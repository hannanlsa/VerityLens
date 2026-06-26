/**
 * VerityLens · Content Script · 搜索结果真实性标注（v0.7.0）
 *
 * 双通道智能路由 + 跨模态自校验 + 调试日志面板
 */

(function() {
  'use strict';

  if (window.__verityLensInjected) return;
  window.__verityLensInjected = true;

  const HOST = window.location.hostname;
  const PLATFORM = detectPlatform();

  const DEBUG_LOG = [];
  const MAX_LOG = 500;

  function log(msg) {
    const ts = new Date().toISOString().substr(11, 12);
    const entry = `[${ts}] [VerityLens] ${msg}`;
    DEBUG_LOG.push(entry);
    if (DEBUG_LOG.length > MAX_LOG) DEBUG_LOG.shift();
    console.log(entry);
  }

  function detectPlatform() {
    if (/baidu\.com$/.test(HOST)) return 'baidu';
    if (/so\.com$/.test(HOST)) return '360';
    if (/sogou\.com$/.test(HOST)) return 'sogou';
    if (/google\.com$/.test(HOST)) return 'google';
    if (/bing\.com$/.test(HOST)) return 'bing';
    if (/duckduckgo\.com$/.test(HOST)) return 'duckduckgo';
    return 'unknown';
  }

  const PLATFORM_SELECTORS = {
    baidu: {
      containers: [
        '#content_left .result',
        '#content_left .result-op',
        '#content_left .c-container'
      ],
      title: 'h3 a, .c-title a, .cosc-title-a, [class*="cosc-title"] a, a[class*="title"]',
      snippet: '.c-abstract, [class*="c-abstract"], .cosc-desc, [class*="cosc-desc"], [class*="abstract"]',
      exclude: '#content_right, .c-trust-ecard, .result-molecule'
    },
    '360': {
      containers: [
        '.res-list',
        'li.res-list',
        '#result .result'
      ],
      title: 'h3 a, .title a, a[class*="title"]',
      snippet: '.lh, .desc, [class*="desc"], [class*="abstract"]',
      exclude: ''
    },
    sogou: {
      containers: [
        '.vrwrap',
        '.rb',
        '#main .result'
      ],
      title: 'h3 a, .vr-title a, a[class*="title"]',
      snippet: '.str_info, .abstract, [class*="desc"], [class*="abstract"]',
      exclude: ''
    },
    google: {
      containers: [
        '#search .g',
        '#search .Gx5Zad',
        '#rso > .g'
      ],
      title: 'h3',
      snippet: '.VwiC3b, .yXK7lf, [class*="snippet"]',
      exclude: ''
    },
    bing: {
      containers: [
        '#b_results .b_algo'
      ],
      title: 'h2 a',
      snippet: '.b_caption p, [class*="caption"] p',
      exclude: ''
    },
    duckduckgo: {
      containers: [
        '.result',
        '[data-result]'
      ],
      title: 'a.result__a, h2 a',
      snippet: '.result__snippet, [class*="snippet"]',
      exclude: ''
    }
  };

  function getResults(selector) {
    const results = [];
    const seen = new Set();

    for (const containerSel of selector.containers) {
      const els = document.querySelectorAll(containerSel);
      for (const el of els) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (selector.exclude && el.closest(selector.exclude)) continue;
        results.push(el);
      }
    }

    return results;
  }

  async function scanAndAnnotate() {
    const selector = PLATFORM_SELECTORS[PLATFORM];
    if (!selector) {
      log('不支持的平台: ' + PLATFORM);
      return;
    }

    const results = getResults(selector);
    log(`平台=${PLATFORM} 发现 ${results.length} 条结果 (选择器: ${selector.containers.join(', ')})`);

    if (results.length === 0) {
      log('未找到任何结果，尝试诊断...');
      for (const cs of selector.containers) {
        const count = document.querySelectorAll(cs).length;
        log(`  选择器 "${cs}" 匹配 ${count} 个元素`);
      }
    }

    const promises = [];
    for (const result of results) {
      if (result.dataset.verityAnnotated) continue;
      if (result.closest('[data-verity-annotated]')) continue;

      const titleEl = result.querySelector(selector.title);
      if (!titleEl) {
        result.dataset.verityAnnotated = 'skipped';
        log(`跳过(无标题): container=${result.className.substring(0, 60)}`);
        continue;
      }

      const snippetEl = result.querySelector(selector.snippet);

      const textContent = [
        titleEl.textContent || '',
        snippetEl?.textContent || ''
      ].join('\n').trim();

      if (!textContent || textContent.length < 5) {
        result.dataset.verityAnnotated = 'skipped';
        log(`跳过(文本过短): "${textContent.substring(0, 30)}"`);
        continue;
      }

      result.dataset.verityAnnotated = 'pending';

      const href = titleEl.href || titleEl.closest('a')?.href || '';
      const hasMedia = !!result.querySelector('video, audio, iframe');
      const hasImage = !!result.querySelector('img[src]');

      promises.push(
        (async () => {
          let ocrResult = null;
          if (hasImage && typeof VerityOCR !== 'undefined') {
            const imgEl = result.querySelector('img[src]');
            if (imgEl) {
              try {
                ocrResult = await VerityOCR.recognize(imgEl.src);
              } catch {}
            }
          }

          try {
            let resultData = await Channel.verify(textContent, {
              resultCount: results.length,
              hasMedia,
              hasImage,
              crossModal: !!ocrResult?.text,
              href,
              ocrResult
            });

            if (ocrResult?.text && resultData.channel === 'local') {
              resultData = await VerityCore.crossValidate(null, ocrResult, textContent);
            }

            result.dataset.verityAnnotated = 'true';
            annotateResult(result, resultData);
            log(`标注: "${textContent.substring(0, 30)}" → ${resultData.confidence} ${(resultData.score * 100).toFixed(0)}% (${resultData.channel})`);
          } catch (err) {
            log(`验证失败: "${textContent.substring(0, 30)}" → ${err.message}`);
            result.dataset.verityAnnotated = 'error';
          }
        })()
      );
    }

    await Promise.allSettled(promises);
    updateStats();
  }

  function annotateResult(element, { confidence, score, reasons, channel, model }) {
    const color = VerityCore.COLORS[confidence] || VerityCore.COLORS.unverified;
    const label = VerityCore.getConfidenceLabel
      ? VerityCore.getConfidenceLabel(confidence)
      : (VerityCore.CONFIDENCE_LABEL[confidence] || confidence);

    const existingRibbon = element.querySelector('.verity-ribbon');
    const existingPopup = element.querySelector('.verity-popup');
    if (existingRibbon) existingRibbon.remove();
    if (existingPopup) existingPopup.remove();

    const ribbon = document.createElement('div');
    ribbon.className = 'verity-ribbon';
    ribbon.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: ${color};
      border-radius: 2px;
      transition: width 0.2s;
      z-index: 999998;
    `;
    element.style.position = 'relative';
    element.style.paddingLeft = '12px';
    element.insertBefore(ribbon, element.firstChild);

    const channelLabel = channel === 'cloud' ? `\u2601\uFE0F ${model || 'LLM'}` :
                         channel === 'docker' ? '\uD83C\uDFD7\uFE0F Docker' : '\uD83D\uDD12 本地';

    const popup = document.createElement('div');
    popup.className = 'verity-popup';
    popup.style.cssText = `
      display: none;
      position: absolute;
      left: 12px;
      top: 100%;
      z-index: 999999;
      background: #1f2937;
      color: #f9fafb;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      max-width: 360px;
      line-height: 1.5;
    `;
    popup.innerHTML = `
      <div style="font-weight:bold;margin-bottom:6px;color:${color};font-size:13px">
        ${label} ${(score * 100).toFixed(0)}%
      </div>
      <div style="font-size:11px;opacity:0.85;margin-bottom:6px">
        ${reasons.map(r => `<div style="margin:2px 0">${r}</div>`).join('')}
      </div>
      <div style="font-size:10px;opacity:0.6;border-top:1px solid #4b5563;padding-top:4px">
        ${channelLabel} \u00B7 VerityLens v${VerityCore.VERSION}
      </div>
    `;
    element.appendChild(popup);

    element.addEventListener('mouseenter', () => {
      popup.style.display = 'block';
      ribbon.style.width = '6px';
    });
    element.addEventListener('mouseleave', () => {
      popup.style.display = 'none';
      ribbon.style.width = '4px';
    });
  }

  function updateStats() {
    const annotated = document.querySelectorAll('[data-verity-annotated="true"]');
    let high = 0, low = 0;
    annotated.forEach(el => {
      const ribbon = el.querySelector('.verity-ribbon');
      if (!ribbon) return;
      const bg = ribbon.style.background;
      if (bg === '#22c55e') high++;
      if (bg === '#ef4444' || bg === '#f97316') low++;
    });

    try {
      chrome.runtime.sendMessage({
        type: 'UPDATE_STATS',
        verified: annotated.length,
        high,
        low
      }).catch(() => {});
    } catch {}
  }

  function createDebugPanel() {
    if (document.getElementById('verity-debug-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'verity-debug-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
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
      <span style="color:#22c55e;font-weight:bold">VerityLens Debug Log</span>
      <span>
        <button id="verity-copy-log" style="background:#374151;color:#e2e8f0;border:1px solid #4b5563;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;margin-right:4px">复制</button>
        <button id="verity-close-debug" style="background:#374151;color:#e2e8f0;border:1px solid #4b5563;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px">关闭</button>
      </span>
    `;

    const logArea = document.createElement('div');
    logArea.id = 'verity-log-area';
    logArea.style.cssText = 'padding:8px 10px;overflow-y:auto;max-height:250px;line-height:1.6;';

    panel.appendChild(header);
    panel.appendChild(logArea);
    document.body.appendChild(panel);

    document.getElementById('verity-close-debug').addEventListener('click', () => {
      panel.style.display = 'none';
    });

    document.getElementById('verity-copy-log').addEventListener('click', () => {
      const text = DEBUG_LOG.join('\n');
      navigator.clipboard.writeText(text).then(() => {
        document.getElementById('verity-copy-log').textContent = '已复制!';
        setTimeout(() => {
          document.getElementById('verity-copy-log').textContent = '复制';
        }, 1500);
      });
    });

    setInterval(() => {
      const area = document.getElementById('verity-log-area');
      if (!area || panel.style.display === 'none') return;
      area.textContent = DEBUG_LOG.join('\n');
      area.scrollTop = area.scrollHeight;
    }, 500);
  }

  function toggleDebugPanel() {
    const panel = document.getElementById('verity-debug-panel');
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }

  log(`初始化 平台=${PLATFORM} URL=${window.location.href}`);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scanAndAnnotate();
      createDebugPanel();
    });
  } else {
    scanAndAnnotate();
    createDebugPanel();
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'VERIFY_REQUEST') {
      log(`右键验证请求: ${message.text || message.url}`);
    }
    if (message.type === 'TOGGLE_DEBUG') {
      toggleDebugPanel();
    }
  });

  window.__verityToggleDebug = toggleDebugPanel;

  const observer = new MutationObserver(() => {
    clearTimeout(window.__verityLensDebounce);
    window.__verityLensDebounce = setTimeout(scanAndAnnotate, 500);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
