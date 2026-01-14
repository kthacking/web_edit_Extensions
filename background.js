chrome.action.onClicked.addListener((tab) => {
    if (!tab.url.includes("chrome://")) {
        chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["editor.css"]
        });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["editor.js"]
        });
    }
});
