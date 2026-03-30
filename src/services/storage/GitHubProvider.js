/**
 * GitHub Sync Provider
 * Uses Personal Access Tokens and the GitHub REST API
 */

import { eventBus, EVENTS } from '../../utils/eventBus.js';

export class GitHubProvider {
    constructor() {
        this.id = 'github';
        this.accessToken = null;
        this.repo = null;
        this.branch = 'main';
        this.initialized = false;

        // Load config from localStorage
        const stored = localStorage.getItem('sync_github');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                this.accessToken = data.token;
                this.repo = data.repo;
                this.branch = data.branch;
            } catch (e) {
                console.error("Failed to load GitHub state", e);
            }
        }
    }

    async init() {
        this.initialized = true;
    }

    async connect() {
        // Here we prompt for a Personal Access Token
        const token = prompt("Enter your GitHub Personal Access Token (PAT):");
        if (token) {
            this.accessToken = token;
            this._saveState();
            eventBus.emit(EVENTS.SYNC_STATUS_CHANGED);
        }
    }

    async disconnect() {
        this.accessToken = null;
        this.repo = null;
        localStorage.removeItem('sync_github');
        eventBus.emit(EVENTS.SYNC_STATUS_CHANGED);
    }

    isConnected() {
        return !!this.accessToken && !!this.repo;
    }

    setConfig(config) {
        if (config.repo) this.repo = config.repo;
        if (config.branch) this.branch = config.branch;
        this._saveState();
    }

    _saveState() {
        localStorage.setItem('sync_github', JSON.stringify({
            token: this.accessToken,
            repo: this.repo,
            branch: this.branch,
            connected: true
        }));
    }

    async _getSha(path) {
        try {
            const res = await fetch(`https://api.github.com/repos/${this.repo}/contents/${path}?ref=${this.branch}`, {
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (res.status === 404) return null; // File not found
            if (!res.ok) throw new Error("Failed to get SHA");
            const data = await res.json();
            return data.sha;
        } catch (error) {
            console.error('GitHub API Error:', error);
            return null;
        }
    }

    async uploadFile(note) {
        if (!this.isConnected()) return;

        try {
            const fileName = `${note.title || 'Untitled'}.md`;
            const content = btoa(unescape(encodeURIComponent(note.content || ''))); // Base64 encode

            const currentSha = await this._getSha(fileName);

            const payload = {
                message: `Auto-sync: update ${fileName} via Markups`,
                content: content,
                branch: this.branch
            };

            if (currentSha) {
                payload.sha = currentSha;
            }

            const res = await fetch(`https://api.github.com/repos/${this.repo}/contents/${fileName}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Failed to sync to GitHub");
            }

            return await res.json();

        } catch (error) {
            console.error('GitHub Sync Error:', error);
            throw error;
        }
    }
}
