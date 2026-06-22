/**
 * VerityLens · Firefox Background Script (MV2) · v0.5.0
 *
 * 双通道智能路由 + 跨模态自校验
 */

browser.runtime.onInstalled.addListener((details) => {
  console.log('[VerityLens] Installed:', details.reason);
  if (details.reason === 'install') {
    browser.storage.local.set({
      firstInstall: Date.now(),
      enabled: true,
      confidenceThreshold: 0.65,
      channelMode: 'smart',
      complexityThreshold: 3
    });

    browser.tabs.create({ url: browser.runtime.getURL('welcome/welcome.html') });
  }
});

browser.contextMenus.create({
  id: 'verity-check',
  title: 'VerityLens · 真实性验证',
  contexts: ['link', 'selection', 'page']
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'verity-check') {
    browser.tabs.sendMessage(tab.id, {
      type: 'VERIFY_REQUEST',
      url: info.linkUrl || info.pageUrl,
      text: info.selectionText
    });
  }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CONFIDENCE') {
    browser.storage.local.get('confidenceThreshold').then((data) => {
      sendResponse({ threshold: data.confidenceThreshold || 0.65 });
    });
    return true;
  }

  if (message.type === 'UPDATE_STATS') {
    browser.storage.local.get(['verifiedCount', 'highCount', 'lowCount'], (data) => {
      browser.storage.local.set({
        verifiedCount: (data.verifiedCount || 0) + (message.verified || 0),
        highCount: (data.highCount || 0) + (message.high || 0),
        lowCount: (data.lowCount || 0) + (message.low || 0)
      });
    });
    sendResponse({ ok: true });
    return true;
  }
});
