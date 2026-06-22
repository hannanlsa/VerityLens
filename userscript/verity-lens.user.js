// ==UserScript==
// @name         VerityLens · 真实透镜
// @namespace    veritylens
// @version      0.6.0
// @description  🛡️ 信息可信度标注（来源大数据AI）· 双通道智能路由 + 三元组交叉验证
// @author       hannanlsa
// @homepage     https://github.com/hannanlsa/VerityLens
// @license      AGPL-3.0
// @match        *://www.baidu.com/s*
// @match        *://www.baidu.com/baidu*
// @match        *://www.so.com/s*
// @match        *://www.sogou.com/web*
// @match        *://www.google.com/search*
// @match        *://duckduckgo.com/*
// @match        *://www.bing.com/search*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @connect      api.deepseek.com
// @connect      open.bigmodel.cn
// @connect      dashscope.aliyuncs.com
// @connect      api.siliconflow.cn
// @connect      api.groq.com
// @connect      api.moonshot.cn
// @connect      api.minimax.chat
// @connect      api.lingyiwanwu.com
// @connect      aip.baidubce.com
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  if (window.__verityLensInjected) return;
  window.__verityLensInjected = true;

  const VERSION = '0.6.0';

  const CONFIDENCE = {
    HIGH: 'high', MEDIUM: 'medium', ABNORMAL: 'abnormal',
    PARTIAL: 'partial_X', UNVERIFIED: 'unverified'
  };

  const COLORS = {
    high: '#22c55e', medium: '#eab308', abnormal: '#ef4444',
    partial_X: '#f97316', unverified: '#9ca3af'
  };

  const CONFIDENCE_LABEL = {
    high: '高置信', medium: '中等', abnormal: '异常',
    partial_X: '部分验证', unverified: '未验证'
  };

  const PROVIDERS = {
    deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'] },
    zhipu: { name: '智谱GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-flash', 'glm-4-air'] },
    qwen: { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-turbo', 'qwen-plus'] },
    siliconflow: { name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', models: ['Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V3', 'meta-llama/Llama-3.3-70B-Instruct'] },
    groq: { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', models: ['llama-3.3-70b-versatile'] },
    moonshot: { name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k'] },
    minimax: { name: 'MiniMax', baseUrl: 'https://api.minimax.chat/v1', models: ['abab6.5s-chat'] },
    yi: { name: '零一万物', baseUrl: 'https://api.lingyiwanwu.com/v1', models: ['yi-lightning'] },
    baidu: { name: '百度千帆', baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop', models: ['ernie-lite-8k'] },
    custom: { name: '自定义', baseUrl: '', models: [] }
  };

  function getConfig() {
    return {
      mode: GM_getValue('channelMode', 'local'),
      provider: GM_getValue('apiProvider', ''),
      apiKey: GM_getValue('apiKey', ''),
      model: GM_getValue('apiModel', ''),
      dockerUrl: GM_getValue('dockerUrl', ''),
      threshold: GM_getValue('confidenceThreshold', 0.65)
    };
  }

  function textHeuristic(text) {
    if (!text) return 0;
    let score = 0.5;
    if (/\.(gov|edu|org)\b/.test(text)) score += 0.2;
    if (/\b(wikipedia|github|stackoverflow|mozilla|w3\.org)\b/.test(text)) score += 0.15;
    if (/\b(官方|官网|documentation|docs)\b/i.test(text)) score += 0.1;
    if (/\b(广告|赞助|推广|ad|sponsored|promo)\b/i.test(text)) score -= 0.3;
    if (/\b(限时|特惠|秒杀|打折|coupon|优惠|折扣)\b/i.test(text)) score -= 0.15;
    if (/\b(点击|下载app|立即购买|马上注册)\b/i.test(text)) score -= 0.1;
    if (text.length > 1000 && /(.)\1{5,}/.test(text)) score -= 0.2;
    if ((text.match(/https?:\/\//g) || []).length > 10) score -= 0.15;
    return Math.max(0, Math.min(1, score));
  }

  function scoreToConfidence(score) {
    if (score >= 0.85) return CONFIDENCE.HIGH;
    if (score >= 0.65) return CONFIDENCE.MEDIUM;
    if (score >= 0.4) return CONFIDENCE.PARTIAL;
    if (score >= 0.2) return CONFIDENCE.ABNORMAL;
    return CONFIDENCE.UNVERIFIED;
  }

  function localVerify(text) {
    const score = textHeuristic(text);
    return {
      confidence: scoreToConfidence(score),
      score,
      reasons: [`📝 本地启发式评分 ${(score * 100).toFixed(0)}%`],
      channel: 'local'
    };
  }

  function cloudVerify(text, config) {
    return new Promise((resolve) => {
      const provider = PROVIDERS[config.provider];
      if (!provider || !config.apiKey) {
        resolve({ ...localVerify(text), reasons: ['⚠️ 未配置API，回退本地'] });
        return;
      }

      const baseUrl = config.dockerUrl || provider.baseUrl;
      const model = config.model || provider.models[0];

      GM_xmlhttpRequest({
        method: 'POST',
        url: `${baseUrl}/chat/completions`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        data: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: '评估搜索结果真实性。返回JSON：{"confidence":"high|medium|abnormal|partial_X|unverified","score":0.0-1.0,"reasons":["原因"]}' },
            { role: 'user', content: text }
          ],
          temperature: 0.1,
          max_tokens: 512
        }),
        timeout: 15000,
        onload(resp) {
          try {
            const data = JSON.parse(resp.responseText);
            const content = data.choices?.[0]?.message?.content || '';
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('no JSON');
            const parsed = JSON.parse(jsonMatch[0]);
            resolve({
              confidence: CONFIDENCE[parsed.confidence?.toUpperCase()] || scoreToConfidence(parsed.score || 0.5),
              score: Math.max(0, Math.min(1, parsed.score || 0.5)),
              reasons: Array.isArray(parsed.reasons) ? parsed.reasons : ['LLM评估'],
              channel: 'cloud',
              model
            });
          } catch {
            resolve({ ...localVerify(text), reasons: ['⚠️ LLM解析失败，回退本地'] });
          }
        },
        onerror(err) {
          resolve({ ...localVerify(text), reasons: [`⚠️ API失败，回退本地`] });
        },
        ontimeout() {
          resolve({ ...localVerify(text), reasons: ['⚠️ API超时，回退本地'] });
        }
      });
    });
  }

  async function verify(text) {
    const config = getConfig();
    if (config.mode === 'local') return localVerify(text);
    if (config.mode === 'cloud' || config.mode === 'smart') {
      if (text.length > 500 && config.apiKey) {
        return cloudVerify(text, config);
      }
      return localVerify(text);
    }
    return localVerify(text);
  }

  const HOST = window.location.hostname;
  const PLATFORM_SELECTORS = {
    baidu: { container: '.result', title: 'h3 a, .c-title a', snippet: '.c-abstract, .content-right_8Zs40' },
    '360': { container: '.res-list, li.res-list', title: 'h3 a, .title', snippet: '.lh, .desc' },
    sogou: { container: '.vrwrap, .rb', title: 'h3 a, .vr-title a', snippet: '.str_info, .abstract' },
    google: { container: '.g, .Gx5Zad', title: 'h3', snippet: '.VwiC3b, .yXK7lf' },
    bing: { container: '.b_algo', title: 'h2 a', snippet: '.b_caption p' },
    duckduckgo: { container: '.result', title: 'a.result__a', snippet: '.result__snippet' }
  };

  let platform = 'unknown';
  if (/baidu\.com$/.test(HOST)) platform = 'baidu';
  if (/so\.com$/.test(HOST)) platform = '360';
  if (/sogou\.com$/.test(HOST)) platform = 'sogou';
  if (/google\.com$/.test(HOST)) platform = 'google';
  if (/bing\.com$/.test(HOST)) platform = 'bing';
  if (/duckduckgo\.com$/.test(HOST)) platform = 'duckduckgo';

  if (platform === 'unknown') return;

  GM_addStyle(`
    .verity-ribbon { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; border-radius: 2px; transition: width 0.2s; }
    .verity-popup { display: none; position: absolute; left: 12px; top: 100%; z-index: 999999; background: #1f2937; color: #f9fafb; padding: 10px 14px; border-radius: 8px; font-size: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); max-width: 360px; line-height: 1.5; }
  `);

  async function scanAndAnnotate() {
    const selector = PLATFORM_SELECTORS[platform];
    if (!selector) return;

    const results = document.querySelectorAll(selector.container);
    const promises = [];

    results.forEach((el) => {
      if (el.dataset.verityAnnotated) return;
      el.dataset.verityAnnotated = 'pending';

      const titleEl = el.querySelector(selector.title);
      const snippetEl = el.querySelector(selector.snippet);
      const text = [titleEl?.textContent || '', snippetEl?.textContent || ''].join('\n').trim();
      if (!text) { el.dataset.verityAnnotated = 'skipped'; return; }

      promises.push(
        verify(text).then((result) => {
          el.dataset.verityAnnotated = 'true';
          annotateResult(el, result);
        }).catch(() => { el.dataset.verityAnnotated = 'error'; })
      );
    });

    await Promise.allSettled(promises);
  }

  function annotateResult(element, { confidence, score, reasons, channel, model }) {
    const color = COLORS[confidence] || COLORS.unverified;
    const label = CONFIDENCE_LABEL[confidence] || '未验证';
    const channelLabel = channel === 'cloud' ? `☁️ ${model || 'LLM'}` : '🔒 本地';

    element.style.position = 'relative';
    element.style.paddingLeft = '12px';

    const ribbon = document.createElement('div');
    ribbon.className = 'verity-ribbon';
    ribbon.style.background = color;
    element.insertBefore(ribbon, element.firstChild);

    const popup = document.createElement('div');
    popup.className = 'verity-popup';
    popup.innerHTML = `
      <div style="font-weight:bold;margin-bottom:6px;color:${color};font-size:13px">
        真实性: ${label} ${(score * 100).toFixed(0)}%
      </div>
      <div style="font-size:11px;opacity:0.85;margin-bottom:6px">
        ${reasons.map(r => `<div style="margin:2px 0">${r}</div>`).join('')}
      </div>
      <div style="font-size:10px;opacity:0.6;border-top:1px solid #4b5563;padding-top:4px">
        ${channelLabel} · VerityLens v${VERSION}
      </div>
    `;
    element.appendChild(popup);

    element.addEventListener('mouseenter', () => { popup.style.display = 'block'; ribbon.style.width = '6px'; });
    element.addEventListener('mouseleave', () => { popup.style.display = 'none'; ribbon.style.width = '4px'; });
  }

  GM_registerMenuCommand('🔑 设置 API Key', () => {
    const provider = prompt('选择提供商 (deepseek/zhipu/qwen/siliconflow/groq/custom):', 'zhipu');
    if (!provider) return;
    const key = prompt('输入 API Key:', '');
    if (!key) return;
    GM_setValue('apiProvider', provider);
    GM_setValue('apiKey', key);
    GM_setValue('channelMode', 'smart');
    alert('✅ 已保存！刷新页面生效。');
  });

  GM_registerMenuCommand('🔒 切换为纯本地模式', () => {
    GM_setValue('channelMode', 'local');
    alert('✅ 已切换为纯本地模式。刷新页面生效。');
  });

  GM_registerMenuCommand('⚡ 切换为智能模式', () => {
    GM_setValue('channelMode', 'smart');
    alert('✅ 已切换为智能模式。刷新页面生效。');
  });

  scanAndAnnotate();

  const observer = new MutationObserver(() => {
    clearTimeout(window.__verityLensDebounce);
    window.__verityLensDebounce = setTimeout(scanAndAnnotate, 500);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();