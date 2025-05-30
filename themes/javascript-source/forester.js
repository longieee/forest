import 'ninja-keys';
import 'katex';

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
  toggleButton.title = 'Toggle theme (Cmd+Shift+T)';
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

fetch("./forest.json")
 .then((res) => res.json())
 .then((data) => {
  const items = []

  const editIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M480-120v-71l216-216 71 71-216 216h-71ZM120-330v-60h300v60H120Zm690-49-71-71 29-29q8-8 21-8t21 8l29 29q8 8 8 21t-8 21l-29 29ZM120-495v-60h470v60H120Zm0-165v-60h470v60H120Z"/></svg>'
  const bookmarkIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M120-40v-700q0-24 18-42t42-18h480q24 0 42.5 18t18.5 42v700L420-167 120-40Zm60-91 240-103 240 103v-609H180v609Zm600 1v-730H233v-60h547q24 0 42 18t18 42v730h-60ZM180-740h480-480Z"/></svg>'
  const themeIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q14 0 27.5 1t26.5 3q-41 29-65.5 75.5T444-660q0 90 63 153t153 63q55 0 101-24.5t75-65.5q2 13 3 26.5t1 27.5q0 150-105 255T480-120Z"/></svg>'

  // Theme switching commands
  items.push({
    id: 'toggle-theme',
    title: 'Toggle Dark/Light Mode',
    section: 'Theme',
    hotkey: 'cmd+shift+t',
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


