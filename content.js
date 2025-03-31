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
  } else if (request.action === "updateSettings") {
    updateSettings(request.settings);
    sendResponse({ status: "success" });
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
  
  // Apply saved settings
  loadAndApplySettings();
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
  // Try to find the main content using common selectors, with expanded options
  const contentSelectors = [
    'article',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content-body',
    '.story-body',
    '.post',
    '.blog-post',
    '.blog-entry',
    'main',
    '#main-content',
    '#content',
    '.content',
    '.main',
    // More blog-specific selectors
    '.blog-content',
    '.article-body',
    '.post-body',
    '.entry',
    '.single-post',
    // Medium-like platforms
    '.story',
    '.story-body-container'
  ];
  
  // Look for content elements with substantial text
  for (const selector of contentSelectors) {
    const elements = document.querySelectorAll(selector);
    
    for (const element of elements) {
      if (element && element.textContent.trim().length > 200) {
        // Found a substantial content block
        return cleanContent(element.innerHTML);
      }
    }
  }
  
  // Advanced content determination using paragraph density
  const paragraphMap = new Map();
  const paragraphs = document.querySelectorAll('p');
  
  if (paragraphs.length === 0) {
    // If no paragraphs found, try to get content from div elements
    return extractFromDivs();
  }
  
  // Map paragraphs to their parent elements
  paragraphs.forEach(p => {
    // Skip very short paragraphs (likely UI elements, not content)
    if (p.textContent.trim().length < 30) return;
    
    // Skip hidden paragraphs
    const style = window.getComputedStyle(p);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    
    // Find suitable container (avoid html, body as too generic)
    let parent = p.parentElement;
    let depth = 0;
    const maxDepth = 5; // Avoid going too high in DOM
    
    while (parent && depth < maxDepth) {
      if (parent.tagName !== 'HTML' && parent.tagName !== 'BODY') {
        // Track this parent element
        if (!paragraphMap.has(parent)) {
          paragraphMap.set(parent, {
            element: parent,
            paragraphs: 1,
            textLength: p.textContent.trim().length
          });
        } else {
          const data = paragraphMap.get(parent);
          data.paragraphs += 1;
          data.textLength += p.textContent.trim().length;
        }
      }
      parent = parent.parentElement;
      depth++;
    }
  });
  
  // Find the container with the most paragraphs and text
  let bestContainer = null;
  let maxScore = 0;
  
  for (const [_, data] of paragraphMap.entries()) {
    // Calculate score based on paragraph count and text length
    const score = (data.paragraphs * 10) + (data.textLength / 50);
    
    if (score > maxScore) {
      maxScore = score;
      bestContainer = data.element;
    }
  }
  
  if (bestContainer) {
    return cleanContent(bestContainer.innerHTML);
  }
  
  // If all else fails, try to extract from div elements
  return extractFromDivs();
}

function extractFromDivs() {
  // Look for div elements that might contain content
  const contentDivs = Array.from(document.querySelectorAll('div'))
    .filter(div => {
      // Skip tiny elements
      if (div.textContent.trim().length < 500) return false;
      
      // Skip hidden elements
      const style = window.getComputedStyle(div);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      
      // Skip elements that contain too many other divs (likely layout containers)
      if (div.querySelectorAll('div').length > 20) return false;
      
      return true;
    })
    .sort((a, b) => b.textContent.length - a.textContent.length);
  
  if (contentDivs.length > 0) {
    // Use the div with the most text
    return cleanContent(contentDivs[0].innerHTML);
  }
  
  // Last resort: find the largest text block
  const allElements = document.querySelectorAll('*');
  let bestElement = null;
  let maxLength = 0;
  
  for (const element of allElements) {
    // Skip script, style, meta elements
    if (['SCRIPT', 'STYLE', 'META', 'LINK', 'HEAD'].includes(element.tagName)) continue;
    
    const textLength = element.textContent.trim().length;
    if (textLength > maxLength) {
      maxLength = textLength;
      bestElement = element;
    }
  }
  
  if (bestElement) {
    return cleanContent(bestElement.innerHTML);
  }
  
  // If all else fails, just clean up the body content
  return cleanContent(document.body.innerHTML);
}

