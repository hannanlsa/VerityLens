/**
 * VerityLens · Edge/Chrome Service Worker (MV3)
 *
 * Edge 和 Chrome 共享 MV3 service worker 规范
 */

// 首次安装
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[VerityLens] Installed:', details.reason);
  if (details.reason === 'install') {
    chrome.storage.local.set({
      firstInstall: Date.now(),
      enabled: true,
      confidenceThreshold: 0.65
    });
  }
});

// 右键菜单
chrome.contextMenus.create({
  id: 'verity-check',
  title: 'VerityLens · 真实性验证',
  contexts: ['link', 'selection', 'page']
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'verity-check') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'VERIFY_REQUEST',
      url: info.linkUrl || info.pageUrl,
      text: info.selectionText
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CONFIDENCE') {
    chrome.storage.local.get('confidenceThreshold').then((data) => {
      sendResponse({ threshold: data.confidenceThreshold || 0.65 });
    });
    return true;
  }
});
