class MoESettings {
    constructor() {
        this.baseUrl = window.location.origin;
        this.availableModels = [];
        this.currentSettings = {};
        
        // DOM elements
        this.connectionText = document.getElementById('connectionText');
        this.modelCount = document.getElementById('modelCount');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.settingsForm = document.getElementById('settingsForm');
        this.saveBtn = document.getElementById('saveBtn');
        this.resetBtn = document.getElementById('resetBtn');
        
        // Model select elements
        this.selects = {
            router: document.getElementById('router'),
            creative: document.getElementById('creative'),
            coding: document.getElementById('coding'),
            analysis: document.getElementById('analysis'),
            math: document.getElementById('math'),
            general: document.getElementById('general')
        };
        
        this.initializeEventListeners();
        this.loadModels();
        this.loadSettings();
    }

    initializeEventListeners() {
        // Refresh models button
        this.refreshBtn.addEventListener('click', () => this.loadModels());
        
        // Form submission
        this.settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });
        
        // Reset button
        this.resetBtn.addEventListener('click', () => this.resetSettings());
        
        // Monitor changes to enable/disable save button
        Object.values(this.selects).forEach(select => {
            select.addEventListener('change', () => this.updateSaveButton());
        });
    }

    async loadModels() {
        try {
            this.updateConnectionStatus('loading', 'Loading models...');
            this.refreshBtn.disabled = true;
            
            const response = await fetch(`${this.baseUrl}/api/models`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.availableModels = await response.json();
            this.updateConnectionStatus('connected', 'Connected');
            this.modelCount.textContent = this.availableModels.length;
            
            this.populateModelSelects();
            
        } catch (error) {
            console.error('Error loading models:', error);
            this.updateConnectionStatus('error', 'Connection failed');
            this.modelCount.textContent = '0';
            this.availableModels = [];
        } finally {
            this.refreshBtn.disabled = false;
        }
    }

    updateConnectionStatus(status, text) {
        this.connectionText.textContent = text;
        this.connectionText.className = `status-text ${status}`;
    }

    populateModelSelects() {
        // Clear existing options (except first default option)
        Object.values(this.selects).forEach(select => {
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
        });

        // Add model options
        this.availableModels.forEach(model => {
            Object.values(this.selects).forEach(select => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                select.appendChild(option);
            });
        });

        // Restore selected values
        this.restoreSelections();
        this.updateSaveButton();
    }

    async loadSettings() {
        try {
            const response = await fetch(`${this.baseUrl}/api/settings`);
            if (response.ok) {
                this.currentSettings = await response.json();
                this.restoreSelections();
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    restoreSelections() {
        Object.keys(this.selects).forEach(category => {
            if (this.currentSettings[category]) {
                this.selects[category].value = this.currentSettings[category];
            }
        });
        this.updateSaveButton();
    }

    async saveSettings() {
        try {
            const settings = {};
            Object.keys(this.selects).forEach(category => {
                settings[category] = this.selects[category].value || null;
            });

            // Validate router is selected
            if (!settings.router) {
                alert('Router model is required. Please select a router model.');
                this.selects.router.focus();
                return;
            }

            this.saveBtn.disabled = true;
            this.saveBtn.textContent = '💾 Saving...';

            const response = await fetch(`${this.baseUrl}/api/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            this.currentSettings = result.settings;
            
            // Show success feedback
            this.saveBtn.textContent = '✅ Saved!';
            setTimeout(() => {
                this.saveBtn.textContent = '💾 Save Settings';
                this.updateSaveButton();
            }, 2000);

            // Show success notification
            this.showNotification('Settings saved successfully!', 'success');

        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification(`Error saving settings: ${error.message}`, 'error');
            this.saveBtn.textContent = '💾 Save Settings';
            this.updateSaveButton();
        }
    }

    resetSettings() {
        if (!confirm('Are you sure you want to reset all settings? This will clear all model assignments.')) {
            return;
        }

        Object.values(this.selects).forEach(select => {
            select.value = '';
        });
        
        this.updateSaveButton();
        this.showNotification('Settings reset. Don\'t forget to save!', 'info');
    }

    updateSaveButton() {
        // Check if any settings have changed
        let hasChanges = false;
        Object.keys(this.selects).forEach(category => {
            const currentValue = this.selects[category].value || null;
            const savedValue = this.currentSettings[category] || null;
            if (currentValue !== savedValue) {
                hasChanges = true;
            }
        });

        this.saveBtn.disabled = !hasChanges;
    }

    showNotification(message, type = 'info') {
        // Remove existing notification
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: 'bold',
            zIndex: '1000',
            backgroundColor: type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'
        });

        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    // Utility method to get configuration summary
    getConfigSummary() {
        const configured = Object.keys(this.selects).filter(category => 
            this.selects[category].value
        );
        
        return {
            total: Object.keys(this.selects).length,
            configured: configured.length,
            missing: Object.keys(this.selects).filter(category => 
                !this.selects[category].value
            ),
            hasRouter: !!this.selects.router.value
        };
    }
}

// Initialize settings when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MoESettings();
});