function cleanContent(html) {
  // Create a document fragment to work with
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Remove unwanted elements
  const removeSelectors = [
    'script', 'style', 'iframe', 'nav', 'noscript',
    'header:not(.entry-header):not(.article-header)',
    'footer', '.ad', '.ads', '.advertisement', 
    '.social-share', '.social-links', '.share-buttons',
    '.sidebar', '.widget', '.comment', '.comments', 
    '.related', '.related-posts', '#comments',
    '.menu', '.navigation', '.search', '.search-form',
    '[role="banner"]', '[role="navigation"]', '[role="complementary"]'
  ];
  
  removeSelectors.forEach(selector => {
    tempDiv.querySelectorAll(selector).forEach(el => {
      el.remove();
    });
  });
  
  // Remove hidden elements
  tempDiv.querySelectorAll('*').forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      el.remove();
    }
  });
  
  // Keep all content elements but repackage them
  const contentDiv = document.createElement('div');
  
  // First, add all headings (to preserve structure)
  const headings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const addedHeadings = new Set();
  
  headings.forEach(el => {
    // Skip duplicate headings
    const headingText = el.textContent.trim();
    if (headingText && !addedHeadings.has(headingText)) {
      addedHeadings.add(headingText);
      contentDiv.appendChild(el.cloneNode(true));
    }
  });
  
  // Add main content elements
  const contentElements = tempDiv.querySelectorAll('p, ul, ol, blockquote, pre, code, table, img, figure, div.wp-block-image, div.wp-caption');
  
  contentElements.forEach(el => {
    // Skip empty elements
    if (!el.textContent.trim() && el.tagName !== 'IMG') return;
    
    // Deep clone to avoid reference issues
    const clone = el.cloneNode(true);
    
    // Handle images specially
    if (el.tagName === 'IMG') {
      handleImage(el, contentDiv);
    } 
    // Handle tables
    else if (el.tagName === 'TABLE') {
      const tableWrapper = document.createElement('div');
      tableWrapper.className = 'clean-reader-table-wrapper';
      tableWrapper.appendChild(clone);
      contentDiv.appendChild(tableWrapper);
    }
    // Handle WordPress image blocks and captions
    else if (el.classList.contains('wp-block-image') || el.classList.contains('wp-caption')) {
      contentDiv.appendChild(clone);
    }
    // Handle other content
    else {
      contentDiv.appendChild(clone);
    }
  });
  
  return contentDiv.innerHTML;
}

function handleImage(imgEl, container) {
  // Check if image has reasonable dimensions
  if (imgEl.width < 50 || imgEl.height < 50) {
    // Skip icons and tiny images
    return;
  }
  
  // Create figure element
  const figure = document.createElement('figure');
  const img = imgEl.cloneNode(true);
  img.className = 'clean-reader-image';
  figure.appendChild(img);
  
  // Try to find caption from various sources
  let caption = '';
  
  // Check alt text
  if (imgEl.alt && imgEl.alt.trim().length > 0) {
    caption = imgEl.alt;
  }
  
  // Check for figcaption in parent figure
  if (!caption && imgEl.closest('figure')) {
    const figCaption = imgEl.closest('figure').querySelector('figcaption');
    if (figCaption) {
      caption = figCaption.textContent.trim();
    }
  }
  
  // Check for WordPress caption
  if (!caption) {
    const wpCaption = imgEl.closest('.wp-caption');
    if (wpCaption) {
      const captionText = wpCaption.querySelector('.wp-caption-text');
      if (captionText) {
        caption = captionText.textContent.trim();
      }
    }
  }
  
  // Add caption if found
  if (caption) {
    const figCaption = document.createElement('figcaption');
    figCaption.textContent = caption;
    figure.appendChild(figCaption);
  }
  
  container.appendChild(figure);
}

