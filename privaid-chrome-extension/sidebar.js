let port = chrome.runtime.connect({name: "privaid"});
let currentTab = 'chat';
let currentBotMessage = null;

// Tab switching functionality
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');
        currentTab = tab.dataset.tab;
    });
});

// Chat functionality
document.getElementById('chatSubmit').addEventListener('click', () => sendMessage('chat'));
document.getElementById('chatInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage('chat');
    }
});

// Compose functionality
document.getElementById('composeSubmit').addEventListener('click', () => sendMessage('compose'));
document.getElementById('composeInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage('compose');
    }
});

document.getElementById('copyCompose').addEventListener('click', () => {
    const composeText = document.getElementById('composeTextArea');
    composeText.select();
    document.execCommand('copy');
});

document.getElementById('insertCompose').addEventListener('click', () => {
    const composeText = document.getElementById('composeTextArea').value;
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "insertText", text: composeText});
    });
});

// Summarize functionality
document.getElementById('summarize').addEventListener('click', summarizePage);

async function sendMessage(type) {
    let input = document.getElementById(type + 'Input');
    let message = input.value.trim();
    if (message === '') return;
    input.value = '';
    
    if (type === 'chat') {
        addMessageToChatbox(message, 'user-message');
    } else if (type === 'compose') {
        // Clear the compose text area when sending a new compose instruction
        document.getElementById('composeTextArea').value = '';
    }
    
    try {
        let messageObject;
        
        if (type === 'chat') {
            let pageContent = await getPageContent();
            let context = `Title: ${pageContent.title}\nContent: ${pageContent.mainContent}`;
            messageObject = {
                type: "query",
                text: message,
                context: context
            };
        } else if (type === 'compose') {
            messageObject = {
                type: "compose",
                text: message
            };
        }
        
        port.postMessage({text: messageObject});
    } catch (error) {
        console.error("Error in sendMessage:", error);
        if (type === 'chat') {
            addMessageToChatbox('Error: ' + error, 'bot-message error-message');
        } else {
            document.getElementById('composeTextArea').value = 'Error: ' + error;
        }
    }
}

port.onMessage.addListener(function(response) {
    console.log("Received response:", response);

    try {
        let processedResponse = response.text && typeof response.text === 'object' ? response.text : response;

        if (processedResponse.type === 'response') {
            if (currentTab === 'chat') {
                if (!currentBotMessage) {
                    currentBotMessage = createBotMessageContainer();
                }
                currentBotMessage.textContent += processedResponse.text;
                if (processedResponse.isLast) {
                    currentBotMessage = null;
                }
            } else if (currentTab === 'compose') {
                document.getElementById('composeTextArea').value += processedResponse.text;
            }
        } else if (processedResponse.type === 'error') {
            if (currentTab === 'chat') {
                addMessageToChatbox('Error: ' + processedResponse.text, 'bot-message error-message');
            } else if (currentTab === 'compose') {
                document.getElementById('composeTextArea').value = 'Error: ' + processedResponse.text;
            }
        } else if (processedResponse.type === 'info') {
            if (currentTab === 'chat') {
                addMessageToChatbox('Info: ' + processedResponse.text, 'bot-message info-message');
            } else if (currentTab === 'compose') {
                document.getElementById('composeTextArea').value = 'Info: ' + processedResponse.text;
            }
        } else {
            console.log("Unknown message type received:", processedResponse.type);
            if (currentTab === 'chat') {
                addMessageToChatbox('Received: ' + JSON.stringify(processedResponse), 'bot-message');
            } else if (currentTab === 'compose') {
                document.getElementById('composeTextArea').value = 'Received: ' + JSON.stringify(processedResponse);
            }
        }
    } catch (error) {
        console.error("Error processing response:", error);
        if (currentTab === 'chat') {
            addMessageToChatbox('Error processing response: ' + JSON.stringify(response), 'bot-message error-message');
        } else if (currentTab === 'compose') {
            document.getElementById('composeTextArea').value = 'Error processing response: ' + JSON.stringify(response);
        }
    }
    
    if (currentTab === 'chat') {
        document.getElementById('chatbox').scrollTop = document.getElementById('chatbox').scrollHeight;
    }
});

function createBotMessageContainer() {
    let chatbox = document.getElementById('chatbox');
    let messageContainer = document.createElement('div');
    messageContainer.className = 'message-container';
    
    let messageElement = document.createElement('div');
    messageElement.className = 'message bot-message';
    
    messageContainer.appendChild(messageElement);
    chatbox.appendChild(messageContainer);
    chatbox.scrollTop = chatbox.scrollHeight;
    
    return messageElement;
}

function addMessageToChatbox(message, className) {
    let chatbox = document.getElementById('chatbox');
    let messageContainer = document.createElement('div');
    messageContainer.className = 'message-container';
    
    let messageElement = document.createElement('div');
    messageElement.className = `message ${className}`;
    messageElement.textContent = message;
    
    messageContainer.appendChild(messageElement);
    chatbox.appendChild(messageContainer);
    chatbox.scrollTop = chatbox.scrollHeight;
}

function getPageContent() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "getPageContent"}, function(response) {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(response);
                    }
                });
            } else {
                reject("No active tab found");
            }
        });
    });
}

async function summarizePage() {
    try {
        let pageContent = await getPageContent();
        let context = `Title: ${pageContent.title}\nContent: ${pageContent.mainContent}`;
        
        let messageObject = {
            type: "summarize",
            context: context
        };
        
        port.postMessage({text: messageObject});
    } catch (error) {
        console.error("Error getting page content:", error);
        addMessageToChatbox('Error getting page content: ' + error, 'bot-message error-message');
    }
}

// Set placeholder text for compose input
document.getElementById('composeInput').placeholder = "Enter compose instruction...";