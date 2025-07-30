class XComTagsHighlighter {
    constructor() {
        this.tags = [];
        this.processedElements = new WeakSet(); // Track processed elements
        this.isProcessing = false; // Prevent concurrent processing
        this.init();
    }

    async init() {
        await this.loadTags();
        this.startObserving();
        this.processExistingContent();
    }

    async loadTags() {
        try {
            const result = await chrome.storage.sync.get(['xcom_tags']);
            this.tags = result.xcom_tags || [];
            console.log('Loaded tags:', this.tags);
        } catch (error) {
            console.error('Error loading tags:', error);
            this.tags = [];
        }
    }

    startObserving() {
        // Create a mutation observer to watch for new content
        const observer = new MutationObserver((mutations) => {
            if (this.isProcessing) return; // Prevent concurrent processing
            
            const hasRelevantChanges = mutations.some(mutation => {
                return mutation.type === 'childList' && 
                       mutation.addedNodes.length > 0 &&
                       Array.from(mutation.addedNodes).some(node => 
                           node.nodeType === Node.ELEMENT_NODE
                       );
            });

            if (hasRelevantChanges) {
                // Debounce the processing
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList') {
                            mutation.addedNodes.forEach((node) => {
                                if (node.nodeType === Node.ELEMENT_NODE) {
                                    this.processContent(node);
                                }
                            });
                        }
                    });
                }, 100);
            }
        });

        // Start observing the document body
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    processExistingContent() {
        // Process existing content on page load
        this.processContent(document.body);
    }

    processContent(container) {
        if (!container || !container.querySelectorAll || this.isProcessing) return;
        
        this.isProcessing = true;
        
        try {
            // Find all X.com links on axiom.trade/pulse
            if (window.location.href.includes('axiom.trade/pulse')) {
                this.processAxiomPulsePage(container);
            }

            // Also process regular text highlighting
            this.highlightTextContent(container);
        } finally {
            this.isProcessing = false;
        }
    }

    processAxiomPulsePage(container) {
        // Find all links that contain X.com URLs
        const xcomLinks = container.querySelectorAll('a[href*="x.com"], a[href*="twitter.com"]');
        
        xcomLinks.forEach(link => {
            // Skip if already processed
            if (this.processedElements.has(link)) return;
            
            this.processXComLink(link);
            this.processedElements.add(link);
        });
    }

    processXComLink(link) {
        const href = link.getAttribute('href');
        if (!href) return;

        // Extract username from X.com URL
        const username = this.extractUsernameFromUrl(href);
        if (!username) return;

        // Check if username is in our tags
        if (this.tags.includes(username.toLowerCase())) {
            this.highlightCoin(link, username);
        }
    }

    extractUsernameFromUrl(url) {
        // Match patterns like:
        // https://x.com/username/status/...
        // https://twitter.com/username/status/...
        const match = url.match(/(?:x\.com|twitter\.com)\/([^\/]+)/);
        return match ? match[1] : null;
    }

    highlightCoin(link, username) {
        // Find the coin container (parent element that contains the coin info)
        const coinContainer = this.findCoinContainer(link);
        if (!coinContainer) {
            console.log('No coin container found for:', username);
            return;
        }

        // Skip if already highlighted
        if (coinContainer.hasAttribute('data-xcom-highlighted')) return;

        // Debug: log the selected container
        console.log('Highlighting coin container for @' + username + ':', coinContainer);
        console.log('Container classes:', coinContainer.className);
        console.log('Container dimensions:', coinContainer.offsetWidth + 'x' + coinContainer.offsetHeight);

        // Add green background to the coin with better styling for axiom.trade/pulse
        coinContainer.style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
        coinContainer.style.border = '2px solid #28a745';
        coinContainer.style.borderRadius = '12px';
        coinContainer.style.padding = '8px';
        coinContainer.style.transition = 'all 0.3s ease';
        coinContainer.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.2)';
        coinContainer.style.position = 'relative';
        coinContainer.style.zIndex = '1';

        // Add a visual indicator
        coinContainer.setAttribute('data-xcom-highlighted', 'true');
        coinContainer.setAttribute('data-xcom-username', username);

        // Add hover effect (only once)
        if (!coinContainer.hasAttribute('data-xcom-hover-added')) {
            coinContainer.addEventListener('mouseenter', () => {
                coinContainer.style.backgroundColor = 'rgba(40, 167, 69, 0.15)';
                coinContainer.style.transform = 'translateY(-2px)';
                coinContainer.style.boxShadow = '0 6px 20px rgba(40, 167, 69, 0.3)';
                coinContainer.style.borderColor = '#20c997';
            });

            coinContainer.addEventListener('mouseleave', () => {
                coinContainer.style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
                coinContainer.style.transform = 'translateY(0)';
                coinContainer.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.2)';
                coinContainer.style.borderColor = '#28a745';
            });

            coinContainer.setAttribute('data-xcom-hover-added', 'true');
        }

        // Add click handler to open coin in new tab (only once)
        if (!coinContainer.hasAttribute('data-xcom-click-added')) {
            coinContainer.addEventListener('click', (e) => {
                // Don't trigger if clicking on the X.com link itself
                if (e.target.closest('a[href*="x.com"], a[href*="twitter.com"]')) {
                    return;
                }

                // Find the coin link or create one
                const coinLink = this.findCoinLink(coinContainer);
                if (coinLink) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Open coin in new tab
                    window.open(coinLink, '_blank');
                    
                    // Show notification
                    this.showNotification(`Открыта монета от @${username}`, 'success');
                }
            });

            coinContainer.setAttribute('data-xcom-click-added', 'true');
        }

        // Add cursor pointer to indicate clickable
        coinContainer.style.cursor = 'pointer';

        // Add a small badge to show it's highlighted
        this.addHighlightBadge(coinContainer, username);
    }

    findCoinContainer(link) {
        // Start from the link and go up the DOM tree to find the main coin container
        let element = link;
        let depth = 0;
        const maxDepth = 30; // Much deeper search

        while (element && depth < maxDepth) {
            // Look for the specific coin container pattern from axiom.trade/pulse
            if (this.isCoinContainer(element)) {
                return element;
            }
            element = element.parentElement;
            depth++;
        }

        // If no specific container found, try to find the closest parent that looks like a coin container
        const closestContainer = link.closest('[class*="flex flex-col flex-1"], [class*="coin"], [class*="card"], [class*="item"], [class*="row"]');
        if (closestContainer) {
            return closestContainer;
        }

        // Try alternative search method
        const alternativeContainer = this.findAlternativeCoinContainer(link);
        if (alternativeContainer) {
            return alternativeContainer;
        }

        // Last resort - go up to find any reasonable container
        let fallbackElement = link;
        for (let i = 0; i < 20; i++) { // Much more iterations
            if (fallbackElement && fallbackElement.parentElement) {
                fallbackElement = fallbackElement.parentElement;
                // Check if this element has reasonable dimensions and structure
                if (fallbackElement.offsetWidth > 200 && fallbackElement.offsetHeight > 100) {
                    return fallbackElement;
                }
            }
        }

        return link.parentElement;
    }

    findAlternativeCoinContainer(link) {
        // Alternative method: look for the main coin container by searching for specific content
        const coinNameElement = link.closest('div').querySelector('span.text-textPrimary');
        if (coinNameElement) {
            // Find the parent container that contains the coin name
            let container = coinNameElement;
            for (let i = 0; i < 25; i++) { // Much more iterations
                if (container && container.className && 
                    (container.className.includes('flex flex-col flex-1') || 
                     container.className.includes('h-full'))) {
                    return container;
                }
                container = container.parentElement;
            }
        }

        // Look for any container that has both coin name and X.com link
        const containers = document.querySelectorAll('div');
        for (let container of containers) {
            if (container.querySelector('span.text-textPrimary') && 
                container.querySelector('a[href*="x.com"]') &&
                container.offsetWidth > 200 && 
                container.offsetHeight > 100 &&
                !container.className.includes('modal') &&
                !container.className.includes('popup') &&
                !container.className.includes('dialog')) {
                return container;
            }
        }

        return null;
    }

    isCoinContainer(element) {
        if (!element || !element.className) return false;

        const className = element.className;
        
        // Check for the specific axiom.trade/pulse coin container pattern
        if (className.includes('flex flex-col flex-1 h-full gap-[20px]')) {
            return true;
        }
        
        // Check for other common coin container patterns
        if (className.includes('flex flex-col flex-1') && className.includes('h-full')) {
            return true;
        }
        
        // Check for elements that contain coin-related content
        if (element.querySelector && (
            element.querySelector('span.text-textPrimary') || // Coin name
            element.querySelector('a[href*="x.com"]') || // X.com link
            element.querySelector('a[href*="twitter.com"]') // Twitter link
        )) {
            // Make sure it's not too deep in the DOM (avoid modal content)
            let depth = 0;
            let parent = element.parentElement;
            while (parent && depth < 5) {
                if (parent.className && (
                    parent.className.includes('modal') || 
                    parent.className.includes('popup') || 
                    parent.className.includes('dialog') ||
                    parent.className.includes('overlay')
                )) {
                    return false; // This is inside a modal, keep looking
                }
                parent = parent.parentElement;
                depth++;
            }
            return true;
        }
        
        // Also check for other common patterns
        const coinKeywords = ['coin', 'card', 'item', 'row', 'flex', 'grid'];
        const lowerClassName = className.toLowerCase();
        
        return coinKeywords.some(keyword => lowerClassName.includes(keyword));
    }

    findCoinLink(container) {
        // Look for any link that might be the coin link
        const links = container.querySelectorAll('a[href]');
        
        for (let link of links) {
            const href = link.getAttribute('href');
            // Skip X.com links, look for other links (like coin details)
            if (href && !href.includes('x.com') && !href.includes('twitter.com') && !href.includes('tiktok.com')) {
                return href;
            }
        }

        // Look for coin name that might be clickable
        const coinNameElement = container.querySelector('span.text-textPrimary');
        if (coinNameElement && coinNameElement.textContent) {
            // Try to construct a search URL for the coin
            const coinName = coinNameElement.textContent.trim();
            if (coinName) {
                return `https://axiom.trade/search?q=${encodeURIComponent(coinName)}`;
            }
        }

        // If no specific coin link found, return the current page URL
        return window.location.href;
    }

    addHighlightBadge(container, username) {
        // Remove existing badge if any
        const existingBadge = container.querySelector('.xcom-highlight-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        // Create badge
        const badge = document.createElement('div');
        badge.className = 'xcom-highlight-badge';
        badge.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span>@${username}</span>
        `;
        
        badge.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: linear-gradient(135deg, #1da1f2, #0d8bd9);
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 4px;
            z-index: 10;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        `;

        // Make container relative for absolute positioning
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        container.appendChild(badge);
    }

    highlightTextContent(container) {
        if (!container || !container.textContent || this.processedElements.has(container)) return;

        // Mark as processed
        this.processedElements.add(container);

        // Look for X.com usernames in the content
        const textNodes = this.getTextNodes(container);
        
        textNodes.forEach(node => {
            // Skip if already processed
            if (this.processedElements.has(node)) return;
            
            const text = node.textContent;
            const highlightedText = this.highlightUsernames(text);
            
            if (highlightedText !== text) {
                const wrapper = document.createElement('span');
                wrapper.innerHTML = highlightedText;
                node.parentNode.replaceChild(wrapper, node);
                this.processedElements.add(wrapper);
            }
            
            this.processedElements.add(node);
        });
    }

    getTextNodes(container) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // Skip if already processed
                    if (this.processedElements.has(node)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            },
            false
        );

        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        return textNodes;
    }

    highlightUsernames(text) {
        if (!this.tags.length) return text;

        // Create a regex pattern to match usernames
        const usernamePattern = /@(\w+)/gi;
        
        return text.replace(usernamePattern, (match, username) => {
            const lowerUsername = username.toLowerCase();
            
            if (this.tags.includes(lowerUsername)) {
                return `<span class="xcom-highlighted-tag" style="
                    background: linear-gradient(135deg, #1da1f2, #0d8bd9);
                    color: white;
                    padding: 2px 6px;
                    border-radius: 12px;
                    font-weight: 600;
                    font-size: 0.9em;
                    box-shadow: 0 2px 4px rgba(29, 161, 242, 0.3);
                    margin: 0 2px;
                    display: inline-block;
                    position: relative;
                " title="Highlighted from your X.com tags list">${match}</span>`;
            }
            
            return match;
        });
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.xcom-notification');
        existingNotifications.forEach(notification => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `xcom-notification xcom-notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;

        // Set background color based on type
        if (type === 'success') {
            notification.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
        } else if (type === 'error') {
            notification.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
        } else {
            notification.style.background = 'linear-gradient(135deg, #17a2b8, #138496)';
        }

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Hide notification after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Method to refresh tags (can be called from popup)
    async refreshTags() {
        await this.loadTags();
        this.processedElements = new WeakSet(); // Reset processed elements
        this.processExistingContent();
    }
}

// Initialize the highlighter when the page loads
let highlighter;
document.addEventListener('DOMContentLoaded', () => {
    highlighter = new XComTagsHighlighter();
});

// Also initialize if the script runs after DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        highlighter = new XComTagsHighlighter();
    });
} else {
    highlighter = new XComTagsHighlighter();
}

// Listen for messages from popup to refresh tags
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'refreshTags' && highlighter) {
        highlighter.refreshTags();
        sendResponse({ success: true });
    }
});

// Export for debugging
window.xcomHighlighter = highlighter;