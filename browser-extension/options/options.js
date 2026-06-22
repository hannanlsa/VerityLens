document.addEventListener('DOMContentLoaded', () => {
  const providers = MODEL_REGISTRY.getAllProviders();
  const freeProviders = MODEL_REGISTRY.getFreeProviders();
  const paidProviders = MODEL_REGISTRY.getPaidProviders();

  initProviderSelect(providers);
  initFreeModelList(freeProviders);
  initPaidModelList(paidProviders);
  loadSettings();
  bindEvents();
});

function initProviderSelect(providers) {
  const select = document.getElementById('apiProvider');
  select.innerHTML = '<option value="">-- 选择提供商 --</option>';

  const freeGroup = document.createElement('optgroup');
  freeGroup.label = '🆓 免费模型';
  const paidGroup = document.createElement('optgroup');
  paidGroup.label = '💎 付费模型';

  providers.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.hasFree ? '🆓 ' : '💎 '}${p.name}`;
    if (p.tier === 'paid') {
      paidGroup.appendChild(opt);
    } else {
      freeGroup.appendChild(opt);
    }
  });

  select.appendChild(freeGroup);
  select.appendChild(paidGroup);

  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = '自定义';
  select.appendChild(customOpt);
}

function initFreeModelList(freeProviders) {
  const container = document.getElementById('freeModelList');
  container.innerHTML = '';

  freeProviders.forEach(p => {
    p.models.filter(m => m.free).forEach(m => {
      const item = document.createElement('div');
      item.className = 'free-model-item';
      item.dataset.provider = p.id;
      item.dataset.model = m.id;
      item.innerHTML = `
        <div class="free-model-info">
          <div class="free-model-name">${p.name} · ${m.name}</div>
          <div class="free-model-desc">${m.free}</div>
        </div>
        <span class="free-model-badge">🆓 免费</span>
      `;
      item.addEventListener('click', () => {
        document.getElementById('apiProvider').value = p.id;
        onProviderChange();
        document.getElementById('apiModel').value = m.id;
        document.getElementById('signupHint').style.display = 'flex';
        document.getElementById('freeText').textContent = m.free;
        const provider = MODEL_REGISTRY.getProvider(p.id);
        document.getElementById('signupLink').href = provider.signupUrl;
      });
      container.appendChild(item);
    });
  });
}

function initPaidModelList(paidProviders) {
  const container = document.getElementById('paidModelList');
  container.innerHTML = '';

  paidProviders.forEach(p => {
    p.models.forEach(m => {
      const item = document.createElement('div');
      item.className = 'free-model-item';
      item.dataset.provider = p.id;
      item.dataset.model = m.id;
      item.innerHTML = `
        <div class="free-model-info">
          <div class="free-model-name">${p.name} · ${m.name}</div>
          <div class="free-model-desc">${m.price || '按量计费'}</div>
        </div>
        <span class="free-model-badge" style="background:#7c3aed">💎 付费</span>
      `;
      item.addEventListener('click', () => {
        document.getElementById('apiProvider').value = p.id;
        onProviderChange();
        document.getElementById('apiModel').value = m.id;
        document.getElementById('signupHint').style.display = 'flex';
        document.getElementById('freeText').textContent = m.price || '按量计费';
        const provider = MODEL_REGISTRY.getProvider(p.id);
        document.getElementById('signupLink').href = provider.signupUrl;
      });
      container.appendChild(item);
    });
  });
}

function loadSettings() {
  chrome.storage.local.get([
    'channelMode', 'apiProvider', 'apiKey', 'apiModel',
    'dockerUrl', 'dockerModel', 'complexityThreshold',
    'translateEnabled', 'targetLang'
  ], (data) => {
    const mode = data.channelMode || 'smart';
    document.querySelector(`input[name=channelMode][value="${mode}"]`).checked = true;

    if (data.apiProvider) {
      document.getElementById('apiProvider').value = data.apiProvider;
      onProviderChange();
    }
    if (data.apiModel) document.getElementById('apiModel').value = data.apiModel;
    if (data.apiKey) document.getElementById('apiKey').value = data.apiKey;
    if (data.dockerUrl) document.getElementById('dockerUrl').value = data.dockerUrl;
    if (data.dockerModel) document.getElementById('dockerModel').value = data.dockerModel || 'qwen2.5:7b';

    const threshold = data.complexityThreshold || 3;
    document.getElementById('complexityThreshold').value = threshold;
    document.getElementById('thresholdValue').textContent = threshold;

    document.getElementById('translateEnabled').checked = data.translateEnabled !== false;
    document.getElementById('targetLang').value = data.targetLang || 'zh';
  });
}

function bindEvents() {
  document.getElementById('apiProvider').addEventListener('change', onProviderChange);

  document.getElementById('toggleKey').addEventListener('click', () => {
    const input = document.getElementById('apiKey');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('complexityThreshold').addEventListener('input', (e) => {
    document.getElementById('thresholdValue').textContent = e.target.value;
  });

  document.getElementById('testCloud').addEventListener('click', testCloudConnection);
  document.getElementById('testDocker').addEventListener('click', testDockerConnection);
  document.getElementById('save').addEventListener('click', saveSettings);
}

function onProviderChange() {
  const providerId = document.getElementById('apiProvider').value;
  const modelSelect = document.getElementById('apiModel');
  const signupHint = document.getElementById('signupHint');

  modelSelect.innerHTML = '<option value="">-- 选择模型 --</option>';

  if (!providerId) {
    signupHint.style.display = 'none';
    return;
  }

  const provider = MODEL_REGISTRY.getProvider(providerId);
  if (!provider) {
    signupHint.style.display = 'none';
    return;
  }

  provider.models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.free ? '🆓 ' : ''}${m.name}`;
    modelSelect.appendChild(opt);
  });

  if (provider.models.length > 0) {
    modelSelect.value = provider.models[0].id;
  }

  const hasFree = provider.models.some(m => m.free);
  if (hasFree) {
    const freeModel = provider.models.find(m => m.free);
    document.getElementById('freeText').textContent = freeModel.free;
    document.getElementById('signupLink').href = provider.signupUrl;
    signupHint.style.display = 'flex';
  } else {
    signupHint.style.display = 'none';
  }
}

