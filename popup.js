// popup.js
document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('toggleBtn');
    const fontSelect = document.getElementById('fontSelect');
    const themeSelect = document.getElementById('themeSelect');
    
    // Load saved preferences
    chrome.storage.sync.get(['font', 'theme'], function(data) {
      if (data.font) fontSelect.value = data.font;
      if (data.theme) themeSelect.value = data.theme;
    });
    
    // Check current reader mode status
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "getStatus"}, function(response) {
        if (response && response.readerModeActive) {
          toggleBtn.textContent = "Disable Reader Mode";
          toggleBtn.classList.add("active");
        } else {
          toggleBtn.textContent = "Enable Reader Mode";
          toggleBtn.classList.remove("active");
        }
      });
    });
    
    // Handle toggle button click
    toggleBtn.addEventListener('click', function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "toggleReader"}, function(response) {
          if (response && response.readerModeActive) {
            toggleBtn.textContent = "Disable Reader Mode";
            toggleBtn.classList.add("active");
          } else {
            toggleBtn.textContent = "Enable Reader Mode";
            toggleBtn.classList.remove("active");
          }
        });
      });
    });
    
    // Handle font selection change
    fontSelect.addEventListener('change', function() {
      const font = fontSelect.value;
      chrome.storage.sync.set({font: font});
      
      // Apply to active reader mode if enabled
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "updateSettings",
          settings: {font: font}
        });
      });
    });
    
    // Handle theme selection change
    themeSelect.addEventListener('change', function() {
      const theme = themeSelect.value;
      chrome.storage.sync.set({theme: theme});
      
      // Apply to active reader mode if enabled
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "updateSettings",
          settings: {theme: theme}
        });
      });
    });
  });