document.addEventListener('DOMContentLoaded', () => {
  const providers = MODEL_REGISTRY.getAllProviders();
  initProviderSelect(providers);
  bindEvents();
});

function initProviderSelect(providers) {
  const select = document.getElementById('welcomeProvider');
  select.innerHTML = '<option value="">-- 选择提供商 --</option>';
  providers.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.hasFree ? '🆓 ' : ''}${p.name}`;
    select.appendChild(opt);
  });
  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = '自定义';
  select.appendChild(customOpt);

  select.addEventListener('change', () => {
    const modelSelect = document.getElementById('welcomeModel');
    modelSelect.innerHTML = '<option value="">-- 选择模型 --</option>';
    const provider = MODEL_REGISTRY.getProvider(select.value);
    if (provider) {
      provider.models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.free ? '🆓 ' : ''}${m.name}`;
        modelSelect.appendChild(opt);
      });
      if (provider.models.length > 0) modelSelect.value = provider.models[0].id;
    }
  });

  select.value = 'zhipu';
  select.dispatchEvent(new Event('change'));
}

function bindEvents() {
  document.getElementById('btnFreeSignup').addEventListener('click', () => {
    window.open('https://open.bigmodel.cn/', '_blank');
    showKeyForm('zhipu');
  });

  document.getElementById('btnFreeHas').addEventListener('click', () => {
    showKeyForm('zhipu');
  });

  document.getElementById('btnLocal').addEventListener('click', () => {
    chrome.storage.local.set({
      channelMode: 'local',
      firstInstall: Date.now(),
      enabled: true
    }, () => {
      window.close();
    });
  });

  document.getElementById('btnDocker').addEventListener('click', () => {
    chrome.storage.local.set({
      channelMode: 'docker',
      firstInstall: Date.now(),
      enabled: true
    }, () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });
  });

  document.getElementById('btnConfirmKey').addEventListener('click', () => {
    const provider = document.getElementById('welcomeProvider').value;
    const model = document.getElementById('welcomeModel').value;
    const apiKey = document.getElementById('welcomeKey').value.trim();

    if (!apiKey) {
      alert('请输入 API Key');
      return;
    }

    chrome.storage.local.set({
      channelMode: 'smart',
      apiProvider: provider,
      apiModel: model,
      apiKey: apiKey,
      firstInstall: Date.now(),
      enabled: true
    }, () => {
      window.close();
    });
  });

  document.getElementById('btnCancelKey').addEventListener('click', () => {
    document.getElementById('keyForm').style.display = 'none';
  });
}

function showKeyForm(defaultProvider) {
  document.getElementById('keyForm').style.display = 'block';
  document.getElementById('welcomeProvider').value = defaultProvider;
  document.getElementById('welcomeProvider').dispatchEvent(new Event('change'));
  document.getElementById('welcomeKey').focus();
}