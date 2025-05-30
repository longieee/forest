import 'ninja-keys';
import 'katex';
import Fuse from 'fuse.js';

import autoRenderMath from 'katex/contrib/auto-render';

function partition(array, isValid) {
 return array.reduce(([pass, fail], elem) => {
  return isValid(elem) ? [[...pass, elem], fail] : [pass, [...fail, elem]];
 }, [[], []]);
}

// Theme management
function getStoredTheme() {
  return localStorage.getItem('theme');
}

function setStoredTheme(theme) {
  localStorage.setItem('theme', theme);
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getTimeBasedTheme() {
  const hour = new Date().getHours();
  // Dark mode from 6 PM (18:00) to 7 AM (07:00)
  return (hour >= 18 || hour < 7) ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function initializeTheme() {
  const storedTheme = getStoredTheme();
  
  if (storedTheme === 'auto' || !storedTheme) {
    // Use time-based theme as default auto behavior
    const timeTheme = getTimeBasedTheme();
    applyTheme(timeTheme);
    
    // Update theme every hour for auto mode
    if (storedTheme === 'auto' || !storedTheme) {
      setInterval(() => {
        if (getStoredTheme() === 'auto' || !getStoredTheme()) {
          const newTimeTheme = getTimeBasedTheme();
          applyTheme(newTimeTheme);
        }
      }, 60000 * 60); // Check every hour
    }
  } else {
    applyTheme(storedTheme);
  }
  
  // Add theme toggle button
  addThemeToggleButton();
}

function addThemeToggleButton() {
  const toggleButton = document.createElement('button');
  toggleButton.className = 'theme-toggle';
  toggleButton.innerHTML = `
    <svg class="theme-toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
      <path d="M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q14 0 27.5 1t26.5 3q-41 29-65.5 75.5T444-660q0 90 63 153t153 63q55 0 101-24.5t75-65.5q2 13 3 26.5t1 27.5q0 150-105 255T480-120Z"/>
    </svg>
    <span class="theme-toggle-text">Theme</span>
  `;
  toggleButton.title = 'Toggle theme (Cmd+T)';
  toggleButton.addEventListener('click', toggleTheme);
  
  document.body.appendChild(toggleButton);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  setStoredTheme(newTheme);
}

function setAutoTheme() {
  setStoredTheme('auto');
  const timeTheme = getTimeBasedTheme();
  applyTheme(timeTheme);
}

window.addEventListener("load", (event) => {
 autoRenderMath(document.body)
 initializeTheme()

 const openAllDetailsAbove = elt => {
  while (elt != null) {
   if (elt.nodeName == 'DETAILS') {
    elt.open = true
   }

   elt = elt.parentNode;
  }
 }

 const jumpToSubtree = evt => {
  if (evt.target.tagName === "A") {
   return;
  }

  const link = evt.target.closest('span[data-target]')
  const selector = link.getAttribute('data-target')
  const tree = document.querySelector(selector)
  openAllDetailsAbove(tree)
  window.location = selector
 }


 [...document.querySelectorAll("[data-target^='#']")].forEach(
  el => el.addEventListener("click", jumpToSubtree)
 );
});

const ninja = document.querySelector('ninja-keys');

// Initialize fuzzy search
let fuse = null;
let allNotes = [];
let contentIndex = new Map(); // Cache for loaded content
let contentLoadingPromises = new Map(); // Track ongoing loads

fetch("./forest.json")
 .then((res) => res.json())
 .then((data) => {
  const items = []

  const editIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M480-120v-71l216-216 71 71-216 216h-71ZM120-330v-60h300v60H120Zm690-49-71-71 29-29q8-8 21-8t21 8l29 29q8 8 8 21t-8 21l-29 29ZM120-495v-60h470v60H120Zm0-165v-60h470v60H120Z"/></svg>'
  const bookmarkIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M120-40v-700q0-24 18-42t42-18h480q24 0 42.5 18t18.5 42v700L420-167 120-40Zm60-91 240-103 240 103v-609H180v609Zm600 1v-730H233v-60h547q24 0 42 18t18 42v730h-60ZM180-740h480-480Z"/></svg>'
  const themeIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q14 0 27.5 1t26.5 3q-41 29-65.5 75.5T444-660q0 90 63 153t153 63q55 0 101-24.5t75-65.5q2 13 3 26.5t1 27.5q0 150-105 255T480-120Z"/></svg>'
  const searchIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/></svg>'

  // Prepare data for fuzzy search
  allNotes = Object.keys(data).map(addr => ({
    id: addr,
    title: data[addr].title || "Untitled",
    taxon: data[addr].taxon || "",
    route: data[addr].route,
    fullTitle: data[addr].taxon 
      ? (data[addr].title ? `${data[addr].taxon}. ${data[addr].title}` : data[addr].taxon)
      : (data[addr].title ? data[addr].title : "Untitled"),
    searchText: `${data[addr].title || ""} ${data[addr].taxon || ""} ${addr}`.toLowerCase(),
    content: "", // Will be loaded on demand
    contentLoaded: false
  }));

  // Start background loading of popular/recent notes
  backgroundLoadContent();

  // Configure Fuse.js for fuzzy search with content support
  const fuseOptions = {
    keys: [
      { name: 'title', weight: 0.3 },
      { name: 'taxon', weight: 0.2 },
      { name: 'id', weight: 0.1 },
      { name: 'searchText', weight: 0.1 },
      { name: 'content', weight: 0.3 } // Give content significant weight
    ],
    threshold: 0.4, // Lower = more strict, higher = more fuzzy
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2,
    findAllMatches: true,
    ignoreLocation: true // Allow matches anywhere in the content
  };

  fuse = new Fuse(allNotes, fuseOptions);

  // Theme switching commands
  items.push({
    id: 'toggle-theme',
    title: 'Toggle Dark/Light Mode',
    section: 'Theme',
    hotkey: 'cmd+t',
    icon: themeIcon,
    handler: toggleTheme
  })

  items.push({
    id: 'light-theme',
    title: 'Switch to Light Mode',
    section: 'Theme',
    icon: themeIcon,
    handler: () => {
      applyTheme('light');
      setStoredTheme('light');
    }
  })

  items.push({
    id: 'dark-theme',
    title: 'Switch to Dark Mode',
    section: 'Theme',
    icon: themeIcon,
    handler: () => {
      applyTheme('dark');
      setStoredTheme('dark');
    }
  })

  items.push({
    id: 'auto-theme',
    title: 'Auto Theme (Time-based)',
    section: 'Theme',
    icon: themeIcon,
    handler: setAutoTheme
  })

  // Fuzzy search commands
  items.push({
    id: 'fuzzy-search',
    title: 'Fuzzy Search Notes',
    section: 'Search',
    hotkey: 'cmd+shift+f',
    icon: searchIcon,
    handler: () => openFuzzySearchModal()
  })

  if (window.sourcePath) {
   items.push({
    id: 'edit',
    title: 'Edit current tree in Visual Studio Code',
    section: 'Commands',
    hotkey: 'cmd+e',
    icon: editIcon,
    handler: () => {
     window.location.href = `vscode://file/${window.sourcePath}`
    }
   })
  }

  const isTopTree = (addr) => {
   const item = data[addr]
   return item.tags ? item.tags.includes('top') : false
  }

  const addItemToSection = (addr, section, icon) => {
   const item = data[addr]
   const title =
    item.taxon
     ? (item.title ? `${item.taxon}. ${item.title}` : item.taxon)
     : (item.title ? item.title : "Untitled")
   const fullTitle = `${title} [${addr}]`
   items.push({
    id: addr,
    title: fullTitle,
    section: section,
    icon: icon,
    handler: () => {
     window.location.href = item.route
    }
   })
  }

  const [top, rest] = partition(Object.keys(data), isTopTree)
  top.forEach((addr) => addItemToSection(addr, "Top Trees", bookmarkIcon))
  rest.forEach((addr) => addItemToSection(addr, "All Trees", null))

  ninja.data = items
 });

// Fuzzy search functionality
function openFuzzySearchModal() {
  const existingModal = document.getElementById('fuzzy-search-overlay');
  if (existingModal) {
    existingModal.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'fuzzy-search-overlay';
  overlay.className = 'fuzzy-search-overlay';
  overlay.innerHTML = `
    <div class="fuzzy-search-modal">
      <div class="fuzzy-search-header">
        <input type="text" class="fuzzy-search-input" id="fuzzy-search-input" placeholder="Search notes with fuzzy matching..." autocomplete="off">
      </div>
      <div class="fuzzy-search-results" id="fuzzy-search-results"></div>
      <div class="fuzzy-search-footer">
        <span>💡 Try: "analsis", "banch space", "theorem", or any partial match</span>
        <div class="fuzzy-search-hotkeys">
          <div class="fuzzy-search-hotkey">
            <span class="fuzzy-search-key">↑</span>
            <span class="fuzzy-search-key">↓</span>
            <span>navigate</span>
          </div>
          <div class="fuzzy-search-hotkey">
            <span class="fuzzy-search-key">Enter</span>
            <span>select</span>
          </div>
          <div class="fuzzy-search-hotkey">
            <span class="fuzzy-search-key">Esc</span>
            <span>close</span>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = document.getElementById('fuzzy-search-input');
  const results = document.getElementById('fuzzy-search-results');
  let selectedIndex = -1;

  // Show modal with animation
  setTimeout(() => {
    overlay.classList.add('active');
  }, 10);

  // Focus input
  input.focus();

  // Close handlers
  const closeModal = () => {
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.remove();
      document.removeEventListener('keydown', handleKeyDown);
    }, 300);
  };

  // Click outside to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  // Keyboard navigation
  const handleKeyDown = (e) => {
    const resultElements = results.querySelectorAll('.fuzzy-search-result');
    
    if (e.key === 'Escape') {
      closeModal();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, resultElements.length - 1);
      updateSelection(resultElements);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection(resultElements);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      resultElements[selectedIndex].click();
    }
  };
  
  const updateSelection = (resultElements) => {
    resultElements.forEach((el, index) => {
      el.classList.toggle('selected', index === selectedIndex);
    });
    
    // Scroll selected item into view
    if (selectedIndex >= 0) {
      resultElements[selectedIndex].scrollIntoView({ 
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  // Search input handler
  let searchTimeout;
  input.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      selectedIndex = -1; // Reset selection when searching
      const query = e.target.value.trim();
      
      if (query.length > 2) {
        // Show loading state for content search
        results.innerHTML = '<div class="fuzzy-search-loading">🔍 Searching in note content...</div>';
      }
      
      performFuzzySearch(query, results, closeModal);
    }, 300); // Slightly longer delay for content search
  });

  // Show some initial suggestions
  performFuzzySearch('', results, closeModal);
}

function performFuzzySearch(query, resultsContainer, closeModal) {
  if (!fuse) return;

  let searchResults;
  if (query.trim() === '') {
    // Show recent or popular notes when no query
    searchResults = allNotes.slice(0, 10).map(note => ({ item: note, score: 0 }));
  } else {
    // Load content for notes that match title/taxon first for better performance
    const titleMatches = fuse.search(query, { limit: 20 });
    const contentPromises = titleMatches.map(result => loadNoteContent(result.item));
    
    Promise.all(contentPromises).then(() => {
      // Re-initialize fuse with updated content and search again
      fuse = new Fuse(allNotes, {
        keys: [
          { name: 'title', weight: 0.3 },
          { name: 'taxon', weight: 0.2 },
          { name: 'id', weight: 0.1 },
          { name: 'searchText', weight: 0.1 },
          { name: 'content', weight: 0.3 }
        ],
        threshold: 0.4,
        includeScore: true,
        includeMatches: true,
        minMatchCharLength: 2,
        findAllMatches: true,
        ignoreLocation: true
      });
      
      searchResults = fuse.search(query).slice(0, 15);
      displaySearchResults(searchResults, resultsContainer, closeModal);
    });
    
    // Show title matches immediately while content loads
    searchResults = titleMatches.slice(0, 15);
  }
  
  displaySearchResults(searchResults, resultsContainer, closeModal);
}

async function loadNoteContent(note) {
  if (note.contentLoaded) return note;
  
  // Check cache first
  if (contentIndex.has(note.id)) {
    note.content = contentIndex.get(note.id);
    note.contentLoaded = true;
    return note;
  }
  
  // Check if already loading to avoid duplicate requests
  if (contentLoadingPromises.has(note.id)) {
    await contentLoadingPromises.get(note.id);
    return note;
  }
  
  const loadPromise = (async () => {
    try {
      const response = await fetch(note.route);
      if (!response.ok) return note;
      
      const xmlText = await response.text();
      const content = extractContentFromXML(xmlText);
      
      note.content = content;
      note.contentLoaded = true;
      contentIndex.set(note.id, content);
      
      return note;
    } catch (error) {
      console.warn(`Failed to load content for ${note.id}:`, error);
      return note;
    } finally {
      contentLoadingPromises.delete(note.id);
    }
  })();
  
  contentLoadingPromises.set(note.id, loadPromise);
  return await loadPromise;
}

// Background loading for popular notes
function backgroundLoadContent() {
  // Load content for first 20 notes in background for better UX
  const notesToPreload = allNotes.slice(0, 20);
  
  // Stagger the loading to avoid overwhelming the browser
  notesToPreload.forEach((note, index) => {
    setTimeout(() => {
      loadNoteContent(note);
    }, index * 100); // 100ms delay between each load
  });
}

function extractContentFromXML(xmlText) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Find the main content in fr:mainmatter
    const mainmatter = xmlDoc.querySelector('fr\\:mainmatter, mainmatter');
    if (!mainmatter) return '';
    
    // Extract text content while preserving some structure
    let content = '';
    const walker = document.createTreeWalker(
      mainmatter,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (text) {
        content += text + ' ';
      }
    }
    
    // Clean up extra whitespace
    return content.replace(/\s+/g, ' ').trim();
  } catch (error) {
    console.warn('Failed to parse XML:', error);
    return '';
  }
}

function displaySearchResults(searchResults, resultsContainer, closeModal) {
  resultsContainer.innerHTML = '';

  if (searchResults.length === 0) {
    resultsContainer.innerHTML = '<div class="fuzzy-search-no-results">No matching notes found</div>';
    return;
  }

  searchResults.forEach((result, index) => {
    const note = result.item;
    const score = result.score || 0;

    const resultElement = document.createElement('div');
    resultElement.className = 'fuzzy-search-result';
    
    // Determine if this is a content match
    const hasContentMatch = result.matches && result.matches.some(match => match.key === 'content');
    const contentPreview = hasContentMatch ? getContentPreview(note.content, result.matches) : '';
    
    resultElement.innerHTML = `
      <div class="fuzzy-search-result-title">${highlightMatches(note.fullTitle, result.matches)}</div>
      <div class="fuzzy-search-result-path">${note.route}</div>
      ${contentPreview ? `<div class="fuzzy-search-result-content">${contentPreview}</div>` : ''}
      ${score > 0 ? `<div class="fuzzy-search-result-score">Relevance: ${(1-score).toFixed(2)}</div>` : ''}
    `;

    resultElement.addEventListener('click', () => {
      window.location.href = note.route;
      closeModal();
    });

    resultsContainer.appendChild(resultElement);
  });
}

function getContentPreview(content, matches) {
  if (!content || !matches) return '';
  
  const contentMatches = matches.filter(match => match.key === 'content');
  if (contentMatches.length === 0) return '';
  
  // Get the first content match for preview
  const match = contentMatches[0];
  if (!match.indices || match.indices.length === 0) return '';
  
  const [start, end] = match.indices[0];
  const contextLength = 60; // Characters of context on each side
  
  const previewStart = Math.max(0, start - contextLength);
  const previewEnd = Math.min(content.length, end + contextLength + 1);
  
  let preview = content.slice(previewStart, previewEnd);
  
  // Add ellipsis if truncated
  if (previewStart > 0) preview = '...' + preview;
  if (previewEnd < content.length) preview = preview + '...';
  
  // Highlight the match within the preview
  const matchText = content.slice(start, end + 1);
  const highlightedPreview = preview.replace(
    new RegExp(escapeRegExp(matchText), 'gi'),
    `<span class="fuzzy-search-highlight">$&</span>`
  );
  
  return highlightedPreview;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMatches(text, matches) {
  if (!matches || matches.length === 0) return text;
  
  let highlightedText = text;
  const highlights = [];
  
  matches.forEach(match => {
    if (match.key === 'title' || match.key === 'fullTitle') {
      match.indices.forEach(([start, end]) => {
        highlights.push({ start, end });
      });
    }
  });
  
  // Sort highlights by start position (descending) to avoid index shifting
  highlights.sort((a, b) => b.start - a.start);
  
  highlights.forEach(({ start, end }) => {
    const before = highlightedText.slice(0, start);
    const highlighted = highlightedText.slice(start, end + 1);
    const after = highlightedText.slice(end + 1);
    highlightedText = before + `<span class="fuzzy-search-highlight">${highlighted}</span>` + after;
  });
  
  return highlightedText;
}

function setupEnhancedSearch() {
  // Add keyboard shortcut for fuzzy search
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      openFuzzySearchModal();
    }
    // Add keyboard shortcut for theme toggle (case-insensitive)
    if ((e.metaKey || e.ctrlKey) && (e.key === 't' || e.key === 'T') && !e.shiftKey) {
      e.preventDefault();
      toggleTheme();
    }
  });
}

// Hover preview functionality
function setupHoverPreviews() {
  let hoverTimeout = null;
  let currentPreview = null;
  
  // Function to update previews when new content is loaded
  const updatePreviews = () => {
    // Find all internal links (those that point to .xml files or anchors)
    const internalLinks = document.querySelectorAll('a[href*=".xml"], a[href^="#"]');
    
    internalLinks.forEach(link => {
      // Skip if already has preview listeners
      if (link.hasAttribute('data-preview-enabled')) return;
      link.setAttribute('data-preview-enabled', 'true');
      
      link.addEventListener('mouseenter', (e) => {
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
          showPreview(e.target);
        }, 300); // Reduced delay for better UX
      });
      
      link.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimeout);
        hidePreview();
      });
      
      link.addEventListener('click', () => {
        clearTimeout(hoverTimeout);
        hidePreview();
      });
    });
  };
  
  // Initial setup
  updatePreviews();
  
  // Re-run when DOM changes (useful for dynamically loaded content)
  const observer = new MutationObserver(updatePreviews);
  observer.observe(document.body, { childList: true, subtree: true });
}

function showPreview(link) {
  const href = link.getAttribute('href');
  if (!href || currentPreview) return;
  
  // Extract the note ID from the href
  let noteId = null;
  if (href.includes('.xml')) {
    noteId = href.split('/').pop().replace('.xml', '');
  } else if (href.startsWith('#')) {
    noteId = href.substring(1);
  }
  
  if (!noteId || !allNotes.length) return;
  
  // Find the note data
  const note = allNotes.find(n => n.id === noteId);
  if (!note) return;
  
  // Create preview element
  const preview = document.createElement('div');
  preview.className = 'hover-preview';
  preview.innerHTML = `
    <div class="hover-preview-header">
      <span class="hover-preview-id">${note.id}</span>
      <span class="hover-preview-title">${note.title || 'Untitled'}</span>
    </div>
    ${note.taxon ? `<div class="hover-preview-taxon">${note.taxon}</div>` : ''}
    <div class="hover-preview-loading">Click to view full note →</div>
  `;
  
  // Position the preview near the link, but keep it on screen
  const linkRect = link.getBoundingClientRect();
  const previewWidth = 300; // Match CSS max-width
  const previewHeight = 120; // Estimate
  
  let left = linkRect.left;
  let top = linkRect.bottom + 8;
  
  // Adjust horizontal position to stay on screen
  if (left + previewWidth > window.innerWidth) {
    left = window.innerWidth - previewWidth - 10;
  }
  if (left < 10) left = 10;
  
  // Adjust vertical position to stay on screen
  if (top + previewHeight > window.innerHeight) {
    top = linkRect.top - previewHeight - 8;
  }
  if (top < 10) top = 10;
  
  preview.style.position = 'fixed';
  preview.style.left = `${left}px`;
  preview.style.top = `${top}px`;
  preview.style.zIndex = '9999';
  
  document.body.appendChild(preview);
  currentPreview = preview;
  
  // Add click handler to preview for navigation
  preview.addEventListener('click', () => {
    window.location.href = note.route;
    hidePreview();
  });
}

function hidePreview() {
  if (currentPreview) {
    currentPreview.remove();
    currentPreview = null;
  }
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme system
  initializeTheme();
  createThemeToggleButton();
  
  // Initialize enhanced search
  setupEnhancedSearch();
  
  // Initialize hover previews
  setupHoverPreviews();
});
