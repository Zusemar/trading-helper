class TagsManagerPage {
    constructor() {
        this.tags = [];
        this.lastUpdate = null;
        this.init();
    }

    init() {
        this.loadTags();
        this.setupEventListeners();
        this.renderTags();
        this.updateStats();
    }

    setupEventListeners() {
        const addBtn = document.getElementById('addBtn');
        const tagInput = document.getElementById('tagInput');
        const clearBtn = document.getElementById('clearBtn');
        const exportBtn = document.getElementById('exportBtn');
        const importBtn = document.getElementById('importBtn');
        const importFile = document.getElementById('importFile');

        // Add tag on button click
        addBtn.addEventListener('click', () => this.addTag());

        // Add tag on Enter key
        tagInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTag();
            }
        });

        // Clear all tags
        clearBtn.addEventListener('click', () => this.clearAllTags());

        // Export tags
        exportBtn.addEventListener('click', () => this.exportTags());

        // Import tags
        importBtn.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', (e) => this.importTags(e));

        // Auto-focus input on page load
        tagInput.focus();

        // Add input validation
        tagInput.addEventListener('input', (e) => {
            const value = e.target.value;
            // Remove @ if user types it
            if (value.startsWith('@')) {
                e.target.value = value.substring(1);
            }
            // Limit to 15 characters
            if (value.length > 15) {
                e.target.value = value.substring(0, 15);
            }
        });
    }

    addTag() {
        const tagInput = document.getElementById('tagInput');
        const tag = tagInput.value.trim();

        if (!tag) {
            this.showNotification('Пожалуйста, введите имя пользователя', 'error');
            return;
        }

        // Clean the tag (remove @ if present and extra spaces)
        const cleanTag = tag.replace(/^@/, '').toLowerCase();

        if (cleanTag.length < 2) {
            this.showNotification('Имя пользователя должно содержать минимум 2 символа', 'error');
            return;
        }

        if (cleanTag.length > 15) {
            this.showNotification('Имя пользователя не может быть длиннее 15 символов', 'error');
            return;
        }

        if (this.tags.includes(cleanTag)) {
            this.showNotification('Этот пользователь уже есть в вашем списке', 'error');
            return;
        }

        // Add tag to array
        this.tags.push(cleanTag);
        
        // Clear input
        tagInput.value = '';
        
        // Update last update time
        this.lastUpdate = new Date();
        
        // Re-render tags and stats
        this.renderTags();
        this.updateStats();
        
        // Show success message
        this.showNotification(`@${cleanTag} успешно добавлен`, 'success');
        
        // Auto-save
        this.saveTags();
    }

    removeTag(tagToRemove) {
        this.tags = this.tags.filter(tag => tag !== tagToRemove);
        this.lastUpdate = new Date();
        this.renderTags();
        this.updateStats();
        this.showNotification(`@${tagToRemove} удален из списка`, 'info');
        this.saveTags();
    }

    renderTags() {
        const container = document.getElementById('tagsContainer');
        const tagCount = document.getElementById('tagCount');

        // Update tag count
        tagCount.textContent = `${this.tags.length} ${this.getTagCountText(this.tags.length)}`;

        if (this.tags.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <h4>Пока нет тегов</h4>
                    <p>Добавьте своих любимых авторов X.com, чтобы начать</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.tags.map(tag => `
            <div class="tag-item" data-tag="${tag}">
                <span class="tag-text">${tag}</span>
                <button class="delete-btn" onclick="tagsManagerPage.removeTag('${tag}')" title="Удалить @${tag}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
        `).join('');
    }

    getTagCountText(count) {
        if (count === 0) return 'тегов';
        if (count === 1) return 'тег';
        if (count >= 2 && count <= 4) return 'тега';
        return 'тегов';
    }

    updateStats() {
        const totalTags = document.getElementById('totalTags');
        const activeTags = document.getElementById('activeTags');
        const lastUpdate = document.getElementById('lastUpdate');

        totalTags.textContent = this.tags.length;
        activeTags.textContent = this.tags.length;

        if (this.lastUpdate) {
            lastUpdate.textContent = this.formatDate(this.lastUpdate);
        } else {
            lastUpdate.textContent = 'Никогда';
        }
    }

    formatDate(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Только что';
        if (minutes < 60) return `${minutes} мин назад`;
        if (hours < 24) return `${hours} ч назад`;
        if (days < 7) return `${days} дн назад`;
        
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async saveTags() {
        try {
            await chrome.storage.sync.set({ 
                'xcom_tags': this.tags,
                'last_update': this.lastUpdate ? this.lastUpdate.toISOString() : null
            });
        } catch (error) {
            console.error('Error saving tags:', error);
            this.showNotification('Ошибка при сохранении тегов', 'error');
        }
    }

    async loadTags() {
        try {
            const result = await chrome.storage.sync.get(['xcom_tags', 'last_update']);
            this.tags = result.xcom_tags || [];
            this.lastUpdate = result.last_update ? new Date(result.last_update) : null;
        } catch (error) {
            console.error('Error loading tags:', error);
            this.tags = [];
            this.lastUpdate = null;
        }
    }

    clearAllTags() {
        if (this.tags.length === 0) {
            this.showNotification('Нет тегов для удаления', 'info');
            return;
        }

        if (confirm('Вы уверены, что хотите удалить все теги? Это действие нельзя отменить.')) {
            this.tags = [];
            this.lastUpdate = new Date();
            this.renderTags();
            this.updateStats();
            this.saveTags();
            this.showNotification('Все теги удалены', 'info');
        }
    }

    exportTags() {
        if (this.tags.length === 0) {
            this.showNotification('Нет тегов для экспорта', 'info');
            return;
        }

        const data = {
            tags: this.tags,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `xcom-tags-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('Теги успешно экспортированы', 'success');
    }

    importTags(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const importedTags = data.tags || [];

                if (!Array.isArray(importedTags) || importedTags.length === 0) {
                    this.showNotification('Файл не содержит валидных тегов', 'error');
                    return;
                }

                // Merge tags (avoid duplicates)
                const newTags = importedTags.filter(tag => !this.tags.includes(tag));
                this.tags = [...this.tags, ...newTags];
                this.lastUpdate = new Date();

                this.renderTags();
                this.updateStats();
                this.saveTags();

                this.showNotification(
                    `Импортировано ${newTags.length} новых тегов из ${importedTags.length}`, 
                    'success'
                );
            } catch (error) {
                console.error('Error importing tags:', error);
                this.showNotification('Ошибка при импорте файла', 'error');
            }
        };

        reader.readAsText(file);
        event.target.value = ''; // Reset file input
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        
        // Remove existing classes
        notification.className = 'notification';
        
        // Add new classes
        notification.classList.add(type, 'show');
        notification.textContent = message;

        // Hide notification after 4 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 4000);
    }

    // Get tags for use in content script
    getTags() {
        return this.tags;
    }
}

// Initialize the tags manager when the page loads
let tagsManagerPage;
document.addEventListener('DOMContentLoaded', () => {
    tagsManagerPage = new TagsManagerPage();
});

// Export for debugging
window.tagsManagerPage = tagsManagerPage; 