async function testCloudConnection() {
  const btn = document.getElementById('testCloud');
  const status = document.getElementById('cloudStatus');
  btn.disabled = true;
  status.textContent = '测试中...';
  status.style.color = '#eab308';

  const providerId = document.getElementById('apiProvider').value;
  const apiKey = document.getElementById('apiKey').value;
  const model = document.getElementById('apiModel').value;

  if (!providerId) {
    status.textContent = '❌ 请先选择提供商';
    status.style.color = '#ef4444';
    btn.disabled = false;
    return;
  }

  const provider = MODEL_REGISTRY.getProvider(providerId);
  if (!provider) {
    status.textContent = '❌ 未知的提供商';
    status.style.color = '#ef4444';
    btn.disabled = false;
    return;
  }

  try {
    const start = Date.now();
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const resp = await fetch(`${provider.baseUrl}/models`, {
      headers,
      signal: AbortSignal.timeout(5000)
    });

    if (resp.ok) {
      const latency = Date.now() - start;
      status.textContent = `✅ 已连接 (${latency}ms) · ${model || provider.models[0]?.name}`;
      status.style.color = '#22c55e';
    } else {
      status.textContent = `❌ 连接失败 (${resp.status})`;
      status.style.color = '#ef4444';
    }
  } catch (err) {
    status.textContent = `❌ 连接失败: ${err.message.slice(0, 40)}`;
    status.style.color = '#ef4444';
  }

  btn.disabled = false;
}

async function testDockerConnection() {
  const btn = document.getElementById('testDocker');
  const status = document.getElementById('dockerStatus');
  const url = document.getElementById('dockerUrl').value.trim();

  btn.disabled = true;
  status.textContent = '测试中...';
  status.style.color = '#eab308';

  if (!url) {
    status.textContent = '❌ 请输入Docker地址';
    status.style.color = '#ef4444';
    btn.disabled = false;
    return;
  }

  try {
    const start = Date.now();
    const testUrl = url.replace(/\/$/, '') + '/v1/models';
    const resp = await fetch(testUrl, { signal: AbortSignal.timeout(5000) });

    if (resp.ok) {
      const latency = Date.now() - start;
      status.textContent = `✅ 已连接 (${latency}ms)`;
      status.style.color = '#22c55e';
    } else {
      status.textContent = `❌ 连接失败 (${resp.status})`;
      status.style.color = '#ef4444';
    }
  } catch (err) {
    status.textContent = `❌ 连接失败: ${err.message.slice(0, 40)}`;
    status.style.color = '#ef4444';
  }

  btn.disabled = false;
}

function saveSettings() {
  const mode = document.querySelector('input[name=channelMode]:checked').value;
  const provider = document.getElementById('apiProvider').value;
  const apiKey = document.getElementById('apiKey').value;
  const apiModel = document.getElementById('apiModel').value;
  const dockerUrl = document.getElementById('dockerUrl').value.trim();
  const dockerModel = document.getElementById('dockerModel').value.trim();
  const threshold = parseInt(document.getElementById('complexityThreshold').value);

  const data = {
    channelMode: mode,
    apiProvider: provider,
    apiKey: apiKey,
    apiModel: apiModel,
    dockerUrl: dockerUrl,
    dockerModel: dockerModel,
    complexityThreshold: threshold,
    translateEnabled: document.getElementById('translateEnabled').checked,
    targetLang: document.getElementById('targetLang').value,
    enabled: true
  };

  chrome.storage.local.set(data, () => {
    const status = document.getElementById('saveStatus');
    status.textContent = '✅ 已保存';
    status.style.color = '#22c55e';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
}