let nativePort = null;

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({tabId: tab.id});
});

chrome.runtime.onConnect.addListener(function(port) {
  if (port.name === "privaid") {
    port.onMessage.addListener(function(msg) {
      if (nativePort === null) {
        nativePort = chrome.runtime.connectNative('online.privaid.chromeextension');
        nativePort.onMessage.addListener(function(response) {
          port.postMessage({text: response});
        });
      }
      nativePort.postMessage(msg.text);
    });
  }
});
