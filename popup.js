class BookmarkViewer {
  constructor() {
    this.bookmarks = [];
    this.folders = new Set();
    this.faviconCache = new Map();
    this.renderCache = new Map(); // Cache rendered bookmark elements
    this.intersectionObserver = null; // For lazy loading favicons
    this.initializeTheme();
    this.initializeEventListeners();
    this.setupIntersectionObserver();
    this.loadPersistedBookmarks();
  }

  initializeTheme() {
    // Load saved theme or default to light
    const savedTheme = localStorage.getItem('bookmarkViewer_theme') || 'light';
    this.setTheme(savedTheme);
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
      themeToggle.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }
    localStorage.setItem('bookmarkViewer_theme', theme);
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  initializeEventListeners() {
    const loadChromeBookmarks = document.getElementById('loadChromeBookmarks');
    const fileInput = document.getElementById('fileInput');
    const clearButton = document.getElementById('clearButton');
    const uploadSectionHeader = document.getElementById('uploadSectionHeader');
    const exportButton = document.getElementById('exportButton');
    const searchInput = document.getElementById('searchInput');
    const themeToggle = document.getElementById('themeToggle');

    loadChromeBookmarks.addEventListener('click', () => this.loadChromeBookmarks());
    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    clearButton.addEventListener('click', () => this.clearBookmarks());
    uploadSectionHeader.addEventListener('click', () => this.toggleAccordion());
    exportButton.addEventListener('click', () => this.exportBookmarks());
    themeToggle.addEventListener('click', () => this.toggleTheme());

    // Debounce search to reduce frequent filtering on large lists
    const debouncedFilter = this.debounce((query) => this.filterBookmarks(query), 250);
    searchInput.addEventListener('input', (e) => debouncedFilter(e.target.value));

    // Use event delegation for bookmark clicks (more efficient for large lists)
    const bookmarksContainer = document.getElementById('bookmarksContainer');
    bookmarksContainer.addEventListener('click', (e) => {
      const link = e.target.closest('a.bookmark-url');
      if (link) {
        e.preventDefault();
        chrome.tabs.create({ url: link.href });
      }
    });
  }

  // Generic debounce utility
  debounce(func, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // Setup Intersection Observer for lazy loading favicons
  setupIntersectionObserver() {
    if ('IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target;
              const src = img.getAttribute('data-src');
              if (src) {
                img.src = src;
                img.removeAttribute('data-src');
                this.intersectionObserver.unobserve(img);
              }
            }
          });
        },
        { rootMargin: '50px' } // Load images 50px before they enter viewport
      );
    }
  }

  // Build a simple search index to speed up filtering
  buildSearchIndex() {
    // Use for loop instead of forEach for better performance
    for (let i = 0; i < this.bookmarks.length; i++) {
      const b = this.bookmarks[i];
      const title = (b.title || '').toLowerCase();
      const url = (b.url || '').toLowerCase();
      const folder = (b.folder || '').toLowerCase();
      b._search = `${title} ${url} ${folder}`;
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
    // Use for loop for better performance
    for (let i = 0; i < tree.length; i++) {
      const node = tree[i];
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
    }
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    this.showLoading(true);
    this.hideError();

    try {
      const content = await this.readFile(file);
      const fileExtension = file.name.split('.').pop().toLowerCase();

      this.bookmarks = [];
      this.folders = new Set();

      if (fileExtension === 'html') {
        this.bookmarks = this.parseHTMLBookmarks(content);
      } else if (fileExtension === 'json') {
        console.log('Parsing JSON file:', file.name);
        console.log('JSON content preview:', content.substring(0, 500));
        this.bookmarks = this.parseJSONBookmarks(content);
        console.log('Extracted bookmarks:', this.bookmarks.length);
      } else {
        throw new Error('Unsupported file format. Please use HTML or JSON files.');
      }

      this.buildSearchIndex();

      this.updateFileInfo(file.name, this.bookmarks.length);
      this.renderBookmarks();
      this.updateStats();
      this.showClearButton();
      this.saveBookmarksToStorage(file.name);
      this.minimizeAccordion();

    } catch (error) {
      console.error('File upload error:', error);
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
      // Handle Chrome bookmark format (with type field)
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
    // Create elements using DOM API for better performance and memory usage
    const card = document.createElement('div');
    card.className = 'bookmark-card';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'bookmark-title';

    const favicon = document.createElement('img');
    favicon.className = 'bookmark-favicon';
    favicon.alt = 'favicon';
    // Use data-src for lazy loading
    if (this.intersectionObserver) {
      favicon.setAttribute('data-src', this.getFaviconUrl(bookmark.url));
      this.intersectionObserver.observe(favicon);
    } else {
      favicon.src = this.getFaviconUrl(bookmark.url);
      favicon.loading = 'lazy';
    }
    favicon.onerror = function() { this.style.display = 'none'; };

    const titleSpan = document.createElement('span');
    titleSpan.className = 'bookmark-title-text';
    titleSpan.textContent = bookmark.title; // textContent is faster and safer

    titleDiv.appendChild(favicon);
    titleDiv.appendChild(titleSpan);

    const link = document.createElement('a');
    link.href = bookmark.url;
    link.className = 'bookmark-url';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = bookmark.url;

    card.appendChild(titleDiv);
    card.appendChild(link);

    if (bookmark.folder) {
      const folderDiv = document.createElement('div');
      folderDiv.className = 'bookmark-folder';
      folderDiv.textContent = bookmark.folder;
      card.appendChild(folderDiv);
    }

    return card;
  }

  renderListInBatches(list) {
    const container = document.getElementById('bookmarksContainer');
    const emptyState = document.getElementById('emptyState');

    // Clear container efficiently
    container.textContent = '';

    if (!list || list.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    // Increase batch size for better performance
    const batchSize = 50;
    let index = 0;

    const renderChunk = () => {
      const frag = document.createDocumentFragment();
      const end = Math.min(index + batchSize, list.length);
      
      for (; index < end; index++) {
        frag.appendChild(this.createBookmarkCard(list[index]));
      }
      
      container.appendChild(frag);

      if (index < list.length) {
        // Use setTimeout with 0 delay instead of requestAnimationFrame for better chunking
        setTimeout(renderChunk, 0);
      }
    };

    renderChunk();
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
    // Clear data structures
    this.bookmarks = [];
    this.folders.clear();
    this.renderCache.clear();
    this.faviconCache.clear();
    
    // Clear UI efficiently
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    document.getElementById('fileInput').value = '';
    document.getElementById('fileInfo').textContent = '';
    document.getElementById('bookmarksContainer').textContent = ''; // textContent is faster than innerHTML
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

    // Generate HTML in Netscape Bookmark format for better compatibility
    const html = this.generateBookmarkHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'bookmarks.html';
    a.click();

    URL.revokeObjectURL(url);
  }

  generateBookmarkHTML() {
    // Use array join for better memory efficiency than string concatenation
    const parts = [];
    
    parts.push(
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
      '<!-- This is an automatically generated file.',
      '     It will be read and overwritten.',
      '     DO NOT EDIT! -->',
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
      '<TITLE>Bookmarks</TITLE>',
      '<H1>Bookmarks</H1>',
      '<DL><p>'
    );

    // Group bookmarks by folder
    const bookmarksByFolder = new Map();
    for (let i = 0; i < this.bookmarks.length; i++) {
      const bookmark = this.bookmarks[i];
      const folder = bookmark.folder || 'Bookmarks';
      if (!bookmarksByFolder.has(folder)) {
        bookmarksByFolder.set(folder, []);
      }
      bookmarksByFolder.get(folder).push(bookmark);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    
    // Generate HTML for each folder
    bookmarksByFolder.forEach((bookmarks, folder) => {
      parts.push(`    <DT><H3>${this.escapeHtml(folder)}</H3>`);
      parts.push('    <DL><p>');
      
      for (let i = 0; i < bookmarks.length; i++) {
        const bookmark = bookmarks[i];
        parts.push(`        <DT><A HREF="${this.escapeHtml(bookmark.url)}" ADD_DATE="${timestamp}">${this.escapeHtml(bookmark.title)}</A>`);
      }
      
      parts.push('    </DL><p>');
    });

    parts.push('</DL><p>');
    
    return parts.join('\n');
  }

  filterBookmarks(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      // Render full list when query is cleared
      this.renderBookmarks();
      return;
    }
    
    // Use for loop for better performance on large arrays
    const filteredBookmarks = [];
    for (let i = 0; i < this.bookmarks.length; i++) {
      const b = this.bookmarks[i];
      if (b._search && b._search.includes(q)) {
        filteredBookmarks.push(b);
      }
    }
    
    this.renderFilteredBookmarks(filteredBookmarks);
  }

  // ...existing code...
}

// Initialize the bookmark viewer when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new BookmarkViewer();
});
