document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleReaderMode');
  const fontSize = document.getElementById('fontSize');
  const fontFamily = document.getElementById('fontFamily');
  const bgColor = document.getElementById('backgroundColor');

  // Load saved settings
  chrome.storage.sync.get(['isActive', 'settings'], ({ isActive, settings }) => {
    toggleBtn.textContent = isActive ? 'Disable Reader Mode' : 'Enable Reader Mode';
    if (settings) {
      fontSize.value = settings.fontSize || 16;
      fontFamily.value = settings.fontFamily || 'Arial';
      bgColor.value = settings.bgColor || '#ffffff';
    }
  });

  // Toggle reader mode
  toggleBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.storage.sync.get(['isActive'], async ({ isActive }) => {
      const newState = !isActive;
      
      // Inject/remove content script
      if (newState) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      }
      
      chrome.storage.sync.set({ isActive: newState });
      toggleBtn.textContent = newState ? 'Disable Reader Mode' : 'Enable Reader Mode';
      chrome.tabs.sendMessage(tab.id, { action: 'toggle', state: newState });
    });
  });

  // Update settings
  [fontSize, fontFamily, bgColor].forEach(element => {
    element.addEventListener('input', () => {
      const settings = {
        fontSize: fontSize.value,
        fontFamily: fontFamily.value,
        bgColor: bgColor.value
      };
      chrome.storage.sync.set({ settings });
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        chrome.tabs.sendMessage(tab.id, { action: 'updateSettings', settings });
      });
    });
  });
});

