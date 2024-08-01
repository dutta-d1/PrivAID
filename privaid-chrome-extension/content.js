// Helper function to extract text from an element, if it exists
function extractText(selector) {
    const element = document.querySelector(selector);
    return element ? element.innerText.trim() : '';
}

// Helper function to extract meta tag content
function extractMeta(name) {
    const meta = document.querySelector(`meta[name="${name}"]`);
    return meta ? meta.getAttribute('content').trim() : '';
}

// Function to extract main content, avoiding common non-content areas
function extractMainContent() {
    // List of selectors to try, in order of preference
    const contentSelectors = [
        'article', 'main', '#content', '.content', 
        '.post-content', '.entry-content', '.article-content'
    ];
    
    for (let selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            return element.innerText.trim();
        }
    }
    
    // If no suitable content area found, fall back to body text
    return document.body.innerText.trim();
}

// Function to summarize text by first truncating and then applying TextRank
function summarizeText(text, maxLength = 10000) {
    // First, truncate the text to maxLength
    let truncatedText = text.length > maxLength 
        ? text.substr(0, maxLength).split(' ').slice(0, -1).join(' ') + '...'
        : text;
    
    // Then, apply TextRank to the truncated text
    return summarizeTextRank(truncatedText, 5);  // Adjust the number of sentences as needed
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPageContent") {
        // Get the page content
        let content = {
            url: window.location.href,
            title: document.title,
            metaDescription: extractMeta('description'),
            h1: extractText('h1'),
            mainContent: summarizeText(extractMainContent())
        };
        
        // Send the content back to the extension
        sendResponse(content);
    }
});

// Listen for the insertText action
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "insertText") {
        let activeElement = document.activeElement;
        if (activeElement.isContentEditable || 
            (activeElement.tagName === 'TEXTAREA') || 
            (activeElement.tagName === 'INPUT' && activeElement.type === 'text')) {
            
            // Insert text at cursor position
            let start = activeElement.selectionStart;
            let end = activeElement.selectionEnd;
            let text = activeElement.value || activeElement.textContent;
            let before = text.substring(0, start);
            let after = text.substring(end, text.length);
            
            if (activeElement.isContentEditable) {
                // For contentEditable elements
                activeElement.textContent = before + request.text + after;
                // Set cursor position
                let range = document.createRange();
                let sel = window.getSelection();
                range.setStart(activeElement.firstChild, start + request.text.length);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            } else {
                // For input and textarea elements
                activeElement.value = before + request.text + after;
                activeElement.selectionStart = activeElement.selectionEnd = start + request.text.length;
            }
            
            activeElement.focus();
            sendResponse({success: true});
        } else {
            console.log("No editable element focused");
            sendResponse({success: false, error: "No editable element focused"});
        }
        return true; // Indicates that the response is sent asynchronously
    }
});