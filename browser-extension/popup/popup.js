document.addEventListener('DOMContentLoaded', () => {
  const threshold = document.getElementById('threshold');
  const thresholdValue = document.getElementById('threshold-value');

  chrome.storage.local.get(['confidenceThreshold', 'verifiedCount', 'highCount', 'lowCount'], (data) => {
    threshold.value = (data.confidenceThreshold || 0.65) * 100;
    thresholdValue.textContent = threshold.value + '%';
    document.getElementById('verified-count').textContent = data.verifiedCount || 0;
    document.getElementById('high-count').textContent = data.highCount || 0;
    document.getElementById('low-count').textContent = data.lowCount || 0;
  });

  threshold.addEventListener('input', () => {
    thresholdValue.textContent = threshold.value + '%';
    chrome.storage.local.set({ confidenceThreshold: threshold.value / 100 });
  });
});
