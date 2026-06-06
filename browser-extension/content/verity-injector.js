/**
 * VerityLens · Content Script · 搜索结果真实性标注
 *
 * 主人决策：颜色标注 + 真实性评分
 * - 绿 = 真实（官方 / 学术 / 可信）
 * - 黄 = 中性（个人博客 / 中等可信）
 * - 红 = 广告 / SEO 农场 / 软文
 *
 * 工作流：
 * 1. 检测当前页面（百度 / 360 / 搜狗 / Google / Bing / DDG）
 * 2. 解析搜索结果 DOM
 * 3. 对每条结果调 VerityCore.crossValidate
 * 4. 注入颜色标签 + hover popup
 *
 * 静默原则：DOM 注入不抓取不复制 = 不违反平台协议
 */

(function() {
  'use strict';

  // 防止重复注入
  if (window.__verityLensInjected) return;
  window.__verityLensInjected = true;

  const HOST = window.location.hostname;
  const PLATFORM = detectPlatform();

  console.log('[VerityLens] 检测到平台:', PLATFORM);

  /**
   * 检测当前搜索引擎
   */
  function detectPlatform() {
    if (/baidu\.com$/.test(HOST)) return 'baidu';
    if (/so\.com$/.test(HOST)) return '360';
    if (/sogou\.com$/.test(HOST)) return 'sogou';
    if (/google\.com$/.test(HOST)) return 'google';
    if (/bing\.com$/.test(HOST)) return 'bing';
    if (/duckduckgo\.com$/.test(HOST)) return 'duckduckgo';
    return 'unknown';
  }

  /**
   * 平台特定的结果选择器
   * 各家 DOM 结构不同，需要针对性处理
   */
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

  /**
   * 主流程：扫描 + 标注
   */
  function scanAndAnnotate() {
    const selector = PLATFORM_SELECTORS[PLATFORM];
    if (!selector) {
      console.warn('[VerityLens] 不支持的平台:', PLATFORM);
      return;
    }

    const results = document.querySelectorAll(selector.container);
    console.log(`[VerityLens] 发现 ${results.length} 条结果`);

    results.forEach((result, idx) => {
      // 跳过已标注的
      if (result.dataset.verityAnnotated) return;
      result.dataset.verityAnnotated = 'true';

      const titleEl = result.querySelector(selector.title);
      const snippetEl = result.querySelector(selector.snippet);

      const textContent = [
        titleEl?.textContent || '',
        snippetEl?.textContent || ''
      ].join('\n').trim();

      if (!textContent) return;

      // 调用 VerityCore
      const result_data = VerityCore.crossValidate(null, null, textContent);
      annotateResult(result, result_data);
    });
  }

  /**
   * 标注单条结果
   */
  function annotateResult(element, { confidence, score, reasons }) {
    const color = VerityCore.COLORS[confidence] || VerityCore.COLORS[VerityCore.CONFIDENCE.UNVERIFIED];

    // 1. 左侧色条
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
    `;
    element.style.position = 'relative';
    element.style.paddingLeft = '12px';
    element.insertBefore(ribbon, element.firstChild);

    // 2. Hover popup
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
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 320px;
    `;
    popup.innerHTML = `
      <div style="font-weight:bold;margin-bottom:4px;color:${color}">
        真实性评分: ${(score * 100).toFixed(0)}% (${confidence})
      </div>
      <div style="font-size:11px;opacity:0.9">
        ${reasons.map(r => `<div>${r}</div>`).join('')}
      </div>
    `;
    element.appendChild(popup);

    element.addEventListener('mouseenter', () => {
      popup.style.display = 'block';
    });
    element.addEventListener('mouseleave', () => {
      popup.style.display = 'none';
    });
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAndAnnotate);
  } else {
    scanAndAnnotate();
  }

  // 监听 DOM 变化（搜索结果分页 / 无限滚动）
  const observer = new MutationObserver(() => {
    clearTimeout(window.__verityLensDebounce);
    window.__verityLensDebounce = setTimeout(scanAndAnnotate, 500);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
