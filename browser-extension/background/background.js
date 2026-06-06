/**
 * VerityLens · Firefox Background Script (MV2)
 *
 * Firefox MV2 使用 scripts 数组而非 MV3 service_worker
 * 同样实现：右键菜单 + 标签页变化 + 跨域消息
 */

// 首次安装
browser.runtime.onInstalled.addListener((details) => {
  console.log('[VerityLens] Installed:', details.reason);
  if (details.reason === 'install') {
    browser.storage.local.set({
      firstInstall: Date.now(),
      enabled: true,
      confidenceThreshold: 0.65
    });
  }
});

// 右键菜单
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

// 跨域消息
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CONFIDENCE') {
    browser.storage.local.get('confidenceThreshold').then((data) => {
      sendResponse({ threshold: data.confidenceThreshold || 0.65 });
    });
    return true;  // 异步响应
  }
});
