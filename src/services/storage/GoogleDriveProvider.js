/**
 * Google Drive Sync Provider
 * Uses Google Identity Services for client-side OAuth
 */

import { eventBus, EVENTS } from '../../utils/eventBus.js';
import APP_CONFIG from '../../config/app.config.js';

export class GoogleDriveProvider {
    constructor() {
        this.id = 'google_drive';
        this.tokenClient = null;
        this.accessToken = null;
        this.folderId = null;
        this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID'; // Replace with real or env
        this.initialized = false;

        // Load tokens from localStorage
        const stored = localStorage.getItem('sync_gdrive');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                this.accessToken = data.token;
                this.folderId = data.folderId;
            } catch (e) {
                console.error("Failed to load GDrive state", e);
            }
        }
    }

    async init() {
        if (this.initialized) return;

        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = () => {
                this.tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: this.clientId,
                    scope: 'https://www.googleapis.com/auth/drive.file',
                    callback: (tokenResponse) => {
                        if (tokenResponse && tokenResponse.access_token) {
                            this.accessToken = tokenResponse.access_token;
                            this._saveState();
                            eventBus.emit(EVENTS.SYNC_STATUS_CHANGED);
                        }
                    },
                });
                this.initialized = true;
                resolve();
            };
            document.head.appendChild(script);
        });
    }

    async connect() {
        await this.init();
        if (this.tokenClient) {
            this.tokenClient.requestAccessToken({prompt: 'consent'});
        }
    }

    async disconnect() {
        this.accessToken = null;
        this.folderId = null;
        localStorage.removeItem('sync_gdrive');
        eventBus.emit(EVENTS.SYNC_STATUS_CHANGED);
    }

    isConnected() {
        return !!this.accessToken;
    }

    setConfig(config) {
        if (config.folder) {
            this.folderId = config.folder; // Usually name, but ID if resolved
            this._saveState();
        }
    }

    _saveState() {
        localStorage.setItem('sync_gdrive', JSON.stringify({
            token: this.accessToken,
            folderId: this.folderId,
            connected: true
        }));
    }

    async _getFolderId(folderName) {
        if (!folderName) folderName = 'Markups';

        // Search for folder
        const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`);
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
            headers: { 'Authorization': `Bearer ${this.accessToken}` }
        });

        if (!res.ok) {
            if (res.status === 401) {
                this.disconnect(); // Token expired
                throw new Error("Unauthorized");
            }
            throw new Error("Failed to search folder");
        }

        const data = await res.json();
        if (data.files && data.files.length > 0) {
            return data.files[0].id;
        }

        // Create folder
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder'
            })
        });

        const createData = await createRes.json();
        return createData.id;
    }

    async uploadFile(note) {
        if (!this.isConnected()) return;

        try {
            const folderId = await this._getFolderId(this.folderId || 'Markups');
            const fileName = `${note.title || 'Untitled'}.md`;

            // Search if file exists
            const query = encodeURIComponent(`name='${fileName}' and '${folderId}' in parents and trashed=false`);
            const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,modifiedTime)`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            const searchData = await searchRes.json();

            let fileId = null;
            let method = 'POST';
            let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

            if (searchData.files && searchData.files.length > 0) {
                fileId = searchData.files[0].id;
                method = 'PATCH';
                url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
            }

            const metadata = {
                name: fileName,
                mimeType: 'text/markdown',
                parents: method === 'POST' ? [folderId] : undefined
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([note.content], { type: 'text/markdown' }));

            const uploadRes = await fetch(url, {
                method: method,
                headers: { 'Authorization': `Bearer ${this.accessToken}` },
                body: form
            });

            if (!uploadRes.ok) throw new Error("Upload failed");

            return await uploadRes.json();

        } catch (error) {
            console.error('GDrive Sync Error:', error);
            throw error;
        }
    }
}
