/**
 * Settings Modal Component
 * Displays application settings including Sync configuration
 * @module ui/settings
 */

import { modal } from '../modal/index.js';
import { eventBus, EVENTS } from '../../utils/eventBus.js';
import { syncManager } from '../../services/storage/SyncManager.js';

export class SettingsModal {
    static instance = null;

    constructor() {
        if (SettingsModal.instance) {
            return SettingsModal.instance;
        }
        SettingsModal.instance = this;
        this.activeTab = 'sync';
    }

    /**
     * Open the settings modal
     */
    open() {
        const content = this._createContent();

        this.modalId = modal.open({
            title: 'Settings',
            content,
            size: 'lg',
            className: 'settings-modal',
            onOpen: (modalElement, bodyElement) => {
                this._attachEventListeners(bodyElement);
                this._renderTabContent(bodyElement);
            }
        });
    }

    /**
     * Create the modal content HTML
     * @private
     * @returns {HTMLElement}
     */
    _createContent() {
        const container = document.createElement('div');
        container.className = 'settings-container';
        container.innerHTML = `
            <style>
                .settings-container {
                    display: flex;
                    height: 60vh;
                    min-height: 400px;
                    margin: -20px; /* Counteract modal body padding */
                }
                .settings-sidebar {
                    width: 200px;
                    border-right: 1px solid var(--border-color, #eee);
                    padding: 20px 0;
                    background: var(--sidebar-bg, #f9f9f9);
                }
                .settings-tab {
                    display: block;
                    width: 100%;
                    text-align: left;
                    padding: 12px 20px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--text-color, #333);
                    font-size: 14px;
                    transition: background 0.2s;
                }
                .settings-tab:hover {
                    background: var(--hover-bg, #eee);
                }
                .settings-tab.active {
                    background: var(--active-bg, #e0e7ff);
                    color: var(--primary-color, #4f46e5);
                    font-weight: 500;
                    border-right: 3px solid var(--primary-color, #4f46e5);
                }
                .settings-content-area {
                    flex: 1;
                    padding: 30px;
                    overflow-y: auto;
                }
                .settings-section-title {
                    margin-top: 0;
                    margin-bottom: 20px;
                    font-size: 1.25rem;
                    border-bottom: 1px solid var(--border-color, #eee);
                    padding-bottom: 10px;
                }
                .sync-provider-card {
                    border: 1px solid var(--border-color, #ddd);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .provider-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .provider-icon {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--bg-color, #f0f0f0);
                    border-radius: 4px;
                    font-size: 18px;
                }
                .provider-details h4 {
                    margin: 0 0 4px 0;
                    font-size: 16px;
                }
                .provider-details p {
                    margin: 0;
                    font-size: 12px;
                    color: var(--text-muted, #666);
                }
                .provider-status {
                    font-size: 12px;
                    padding: 4px 8px;
                    border-radius: 12px;
                    background: var(--bg-color, #eee);
                    margin-top: 4px;
                    display: inline-block;
                }
                .status-connected {
                    background: #dcfce7;
                    color: #166534;
                }
                .status-disconnected {
                    background: #fee2e2;
                    color: #991b1b;
                }
                .btn-connect {
                    padding: 8px 16px;
                    border-radius: 6px;
                    border: 1px solid var(--border-color, #ccc);
                    background: var(--bg-color, #fff);
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                }
                .btn-connect:hover {
                    background: var(--hover-bg, #f9f9f9);
                }
                .btn-disconnect {
                    border-color: #fca5a5;
                    color: #dc2626;
                }
                .btn-disconnect:hover {
                    background: #fef2f2;
                }
                .provider-config {
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px dashed var(--border-color, #eee);
                    width: 100%;
                }
                .config-row {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    margin-bottom: 10px;
                }
                .config-row label {
                    font-size: 12px;
                    font-weight: 500;
                }
                .config-row input {
                    padding: 8px;
                    border: 1px solid var(--border-color, #ccc);
                    border-radius: 4px;
                    font-size: 14px;
                }

                /* Dark mode support */
                @media (prefers-color-scheme: dark) {
                    .settings-sidebar {
                        background: #1f2937;
                        border-color: #374151;
                    }
                    .settings-tab {
                        color: #f3f4f6;
                    }
                    .settings-tab:hover {
                        background: #374151;
                    }
                    .settings-tab.active {
                        background: #374151;
                        color: #60a5fa;
                        border-color: #60a5fa;
                    }
                    .settings-section-title {
                        border-color: #374151;
                    }
                    .sync-provider-card {
                        border-color: #374151;
                    }
                    .provider-icon {
                        background: #374151;
                    }
                    .provider-details p {
                        color: #9ca3af;
                    }
                    .status-connected {
                        background: #064e3b;
                        color: #34d399;
                    }
                    .status-disconnected {
                        background: #7f1d1d;
                        color: #f87171;
                    }
                    .btn-connect {
                        background: #374151;
                        border-color: #4b5563;
                        color: white;
                    }
                    .btn-connect:hover {
                        background: #4b5563;
                    }
                    .btn-disconnect {
                        border-color: #7f1d1d;
                        color: #fca5a5;
                    }
                    .btn-disconnect:hover {
                        background: #7f1d1d;
                    }
                    .provider-config {
                        border-color: #374151;
                    }
                    .config-row input {
                        background: #1f2937;
                        border-color: #4b5563;
                        color: white;
                    }
                }
            </style>

            <div class="settings-sidebar">
                <button class="settings-tab ${this.activeTab === 'general' ? 'active' : ''}" data-tab="general">General</button>
                <button class="settings-tab ${this.activeTab === 'sync' ? 'active' : ''}" data-tab="sync">Cloud Sync</button>
            </div>

            <div class="settings-content-area" id="settings-content-area">
                <!-- Content injected here -->
            </div>
        `;
        return container;
    }

