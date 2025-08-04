class BookmarkViewer {
  constructor() {
    this.bookmarks = [];
    this.folders = new Set();
    this.initializeEventListeners();
    this.loadPersistedBookmarks();
  }

  initializeEventListeners() {
    const loadChromeBookmarks = document.getElementById('loadChromeBookmarks');
    const fileInput = document.getElementById('fileInput');
    const clearButton = document.getElementById('clearButton');
    const uploadSectionHeader = document.getElementById('uploadSectionHeader');
    const exportButton = document.getElementById('exportButton');

    loadChromeBookmarks.addEventListener('click', () => this.loadChromeBookmarks());
    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    clearButton.addEventListener('click', () => this.clearBookmarks());
    uploadSectionHeader.addEventListener('click', () => this.toggleAccordion());
    exportButton.addEventListener('click', () => this.exportBookmarks());
  }

  async loadChromeBookmarks() {
    this.showLoading(true);
    this.hideError();

    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      // Only reset bookmarks and folders if starting fresh
      this.bookmarks = [];
      this.folders = new Set();
      
      this.extractBookmarksFromTree(bookmarkTree);
      
      this.updateFileInfo('Browser Bookmarks', this.bookmarks.length);
      this.renderBookmarks();
      this.updateStats();
      this.showClearButton();
      this.saveBookmarksToStorage('Browser Bookmarks');
      this.minimizeAccordion();
      
    } catch (error) {
      this.showError('Failed to load browser bookmarks: ' + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  extractBookmarksFromTree(tree, folderPath = '') {
    tree.forEach(node => {
      if (node.children) {
        // This is a folder
        const currentPath = folderPath ? `${folderPath} > ${node.title}` : node.title;
        this.folders.add(currentPath);
        this.extractBookmarksFromTree(node.children, currentPath);
      } else if (node.url) {
        // This is a bookmark
        this.bookmarks.push({
          title: node.title || node.url,
          url: node.url,
          folder: folderPath || 'Bookmarks'
        });
      }
    });
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    this.showLoading(true);
    this.hideError();

    try {
      const content = await this.readFile(file);
      const fileExtension = file.name.split('.').pop().toLowerCase();

      // Reset bookmarks and folders when loading new file
      this.bookmarks = [];
      this.folders = new Set();

      if (fileExtension === 'html') {
        this.bookmarks = this.parseHTMLBookmarks(content);
      } else if (fileExtension === 'json') {
        this.bookmarks = this.parseJSONBookmarks(content);
      } else {
        throw new Error('Unsupported file format. Please use HTML or JSON files.');
      }

      this.updateFileInfo(file.name, this.bookmarks.length);
      this.renderBookmarks();
      this.updateStats();
      this.showClearButton();
      this.saveBookmarksToStorage(file.name);
      this.minimizeAccordion();

    } catch (error) {
      this.showError(error.message);
    } finally {
      this.showLoading(false);
    }
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  parseHTMLBookmarks(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const bookmarks = [];
    const links = doc.querySelectorAll('a[href]');

    links.forEach(link => {
      const href = link.getAttribute('href');
      const title = link.textContent.trim() || href;
      
      // Try to find folder context
      let folder = 'Bookmarks';
      let parent = link.parentElement;
      while (parent) {
        const folderHeader = parent.querySelector('h3');
        if (folderHeader) {
          folder = folderHeader.textContent.trim();
          break;
        }
        parent = parent.parentElement;
      }

      if (href && href !== '#' && !href.startsWith('javascript:')) {
        bookmarks.push({ title, url: href, folder });
        this.folders.add(folder);
      }
    });

    return bookmarks;
  }

  parseJSONBookmarks(jsonString) {
    const data = JSON.parse(jsonString);
    const bookmarks = [];

    const extractBookmarks = (item, folderPath = 'Bookmarks') => {
      if (item.type === 'url' && item.url) {
        bookmarks.push({
          title: item.name || item.title || item.url,
          url: item.url,
          folder: folderPath
        });
        this.folders.add(folderPath);
      } else if (item.type === 'folder' && item.children) {
        const newFolderPath = folderPath === 'Bookmarks' ? item.name : `${folderPath} > ${item.name}`;
        item.children.forEach(child => extractBookmarks(child, newFolderPath));
      }
    };

    // Handle different JSON structures
    if (data.roots) {
      // Chrome bookmark format
      Object.values(data.roots).forEach(root => {
        if (root.children) {
          root.children.forEach(item => extractBookmarks(item, root.name || 'Bookmarks'));
        }
      });
    } else if (Array.isArray(data)) {
      // Simple array format
      data.forEach(item => extractBookmarks(item));
    } else {
      // Single object or other format
      extractBookmarks(data);
    }

    return bookmarks;
  }

  renderBookmarks() {
    const container = document.getElementById('bookmarksContainer');
    const emptyState = document.getElementById('emptyState');

    if (this.bookmarks.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    
    container.innerHTML = this.bookmarks.map(bookmark => `
      <div class="bookmark-card">
        <div class="bookmark-title">
          <img src="${this.getFaviconUrl(bookmark.url)}" class="bookmark-favicon" alt="favicon" onerror="this.style.display='none'">
          <span class="bookmark-title-text">${this.escapeHtml(bookmark.title)}</span>
        </div>
        <a href="${bookmark.url}" target="_blank" rel="noopener noreferrer" class="bookmark-url">
          ${this.escapeHtml(bookmark.url)}
        </a>
        ${bookmark.folder ? `<div class="bookmark-folder">${this.escapeHtml(bookmark.folder)}</div>` : ''}
      </div>
    `).join('');
  }

  updateStats() {
    const statsContainer = document.getElementById('stats');
    const totalCount = document.getElementById('totalCount');
    const folderCount = document.getElementById('folderCount');

    totalCount.textContent = this.bookmarks.length;
    folderCount.textContent = this.folders.size;
    
    statsContainer.style.display = this.bookmarks.length > 0 ? 'flex' : 'none';
  }

  updateFileInfo(fileName, count) {
    const fileInfo = document.getElementById('fileInfo');
    fileInfo.textContent = `Loaded: ${fileName} (${count} bookmarks found)`;
  }

  showClearButton() {
    const clearButton = document.getElementById('clearButton');
    clearButton.style.display = this.bookmarks.length > 0 ? 'inline-block' : 'none';
  }

  clearBookmarks() {
    this.bookmarks = [];
    this.folders.clear();
    document.getElementById('fileInput').value = '';
    document.getElementById('fileInfo').textContent = '';
    document.getElementById('bookmarksContainer').innerHTML = '';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('stats').style.display = 'none';
    document.getElementById('clearButton').style.display = 'none';
    document.getElementById('status').textContent = 'Extension loaded successfully!';
    document.getElementById('status').style.backgroundColor = '#e8f5e8';
    document.getElementById('status').style.color = '#2e7d32';
    this.hideError();
    this.clearPersistedBookmarks();
    this.expandAccordion();
  }

  toggleAccordion() {
    const uploadSection = document.getElementById('uploadSection');
    const uploadSectionContent = document.getElementById('uploadSectionContent');
    const accordionToggle = document.getElementById('accordionToggle');
    
    if (uploadSectionContent.classList.contains('expanded')) {
      uploadSectionContent.classList.remove('expanded');
      accordionToggle.classList.remove('expanded');
      accordionToggle.textContent = '▼';
    } else {
      uploadSectionContent.classList.add('expanded');
      accordionToggle.classList.add('expanded');
      accordionToggle.textContent = '▲';
    }
  }

  minimizeAccordion() {
    const uploadSection = document.getElementById('uploadSection');
    const uploadSectionContent = document.getElementById('uploadSectionContent');
    const accordionToggle = document.getElementById('accordionToggle');
    
    uploadSection.classList.add('has-bookmarks');
    uploadSectionContent.classList.remove('expanded');
    accordionToggle.classList.remove('expanded');
    accordionToggle.textContent = '▼';
  }

  expandAccordion() {
    const uploadSection = document.getElementById('uploadSection');
    const uploadSectionContent = document.getElementById('uploadSectionContent');
    const accordionToggle = document.getElementById('accordionToggle');
    
    uploadSection.classList.remove('has-bookmarks');
    uploadSectionContent.classList.add('expanded');
    accordionToggle.classList.add('expanded');
    accordionToggle.textContent = '▲';
  }

  showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
  }

  showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  hideError() {
    document.getElementById('error').style.display = 'none';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getFaviconUrl(url) {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch (error) {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik04IDRMMTIgOEw4IDEyTDQgOEw4IDRaIiBmaWxsPSIjQ0NDQ0NDIi8+Cjwvc3ZnPgo=';
    }
  }

  loadPersistedBookmarks() {
    try {
      const savedBookmarks = localStorage.getItem('bookmarkViewer_bookmarks');
      const savedFolders = localStorage.getItem('bookmarkViewer_folders');
      const savedSource = localStorage.getItem('bookmarkViewer_source');
      
      if (savedBookmarks) {
        this.bookmarks = JSON.parse(savedBookmarks);
        this.folders = new Set(JSON.parse(savedFolders || '[]'));
        
        if (this.bookmarks.length > 0) {
          this.updateFileInfo(savedSource || 'Saved Bookmarks', this.bookmarks.length);
          this.renderBookmarks();
          this.updateStats();
          this.showClearButton();
          this.minimizeAccordion();
        }
      }
    } catch (error) {
      console.error('Failed to load persisted bookmarks:', error);
    }
  }

  saveBookmarksToStorage(source) {
    try {
      localStorage.setItem('bookmarkViewer_bookmarks', JSON.stringify(this.bookmarks));
      localStorage.setItem('bookmarkViewer_folders', JSON.stringify([...this.folders]));
      localStorage.setItem('bookmarkViewer_source', source);
    } catch (error) {
      console.error('Failed to save bookmarks:', error);
    }
  }

  clearPersistedBookmarks() {
    try {
      localStorage.removeItem('bookmarkViewer_bookmarks');
      localStorage.removeItem('bookmarkViewer_folders');
      localStorage.removeItem('bookmarkViewer_source');
    } catch (error) {
      console.error('Failed to clear persisted bookmarks:', error);
    }
  }

  exportBookmarks() {
    if (this.bookmarks.length === 0) {
      alert('No bookmarks to export.');
      return;
    }

    const dataStr = JSON.stringify(this.bookmarks, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'bookmarks.json';
    a.click();

    URL.revokeObjectURL(url);
  }
}

// Initialize the bookmark viewer when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new BookmarkViewer();
});
