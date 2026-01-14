chrome.action.onClicked.addListener((tab) => {
    if (!tab.url.includes("chrome://")) {
        // CSS is now handled by manifest content_scripts
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["editor.js"]
        });
    }
});
