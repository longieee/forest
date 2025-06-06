import 'ninja-keys';
import 'katex';
import Fuse from 'fuse.js';

import autoRenderMath from 'katex/contrib/auto-render';

// Interactive Concept Graph
let conceptGraph = null;
let graphData = { nodes: [], links: [] };
let currentNoteId = null; // Track the current note being viewed

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
  toggleButton.title = 'Toggle theme (Ctrl+T)';
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

// Try multiple possible paths for forest.json
// Priority: 1) Same directory as HTML files (output dir), 2) Root of site, 3) Without ./ prefix
const forestJsonPaths = ["./forest.json", "forest.json", "/forest.json"];

async function fetchForestJson() {
  // Add cache-busting parameter to avoid stale data
  const cacheBuster = `?v=${Date.now()}`;
  
  for (const path of forestJsonPaths) {
    try {
      console.log(`Trying to fetch forest.json from: ${path}${cacheBuster}`);
      const response = await fetch(path + cacheBuster, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Cache-Control': 'no-cache'
        }
      });
      if (response.ok) {
        console.log(`Successfully fetched forest.json from: ${path}`);
        const text = await response.text();
        console.log(`Response text length: ${text.length}`);
        const data = JSON.parse(text);
        console.log(`Parsed JSON with ${Object.keys(data).length} entries`);
        return data;
      } else {
        console.log(`Failed to fetch from ${path}: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`Error fetching from ${path}:`, error);
    }
  }
  throw new Error('Could not fetch forest.json from any path');
}

fetchForestJson()
 .then((data) => {
   console.log('Forest data loaded successfully:', Object.keys(data).length, 'notes found');
  const items = []

  const editIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M480-120v-71l216-216 71 71-216 216h-71ZM120-330v-60h300v60H120Zm690-49-71-71 29-29q8-8 21-8t21 8l29 29q8 8 8 21t-8 21l-29 29ZM120-495v-60h470v60H120Zm0-165v-60h470v60H120Z"/></svg>'
  const bookmarkIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M120-40v-700q0-24 18-42t42-18h480q24 0 42.5 18t18.5 42v700L420-167 120-40Zm60-91 240-103 240 103v-609H180v609Zm600 1v-730H233v-60h547q24 0 42 18t18 42v730h-60ZM180-740h480-480Z"/></svg>'
  const themeIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20"><path d="M12 3v1.5a7.5 7.5 0 0 1 0 15V21a9 9 0 0 0 0-18Zm0 15.75A3.75 3.75 0 0 1 8.25 15H12v3Zm3.75-3.75A3.75 3.75 0 0 1 12 18.75V15h3.75ZM12 6.75V9H8.25A3.75 3.75 0 0 1 12 6.75ZM15.75 9H12V6.75A3.75 3.75 0 0 1 15.75 9ZM12 3v1.5a7.5 7.5 0 0 1 0 15V21a9 9 0 0 0 0-18Zm0 15.75A3.75 3.75 0 0 1 8.25 15H12v3Zm3.75-3.75A3.75 3.75 0 0 1 12 18.75V15h3.75ZM12 6.75V9H8.25A3.75 3.75 0 0 1 12 6.75ZM15.75 9H12V6.75A3.75 3.75 0 0 1 15.75 9Z"/></svg>'
  const searchIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20"><path d="M10.5 3a7.5 7.5 0 0 1 5.196 12.696l3.354 3.354a1 1 0 0 1-1.414 1.414l-3.354-3.354A7.5 7.5 0 0 1 10.5 3ZM9 10.5A4.5 4.5 0 1 0 9 19a4.5 4.5 0 0 0 0-8.5Zm0 8.5A4.5 4.5 0 0 1 4.5 15H9v4Zm6.75-4.5A4.5 4.5 0 1 1 15 10.5V9h4.5a4.5 4.5 0 0 1 0 9H15v-1.5ZM9 6.75V9H4.5A4.5 4.5 0 0 1 9 6.75ZM15 6.75V9h4.5A4.5 4.5 0 0 1 15 6.75ZM9 3v1.5A7.5 7.5 0 0 0 3 10.5H1.5A9 9 0 0 1 9 3ZM15 3v1.5A7.5 7.5 0 0 1 21 10.5H22.5A9 9 0 0 0 15 3ZM9 19v-1.5a7.5 7.5 0 0 0 0-15V3a9 9 0 0 1 0 18Zm6-1.5v1.5a7.5 7.5 0 0 0 0-15V3a9 9 0 0 1 0 18Z"/></svg>'

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
    hotkey: 'ctrl+t',
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

  // Concept graph command
  const graphIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="-960 -960 1920 1920" width="20"><path d="M240-40q-50 0-85-35t-35-85q0-50 35-85t85-35q11 0 21 2t19 6l64-64q-4-9-6-19t-2-21q0-50 35-85t85-35q50 0 85 35t35 85q0 11-2 21t-6 19l64 64q9-4 19-6t21-2q50 0 85 35t35 85q0 50-35 85t-85 35q-50 0-85-35t-35-85q0-11 2-21t6-19l-64-64q-9 4-19 6t-21 2q-11 0-21-2t-19-6l-64 64q4 9 6 19t2 21q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T280-160q0-17-11.5-28.5T240-200q-17 0-28.5 11.5T200-160q0 17 11.5 28.5T240-120Zm240-320q17 0 28.5-11.5T520-480q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480q0 17 11.5 28.5T480-440Zm240 320q17 0 28.5-11.5T760-160q0-17-11.5-28.5T720-200q-17 0-28.5 11.5T680-160q0 17 11.5 28.5T720-120Z"/></svg>'
  items.push({
    id: 'concept-graph',
    title: 'Show Concept Graph',
    section: 'Search',
    hotkey: 'ctrl+g',
    icon: graphIcon,
    handler: () => {
      loadD3().then(() => {
        // Update current note ID before opening modal
        currentNoteId = getCurrentNoteId();
        openConceptGraphModal();
      }).catch(error => {
        console.error('Failed to load concept graph:', error);
      });
    }
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
 })
 .catch((error) => {
   console.error('Error loading forest.json:', error);
   console.log('Hover previews and search functionality may not work properly');
   
   // Initialize empty allNotes array so hover previews don't crash
   allNotes = [];
   
   // Try to initialize basic functionality anyway
   try {
     setupEnhancedSearch();
     setupHoverPreviews();
   } catch (e) {
     console.error('Error initializing search/preview functionality:', e);
   }
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
    // Focus input after animation starts to ensure it gets focus
    setTimeout(() => {
      input.focus();
      input.select(); // Also select any existing text
    }, 50);
  }, 10);

  // Focus input immediately as well (fallback)
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

  // Touch support for mobile
  let touchStartY = 0;
  overlay.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  });
  
  overlay.addEventListener('touchend', (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY;
    
    // Swipe down to close modal on mobile
    if (deltaY > 100 && e.target === overlay) {
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
    // Add keyboard shortcut for theme toggle (Ctrl+T only, not Cmd+T to avoid conflict with new tab)
    if (e.ctrlKey && (e.key === 't' || e.key === 'T') && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      toggleTheme();
    }
    // Add keyboard shortcut for concept graph
    if (e.ctrlKey && (e.key === 'g' || e.key === 'G') && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      loadD3().then(openConceptGraphModal).catch(console.error);
    }
  });
}

// Hover preview functionality
function setupHoverPreviews() {
  console.log('Setting up hover previews...');
  let hoverTimeout = null;
  let currentPreview = null;
  
  // Function to update previews when new content is loaded
  const updatePreviews = () => {
    // Find all internal links (those that point to .xml files or anchors)
    const internalLinks = document.querySelectorAll('a[href*=".xml"], a[href^="#"]');
    console.log(`Found ${internalLinks.length} internal links for hover preview setup`);
    
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
  
  console.log(`Attempting to show preview for note ID: ${noteId}`);
  
  if (!noteId) {
    console.log('No valid note ID found');
    return;
  }
  
  if (!allNotes.length) {
    console.log('allNotes array is empty');
    return;
  }
  
  // Find the note data
  const note = allNotes.find(n => n.id === noteId);
  if (!note) {
    console.log(`Note with ID ${noteId} not found in allNotes`);
    return;
  }
  
  console.log(`Creating preview for note:`, note);
  
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
  console.log('DOM ready - initializing forest features...');
  console.log('Current URL:', window.location.href);
  console.log('Base URL:', window.location.origin);
  
  // Initialize theme system
  initializeTheme();
  addThemeToggleButton();
  
  // Initialize enhanced search
  setupEnhancedSearch();
  
  // Initialize hover previews
  setupHoverPreviews();
  
  // Initialize concept graph
  setupConceptGraph();
  
  // Initialize mobile support
  enhanceMobileSupport();
  
  // Add global debugging info
  window.forestDebug = {
    allNotes: () => allNotes,
    forestJsonPaths: forestJsonPaths,
    contentIndex: () => contentIndex,
    testFetch: async (path) => {
      try {
        const response = await fetch(path);
        console.log(`Fetch ${path}:`, response.status, response.ok);
        if (response.ok) {
          const data = await response.json();
          console.log(`Data keys:`, Object.keys(data).slice(0, 5));
        }
        return response;
      } catch (error) {
        console.log(`Fetch error for ${path}:`, error);
        return null;
      }
    }
  };
  
  console.log('Forest features initialized. Use window.forestDebug for debugging.');
});

// Concept Graph functionality
async function setupConceptGraph() {
  try {
    console.log('🎯 CONCEPT GRAPH: Starting setup...');
    await loadD3();
    console.log('🎯 CONCEPT GRAPH: D3.js loaded successfully');
    addConceptGraphButton();
    console.log('🎯 CONCEPT GRAPH: Button added to DOM');
  } catch (error) {
    console.error('🎯 CONCEPT GRAPH: Failed to load D3.js:', error);
  }
}

function addConceptGraphButton() {
  console.log('🎯 CONCEPT GRAPH: Creating button...');
  const graphButton = document.createElement('button');
  graphButton.className = 'concept-graph-toggle';
  graphButton.innerHTML = `
    <svg class="concept-graph-icon" xmlns="http://www.w3.org/2000/svg" viewBox="-960 -960 1920 1920" width="20"><path d="M240-40q-50 0-85-35t-35-85q0-50 35-85t85-35q11 0 21 2t19 6l64-64q-4-9-6-19t-2-21q0-50 35-85t85-35q50 0 85 35t35 85q0 11-2 21t-6 19l64 64q9-4 19-6t21-2q50 0 85 35t35 85q0 50-35 85t-85 35q-50 0-85-35t-35-85q0-11 2-21t6-19l-64-64q-9 4-19 6t-21 2q-11 0-21-2t-19-6l-64 64q4 9 6 19t2 21q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T280-160q0-17-11.5-28.5T240-200q-17 0-28.5 11.5T200-160q0 17 11.5 28.5T240-120Zm240-320q17 0 28.5-11.5T520-480q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480q0 17 11.5 28.5T480-440Zm240 320q17 0 28.5-11.5T760-160q0-17-11.5-28.5T720-200q-17 0-28.5 11.5T680-160q0 17 11.5 28.5T720-120Z"/></svg>
    <span class="concept-graph-text">Graph</span>
  `;
  graphButton.title = 'Show concept graph (Ctrl+G)';
  graphButton.addEventListener('click', openConceptGraphModal);
  
  document.body.appendChild(graphButton);
  console.log('🎯 CONCEPT GRAPH: Button appended to body');
  
  // Verify button is in DOM
  const buttonCheck = document.querySelector('.concept-graph-toggle');
  if (buttonCheck) {
    console.log('🎯 CONCEPT GRAPH: Button successfully found in DOM');
  } else {
    console.error('🎯 CONCEPT GRAPH: Button NOT found in DOM after adding');
  }
}

function openConceptGraphModal() {
  const existingModal = document.getElementById('concept-graph-overlay');
  if (existingModal) {
    existingModal.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'concept-graph-overlay';
  overlay.className = 'concept-graph-overlay';
  overlay.innerHTML = `
    <div class="concept-graph-modal">
      <div class="concept-graph-header">
        <h3>Mathematical Concept Graph</h3>
        <div class="concept-graph-controls">
          <div class="control-group">
            <label>Mode:</label>
            <select id="graph-mode-filter">
              <option value="contextual">Contextual (center on current note)</option>
              <option value="topic">Topic Overview</option>
            </select>
          </div>
          <div class="control-group">
            <label>Topic:</label>
            <select id="graph-topic-filter">
              <option value="FA">Functional Analysis (default)</option>
              <option value="SP">Stochastic Processes</option>
              <option value="CA">Complex Analysis</option>
              <option value="AN">Analysis</option>
              <option value="all">All Topics</option>
            </select>
          </div>
          <div class="control-group">
            <label>Max nodes:</label>
            <select id="graph-node-limit">
              <option value="20">20 (fast)</option>
              <option value="30" selected>30 (recommended)</option>
              <option value="50">50 (detailed)</option>
              <option value="100">100 (comprehensive)</option>
            </select>
          </div>
          <button class="concept-graph-control update-btn" id="graph-update">Update</button>
          <button class="concept-graph-close">×</button>
        </div>
      </div>
      <div class="concept-graph-status" id="concept-graph-status">
        Starting with Functional Analysis (30 nodes max)...
      </div>
      <div class="concept-graph-container" id="concept-graph-container">
        <div class="concept-graph-loading">
          <div>🌲 Building your mathematical forest...</div>
          <div class="loading-progress"></div>
        </div>
      </div>
      <div class="concept-graph-footer">
        <div class="concept-graph-legend">
          <div class="legend-item"><div class="node-legend definition"></div>Definition</div>
          <div class="legend-item"><div class="node-legend theorem"></div>Theorem</div>
          <div class="legend-item"><div class="node-legend lemma"></div>Lemma</div>
          <div class="legend-item"><div class="node-legend proposition"></div>Proposition</div>
        </div>
        <div class="concept-graph-info">
          Click nodes to navigate • Drag to rearrange • Scroll to zoom
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Show modal with animation
  setTimeout(() => {
    overlay.classList.add('active');
    
    // Detect current note and set initial mode
    const currentNote = getCurrentNoteId();
    const modeSelect = document.getElementById('graph-mode-filter');
    const topicSelect = document.getElementById('graph-topic-filter');
    
    if (currentNote) {
      console.log(`🎯 CONCEPT GRAPH: Current note detected: ${currentNote}, using contextual mode`);
      modeSelect.value = 'contextual';
      // Disable topic selection in contextual mode initially
      topicSelect.disabled = true;
      initializeConceptGraph('contextual', 30, currentNote);
    } else {
      console.log('🎯 CONCEPT GRAPH: No current note detected, using topic overview mode');
      modeSelect.value = 'topic';
      topicSelect.disabled = false;
      initializeConceptGraph('all', 30); // Start with ALL topics for overview
    }
  }, 10);

  // Close handlers
  const closeModal = () => {
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.remove();
      if (conceptGraph) {
        conceptGraph.remove();
        conceptGraph = null;
      }
    }, 300);
  };

  // Update handler for new controls
  const updateGraph = async () => {
    const mode = document.getElementById('graph-mode-filter').value;
    const topicFilter = document.getElementById('graph-topic-filter').value;
    const nodeLimit = parseInt(document.getElementById('graph-node-limit').value);
    const topicSelect = document.getElementById('graph-topic-filter');
    
    // Update status and handle mode-specific logic
    const statusDiv = document.getElementById('concept-graph-status');
    let centerNoteId = null;
    let displayMode = '';
    
    if (mode === 'contextual') {
      centerNoteId = getCurrentNoteId();
      if (centerNoteId) {
        displayMode = `Contextual view centered on ${centerNoteId}`;
        topicSelect.disabled = true; // Disable topic selection in contextual mode
      } else {
        // Fall back to topic mode if no current note
        displayMode = 'No current note detected, showing topic overview';
        topicSelect.disabled = false;
      }
    } else {
      displayMode = {
        'FA': 'Functional Analysis',
        'SP': 'Stochastic Processes', 
        'CA': 'Complex Analysis',
        'AN': 'Analysis',
        'all': 'All Topics'
      }[topicFilter] || topicFilter;
      topicSelect.disabled = false;
    }
    
    statusDiv.textContent = `Loading ${displayMode} (${nodeLimit} nodes max)...`;
    
    // Show loading
    const container = document.getElementById('concept-graph-container');
    container.innerHTML = `
      <div class="concept-graph-loading">
        <div>🌲 Rebuilding graph for ${displayMode}...</div>
        <div class="loading-progress"></div>
      </div>
    `;
    
    // Rebuild graph with new settings
    const effectiveFilter = mode === 'contextual' ? 'contextual' : topicFilter;
    await initializeConceptGraph(effectiveFilter, nodeLimit, centerNoteId);
    
    // Update status
    if (graphData && graphData.nodes) {
      statusDiv.innerHTML = `
        Showing <strong>${graphData.showing}</strong> of <strong>${graphData.totalAvailable}</strong> ${displayMode} concepts
        ${graphData.hasMore ? ' <span class="more-available">(more available)</span>' : ''}
      `;
    }
  };

  document.getElementById('graph-update').addEventListener('click', updateGraph);
  document.getElementById('graph-mode-filter').addEventListener('change', (e) => {
    const topicSelect = document.getElementById('graph-topic-filter');
    if (e.target.value === 'contextual') {
      topicSelect.disabled = true;
    } else {
      topicSelect.disabled = false;
    }
  });
  document.querySelector('.concept-graph-close').addEventListener('click', closeModal);

  // Click outside to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  // Touch support for mobile
  let graphTouchStartY = 0;
  overlay.addEventListener('touchstart', (e) => {
    graphTouchStartY = e.touches[0].clientY;
  });
  
  overlay.addEventListener('touchend', (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchEndY - graphTouchStartY;
    
    // Swipe down to close modal on mobile
    if (deltaY > 100 && e.target === overlay) {
      closeModal();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
}

async function initializeConceptGraph(filterTopic = 'FA', maxNodes = 30, centerNoteId = null) {
  console.log('🎯 CONCEPT GRAPH: Initializing concept graph...');
  console.log(`🎯 CONCEPT GRAPH: Starting with filter: ${filterTopic}, maxNodes: ${maxNodes}, centerNote: ${centerNoteId}`);
  
  // Always rebuild with current filter settings
  await buildGraphData(filterTopic, maxNodes, centerNoteId);
  console.log('🎯 CONCEPT GRAPH: graphData built:', graphData);
  
  // Check if graphData was properly created
  if (!graphData) {
    console.error('🎯 CONCEPT GRAPH: ERROR - graphData is null after buildGraphData');
    return;
  }
  if (!graphData.nodes || graphData.nodes.length === 0) {
    console.error('🎯 CONCEPT GRAPH: ERROR - No nodes in graphData after buildGraphData');
    console.error('🎯 CONCEPT GRAPH: graphData content:', graphData);
    return;
  }
  
  createD3Graph();
  console.log('🎯 CONCEPT GRAPH: D3 graph creation initiated.');
}

async function buildGraphData(filterTopic = null, maxNodes = 50, centerNoteId = null) {
  console.log('🎯 CONCEPT GRAPH: Building graph data...');
  console.log(`🎯 CONCEPT GRAPH: Filter topic: ${filterTopic}, Max nodes: ${maxNodes}, Center note: ${centerNoteId}`);
  
  // Reset graph data
  const nodes = [];
  const links = [];
  const nodeMap = new Map();

  // Check if we have notes to work with
  console.log('🎯 CONCEPT GRAPH: Number of allNotes:', allNotes?.length || 0);
  if (!allNotes || allNotes.length === 0) {
    console.error('🎯 CONCEPT GRAPH: No notes available to build graph!');
    return;
  }

  // Debug: Show first few note IDs to verify the data
  console.log('🎯 CONCEPT GRAPH: Sample note IDs:', allNotes.slice(0, 5).map(n => n.id));

  // Filter and limit notes
  let filteredNotes = allNotes;
  
  // Contextual mode: center on a specific note
  if (centerNoteId) {
    console.log(`🎯 CONCEPT GRAPH: Using contextual mode centered on ${centerNoteId}`);
    
    // Find the center note
    const centerNote = allNotes.find(note => note.id === centerNoteId);
    if (!centerNote) {
      console.warn(`🎯 CONCEPT GRAPH: Center note ${centerNoteId} not found, falling back to overview mode`);
    } else {
      // Start with the center note
      filteredNotes = [centerNote];
      
      // Load content for center note to find its connections
      if (!centerNote.contentLoaded) {
        await loadNoteContent(centerNote);
      }
      
      // Extract links from center note to find directly connected notes
      const centerLinks = await extractLinksFromNote(centerNote);
      console.log(`🎯 CONCEPT GRAPH: Found ${centerLinks.length} links from center note`);
      
      // Add directly connected notes
      const connectedNotes = centerLinks
        .map(linkId => allNotes.find(note => note.id === linkId))
        .filter(note => note); // Remove null entries
      
      filteredNotes = filteredNotes.concat(connectedNotes);
      console.log(`🎯 CONCEPT GRAPH: Added ${connectedNotes.length} directly connected notes`);
      
      // Optional: Add second-degree connections if we have room
      if (filteredNotes.length < maxNodes * 0.7) {
        const secondDegreePromises = connectedNotes.slice(0, 5).map(async note => {
          if (!note.contentLoaded) {
            await loadNoteContent(note);
          }
          return extractLinksFromNote(note);
        });
        
        try {
          const secondDegreeLinksArrays = await Promise.all(secondDegreePromises);
          const secondDegreeLinks = secondDegreeLinksArrays.flat();
          const secondDegreeNotes = secondDegreeLinks
            .map(linkId => allNotes.find(note => note.id === linkId))
            .filter(note => note && !filteredNotes.includes(note)); // Avoid duplicates
          
          const additionalNotes = secondDegreeNotes.slice(0, maxNodes - filteredNotes.length);
          filteredNotes = filteredNotes.concat(additionalNotes);
          console.log(`🎯 CONCEPT GRAPH: Added ${additionalNotes.length} second-degree connections`);
        } catch (error) {
          console.warn('🎯 CONCEPT GRAPH: Failed to load second-degree connections:', error);
        }
      }
      
      // Remove duplicates
      filteredNotes = [...new Set(filteredNotes)];
    }
  } else {
    // Topic filtering mode (existing behavior)
    // Apply topic filter if specified
    if (filterTopic && filterTopic !== 'all') {
      console.log(`🎯 CONCEPT GRAPH: Applying filter for topic: ${filterTopic}`);
      filteredNotes = allNotes.filter(note => {
        const group = getTopicGroup(note.id);
        const matches = group === filterTopic;
        if (!matches && Math.random() < 0.1) { // Log some non-matches for debugging
          console.log(`🎯 CONCEPT GRAPH: Note ${note.id} -> group ${group}, filter ${filterTopic}, matches: ${matches}`);
        }
        return matches;
      });
      console.log(`🎯 CONCEPT GRAPH: Filtered to ${filteredNotes.length} notes for topic ${filterTopic}`);
      
      // Debug: Show some filtered note IDs
      if (filteredNotes.length > 0) {
        console.log('🎯 CONCEPT GRAPH: Sample filtered note IDs:', filteredNotes.slice(0, 3).map(n => n.id));
      }
    } else {
      console.log('🎯 CONCEPT GRAPH: No topic filter applied, using all notes');
    }
  }
  
  // Sort by importance (notes with more potential connections first)
  filteredNotes.sort((a, b) => {
    const aImportance = (a.fullTitle?.length || 0) + (a.id.includes('000') ? 10 : 0);
    const bImportance = (b.fullTitle?.length || 0) + (b.id.includes('000') ? 10 : 0);
    return bImportance - aImportance;
  });
  
  // Limit number of nodes for performance
  const limitedNotes = filteredNotes.slice(0, maxNodes);
  console.log(`🎯 CONCEPT GRAPH: Limited to ${limitedNotes.length} nodes`);

  // Create nodes from filtered notes
  limitedNotes.forEach((note, index) => {
    const node = {
      id: note.id,
      title: note.title || 'Untitled',
      taxon: note.taxon || 'Definition',
      route: note.route,
      fullTitle: note.fullTitle,
      group: getTopicGroup(note.id),
      importance: (note.fullTitle?.length || 0) + (note.id.includes('000') ? 10 : 0),
      x: Math.random() * 800,
      y: Math.random() * 600,
      isCenterNode: centerNoteId && note.id === centerNoteId // Mark the center node
    };
    nodes.push(node);
    nodeMap.set(note.id, index);
  });
  console.log(`🎯 CONCEPT GRAPH: Created ${nodes.length} nodes`);

  // Extract links from note content (only from filtered notes)
  console.log('🎯 CONCEPT GRAPH: Extracting links from notes...');
  const linkPromises = limitedNotes.map(async (note) => {
    if (!note.contentLoaded) {
      await loadNoteContent(note);
    }
    return extractLinksFromNote(note);
  });

  try {
    const allExtractedLinks = await Promise.all(linkPromises);
    console.log(`🎯 CONCEPT GRAPH: Extracted links from ${allExtractedLinks.length} notes`);
    
    // Build links array (only between nodes that exist in our filtered set)
    let linkCount = 0;
    allExtractedLinks.forEach((extractedLinks, sourceIndex) => {
      if (extractedLinks && extractedLinks.length) {
        const sourceNode = nodes[sourceIndex];
        extractedLinks.forEach(targetId => {
          const targetIndex = nodeMap.get(targetId);
          if (targetIndex !== undefined && sourceIndex !== targetIndex) {
            const targetNode = nodes[targetIndex];
            links.push({
              source: sourceNode.id,  // Use node ID instead of index
              target: targetNode.id,  // Use node ID instead of index
              strength: 1
            });
            linkCount++;
          }
        });
      }
    });
    
    console.log(`🎯 CONCEPT GRAPH: Created ${linkCount} links`);
  } catch (error) {
    console.error('🎯 CONCEPT GRAPH: Error extracting links:', error);
  }

  graphData = { 
    nodes, 
    links, 
    totalAvailable: filteredNotes.length,
    showing: limitedNotes.length,
    hasMore: filteredNotes.length > maxNodes
  };
  console.log(`🎯 CONCEPT GRAPH: Final graph data:`, graphData);
  console.log(`🎯 CONCEPT GRAPH: Graph built with ${nodes.length} nodes and ${links.length} links`);
  console.log(`🎯 CONCEPT GRAPH: Showing ${limitedNotes.length} of ${filteredNotes.length} available nodes`);
  
  // Verify graphData is properly set
  if (graphData.nodes.length === 0) {
    console.error('🎯 CONCEPT GRAPH: WARNING - No nodes were created!');
    console.error('🎯 CONCEPT GRAPH: filteredNotes:', filteredNotes.length);
    console.error('🎯 CONCEPT GRAPH: limitedNotes:', limitedNotes.length);
  }
}

function extractLinksFromNote(note) {
  const links = [];
  const route = note.route;
  
  console.log(`🎯 CONCEPT GRAPH: Extracting links from note ${note.id} at ${route}`);
  
  // Fetch the XML content and extract fr:link elements
  return fetch(route)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status} for ${route}`);
      }
      return response.text();
    })
    .then(xmlText => {
      console.log(`🎯 CONCEPT GRAPH: Received XML for ${note.id}, length: ${xmlText.length}`);
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      // Find all fr:link elements
      const linkElements = xmlDoc.querySelectorAll('fr\\:link[type="local"], link[type="local"]');
      console.log(`🎯 CONCEPT GRAPH: Found ${linkElements.length} links in ${note.id}`);
      
      linkElements.forEach(link => {
        const addr = link.getAttribute('addr');
        if (addr && addr !== note.id) {
          links.push(addr);
        }
      });
      
      console.log(`🎯 CONCEPT GRAPH: Extracted ${links.length} valid links from ${note.id}`);
      return links;
    })
    .catch(error => {
      console.error(`🎯 CONCEPT GRAPH: Failed to extract links from ${note.id}:`, error);
      return [];
    });
}

function getTopicGroup(noteId) {
  if (noteId.startsWith('FA-')) return 'FA';
  if (noteId.startsWith('SP-')) return 'SP';
  if (noteId.startsWith('CA-')) return 'CA';
  if (noteId.startsWith('AN-')) return 'AN';
  return 'other';
}

// Function to detect the current note ID from the page URL
function getCurrentNoteId() {
  const url = window.location.href;
  console.log('🎯 CONCEPT GRAPH: Current URL:', url);
  
  // Extract note ID from URL patterns like:
  // file:///path/to/FA-0001.xml
  // /path/to/FA-0001.xml
  // FA-0001.xml
  const match = url.match(/([A-Z]{2}-[0-9A-Z]{4})\.xml/);
  const noteId = match ? match[1] : null;
  
  console.log('🎯 CONCEPT GRAPH: Detected current note ID:', noteId);
  return noteId;
}

function createD3Graph() {
  console.log('🎯 CONCEPT GRAPH: Creating D3 graph...');
  
  // Verify D3 is loaded
  if (!window.d3) {
    console.error('🎯 CONCEPT GRAPH: D3.js not loaded, cannot create graph');
    return;
  }

  // Verify data with detailed logging
  console.log('🎯 CONCEPT GRAPH: Checking graphData:', graphData);
  if (!graphData) {
    console.error('🎯 CONCEPT GRAPH: graphData is null/undefined');
    return;
  }
  if (!graphData.nodes) {
    console.error('🎯 CONCEPT GRAPH: graphData.nodes is null/undefined');
    return;
  }
  if (!graphData.links) {
    console.error('🎯 CONCEPT GRAPH: graphData.links is null/undefined');
    return;
  }
  
  console.log(`🎯 CONCEPT GRAPH: Graph data contains ${graphData.nodes.length} nodes and ${graphData.links.length} links`);
  
  // Debug: Log first few nodes and links
  if (graphData.nodes.length > 0) {
    console.log('🎯 CONCEPT GRAPH: Sample nodes:', graphData.nodes.slice(0, 3));
  }
  if (graphData.links.length > 0) {
    console.log('🎯 CONCEPT GRAPH: Sample links:', graphData.links.slice(0, 3));
  }
  
  const container = document.getElementById('concept-graph-container');
  if (!container) {
    console.error('🎯 CONCEPT GRAPH: Container element not found');
    return;
  }
  
  container.innerHTML = '';
  console.log('🎯 CONCEPT GRAPH: Container cleared');

  const width = container.clientWidth;
  const height = container.clientHeight;
  console.log(`🎯 CONCEPT GRAPH: Container dimensions: ${width}x${height}`);

  // Create SVG
  const svg = d3.select('#concept-graph-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .call(d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      }));
  console.log('🎯 CONCEPT GRAPH: SVG created with zoom behavior');

  const g = svg.append('g');

  // Create force simulation with optimized settings for smaller graphs
  console.log('🎯 CONCEPT GRAPH: Creating force simulation');
  const simulation = d3.forceSimulation(graphData.nodes)
    .force('link', d3.forceLink(graphData.links)
      .id(d => d.id)
      .distance(100)  // Increased distance for better spacing
      .strength(0.2)) // Increased strength for clearer connections
    .force('charge', d3.forceManyBody()
      .strength(-400) // More repulsion for better separation
      .distanceMax(300)) // Limit interaction distance
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide()
      .radius(d => {
        const baseRadius = getTaxonRadius(d.taxon);
        const importanceBonus = Math.min(d.importance / 10, 8);
        return baseRadius + importanceBonus + 5; // Add padding
      })
      .strength(0.7))
    .alphaDecay(0.02) // Slower cooling for better convergence
    .velocityDecay(0.3); // More damping for stability

  // Create links
  console.log('🎯 CONCEPT GRAPH: Creating links');
  const link = g.append('g')
    .selectAll('line')
    .data(graphData.links)
    .join('line')
    .attr('class', 'graph-link')
    .attr('stroke', '#666')
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', 1);

  // Create nodes with importance-based sizing
  console.log('🎯 CONCEPT GRAPH: Creating nodes');
  const node = g.append('g')
    .selectAll('circle')
    .data(graphData.nodes)
    .join('circle')
    .attr('class', d => `graph-node ${d.group} ${d.taxon.toLowerCase()} ${d.isCenterNode ? 'center-node' : ''}`)
    .attr('r', d => {
      const baseRadius = getTaxonRadius(d.taxon);
      const importanceBonus = Math.min(d.importance / 10, 8); // Scale importance to reasonable size
      const centerBonus = d.isCenterNode ? 5 : 0; // Make center node larger
      return baseRadius + importanceBonus + centerBonus;
    })
    .attr('fill', d => getTaxonColor(d.taxon))
    .attr('stroke', d => d.isCenterNode ? '#ff6b6b' : '#fff')
    .attr('stroke-width', d => d.isCenterNode ? 4 : 2)
    .style('cursor', 'pointer')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));

  // Add labels
  console.log('🎯 CONCEPT GRAPH: Creating labels');
  const label = g.append('g')
    .selectAll('text')
    .data(graphData.nodes)
    .join('text')
    .attr('class', 'graph-label')
    .attr('text-anchor', 'middle')
    .attr('dy', '.35em')
    .attr('font-size', '10px')
    .attr('fill', '#333')
    .attr('pointer-events', 'none')
    .text(d => d.title.length > 12 ? d.title.substring(0, 12) + '...' : d.title);

  // Add tooltips and click handlers
  console.log('🎯 CONCEPT GRAPH: Adding interaction handlers');
  node
    .on('mouseover', function(event, d) {
      // Show tooltip
      const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'graph-tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.8)')
        .style('color', 'white')
        .style('padding', '8px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('z-index', '10000');

      tooltip.transition()
        .duration(200)
        .style('opacity', .9);
      
      tooltip.html(`<strong>${d.title}</strong><br/>${d.taxon}<br/>ID: ${d.id}`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');

      // Highlight connected nodes
      const connectedNodes = new Set();
      graphData.links.forEach(link => {
        if (link.source.id === d.id) connectedNodes.add(link.target.id);
        if (link.target.id === d.id) connectedNodes.add(link.source.id);
      });

      node.style('opacity', n => connectedNodes.has(n.id) || n.id === d.id ? 1 : 0.3);
      link.style('opacity', l => 
        (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.1);
    })
    .on('mouseout', function(event, d) {
      // Remove tooltip
      d3.selectAll('.graph-tooltip').remove();
      
      // Reset opacity
      node.style('opacity', 1);
      link.style('opacity', 0.6);
    })
    .on('click', function(event, d) {
      window.location.href = d.route;
    });

  // Update positions on tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);

    label
      .attr('x', d => d.x)
      .attr('y', d => d.y);
  });

  // Drag functions
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  conceptGraph = { svg, simulation, nodes: graphData.nodes, links: graphData.links };
  console.log('🎯 CONCEPT GRAPH: Graph created successfully');
}

function getTaxonRadius(taxon) {
  switch (taxon.toLowerCase()) {
    case 'theorem': return 12;
    case 'lemma': return 10;
    case 'proposition': return 10;
    case 'definition': return 8;
    default: return 8;
  }
}

function getTaxonColor(taxon) {
  switch (taxon.toLowerCase()) {
    case 'theorem': return '#ff6b6b';
    case 'lemma': return '#4ecdc4';
    case 'proposition': return '#45b7d1';
    case 'definition': return '#96ceb4';
    case 'notation': return '#feca57';
    default: return '#b8b8b8';
  }
}

// Load D3.js library
function loadD3() {
  return new Promise((resolve, reject) => {
    if (window.d3) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://d3js.org/d3.v7.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Alias for backward compatibility
function showConceptGraph() {
  return openConceptGraphModal();
}

// Export functions to global window object for testing and external access
window.getCurrentNoteId = getCurrentNoteId;
window.buildGraphData = buildGraphData;
window.showConceptGraph = showConceptGraph;
window.createD3Graph = createD3Graph;

// Mobile-friendly search and navigation
function addMobileToolbar() {
  // Check if mobile toolbar already exists
  if (document.querySelector('.mobile-toolbar')) {
    console.log('📱 Mobile toolbar already exists, skipping...');
    return;
  }

  // More comprehensive mobile detection
  const isMobile = window.innerWidth <= 768 || 
                   /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

  console.log('📱 Mobile detection:', {
    viewport: window.innerWidth,
    userAgent: navigator.userAgent.includes('Mobile'),
    touchPoints: navigator.maxTouchPoints,
    isMobile: isMobile
  });

  if (isMobile) {
    console.log('📱 Adding mobile toolbar...');
    
    // Create mobile toolbar
    const mobileToolbar = document.createElement('div');
    mobileToolbar.className = 'mobile-toolbar';
    mobileToolbar.innerHTML = `
      <button class="mobile-tool-btn mobile-search-btn" title="Search notes">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        <span>Search</span>
      </button>
      <button class="mobile-tool-btn mobile-graph-btn" title="Concept graph">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        <span>Graph</span>
      </button>
      <button class="mobile-tool-btn mobile-theme-btn" title="Toggle theme">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 3v1.5a7.5 7.5 0 0 1 0 15V21c4.97 0 9-4.03 9-9s-4.03-9-9-9z"/></svg>
        <span>Theme</span>
      </button>
      <button class="mobile-tool-btn mobile-home-btn" title="Home">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
        <span>Home</span>
      </button>
    `;
    
    // Add event listeners
    const searchBtn = mobileToolbar.querySelector('.mobile-search-btn');
    const graphBtn = mobileToolbar.querySelector('.mobile-graph-btn');
    const themeBtn = mobileToolbar.querySelector('.mobile-theme-btn');
    const homeBtn = mobileToolbar.querySelector('.mobile-home-btn');
    
    searchBtn.addEventListener('click', () => openFuzzySearchModal());
    graphBtn.addEventListener('click', () => loadD3().then(openConceptGraphModal).catch(console.error));
    themeBtn.addEventListener('click', () => toggleTheme());
    homeBtn.addEventListener('click', () => {
      if (window.location.pathname !== '/index.xml' && window.location.pathname !== '/') {
        window.location.href = 'index.xml';
      }
    });
    
    document.body.appendChild(mobileToolbar);
    console.log('📱 Mobile toolbar added successfully');
    
    // Force show with CSS override for mobile
    mobileToolbar.style.display = 'grid';
    mobileToolbar.style.position = 'fixed';
    mobileToolbar.style.bottom = '0';
    mobileToolbar.style.left = '0';
    mobileToolbar.style.right = '0';
    mobileToolbar.style.zIndex = '1001';
    
    // Add body padding to account for toolbar
    document.body.style.paddingBottom = '64px';
  } else {
    console.log('📱 Not mobile viewport, skipping mobile toolbar');
  }
}

// Function to handle window resize for mobile toolbar
function handleMobileToolbarResize() {
  const toolbar = document.querySelector('.mobile-toolbar');
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile && !toolbar) {
    // Add toolbar if we're now in mobile mode but don't have one
    addMobileToolbar();
  } else if (!isMobile && toolbar) {
    // Remove toolbar if we're no longer in mobile mode
    toolbar.remove();
    document.body.style.paddingBottom = '';
  }
}

// Initial check for mobile toolbar on page load
handleMobileToolbarResize();

// Re-check on window resize
window.addEventListener('resize', handleMobileToolbarResize);

// Enhanced mobile support for existing features
function enhanceMobileSupport() {
  console.log('📱 Enhancing mobile support...');
  
  // Add mobile toolbar
  addMobileToolbar();
  
  // Add resize listener to handle orientation changes and window resizing
  window.addEventListener('resize', handleMobileToolbarResize);
  
  // Enhance existing concept graph button for mobile
  const existingGraphBtn = document.querySelector('.concept-graph-toggle');
  if (existingGraphBtn && window.innerWidth <= 768) {
    // Make it more touch-friendly on mobile
    existingGraphBtn.style.display = 'none'; // Hide desktop button, use mobile toolbar instead
  }
  
  // Add touch support for search shortcuts
  let touchStartTime = 0;
  let touchCount = 0;
  
  document.addEventListener('touchstart', (e) => {
    touchStartTime = Date.now();
    touchCount++;
    
    // Double-tap to search (with 300ms window)
    setTimeout(() => {
      if (touchCount === 2) {
        openFuzzySearchModal();
        touchCount = 0;
      } else {
        touchCount = 0;
      }
    }, 300);
  });
  
  // Add swipe gestures for navigation
  let touchStartX = 0;
  let touchStartY = 0;
  
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  });
  
  document.addEventListener('touchend', (e) => {
    if (!touchStartX || !touchStartY) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    
    // Only trigger if swipe is primarily horizontal and significant
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 100) {
      // Swipe right to go back (if possible)
      if (deltaX > 0 && window.history.length > 1) {
        window.history.back();
      }
      // Swipe left to go to home (if not already there)
      else if (deltaX < 0) {
        // Check if we're not on home page
        if (window.location.pathname !== '/index.xml' && window.location.pathname !== '/') {
          const homeLink = document.querySelector('a[href="index.xml"]');
          if (homeLink) {
            homeLink.click();
          }
        }
      }
    }
    
    touchStartX = 0;
    touchStartY = 0;
  });
  
  // Improve keyboard support on mobile devices with external keyboards
  document.addEventListener('keydown', (e) => {
    // Add Escape key support for modals
    if (e.key === 'Escape') {
      // Close search modal
      const searchOverlay = document.querySelector('.fuzzy-search-overlay.active');
      if (searchOverlay) {
        searchOverlay.classList.remove('active');
        setTimeout(() => searchOverlay.remove(), 300);
        return;
      }
      
      // Close graph modal
      const graphOverlay = document.querySelector('.concept-graph-overlay.active');
      if (graphOverlay) {
        graphOverlay.classList.remove('active');
        setTimeout(() => {
          graphOverlay.remove();
          if (conceptGraph) {
            conceptGraph.remove();
            conceptGraph = null;
          }
        }, 300);
        return;
      }
    }
  });
  
  console.log('📱 Mobile support enhanced with toolbar, gestures, and responsive handling');
}