    /**
     * Attach event listeners to the modal
     * @private
     * @param {HTMLElement} bodyElement
     */
    _attachEventListeners(bodyElement) {
        const tabs = bodyElement.querySelectorAll('.settings-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                tabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.activeTab = e.target.dataset.tab;
                this._renderTabContent(bodyElement);
            });
        });

        // Listen for sync status changes to re-render
        this.unsubscribeSyncStatus = eventBus.on(EVENTS.SYNC_STATUS_CHANGED, () => {
            if (this.activeTab === 'sync') {
                this._renderTabContent(bodyElement);
            }
        });

        // Cleanup on close
        const originalOnClose = modal.activeModals.find(m => m.id === this.modalId)?.onClose;
        const modalInfo = modal.activeModals.find(m => m.id === this.modalId);
        if (modalInfo) {
            modalInfo.onClose = () => {
                if (this.unsubscribeSyncStatus) this.unsubscribeSyncStatus();
                if (originalOnClose) originalOnClose();
            };
        }
    }

    /**
     * Render the active tab's content
     * @private
     * @param {HTMLElement} bodyElement
     */
    _renderTabContent(bodyElement) {
        const contentArea = bodyElement.querySelector('#settings-content-area');
        contentArea.innerHTML = '';

        if (this.activeTab === 'general') {
            contentArea.innerHTML = `
                <h3 class="settings-section-title">General Settings</h3>
                <p>General settings configuration will go here.</p>
            `;
        } else if (this.activeTab === 'sync') {
            const syncStatus = syncManager ? syncManager.getStatus() : {
                google_drive: { connected: false },
                github: { connected: false },
                gitlab: { connected: false }
            };

            const providers = [
                {
                    id: 'google_drive',
                    name: 'Google Drive',
                    icon: '📁',
                    desc: 'Sync notes to a folder in your Google Drive',
                    status: syncStatus.google_drive,
                    configHtml: syncStatus.google_drive?.connected ? `
                        <div class="config-row">
                            <label>Folder ID / Name</label>
                            <input type="text" id="gdrive-folder" value="${syncStatus.google_drive.folder || 'Markups'}" placeholder="Folder Name">
                        </div>
                    ` : ''
                },
                {
                    id: 'github',
                    name: 'GitHub',
                    icon: '🐙',
                    desc: 'Sync notes as commits to a GitHub repository',
                    status: syncStatus.github,
                    configHtml: syncStatus.github?.connected ? `
                        <div class="config-row">
                            <label>Repository (e.g., username/repo)</label>
                            <input type="text" id="github-repo" value="${syncStatus.github.repo || ''}" placeholder="username/markups-notes">
                        </div>
                        <div class="config-row">
                            <label>Branch</label>
                            <input type="text" id="github-branch" value="${syncStatus.github.branch || 'main'}" placeholder="main">
                        </div>
                    ` : ''
                },
                {
                    id: 'gitlab',
                    name: 'GitLab',
                    icon: '🦊',
                    desc: 'Sync notes as commits to a GitLab repository',
                    status: syncStatus.gitlab,
                    configHtml: syncStatus.gitlab?.connected ? `
                        <div class="config-row">
                            <label>Repository ID or Path</label>
                            <input type="text" id="gitlab-repo" value="${syncStatus.gitlab.repo || ''}" placeholder="username/markups-notes">
                        </div>
                        <div class="config-row">
                            <label>Branch</label>
                            <input type="text" id="gitlab-branch" value="${syncStatus.gitlab.branch || 'main'}" placeholder="main">
                        </div>
                    ` : ''
                }
            ];

            const html = `
                <h3 class="settings-section-title">Cloud Sync</h3>
                <p style="margin-bottom: 20px; color: var(--text-muted, #666); font-size: 14px;">
                    Connect your cloud storage providers to keep your notes synchronized across all your devices.
                </p>

                <div class="sync-providers-list">
                    ${providers.map(p => `
                        <div class="sync-provider-card" style="flex-direction: column; align-items: stretch;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div class="provider-info">
                                    <div class="provider-icon">${p.icon}</div>
                                    <div class="provider-details">
                                        <h4>${p.name}</h4>
                                        <p>${p.desc}</p>
                                        <span class="provider-status ${p.status?.connected ? 'status-connected' : 'status-disconnected'}">
                                            ${p.status?.connected ? 'Connected' : 'Not Connected'}
                                        </span>
                                        ${p.status?.lastSync ? `<span style="font-size: 11px; margin-left: 8px; color: #888;">Last sync: ${new Date(p.status.lastSync).toLocaleString()}</span>` : ''}
                                    </div>
                                </div>
                                <button class="btn-connect ${p.status?.connected ? 'btn-disconnect' : ''}" data-provider="${p.id}" data-action="${p.status?.connected ? 'disconnect' : 'connect'}">
                                    ${p.status?.connected ? 'Disconnect' : 'Connect'}
                                </button>
                            </div>

                            ${p.status?.connected ? `
                                <div class="provider-config">
                                    ${p.configHtml}
                                    <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
                                        <button class="btn-connect btn-save-config" data-provider="${p.id}" style="background: var(--primary-color, #4f46e5); color: white; border: none;">Save Configuration</button>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `;

            contentArea.innerHTML = html;

            // Attach action listeners
            contentArea.querySelectorAll('.btn-connect[data-action]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const providerId = e.target.dataset.provider;
                    const action = e.target.dataset.action;

                    if (action === 'connect') {
                        if (syncManager) await syncManager.connectProvider(providerId);
                    } else {
                        if (syncManager) await syncManager.disconnectProvider(providerId);
                    }
                    this._renderTabContent(bodyElement); // Re-render immediately to reflect state
                });
            });

            // Attach config save listeners
            contentArea.querySelectorAll('.btn-save-config').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const providerId = e.target.dataset.provider;
                    let config = {};

                    if (providerId === 'google_drive') {
                        config.folder = contentArea.querySelector('#gdrive-folder').value;
                    } else if (providerId === 'github') {
                        config.repo = contentArea.querySelector('#github-repo').value;
                        config.branch = contentArea.querySelector('#github-branch').value;
                    } else if (providerId === 'gitlab') {
                        config.repo = contentArea.querySelector('#gitlab-repo').value;
                        config.branch = contentArea.querySelector('#gitlab-branch').value;
                    }

                    if (syncManager) {
                        await syncManager.saveProviderConfig(providerId, config);
                        import('../../ui/toast/index.js').then(({ toast }) => {
                            toast.success(`${providers.find(p => p.id === providerId).name} configuration saved.`);
                        });
                    }
                });
            });
        }
    }
}

export const settingsModal = new SettingsModal();
export default settingsModal;