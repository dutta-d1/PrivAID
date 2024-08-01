# Project Description

To make an AI extension for Chrome that will take the context of the current webpage of the user and give user the ability to perform AI tasks such as page summarization, asking about jargons used in the page or asking to explain anything related to the contents of the webpage. It can also help the user with composing tasks like writing an email or a blog post.

The name of the extension is PrivAid. The domain of the extension is privaid.online. The extension in reverse domain is online.privaid.chromeextension.


# Appearance of the extension

The extension opens a sidebar and has 2 tabs - Chat and Compose

Chat - This is a typical chat interface with bubbles. The user's queries appear in a right aligned bubble and the system responses appear as a left aligned bubble. There is a text field at the bottom and a submit button to submit queries.

Compose - This tab has a single editable large text field for the system response. User is able to modify the response by editing manually, if required. There is a 'copy' button that will copy the entire response to the clipboard. Another button named 'insert' will insert the text in the webpage if the user has the cursor on a text input field. Queries will be input by the user via a small text field at the bottom along with a submit button.


# Design of the system

The extension communicates with a python script via the chrome native bridge interface using stdin and stdout using JSON. The format of the message is as below-

Extension to python script - 
{"type": "query", "text": "Sample query", "context" : "scrapped webpage in escaped format"}
{"type": "summarize", "context" : "scrapped webpage in escaped format"}
{"type: "compose" "text": "Compose instruction"}

Script to extension -
{"type": "respose", "text": "Sample hello response from the LLM.", "isLast": True}
{"type": "info", "text": "Ryzen AI ready"}
{"type": "error", "text": "Error in parsing the input"}
