/**
 * VerityLens · Content Script · 搜索结果真实性标注（v0.3.0）
 *
 * 双通道智能路由 + 跨模态自校验：
 * - 轻量任务 → 本地启发式评分
 * - 复杂任务 → 云端 LLM / Docker Ollama
 * - 含音视频 → 跨模态验证（ASR + OCR + 文本三元组）
 *
 * 静默原则：DOM 注入不抓取不复制 = 不违反平台协议
 */

(function() {
  'use strict';

  if (window.__verityLensInjected) return;
  window.__verityLensInjected = true;

  const HOST = window.location.hostname;
  const PLATFORM = detectPlatform();

  console.log('[VerityLens] 检测到平台:', PLATFORM);

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
      container: '.result',
      title: 'h3 a, .c-title a',
      snippet: '.c-abstract, .content-right_8Zs40'
    },
    '360': {
      container: '.res-list, li.res-list',
      title: 'h3 a, .title',
      snippet: '.lh, .desc'
    },
    sogou: {
      container: '.vrwrap, .rb',
      title: 'h3 a, .vr-title a',
      snippet: '.str_info, .abstract'
    },
    google: {
      container: '.g, .Gx5Zad',
      title: 'h3',
      snippet: '.VwiC3b, .yXK7lf'
    },
    bing: {
      container: '.b_algo',
      title: 'h2 a',
      snippet: '.b_caption p'
    },
    duckduckgo: {
      container: '.result',
      title: 'a.result__a',
      snippet: '.result__snippet'
    }
  };

  async function scanAndAnnotate() {
    const selector = PLATFORM_SELECTORS[PLATFORM];
    if (!selector) {
      console.warn('[VerityLens] 不支持的平台:', PLATFORM);
      return;
    }

    const results = document.querySelectorAll(selector.container);
    console.log(`[VerityLens] 发现 ${results.length} 条结果`);

    const promises = [];
    results.forEach((result) => {
      if (result.dataset.verityAnnotated) return;
      result.dataset.verityAnnotated = 'pending';

      const titleEl = result.querySelector(selector.title);
      const snippetEl = result.querySelector(selector.snippet);

      const textContent = [
        titleEl?.textContent || '',
        snippetEl?.textContent || ''
      ].join('\n').trim();

      if (!textContent) {
        result.dataset.verityAnnotated = 'skipped';
        return;
      }

      const href = titleEl?.href || '';
      const hasMedia = !!result.querySelector('video, audio, iframe');
      const hasImage = !!result.querySelector('img[src]');

      let ocrResult = null;
      if (hasImage && typeof VerityOCR !== 'undefined') {
        const imgEl = result.querySelector('img[src]');
        if (imgEl) {
          try {
            ocrResult = await VerityOCR.recognize(imgEl.src);
          } catch {}
        }
      }

      promises.push(
        Channel.verify(textContent, {
          resultCount: results.length,
          hasMedia,
          hasImage,
          crossModal: !!ocrResult?.text,
          href,
          ocrResult
        }).then((resultData) => {
          if (ocrResult?.text && resultData.channel === 'local') {
            resultData = VerityCore.crossValidate(null, ocrResult, textContent);
          }
          result.dataset.verityAnnotated = 'true';
          annotateResult(result, resultData);
        }).catch((err) => {
          console.warn('[VerityLens] 验证失败:', err);
          result.dataset.verityAnnotated = 'error';
        })
      );
    });

    await Promise.allSettled(promises);
    updateStats();
  }

  function annotateResult(element, { confidence, score, reasons, channel, model }) {
    const color = VerityCore.COLORS[confidence] || VerityCore.COLORS.unverified;
    const label = VerityCore.CONFIDENCE_LABEL[confidence] || '未验证';

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
    `;
    element.style.position = 'relative';
    element.style.paddingLeft = '12px';
    element.insertBefore(ribbon, element.firstChild);

    const channelLabel = channel === 'cloud' ? `☁️ ${model || 'LLM'}` :
                         channel === 'docker' ? '🐳 本地Docker' : '🔒 本地';

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
        真实性: ${label} ${(score * 100).toFixed(0)}%
      </div>
      <div style="font-size:11px;opacity:0.85;margin-bottom:6px">
        ${reasons.map(r => `<div style="margin:2px 0">${r}</div>`).join('')}
      </div>
      <div style="font-size:10px;opacity:0.6;border-top:1px solid #4b5563;padding-top:4px">
        ${channelLabel} · VerityLens v${VerityCore.VERSION}
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

    chrome.runtime.sendMessage({
      type: 'UPDATE_STATS',
      verified: annotated.length,
      high,
      low
    }).catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAndAnnotate);
  } else {
    scanAndAnnotate();
  }

  const observer = new MutationObserver(() => {
    clearTimeout(window.__verityLensDebounce);
    window.__verityLensDebounce = setTimeout(scanAndAnnotate, 500);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
