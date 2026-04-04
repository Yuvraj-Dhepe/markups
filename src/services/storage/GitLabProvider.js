/**
 * GitLab Sync Provider
 * Uses Personal Access Tokens and the GitLab REST API
 */

import { eventBus, EVENTS } from '../../utils/eventBus.js';

export class GitLabProvider {
    constructor() {
        this.id = 'gitlab';
        this.accessToken = null;
        this.repoId = null; // Can be ID or URL-encoded path like 'namespace%2Fproject'
        this.branch = 'main';
        this.initialized = false;

        // Load config from localStorage
        const stored = localStorage.getItem('sync_gitlab');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                this.accessToken = data.token;
                this.repoId = data.repoId;
                this.branch = data.branch;
            } catch (e) {
                console.error("Failed to load GitLab state", e);
            }
        }
    }

    async init() {
        this.initialized = true;
    }

    async connect() {
        // Here we prompt for a Personal Access Token
        const token = prompt("Enter your GitLab Personal Access Token (PAT):");
        if (token) {
            this.accessToken = token;
            this._saveState();
            eventBus.emit(EVENTS.SYNC_STATUS_CHANGED);
        }
    }

    async disconnect() {
        this.accessToken = null;
        this.repoId = null;
        localStorage.removeItem('sync_gitlab');
        eventBus.emit(EVENTS.SYNC_STATUS_CHANGED);
    }

    isConnected() {
        return !!this.accessToken && !!this.repoId;
    }

    setConfig(config) {
        if (config.repo) {
            // Encode the repo path for GitLab API
            this.repoId = encodeURIComponent(config.repo);
            this._saveState();
        }
        if (config.branch) {
            this.branch = config.branch;
            this._saveState();
        }
    }

    _saveState() {
        localStorage.setItem('sync_gitlab', JSON.stringify({
            token: this.accessToken,
            repoId: this.repoId,
            branch: this.branch,
            connected: true
        }));
    }

    async _checkFileExists(filePath) {
        try {
            const url = `https://gitlab.com/api/v4/projects/${this.repoId}/repository/files/${encodeURIComponent(filePath)}?ref=${this.branch}`;
            const res = await fetch(url, {
                headers: { 'Private-Token': this.accessToken }
            });
            return res.ok;
        } catch (error) {
            return false;
        }
    }

    async uploadFile(note) {
        if (!this.isConnected()) return;

        try {
            const fileName = `${note.title || 'Untitled'}.md`;
            const content = note.content || '';
            const encodedFilePath = encodeURIComponent(fileName);

            const exists = await this._checkFileExists(fileName);
            const method = exists ? 'PUT' : 'POST';

            const url = `https://gitlab.com/api/v4/projects/${this.repoId}/repository/files/${encodedFilePath}`;

            const payload = {
                branch: this.branch,
                author_email: "markups@example.com",
                author_name: "Markups Auto Sync",
                content: content,
                commit_message: `Auto-sync: update ${fileName} via Markups`
            };

            const res = await fetch(url, {
                method: method,
                headers: {
                    'Private-Token': this.accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Failed to sync to GitLab");
            }

            return await res.json();

        } catch (error) {
            console.error('GitLab Sync Error:', error);
            throw error;
        }
    }
}
