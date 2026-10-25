class BookmarkViewer {
  constructor() {
    this.bookmarks = [];
    this.folders = new Set();
    this.intersectionObserver = null; // For lazy loading favicons
    this.renderToken = 0; // Incremented per render so stale batches stop
    this.initializeTheme();
    this.initializeEventListeners();
    this.setupIntersectionObserver();
    this.loadPersistedBookmarks();
  }

  initializeTheme() {
    // Load saved theme or default to light
    const savedTheme = localStorage.getItem('bookmarkViewer_theme') || 'light';
    this.setTheme(savedTheme);
    this.initializeBackgroundColor();
  }

  initializeBackgroundColor() {
    const savedBgColor = localStorage.getItem('bookmarkViewer_bgColor');
    if (savedBgColor) {
      this.setBackgroundColor(savedBgColor, false);
      return;
    }

    this.applyDefaultBackgroundForTheme();
  }

  applyDefaultBackgroundForTheme() {
    const defaultBgColor = document.documentElement.getAttribute('data-theme') === 'dark' ? '#1a1a2e' : '#4A90E2';
    document.documentElement.style.setProperty('--bg', defaultBgColor);
    this.updateBackgroundTone(defaultBgColor);

    const bgColorPicker = document.getElementById('bgColorPicker');
    if (bgColorPicker) {
      bgColorPicker.value = defaultBgColor;
    }
  }

  setBackgroundColor(color, persist = true) {
    if (!color) return;
    document.documentElement.style.setProperty('--bg', color);
    this.updateBackgroundTone(color);

    const bgColorPicker = document.getElementById('bgColorPicker');
    if (bgColorPicker) {
      bgColorPicker.value = color;
    }

    if (persist) {
      localStorage.setItem('bookmarkViewer_bgColor', color);
    }

    const bgReset = document.getElementById('bgReset');
    if (bgReset) bgReset.hidden = false;
  }

  resetBackgroundColor() {
    localStorage.removeItem('bookmarkViewer_bgColor');
    this.applyDefaultBackgroundForTheme();
    document.getElementById('bgReset').hidden = true;
  }

  // Switch text on the background to dark when the color is light (#rrggbb)
  updateBackgroundTone(color) {
    const hex = color.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (luminance > 0.6) {
      document.documentElement.setAttribute('data-bg-tone', 'light');
    } else {
      document.documentElement.removeAttribute('data-bg-tone');
    }
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
      themeToggle.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }
    localStorage.setItem('bookmarkViewer_theme', theme);

    if (!localStorage.getItem('bookmarkViewer_bgColor')) {
      this.applyDefaultBackgroundForTheme();
    }
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
    const bgColorPicker = document.getElementById('bgColorPicker');
    const bgReset = document.getElementById('bgReset');
    const fileInputLabel = document.getElementById('fileInputLabel');

    loadChromeBookmarks.addEventListener('click', () => this.loadChromeBookmarks());
    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    clearButton.addEventListener('click', () => this.clearBookmarks());
    uploadSectionHeader.addEventListener('click', () => this.toggleAccordion());
    exportButton.addEventListener('click', () => this.exportBookmarks());
    themeToggle.addEventListener('click', () => this.toggleTheme());
    bgColorPicker.addEventListener('input', (e) => this.setBackgroundColor(e.target.value));
    bgReset.addEventListener('click', () => this.resetBackgroundColor());

    // A <label> doesn't open the file picker from the keyboard on its own
    fileInputLabel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    // Debounce search to reduce frequent filtering on large lists
    const debouncedFilter = this.debounce((query) => this.filterBookmarks(query), 250);
    searchInput.addEventListener('input', (e) => debouncedFilter(e.target.value));

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && searchInput.value) {
        e.preventDefault();
        searchInput.value = '';
        this.filterBookmarks('');
      } else if (e.key === 'Enter') {
        // Filter now so a pending debounce can't leave a stale first result
        this.filterBookmarks(searchInput.value);
        const first = document.querySelector('#bookmarksContainer a.bookmark-url');
        if (first) this.openBookmark(first.href, e.ctrlKey || e.metaKey);
      }
    });

    // Use event delegation for bookmark clicks (more efficient for large lists)
    const bookmarksContainer = document.getElementById('bookmarksContainer');
    bookmarksContainer.addEventListener('click', (e) => {
      const link = e.target.closest('a.bookmark-url');
      if (link) {
        e.preventDefault();
        // Ctrl/Cmd+click opens behind the current tab and keeps the popup open
        this.openBookmark(link.href, e.ctrlKey || e.metaKey);
      }
    });
  }

  openBookmark(url, background = false) {
    // Bookmarklets (javascript:) and some internal URLs can't be opened as tabs
    chrome.tabs.create({ url, active: !background }).catch(() => {
      this.showError("This bookmark type can't be opened from here.");
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
      this.filterBookmarks(document.getElementById('searchInput').value);
      this.updateStats();
      this.showClearButton();
      // Remember only the source; the list is re-read from the browser on open so it's never stale
      this.clearPersistedBookmarks();
      localStorage.setItem('bookmarkViewer_source', 'Browser Bookmarks');
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
        // The tree's root node has no title; don't count it as a folder
        if (currentPath) this.folders.add(currentPath);
        this.extractBookmarksFromTree(node.children, currentPath);
      } else if (node.url) {
        // This is a bookmark
        this.bookmarks.push({
          title: node.title || node.url,
          url: node.url,
          folder: folderPath || 'Bookmarks',
          dateAdded: node.dateAdded
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
        this.bookmarks = this.parseJSONBookmarks(content);
      } else {
        throw new Error('Unsupported file format. Please use HTML or JSON files.');
      }

      this.buildSearchIndex();

      this.updateFileInfo(file.name, this.bookmarks.length);
      this.filterBookmarks(document.getElementById('searchInput').value);
      this.updateStats();
      this.showClearButton();
      this.saveBookmarksToStorage(file.name);
      this.minimizeAccordion();

    } catch (error) {
      console.error('File upload error:', error);
      this.showError(error.message);
    } finally {
      this.showLoading(false);
      // Reset so choosing the same file again still fires 'change'
      event.target.value = '';
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
      const folder = this.getHTMLFolderPath(link);

      if (href && href !== '#' && !href.startsWith('javascript:')) {
        // ADD_DATE is in seconds; dateAdded matches the browser API's milliseconds
        const addDate = parseInt(link.getAttribute('add_date'), 10);
        const dateAdded = addDate ? addDate * 1000 : undefined;
        bookmarks.push({ title, url: href, folder, dateAdded });
        this.folders.add(folder);
      }
    });

    return bookmarks;
  }

  // Build a full "A > B" folder path for a link in a Netscape bookmark file.
  // Each folder is <DT><H3>Name</H3><DL>...</DL>, so the <H3> naming a <DL>
  // is the nearest <H3> sibling before it.
  getHTMLFolderPath(link) {
    const names = [];
    let dl = link.closest('dl');
    while (dl) {
      let prev = dl.previousElementSibling;
      while (prev && prev.tagName !== 'H3') prev = prev.previousElementSibling;
      if (prev) names.unshift(prev.textContent.trim());
      dl = dl.parentElement ? dl.parentElement.closest('dl') : null;
    }
    return names.length ? names.join(' > ') : 'Bookmarks';
  }

  parseJSONBookmarks(jsonString) {
    const data = JSON.parse(jsonString);
    const bookmarks = [];

    // Chrome's Bookmarks file stores date_added as microseconds since 1601-01-01
    const fromChromeTime = (value) => {
      const ms = Number(value) / 1000 - 11644473600000;
      return ms > 0 ? ms : undefined;
    };

    const extractBookmarks = (item, folderPath = 'Bookmarks') => {
      // Handle Chrome bookmark format (with type field)
      if (item.type === 'url' && item.url) {
        bookmarks.push({
          title: item.name || item.title || item.url,
          url: item.url,
          folder: folderPath,
          dateAdded: fromChromeTime(item.date_added)
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
    const token = ++this.renderToken;

    // Stop watching favicons of cards that are about to be removed
    if (this.intersectionObserver) this.intersectionObserver.disconnect();

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
      // A newer render (search, reload, clear) has started; stop this one
      if (token !== this.renderToken) return;

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
    // Clear data structures and stop any render in progress
    this.renderToken++;
    this.bookmarks = [];
    this.folders.clear();
    if (this.intersectionObserver) this.intersectionObserver.disconnect();

    // Clear UI efficiently
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    document.getElementById('fileInput').value = '';
    document.getElementById('fileInfo').textContent = '';
    document.getElementById('bookmarksContainer').textContent = ''; // textContent is faster than innerHTML
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('stats').style.display = 'none';
    document.getElementById('clearButton').style.display = 'none';
    this.hideError();
    this.clearPersistedBookmarks();
    this.expandAccordion();
  }

  toggleAccordion() {
    // Controls only collapse once bookmarks are loaded
    if (!document.getElementById('uploadSection').classList.contains('has-bookmarks')) return;

    const expanded = !document.getElementById('uploadSectionContent').classList.contains('expanded');
    this.setAccordionExpanded(expanded);
  }

  setAccordionExpanded(expanded) {
    document.getElementById('uploadSectionContent').classList.toggle('expanded', expanded);
    document.getElementById('accordionToggle').classList.toggle('expanded', expanded);
    document.getElementById('uploadSectionHeader').setAttribute('aria-expanded', String(expanded));
  }

  minimizeAccordion() {
    document.getElementById('uploadSection').classList.add('has-bookmarks');
    this.setAccordionExpanded(false);
  }

  expandAccordion() {
    document.getElementById('uploadSection').classList.remove('has-bookmarks');
    this.setAccordionExpanded(true);
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

  // Also escapes quotes, since the output is used inside HREF="..." attributes
  escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Served from the browser's own favicon cache (needs the "favicon" permission),
  // so no request about your bookmarks leaves the machine
  getFaviconUrl(url) {
    const iconUrl = new URL(chrome.runtime.getURL('/_favicon/'));
    iconUrl.searchParams.set('pageUrl', url);
    iconUrl.searchParams.set('size', '16');
    return iconUrl.toString();
  }

  loadPersistedBookmarks() {
    // Browser bookmarks are always re-read so changes made since last time show up
    if (localStorage.getItem('bookmarkViewer_source') === 'Browser Bookmarks') {
      this.loadChromeBookmarks();
      return;
    }

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
      // Save without the _search index; it's rebuilt on load
      const toSave = this.bookmarks.map(({ title, url, folder, dateAdded }) => ({ title, url, folder, dateAdded }));
      localStorage.setItem('bookmarkViewer_bookmarks', JSON.stringify(toSave));
      localStorage.setItem('bookmarkViewer_folders', JSON.stringify([...this.folders]));
      localStorage.setItem('bookmarkViewer_source', source);
    } catch (error) {
      console.error('Failed to save bookmarks:', error);
      this.showError('Bookmarks loaded, but too large to save for next time.');
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

    // Revoking right away can cancel the download before it starts
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

    // Rebuild the folder tree from "A > B" paths. Bookmarks with no folder
    // ("Bookmarks") go at the top level.
    const root = { children: new Map(), bookmarks: [] };
    for (let i = 0; i < this.bookmarks.length; i++) {
      const bookmark = this.bookmarks[i];
      let node = root;
      if (bookmark.folder && bookmark.folder !== 'Bookmarks') {
        for (const name of bookmark.folder.split(' > ')) {
          if (!node.children.has(name)) {
            node.children.set(name, { children: new Map(), bookmarks: [] });
          }
          node = node.children.get(name);
        }
      }
      node.bookmarks.push(bookmark);
    }

    const now = Date.now();
    const writeFolder = (node, depth) => {
      const indent = '    '.repeat(depth);

      node.children.forEach((child, name) => {
        parts.push(`${indent}<DT><H3>${this.escapeHtml(name)}</H3>`);
        parts.push(`${indent}<DL><p>`);
        writeFolder(child, depth + 1);
        parts.push(`${indent}</DL><p>`);
      });

      for (let i = 0; i < node.bookmarks.length; i++) {
        const bookmark = node.bookmarks[i];
        const addDate = Math.floor((bookmark.dateAdded || now) / 1000);
        parts.push(`${indent}<DT><A HREF="${this.escapeHtml(bookmark.url)}" ADD_DATE="${addDate}">${this.escapeHtml(bookmark.title)}</A>`);
      }
    };
    writeFolder(root, 1);

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
    
    // Every word must match, but not necessarily next to each other
    const terms = q.split(/\s+/);

    // Use for loop for better performance on large arrays
    const filteredBookmarks = [];
    for (let i = 0; i < this.bookmarks.length; i++) {
      const b = this.bookmarks[i];
      if (b._search && terms.every(t => b._search.includes(t))) {
        filteredBookmarks.push(b);
      }
    }
    
    this.renderFilteredBookmarks(filteredBookmarks);
  }
}

// Initialize the bookmark viewer when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new BookmarkViewer();
});
