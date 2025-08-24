class BookmarkViewer {
  constructor() {
    this.bookmarks = [];
    this.folders = new Set();
    this.faviconCache = new Map();
    
    // Add global error handler to prevent popup from closing
    window.addEventListener('error', (event) => {
      console.error('Global error caught:', event.error);
      this.showError(`Unexpected error: ${event.error?.message || 'Unknown error'}`);
      event.preventDefault();
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.showError(`Promise error: ${event.reason?.message || event.reason}`);
      event.preventDefault();
    });

    try {
      this.initializeEventListeners();
      this.loadPersistedBookmarks();
      console.log('BookmarkViewer initialized successfully');
    } catch (error) {
      console.error('Error initializing BookmarkViewer:', error);
      this.showError(`Failed to initialize extension: ${error.message}`);
    }
  }

  initializeEventListeners() {
    const loadChromeBookmarks = document.getElementById('loadChromeBookmarks');
    const fileInput = document.getElementById('fileInput');
    const clearButton = document.getElementById('clearButton');
    const uploadSectionHeader = document.getElementById('uploadSectionHeader');
    const exportButton = document.getElementById('exportButton');
    const searchInput = document.getElementById('searchInput');

    loadChromeBookmarks.addEventListener('click', () => this.loadChromeBookmarks());
    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    clearButton.addEventListener('click', () => this.clearBookmarks());
    uploadSectionHeader.addEventListener('click', () => this.toggleAccordion());
    exportButton.addEventListener('click', () => this.exportBookmarks());

    // Debounce search to reduce frequent filtering on large lists
    const debouncedFilter = this.debounce((query) => this.filterBookmarks(query), 250);
    searchInput.addEventListener('input', (e) => debouncedFilter(e.target.value));
  }

  // Generic debounce utility
  debounce(func, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // Build a simple search index to speed up filtering
  buildSearchIndex() {
    try {
      if (!Array.isArray(this.bookmarks)) {
        console.warn('Bookmarks is not an array, skipping search index build');
        return;
      }
      
      this.bookmarks.forEach((b, index) => {
        try {
          if (b && typeof b === 'object') {
            const title = (b.title || '').toString().toLowerCase();
            const url = (b.url || '').toString().toLowerCase();
            const folder = (b.folder || '').toString().toLowerCase();
            b._search = `${title} ${url} ${folder}`;
          }
        } catch (itemError) {
          console.warn(`Error processing bookmark at index ${index}:`, itemError);
        }
      });
    } catch (error) {
      console.error('Error building search index:', error);
    }
  }

  async loadChromeBookmarks() {
    this.showLoading(true);
    this.hideError();

    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      this.bookmarks = [];
      this.folders = new Set();
      
      this.extractBookmarksFromTree(bookmarkTree);
      this.buildSearchIndex();
      
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

    console.log('Starting file upload:', file.name, file.type, file.size);
    this.showLoading(true);
    this.hideError();

    try {
      const content = await this.readFile(file);
      const fileExtension = file.name.split('.').pop().toLowerCase();
      
      console.log('File read successfully, extension:', fileExtension, 'Content length:', content.length);

      this.bookmarks = [];
      this.folders = new Set();

      if (fileExtension === 'html') {
        console.log('Parsing as HTML bookmarks');
        this.bookmarks = this.parseHTMLBookmarks(content);
      } else if (fileExtension === 'json') {
<<<<<<< HEAD
        console.log('Parsing as JSON bookmarks');
=======
        console.log('Parsing JSON file:', file.name);
        console.log('JSON content preview:', content.substring(0, 500));
>>>>>>> 4677a59 (Update version to 1.1.5 and enhance JSON parsing with improved error handling and logging)
        this.bookmarks = this.parseJSONBookmarks(content);
        console.log('Extracted bookmarks:', this.bookmarks.length);
      } else {
        throw new Error('Unsupported file format. Please use HTML or JSON files.');
      }

      console.log('Bookmarks parsed successfully:', this.bookmarks.length, 'bookmarks found');
      this.buildSearchIndex();

      this.updateFileInfo(file.name, this.bookmarks.length);
      this.renderBookmarks();
      this.updateStats();
      this.showClearButton();
      this.saveBookmarksToStorage(file.name);
      this.minimizeAccordion();

      console.log('File upload completed successfully');

    } catch (error) {
      console.error('File upload error:', error);
<<<<<<< HEAD
      this.showError(`Error loading file: ${error.message}`);
=======
      this.showError(error.message);
>>>>>>> 4677a59 (Update version to 1.1.5 and enhance JSON parsing with improved error handling and logging)
    } finally {
      this.showLoading(false);
    }
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      // Validate file input
      if (!file) {
        reject(new Error('No file provided'));
        return;
      }

      if (!file.type && !file.name) {
        reject(new Error('Invalid file object'));
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const result = e.target.result;
          if (typeof result !== 'string') {
            reject(new Error('File content is not text-readable'));
            return;
          }
          if (result.trim() === '') {
            reject(new Error('File appears to be empty'));
            return;
          }
          resolve(result);
        } catch (error) {
          reject(new Error(`Error processing file content: ${error.message}`));
        }
      };
      
      reader.onerror = (e) => {
        reject(new Error(`Failed to read file: ${e.target.error?.message || 'Unknown error'}`));
      };
      
      reader.onabort = () => {
        reject(new Error('File reading was aborted'));
      };
      
      try {
        reader.readAsText(file);
      } catch (error) {
        reject(new Error(`Failed to start reading file: ${error.message}`));
      }
    });
  }

  parseHTMLBookmarks(html) {
    try {
      if (!html || typeof html !== 'string') {
        throw new Error('Invalid HTML content provided');
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Check for parsing errors
      const parserErrors = doc.querySelectorAll('parsererror');
      if (parserErrors.length > 0) {
        throw new Error('HTML parsing failed - invalid HTML format');
      }

      const bookmarks = [];
      const links = doc.querySelectorAll('a[href]');

      console.log(`Found ${links.length} links in HTML file`);

      links.forEach((link, index) => {
        try {
          const href = link.getAttribute('href');
          const title = link.textContent?.trim() || href;
          
          // Try to find folder context
          let folder = 'Bookmarks';
          let parent = link.parentElement;
          let searchDepth = 0;
          
          while (parent && searchDepth < 10) {
            const folderHeader = parent.querySelector('h3');
            if (folderHeader && folderHeader.textContent) {
              folder = folderHeader.textContent.trim();
              break;
            }
            parent = parent.parentElement;
            searchDepth++;
          }

          if (href && 
              typeof href === 'string' && 
              href.trim() !== '' && 
              href !== '#' && 
              !href.startsWith('javascript:')) {
            bookmarks.push({ 
              title: title || href, 
              url: href.trim(), 
              folder: folder 
            });
            this.folders.add(folder);
          }
        } catch (linkError) {
          console.warn(`Error processing link at index ${index}:`, linkError);
        }
      });

      if (bookmarks.length === 0) {
        throw new Error('No valid bookmarks found in HTML file');
      }

      console.log(`Successfully parsed ${bookmarks.length} bookmarks from HTML`);
      return bookmarks;
      
    } catch (error) {
      console.error('HTML parsing error:', error);
      throw new Error(`Failed to parse HTML bookmarks: ${error.message}`);
    }
  }

  parseJSONBookmarks(jsonString) {
    let data;
    const bookmarks = [];

<<<<<<< HEAD
    // Robust JSON parsing with better error handling
    try {
      data = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error(`Invalid JSON format: ${parseError.message}`);
    }

    // Validate that data exists
    if (!data || (typeof data !== 'object' && !Array.isArray(data))) {
      throw new Error('Invalid bookmark data: Expected object or array');
    }

    const extractBookmarks = (item, folderPath = 'Bookmarks', depth = 0) => {
      // Prevent infinite recursion
      if (depth > 100) {
        console.warn('Maximum recursion depth reached, skipping item');
        return;
      }

      // Validate item exists and is an object
      if (!item || typeof item !== 'object') {
        return;
      }

      // Handle bookmark items (URLs)
      if (item.type === 'url' || item.url) {
        const url = item.url;
        if (url && typeof url === 'string' && url.trim() !== '') {
          bookmarks.push({
            title: item.name || item.title || url,
            url: url.trim(),
            folder: folderPath || 'Bookmarks'
          });
          this.folders.add(folderPath || 'Bookmarks');
        }
        return;
      }

      // Handle folder items
      if (item.type === 'folder' || item.children) {
        const folderName = item.name || item.title || 'Untitled Folder';
        const newFolderPath = folderPath === 'Bookmarks' ? folderName : `${folderPath} > ${folderName}`;
        
        if (Array.isArray(item.children)) {
          item.children.forEach(child => extractBookmarks(child, newFolderPath, depth + 1));
        }
        return;
      }

      // Handle direct bookmark objects (without type field)
      if (item.url && typeof item.url === 'string') {
=======
    const extractBookmarks = (item, folderPath = 'Bookmarks') => {
      // Handle Chrome bookmark format (with type field)
      if (item.type === 'url' && item.url) {
>>>>>>> 4677a59 (Update version to 1.1.5 and enhance JSON parsing with improved error handling and logging)
        bookmarks.push({
          title: item.title || item.name || item.url,
          url: item.url.trim(),
          folder: folderPath || 'Bookmarks'
        });
        this.folders.add(folderPath || 'Bookmarks');
      }
      // Handle simple bookmark objects (with url property)
      else if (item.url && !item.type) {
        bookmarks.push({
          title: item.title || item.name || item.url,
          url: item.url,
          folder: item.folder || folderPath
        });
        this.folders.add(item.folder || folderPath);
      }
      // Handle objects with children but no type (folder-like)
      else if (item.children && Array.isArray(item.children)) {
        const newFolderPath = item.name || item.title || folderPath;
        if (newFolderPath !== folderPath) {
          this.folders.add(newFolderPath);
        }
        item.children.forEach(child => extractBookmarks(child, newFolderPath));
      }
      // Handle nested objects recursively
      else if (typeof item === 'object' && item !== null) {
        Object.values(item).forEach(value => {
          if (Array.isArray(value)) {
            value.forEach(subItem => extractBookmarks(subItem, folderPath));
          } else if (typeof value === 'object' && value !== null) {
            extractBookmarks(value, folderPath);
          }
        });
      }
    };

<<<<<<< HEAD
    try {
      // Handle Chrome/Edge bookmark export format
      if (data.roots && typeof data.roots === 'object') {
        Object.values(data.roots).forEach(root => {
          if (root && typeof root === 'object' && Array.isArray(root.children)) {
            root.children.forEach(item => extractBookmarks(item, root.name || 'Bookmarks'));
          }
        });
      }
      // Handle array format
      else if (Array.isArray(data)) {
        data.forEach(item => extractBookmarks(item));
      }
      // Handle single object format
      else if (typeof data === 'object') {
        extractBookmarks(data);
      }
    } catch (extractError) {
      console.error('Error extracting bookmarks:', extractError);
      throw new Error(`Failed to extract bookmarks: ${extractError.message}`);
    }

    if (bookmarks.length === 0) {
      throw new Error('No valid bookmarks found in the file. Please check the format.');
=======
    // Handle Chrome bookmark export format
    if (data.roots) {
      Object.values(data.roots).forEach(root => {
        if (root.children) {
          root.children.forEach(item => extractBookmarks(item, root.name || 'Bookmarks'));
        }
      });
    }
    // Handle simple array of bookmarks
    else if (Array.isArray(data)) {
      data.forEach(item => extractBookmarks(item));
    }
    // Handle single bookmark object or other formats
    else {
      extractBookmarks(data);
>>>>>>> 4677a59 (Update version to 1.1.5 and enhance JSON parsing with improved error handling and logging)
    }

    // Log for debugging
    console.log(`Parsed ${bookmarks.length} bookmarks from JSON`);
    return bookmarks;
  }

  // Unified renderer with batching for large lists
  renderBookmarks() {
    this.renderListInBatches(this.bookmarks);
  }

  renderFilteredBookmarks(filteredBookmarks) {
    this.renderListInBatches(filteredBookmarks);
  }

  createBookmarkCard(bookmark) {
    const card = document.createElement('div');
    card.className = 'bookmark-card';
    card.innerHTML = `
      <div class="bookmark-title">
        <img src="${this.getFaviconUrl(bookmark.url)}" loading="lazy" class="bookmark-favicon" alt="favicon" onerror="this.style.display='none'">
        <span class="bookmark-title-text">${this.escapeHtml(bookmark.title)}</span>
      </div>
      <a href="${bookmark.url}" target="_blank" rel="noopener noreferrer" class="bookmark-url">
        ${this.escapeHtml(bookmark.url)}
      </a>
      ${bookmark.folder ? `<div class=\"bookmark-folder\">${this.escapeHtml(bookmark.folder)}</div>` : ''}
    `;
    return card;
  }

  renderListInBatches(list) {
    const container = document.getElementById('bookmarksContainer');
    const emptyState = document.getElementById('emptyState');

    container.innerHTML = '';

    if (!list || list.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    const batchSize = 200;
    let index = 0;

    const renderChunk = () => {
      const frag = document.createDocumentFragment();
      const end = Math.max(Math.min(index + batchSize, list.length), index);
      for (; index < end; index++) {
        frag.appendChild(this.createBookmarkCard(list[index]));
      }
      container.appendChild(frag);

      if (index < list.length) {
        requestAnimationFrame(renderChunk);
      }
    };

    requestAnimationFrame(renderChunk);
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
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
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
      if (this.faviconCache.has(domain)) return this.faviconCache.get(domain);
      const iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
      this.faviconCache.set(domain, iconUrl);
      return iconUrl;
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
        this.buildSearchIndex();
        
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

  filterBookmarks(query) {
    const q = (query || '').toLowerCase();
    if (!q) {
      // Render full list when query is cleared
      this.renderBookmarks();
      return;
    }
    const filteredBookmarks = this.bookmarks.filter(b => b._search && b._search.includes(q));
    this.renderFilteredBookmarks(filteredBookmarks);
  }

  // ...existing code...
}

// Initialize the bookmark viewer when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing BookmarkViewer...');
  try {
    window.bookmarkViewer = new BookmarkViewer();
    console.log('BookmarkViewer created successfully');
  } catch (error) {
    console.error('Failed to create BookmarkViewer:', error);
    // Show error in the UI if possible
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
      errorDiv.textContent = `Initialization failed: ${error.message}`;
      errorDiv.style.display = 'block';
    }
  }
});
