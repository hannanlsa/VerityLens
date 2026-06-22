/**
 * VerityLens · Translator Content Script · 双语翻译注入（v0.6.1）
 *
 * 检测页面语言 → 自动翻译为用户目标语言 → 原文下方插入译文
 * 联合国六大工作语言：zh/en/fr/es/ru/ar
 */

(function() {
  'use strict';

  if (window.__verityTranslatorInjected) return;
  window.__verityTranslatorInjected = true;

  const LOG = [];
  const MAX_LOG = 300;

  function log(msg) {
    const ts = new Date().toISOString().substr(11, 12);
    const entry = `[${ts}] [VerityTranslate] ${msg}`;
    LOG.push(entry);
    if (LOG.length > MAX_LOG) LOG.shift();
    console.log(entry);
  }

  const SEARCH_ENGINES = ['baidu.com', 'so.com', 'sogou.com', 'google.com', 'bing.com', 'duckduckgo.com'];
  function isSearchEngine() {
    return SEARCH_ENGINES.some(e => window.location.hostname.includes(e));
  }

  async function loadConfig() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        return { translateEnabled: true, targetLang: 'zh', apiProvider: '', apiKey: '', apiModel: '' };
      }
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ translateEnabled: true, targetLang: 'zh', apiProvider: '', apiKey: '', apiModel: '' });
        }, 2000);
        chrome.storage.local.get([
          'translateEnabled', 'targetLang', 'apiProvider', 'apiKey', 'apiModel'
        ], (data) => {
          clearTimeout(timeout);
          resolve({
            translateEnabled: data.translateEnabled !== false,
            targetLang: data.targetLang || 'zh',
            apiProvider: data.apiProvider || '',
            apiKey: data.apiKey || '',
            apiModel: data.apiModel || ''
          });
        });
      });
    } catch {
      return { translateEnabled: true, targetLang: 'zh', apiProvider: '', apiKey: '', apiModel: '' };
    }
  }

  function createFloatingButton() {
    if (document.getElementById('verity-translate-btn')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'verity-translate-wrapper';
    wrapper.style.cssText = `
      position: fixed;
      bottom: 60px;
      right: 10px;
      z-index: 9999998;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    `;

    const btn = document.createElement('div');
    btn.id = 'verity-translate-btn';
    btn.style.cssText = `
      width: 40px;
      height: 40px;
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 18px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transition: transform 0.2s, background 0.2s;
    `;
    btn.textContent = '\uD83D\uDD04';
    btn.title = 'VerityLens 双语翻译（应急用）';

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
      btn.style.background = '#374151';
      warning.style.opacity = '1';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.background = '#1f2937';
      warning.style.opacity = '0.7';
    });

    btn.addEventListener('click', async () => {
      btn.textContent = '\u23F3';
      await runTranslation();
      btn.textContent = '\u2705';
      setTimeout(() => { btn.textContent = '\uD83D\uDD04'; }, 2000);
    });

    const warning = document.createElement('div');
    warning.style.cssText = `
      background: #fef2f2;
      border: 1px solid #ef4444;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11px;
      color: #dc2626;
      max-width: 240px;
      line-height: 1.5;
      opacity: 0.7;
      transition: opacity 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    warning.innerHTML = '<strong>\u26A0\uFE0F 注意</strong>\uFF1A\u5982\u7F51\u7AD9\u6709\u5B98\u65B9\u8BED\u8A00\u5207\u6362\uFF0C\u8BF7\u4F18\u5148\u4F7F\u7528\u3002\u672C\u7FFB\u8BD1\u4EC5\u4E3A\u5E94\u6025\u7528\u9014\uFF0C\u53EF\u80FD\u4E0D\u51C6\u786E\u3002';

    wrapper.appendChild(btn);
    wrapper.appendChild(warning);
    document.body.appendChild(wrapper);
  }

  function createProgressBar() {
    if (document.getElementById('verity-translate-progress')) return null;

    const bar = document.createElement('div');
    bar.id = 'verity-translate-progress';
    bar.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, #22c55e, #3b82f6);
      z-index: 9999999;
      transition: width 0.3s;
      width: 0%;
    `;
    document.body.appendChild(bar);
    return bar;
  }

  function removeProgressBar() {
    const bar = document.getElementById('verity-translate-progress');
    if (bar) bar.remove();
  }

  async function runTranslation() {
    const config = await loadConfig();

    if (!config.translateEnabled) {
      log('翻译功能已关闭');
      return;
    }

    const sourceLang = VerityTranslator.detectPageLanguage();
    const targetLang = config.targetLang;

    log(`页面语言: ${sourceLang} → 目标语言: ${targetLang}`);

    if (!VerityTranslator.needsTranslation(sourceLang, targetLang)) {
      log('无需翻译（语言相同或无法识别）');
      return;
    }

    const progressBar = createProgressBar();

    try {
      const result = await VerityTranslator.translatePage(
        sourceLang, targetLang, config,
        (progress) => {
          const pct = (progress.translated / progress.total * 100).toFixed(0);
          if (progressBar) progressBar.style.width = pct + '%';
          log(`翻译进度: ${progress.translated}/${progress.total} (${pct}%) 批次 ${progress.batch}/${progress.totalBatches}`);
        }
      );

      log(`翻译完成: ${result.translated}/${result.total} 段`);
    } catch (err) {
      log(`翻译失败: ${err.message}`);
    }

    setTimeout(removeProgressBar, 2000);
  }

  async function init() {
    if (isSearchEngine()) {
      log('搜索引擎页面，跳过自动翻译');
      return;
    }

    const config = await loadConfig();
    if (!config.translateEnabled) {
      log('翻译功能已关闭');
      return;
    }

    const sourceLang = VerityTranslator.detectPageLanguage();
    const targetLang = config.targetLang;

    log(`页面: ${window.location.href} 语言: ${sourceLang} 目标: ${targetLang}`);

    if (!VerityTranslator.needsTranslation(sourceLang, targetLang)) {
      log('无需翻译');
      return;
    }

    createFloatingButton();

    if (document.readyState === 'complete') {
      setTimeout(runTranslation, 1000);
    } else {
      window.addEventListener('load', () => {
        setTimeout(runTranslation, 1000);
      });
    }

    const observer = new MutationObserver(() => {
      clearTimeout(window.__verityTranslateDebounce);
      window.__verityTranslateDebounce = setTimeout(async () => {
        const newParagraphs = VerityTranslator.extractParagraphs()
          .filter(p => !p.dataset.verityTranslated);
        if (newParagraphs.length > 5) {
          log(`检测到新内容: ${newParagraphs.length} 段未翻译`);
          const config = await loadConfig();
          const sourceLang = VerityTranslator.detectPageLanguage();
          if (VerityTranslator.needsTranslation(sourceLang, config.targetLang)) {
            await VerityTranslator.translatePage(sourceLang, config.targetLang, config);
          }
        }
      }, 3000);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function createDebugPanel() {
    if (document.getElementById('verity-translate-debug')) return;

    const panel = document.createElement('div');
    panel.id = 'verity-translate-debug';
    panel.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 60px;
      width: 420px;
      max-height: 300px;
      background: #111827;
      border: 1px solid #374151;
      border-radius: 8px;
      z-index: 9999999;
      font-family: 'Cascadia Code', 'Fira Code', monospace;
      font-size: 11px;
      color: #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      display: none;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'padding:6px 10px;background:#1f2937;border-bottom:1px solid #374151;display:flex;justify-content:space-between;align-items:center;';
    header.innerHTML = `
      <span style="color:#3b82f6;font-weight:bold">VerityLens Translate Debug</span>
      <span>
        <button id="vt-copy-log" style="background:#374151;color:#e2e8f0;border:1px solid #4b5563;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;margin-right:4px">复制</button>
        <button id="vt-close-debug" style="background:#374151;color:#e2e8f0;border:1px solid #4b5563;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px">关闭</button>
      </span>
    `;

    const logArea = document.createElement('div');
    logArea.id = 'vt-log-area';
    logArea.style.cssText = 'padding:8px 10px;overflow-y:auto;max-height:250px;line-height:1.6;';

    panel.appendChild(header);
    panel.appendChild(logArea);
    document.body.appendChild(panel);

    document.getElementById('vt-close-debug').addEventListener('click', () => {
      panel.style.display = 'none';
    });

    document.getElementById('vt-copy-log').addEventListener('click', () => {
      const text = LOG.join('\n');
      navigator.clipboard.writeText(text).then(() => {
        document.getElementById('vt-copy-log').textContent = '已复制!';
        setTimeout(() => {
          document.getElementById('vt-copy-log').textContent = '复制';
        }, 1500);
      });
    });

    setInterval(() => {
      const area = document.getElementById('vt-log-area');
      if (!area || panel.style.display === 'none') return;
      area.textContent = LOG.join('\n');
      area.scrollTop = area.scrollHeight;
    }, 500);
  }

  function toggleDebugPanel() {
    const panel = document.getElementById('verity-translate-debug');
    if (!panel) {
      createDebugPanel();
      const p = document.getElementById('verity-translate-debug');
      if (p) p.style.display = 'block';
      return;
    }
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TOGGLE_TRANSLATE') {
      runTranslation();
    }
    if (message.type === 'TOGGLE_DEBUG') {
      toggleDebugPanel();
    }
  });

  init();
})();