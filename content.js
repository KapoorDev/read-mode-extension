// content.js
let readerModeActive = false;
let originalContent = null;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleReader") {
    toggleReaderMode();
    sendResponse({ status: "success", readerModeActive });
  } else if (request.action === "getStatus") {
    sendResponse({ readerModeActive });
  }
  return true;
});

function toggleReaderMode() {
  if (readerModeActive) {
    disableReaderMode();
  } else {
    enableReaderMode();
  }
}

function enableReaderMode() {
  // Save original content
  originalContent = document.body.innerHTML;
  
  // Extract the main content
  const article = extractMainContent();
  
  // Create reader mode container
  const readerContainer = document.createElement("div");
  readerContainer.className = "clean-reader-container";
  
  // Add title
  const title = document.createElement("h1");
  title.className = "clean-reader-title";
  title.textContent = document.title;
  readerContainer.appendChild(title);
  
  // Add metadata if available
  const meta = extractMetadata();
  if (meta) {
    const metaDiv = document.createElement("div");
    metaDiv.className = "clean-reader-meta";
    metaDiv.innerHTML = meta;
    readerContainer.appendChild(metaDiv);
  }
  
  // Add main content
  const content = document.createElement("div");
  content.className = "clean-reader-content";
  content.innerHTML = article;
  readerContainer.appendChild(content);
  
  // Replace body content
  document.body.innerHTML = "";
  document.body.appendChild(readerContainer);
  
  // Add control panel
  addControlPanel();
  
  // Set active flag
  readerModeActive = true;
}

function disableReaderMode() {
  // Restore original content
  if (originalContent) {
    document.body.innerHTML = originalContent;
  }
  
  // Reset active flag
  readerModeActive = false;
}

function extractMainContent() {
  // Try to find the main content using common selectors
  const contentSelectors = [
    'article',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content-body',
    '.story-body',
    'main',
    '#main-content'
  ];
  
  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.length > 500) {
      // Found a substantial content block
      return cleanContent(element.innerHTML);
    }
  }
  
  // Fallback: heuristic approach to find the largest text block
  const paragraphs = document.querySelectorAll('p');
  let bestParent = null;
  let maxParagraphs = 0;
  
  paragraphs.forEach(p => {
    if (p.textContent.length < 50) return; // Skip short paragraphs
    
    const parent = p.parentElement;
    const siblingParagraphs = parent.querySelectorAll('p').length;
    
    if (siblingParagraphs > maxParagraphs) {
      maxParagraphs = siblingParagraphs;
      bestParent = parent;
    }
  });
  
  if (bestParent && maxParagraphs > 3) {
    return cleanContent(bestParent.innerHTML);
  }
  
  // Last resort: return the body content
  return cleanContent(document.body.innerHTML);
}

function cleanContent(html) {
  // Create a document fragment to work with
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Remove unwanted elements
  const removeSelectors = [
    'script', 'style', 'iframe', 'nav', 'header', 'footer', 
    '.ad', '.ads', '.advertisement', '.social', '.sidebar',
    '.comment', '.comments', '.sharing', '.related'
  ];
  
  removeSelectors.forEach(selector => {
    tempDiv.querySelectorAll(selector).forEach(el => {
      el.remove();
    });
  });
  
  // Keep only paragraphs, headings, lists, blockquotes, and images
  const contentDiv = document.createElement('div');
  
  // Process and add main content elements
  const contentElements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, img, figure');
  contentElements.forEach(el => {
    // Deep clone to avoid reference issues
    const clone = el.cloneNode(true);
    
    // Handle images specially
    if (el.tagName === 'IMG') {
      const figure = document.createElement('figure');
      clone.className = 'clean-reader-image';
      figure.appendChild(clone);
      
      // Add caption if alt text exists
      if (el.alt) {
        const caption = document.createElement('figcaption');
        caption.textContent = el.alt;
        figure.appendChild(caption);
      }
      
      contentDiv.appendChild(figure);
    } else {
      contentDiv.appendChild(clone);
    }
  });
  
  return contentDiv.innerHTML;
}

function extractMetadata() {
  let meta = '';
  
  // Author
  const authorSelectors = [
    'meta[name="author"]',
    '.author',
    '.byline',
    '[rel="author"]'
  ];
  
  for (const selector of authorSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const author = element.getAttribute('content') || element.textContent.trim();
      if (author) {
        meta += `<span class="clean-reader-author">By ${author}</span>`;
        break;
      }
    }
  }
  
  // Date
  const dateSelectors = [
    'meta[property="article:published_time"]',
    'time',
    '.date',
    '.published',
    '.timestamp'
  ];
  
  for (const selector of dateSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const dateStr = element.getAttribute('content') || element.getAttribute('datetime') || element.textContent.trim();
      if (dateStr) {
        try {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            meta += `<span class="clean-reader-date">${date.toLocaleDateString()}</span>`;
            break;
          }
        } catch (e) {
          // Invalid date format, try next selector
        }
      }
    }
  }
  
  return meta;
}

function addControlPanel() {
  const panel = document.createElement('div');
  panel.className = 'clean-reader-controls';
  
  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'clean-reader-btn';
  closeBtn.textContent = 'Exit Reader Mode';
  closeBtn.addEventListener('click', disableReaderMode);
  panel.appendChild(closeBtn);
  
  // Font size controls
  const fontBtns = document.createElement('div');
  fontBtns.className = 'clean-reader-font-controls';
  
  const smallerBtn = document.createElement('button');
  smallerBtn.className = 'clean-reader-btn';
  smallerBtn.textContent = 'A-';
  smallerBtn.addEventListener('click', () => changeFontSize(-1));
  fontBtns.appendChild(smallerBtn);
  
  const largerBtn = document.createElement('button');
  largerBtn.className = 'clean-reader-btn';
  largerBtn.textContent = 'A+';
  largerBtn.addEventListener('click', () => changeFontSize(1));
  fontBtns.appendChild(largerBtn);
  
  panel.appendChild(fontBtns);
  
  // Add theme toggle
  const themeBtn = document.createElement('button');
  themeBtn.className = 'clean-reader-btn';
  themeBtn.textContent = 'Toggle Dark Mode';
  themeBtn.addEventListener('click', toggleTheme);
  panel.appendChild(themeBtn);
  
  document.querySelector('.clean-reader-container').appendChild(panel);
}

function changeFontSize(delta) {
  const content = document.querySelector('.clean-reader-content');
  if (!content) return;
  
  // Get current font size
  const style = window.getComputedStyle(content);
  let fontSize = parseInt(style.fontSize);
  
  // Change font size
  fontSize += delta * 2;
  
  // Apply new font size (within reasonable limits)
  if (fontSize >= 12 && fontSize <= 32) {
    content.style.fontSize = `${fontSize}px`;
  }
}

function toggleTheme() {
  const container = document.querySelector('.clean-reader-container');
  container.classList.toggle('clean-reader-dark');
}