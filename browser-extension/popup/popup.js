document.addEventListener('DOMContentLoaded', () => {
  const threshold = document.getElementById('threshold');
  const thresholdValue = document.getElementById('threshold-value');

  chrome.storage.local.get([
    'confidenceThreshold', 'verifiedCount', 'highCount', 'lowCount',
    'channelMode', 'apiProvider', 'apiModel'
  ], (data) => {
    threshold.value = (data.confidenceThreshold || 0.65) * 100;
    thresholdValue.textContent = threshold.value + '%';
    document.getElementById('verified-count').textContent = data.verifiedCount || 0;
    document.getElementById('high-count').textContent = data.highCount || 0;
    document.getElementById('low-count').textContent = data.lowCount || 0;

    const modeLabels = {
      local: '🔒 纯本地',
      smart: '⚡ 智能切换',
      cloud: '☁️ 仅云端',
      docker: '🐳 仅Docker'
    };
    document.getElementById('channelMode').textContent = modeLabels[data.channelMode] || '⚡ 智能切换';

    if (data.channelMode === 'local') {
      document.getElementById('currentModel').textContent = '本地启发式';
    } else if (data.channelMode === 'docker') {
      document.getElementById('currentModel').textContent = data.apiModel || 'qwen2.5:7b';
    } else {
      const provider = MODEL_REGISTRY.getProvider(data.apiProvider);
      const modelName = data.apiModel || provider?.models?.[0]?.name || '未配置';
      document.getElementById('currentModel').textContent = modelName;
    }
  });

  threshold.addEventListener('input', () => {
    thresholdValue.textContent = threshold.value + '%';
    chrome.storage.local.set({ confidenceThreshold: threshold.value / 100 });
  });

  document.getElementById('settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('about').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://github.com/hannanlsa/VerityLens' });
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'UPDATE_STATS') {
    document.getElementById('verified-count').textContent = message.verified || 0;
    document.getElementById('high-count').textContent = message.high || 0;
    document.getElementById('low-count').textContent = message.low || 0;
  }
});
