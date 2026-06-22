/**
 * VerityLens · Translator Content Script · 双语翻译注入（v0.5.0）
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

    const btn = document.createElement('div');
    btn.id = 'verity-translate-btn';
    btn.style.cssText = `
      position: fixed;
      bottom: 60px;
      right: 10px;
      width: 40px;
      height: 40px;
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 9999998;
      font-size: 18px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transition: transform 0.2s, background 0.2s;
    `;
    btn.textContent = '\uD83D\uDD04';
    btn.title = 'VerityLens 双语翻译';

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
      btn.style.background = '#374151';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.background = '#1f2937';
    });

    btn.addEventListener('click', async () => {
      btn.textContent = '\u23F3';
      await runTranslation();
      btn.textContent = '\u2705';
      setTimeout(() => { btn.textContent = '\uD83D\uDD04'; }, 2000);
    });

    document.body.appendChild(btn);
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

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TOGGLE_TRANSLATE') {
      runTranslation();
    }
  });

  init();
})();