function extractMetadata() {
  let meta = '';
  
  // Author
  const authorSelectors = [
    'meta[name="author"]',
    '.author',
    '.byline',
    '[rel="author"]',
    '.author-name',
    '.post-author',
    '.entry-author',
    'span[itemprop="author"]',
    '[class*="author"]'
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
    '.timestamp',
    '.post-date',
    '.entry-date',
    '.publish-date',
    'span[itemprop="datePublished"]',
    '[class*="date"]'
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
  
  // Extract categories/tags if available
  const categorySelectors = [
    '.categories', 
    '.tags', 
    '.post-categories',
    '.post-tags',
    '[rel="category"]',
    '[rel="tag"]'
  ];
  
  for (const selector of categorySelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const categories = Array.from(elements)
        .map(el => el.textContent.trim())
        .filter(text => text.length > 0);
      
      if (categories.length > 0) {
        meta += `<span class="clean-reader-categories">${categories.join(', ')}</span>`;
        break;
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
  
  // Add font family selector
  const fontFamily = document.createElement('select');
  fontFamily.className = 'clean-reader-select';
  fontFamily.innerHTML = `
    <option value="serif">Serif</option>
    <option value="sans-serif">Sans-serif</option>
    <option value="monospace">Monospace</option>
  `;
  fontFamily.addEventListener('change', (e) => changeFont(e.target.value));
  
  const fontLabel = document.createElement('span');
  fontLabel.textContent = 'Font: ';
  fontLabel.className = 'clean-reader-label';
  
  const fontContainer = document.createElement('div');
  fontContainer.className = 'clean-reader-option';
  fontContainer.appendChild(fontLabel);
  fontContainer.appendChild(fontFamily);
  
  panel.appendChild(fontContainer);
  
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
    
    // Save setting
    chrome.storage.sync.set({ fontSize });
  }
}

function changeFont(fontFamily) {
  const container = document.querySelector('.clean-reader-container');
  if (!container) return;
  
  // Apply font family
  container.style.fontFamily = fontFamily;
  
  // Save setting
  chrome.storage.sync.set({ fontFamily });
}

function toggleTheme() {
  const container = document.querySelector('.clean-reader-container');
  const isDark = container.classList.toggle('clean-reader-dark');
  
  // Save setting
  chrome.storage.sync.set({ darkMode: isDark });
}

function updateSettings(settings) {
  if (!readerModeActive) return;
  
  const container = document.querySelector('.clean-reader-container');
  if (!container) return;
  
  if (settings.theme) {
    if (settings.theme === 'dark') {
      container.classList.add('clean-reader-dark');
    } else {
      container.classList.remove('clean-reader-dark');
    }
  }
  
  if (settings.font) {
    switch (settings.font) {
      case 'serif':
        container.style.fontFamily = 'Georgia, serif';
        break;
      case 'sans-serif':
        container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        break;
      case 'monospace':
        container.style.fontFamily = 'Consolas, Monaco, "Courier New", monospace';
        break;
    }
  }
}

function loadAndApplySettings() {
  chrome.storage.sync.get(['fontFamily', 'fontSize', 'darkMode'], function(data) {
    const container = document.querySelector('.clean-reader-container');
    const content = document.querySelector('.clean-reader-content');
    
    if (data.fontFamily) {
      container.style.fontFamily = data.fontFamily;
      
      // Update select dropdown
      const fontSelect = document.querySelector('.clean-reader-select');
      if (fontSelect) {
        fontSelect.value = data.fontFamily;
      }
    }
    
    if (data.fontSize && content) {
      content.style.fontSize = `${data.fontSize}px`;
    }
    
    if (data.darkMode) {
      container.classList.add('clean-reader-dark');
    }
  });
}
