// Background script for X.com Tags Manager

// Listen for extension icon click
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({
        url: chrome.runtime.getURL('options.html')
    });
});

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // Open options page on first install
        chrome.tabs.create({
            url: chrome.runtime.getURL('options.html')
        });
    }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'refreshTags') {
        // Forward the message to content scripts
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.url && (
                    tab.url.includes('axiom.trade/pulse') ||
                    tab.url.includes('twitter.com') ||
                    tab.url.includes('x.com')
                )) {
                    chrome.tabs.sendMessage(tab.id, request);
                }
            });
        });
        sendResponse({ success: true });
    }
}); 