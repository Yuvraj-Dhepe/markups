/**
 * Sync Manager
 * Orchestrates syncing across multiple cloud providers
 * @module services/storage/SyncManager
 */

import { eventBus, EVENTS } from '../../utils/eventBus.js';
import { GoogleDriveProvider } from './GoogleDriveProvider.js';
import { GitHubProvider } from './GitHubProvider.js';
import { GitLabProvider } from './GitLabProvider.js';

class SyncManager {
    static instance = null;

    constructor() {
        if (SyncManager.instance) {
            return SyncManager.instance;
        }

        this.providers = {
            google_drive: new GoogleDriveProvider(),
            github: new GitHubProvider(),
            gitlab: new GitLabProvider()
        };

        this.status = {
            google_drive: { connected: false, lastSync: null },
            github: { connected: false, lastSync: null },
            gitlab: { connected: false, lastSync: null }
        };

        // Attempt initialization from local storage state
        this._loadStatus();
        this._initProviders();

        SyncManager.instance = this;
    }

    async _initProviders() {
        for (const [id, provider] of Object.entries(this.providers)) {
            try {
                await provider.init();
                this.status[id].connected = provider.isConnected();
            } catch (error) {
                console.error(`Failed to initialize ${id}:`, error);
            }
        }
        eventBus.emit(EVENTS.SYNC_STATUS_CHANGED, this.status);
    }

    _loadStatus() {
        try {
            const storedStatus = localStorage.getItem('sync_status');
            if (storedStatus) {
                const parsed = JSON.parse(storedStatus);
                // Merge loaded status with defaults
                for (const key in this.status) {
                    if (parsed[key]) {
                        this.status[key] = { ...this.status[key], ...parsed[key] };
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load sync status', e);
        }
    }

    _saveStatus() {
        try {
            localStorage.setItem('sync_status', JSON.stringify(this.status));
        } catch (e) {
            console.error('Failed to save sync status', e);
        }
    }

    getStatus() {
        // Also fetch dynamic config values from providers to display in settings UI
        return {
            google_drive: {
                ...this.status.google_drive,
                connected: this.providers.google_drive.isConnected(),
                folder: this.providers.google_drive.folderId
            },
            github: {
                ...this.status.github,
                connected: this.providers.github.isConnected(),
                repo: this.providers.github.repo,
                branch: this.providers.github.branch
            },
            gitlab: {
                ...this.status.gitlab,
                connected: this.providers.gitlab.isConnected(),
                repo: this.providers.gitlab.repoId,
                branch: this.providers.gitlab.branch
            }
        };
    }

    async connectProvider(providerId) {
        const provider = this.providers[providerId];
        if (provider) {
            try {
                await provider.connect();
                this.status[providerId].connected = provider.isConnected();
                this._saveStatus();
                eventBus.emit(EVENTS.SYNC_STATUS_CHANGED, this.status);
            } catch (error) {
                console.error(`Error connecting to ${providerId}:`, error);
            }
        }
    }

    async disconnectProvider(providerId) {
        const provider = this.providers[providerId];
        if (provider) {
            try {
                await provider.disconnect();
                this.status[providerId].connected = false;
                this.status[providerId].lastSync = null;
                this._saveStatus();
                eventBus.emit(EVENTS.SYNC_STATUS_CHANGED, this.status);
            } catch (error) {
                console.error(`Error disconnecting from ${providerId}:`, error);
            }
        }
    }

    async saveProviderConfig(providerId, config) {
        const provider = this.providers[providerId];
        if (provider && provider.setConfig) {
            provider.setConfig(config);
            this.status[providerId].connected = provider.isConnected();
            this._saveStatus();
            eventBus.emit(EVENTS.SYNC_STATUS_CHANGED, this.status);
        }
    }

    /**
     * Upload a note to all connected cloud providers
     * @param {Object} note The note document to upload
     */
    async uploadAll(note) {
        let anySuccess = false;

        eventBus.emit(EVENTS.SYNC_STARTED);

        const uploadPromises = Object.entries(this.providers).map(async ([id, provider]) => {
            if (provider.isConnected()) {
                try {
                    await provider.uploadFile(note);
                    this.status[id].lastSync = Date.now();
                    anySuccess = true;
                    console.log(`Successfully synced ${note.title} to ${id}`);
                } catch (error) {
                    console.error(`Failed to sync to ${id}:`, error);
                }
            }
        });

        await Promise.allSettled(uploadPromises);

        this._saveStatus();

        if (anySuccess) {
            eventBus.emit(EVENTS.SYNC_COMPLETE);
            eventBus.emit(EVENTS.SYNC_STATUS_CHANGED, this.status);
        } else {
            // Check if ANY providers were connected. If so, and no success, error.
            const anyConnected = Object.values(this.providers).some(p => p.isConnected());
            if (anyConnected) {
                eventBus.emit(EVENTS.SYNC_ERROR);
            }
        }
    }
}

export const syncManager = new SyncManager();
export default syncManager;