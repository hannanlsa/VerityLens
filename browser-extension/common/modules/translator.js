/**
 * VerityLens · Translator Module · 双语翻译核心（v0.7.0）
 *
 * 联合国六大工作语言互译：
 * - 中文(zh) · 英文(en) · 法文(fr) · 西文(es) · 俄文(ru) · 阿拉伯文(ar)
 *
 * 方案C：批量编号翻译 → 映射回DOM
 */

const VerityTranslator = {
  VERSION: '0.7.0',

  LANG_NAMES: {
    zh: '中文',
    en: 'English',
    fr: 'Français',
    es: 'Español',
    ru: 'Русский',
    ar: 'العربية'
  },

  UN_LANGS: ['zh', 'en', 'fr', 'es', 'ru', 'ar'],

  RTL_LANGS: ['ar'],

  BATCH_SIZE: 25,
  MAX_CHARS_PER_BATCH: 6000,
  MIN_PARAGRAPH_LENGTH: 8,
  PARALLEL_BATCHES: 3,

  _cache: {},

  _cacheKey(text, src, tgt) {
    return src + '→' + tgt + ':' + text.substring(0, 100);
  },

  detectLanguage(text) {
    if (!text || text.length < 3) return 'unknown';

    const zhChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    if (totalChars > 0 && zhChars / totalChars > 0.15) return 'zh';

    const arChars = (text.match(/[\u0600-\u06ff]/g) || []).length;
    if (totalChars > 0 && arChars / totalChars > 0.15) return 'ar';

    const ruChars = (text.match(/[\u0400-\u04ff]/g) || []).length;
    if (totalChars > 0 && ruChars / totalChars > 0.2) return 'ru';

    const frWords = (text.match(/\b(le|la|les|de|des|du|un|une|est|dans|pour|avec|sur|que|qui|pas|plus|son|cette|il|elle|nous|vous)\b/gi) || []).length;
    const esWords = (text.match(/\b(el|la|los|las|de|del|en|es|un|una|por|para|con|que|se|no|su|más|este|esta|pero|como)\b/gi) || []).length;
    const enWords = (text.match(/\b(the|is|are|was|were|have|has|been|will|would|could|should|this|that|with|from|they|their|which|would|about)\b/gi) || []).length;

    const total = enWords + frWords + esWords;
    if (total === 0) return 'unknown';

    if (enWords / total > 0.5) return 'en';
    if (frWords > esWords && frWords > enWords) return 'fr';
    if (esWords > frWords && esWords > enWords) return 'es';

    return 'en';
  },

  detectPageLanguage() {
    const htmlLang = document.documentElement.lang || '';
    const langCode = htmlLang.split('-')[0].toLowerCase();
    if (this.UN_LANGS.includes(langCode)) return langCode;

    const metaLang = document.querySelector('meta[http-equiv="content-language"]');
    if (metaLang) {
      const mc = (metaLang.content || '').split('-')[0].toLowerCase();
      if (this.UN_LANGS.includes(mc)) return mc;
    }

    const bodyText = document.body?.innerText?.substring(0, 2000) || '';
    if (bodyText.length > 50) return this.detectLanguage(bodyText);

    return 'unknown';
  },

  needsTranslation(sourceLang, targetLang) {
    if (sourceLang === 'unknown') return false;
    if (sourceLang === targetLang) return false;
    return this.UN_LANGS.includes(sourceLang) && this.UN_LANGS.includes(targetLang);
  },

  extractParagraphs(root) {
    const paragraphs = [];
    const tags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'DD', 'DT', 'BLOCKQUOTE', 'FIGCAPTION', 'SPAN'];
    const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'NAV', 'FOOTER', 'HEADER', 'ASIDE', 'SVG', 'CANVAS', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT']);
    const skipClasses = ['verity-ribbon', 'verity-popup', 'verity-translate', 'verity-debug'];

    const walk = (node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (skipTags.has(node.tagName)) return;
        if (node.classList) {
          for (const sc of skipClasses) {
            if (node.classList.contains(sc)) return;
          }
        }
        if (node.dataset.verityTranslated) return;

        if (tags.includes(node.tagName)) {
          const text = node.textContent.trim();
          if (text.length >= this.MIN_PARAGRAPH_LENGTH && !node.querySelector(tags.join(','))) {
            paragraphs.push(node);
            return;
          }
        }

        for (const child of node.children) {
          walk(child);
        }
      }
    };

    walk(root || document.body);
    return paragraphs;
  },

  createBatches(paragraphs, sourceLang) {
    const batches = [];
    let currentBatch = [];
    let currentLength = 0;

    for (const p of paragraphs) {
      const text = p.textContent.trim();
      if (currentBatch.length >= this.BATCH_SIZE || currentLength + text.length > this.MAX_CHARS_PER_BATCH) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
        }
        currentBatch = [];
        currentLength = 0;
      }
      currentBatch.push(p);
      currentLength += text.length;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  },

  buildTranslationPrompt(sourceLang, targetLang, numberedTexts) {
    const srcName = this.LANG_NAMES[sourceLang] || sourceLang;
    const tgtName = this.LANG_NAMES[targetLang] || targetLang;

    return `你是专业翻译。将以下${srcName}段落翻译为${tgtName}。

严格格式要求：
1. 每段翻译独占一行，格式: [编号] 翻译内容|置信度
2. 置信度为0.0~1.0的小数，表示你对这段翻译准确性的把握
   - 0.9~1.0: 非常有把握，术语准确，语意完整
   - 0.7~0.9: 基本准确，个别表述可能不够地道
   - 0.5~0.7: 大致意思对，但细节可能有偏差
   - 0.0~0.5: 不确定，可能存在明显误译
3. 保留专业术语的原文（括号标注）
4. 不要合并或拆分段落
5. 不要添加解释

示例:
[1] 维基百科是一个在线百科全书|0.95
[2] 该组织成立于1945年|0.88

${numberedTexts.join('\n')}`;
  },

  parseTranslationResponse(response) {
    const results = {};
    const lines = response.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const match = line.match(/^\[(\d+)\]\s*([\s\S]+)/);
      if (match) {
        results[parseInt(match[1])] = match[2].trim();
      }
    }

    return results;
  },

  async translateBatch(paragraphs, sourceLang, targetLang, channelConfig) {
    const numberedTexts = paragraphs.map((p, i) => `[${i + 1}] ${p.textContent.trim()}`);
    const prompt = this.buildTranslationPrompt(sourceLang, targetLang, numberedTexts);

    try {
      const result = await Channel.verify(prompt, {
        resultCount: 1,
        forceCloud: true,
        translationMode: true,
        sourceLang,
        targetLang
      });

      if (result.channel === 'local') {
        return this.localFallback(paragraphs, sourceLang, targetLang);
      }

      return null;
    } catch {
      return this.localFallback(paragraphs, sourceLang, targetLang);
    }
  },

  async translateViaAPI(texts, sourceLang, targetLang, provider, apiKey, model) {
    const providerInfo = MODEL_REGISTRY.getProvider(provider);
    if (!providerInfo) throw new Error('Unknown provider: ' + provider);

    const baseUrl = providerInfo.baseUrl;
    const modelName = model || providerInfo.models[0]?.id || '';
    const srcName = this.LANG_NAMES[sourceLang] || sourceLang;
    const tgtName = this.LANG_NAMES[targetLang] || targetLang;

    const numberedTexts = texts.map((t, i) => `[${i + 1}] ${t}`);
    const systemPrompt = `你是专业翻译。将以下${srcName}段落翻译为${tgtName}。

严格格式要求：
- 每段翻译独占一行，格式: [编号] 翻译内容|置信度
- 置信度为0.0~1.0的小数，表示你对这段翻译准确性的把握
  0.9~1.0: 非常有把握  0.7~0.9: 基本准确  0.5~0.7: 可能有偏差  0.0~0.5: 不确定
- 编号必须与原文一致
- 翻译准确自然，保留专业术语原文（括号标注）
- 不要合并或拆分段落
- 不要添加解释`;

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey && apiKey !== 'local') headers['Authorization'] = `Bearer ${apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: numberedTexts.join('\n') }
        ],
        temperature: 0.3,
        max_tokens: 8192
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`API ${resp.status}: ${errText.slice(0, 100)}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    return this.parseTranslationResponse(content);
  },

  parseTranslationResponse(response) {
    const results = {};
    if (!response) return results;

    const matches = response.matchAll(/\[(\d+)\]\s*([\s\S]*?)\|(\d+\.?\d*)\s*(?=\[\d+\]|$)/g);
    for (const match of matches) {
      const num = parseInt(match[1]);
      const text = match[2].trim();
      const confidence = parseFloat(match[3]);
      if (num > 0 && text) {
        results[num] = { text, confidence: Math.min(1, Math.max(0, confidence || 0.5)) };
      }
    }

    if (Object.keys(results).length === 0) {
      const fallbackMatches = response.matchAll(/\[(\d+)\]\s*([\s\S]*?)(?=\[\d+\]|$)/g);
      for (const match of fallbackMatches) {
        const num = parseInt(match[1]);
        let text = match[2].trim();
        const pipeMatch = text.match(/^(.+)\|(\d+\.?\d*)$/);
        let confidence = 0.5;
        if (pipeMatch) {
          text = pipeMatch[1].trim();
          confidence = parseFloat(pipeMatch[2]);
        }
        if (num > 0 && text) {
          results[num] = { text, confidence: Math.min(1, Math.max(0, confidence || 0.5)) };
        }
      }
    }

    if (Object.keys(results).length === 0) {
      const lines = response.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const m = line.match(/^\[(\d+)\]\s*(.+)/);
        if (m) {
          let text = m[2].trim();
          let confidence = 0.5;
          const pm = text.match(/^(.+)\|(\d+\.?\d*)$/);
          if (pm) {
            text = pm[1].trim();
            confidence = parseFloat(pm[2]);
          }
          results[parseInt(m[1])] = { text, confidence: Math.min(1, Math.max(0, confidence || 0.5)) };
        }
      }
    }

    return results;
  },

  localConfidenceCheck(original, translated, llmConfidence) {
    let score = llmConfidence || 0.5;

    if (!translated || translated.length < 2) return 0.1;

    const origLen = original.length;
    const transLen = translated.length;
    const ratio = transLen / Math.max(origLen, 1);
    if (ratio < 0.2 || ratio > 5.0) score *= 0.6;

    const origNumbers = (original.match(/\d+/g) || []).join('');
    const transNumbers = (translated.match(/\d+/g) || []).join('');
    if (origNumbers && origNumbers !== transNumbers) score *= 0.7;

    const origProperNouns = (original.match(/[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g) || []);
    for (const pn of origProperNouns) {
      if (!translated.includes(pn)) score *= 0.9;
    }

    if (translated.includes('[翻译失败]') || translated.includes('需配置API')) score = 0.1;

    return Math.min(1, Math.max(0, score));
  },

  confidenceStyle(confidence) {
    if (confidence >= 0.8) {
      return { border: '#22c55e', label: '✓ 可信', bg: 'rgba(34,197,94,0.08)' };
    } else if (confidence >= 0.5) {
      return { border: '#eab308', label: '⚠ 一般', bg: 'rgba(234,179,8,0.08)' };
    } else {
      return { border: '#ef4444', label: '✗ 存疑', bg: 'rgba(239,68,68,0.08)' };
    }
  },

  insertTranslation(element, translatedText, targetLang, confidence) {
    if (element.dataset.verityTranslated) return;

    const isRTL = this.RTL_LANGS.includes(targetLang);
    const cStyle = this.confidenceStyle(confidence || 0.5);

    const translationDiv = document.createElement('div');
    translationDiv.className = 'verity-translate';
    translationDiv.dir = isRTL ? 'rtl' : 'ltr';

    const badge = document.createElement('span');
    badge.style.cssText = `
      display: inline-block;
      font-size: 10px;
      font-style: normal;
      padding: 1px 5px;
      border-radius: 3px;
      margin-right: 4px;
      font-weight: 600;
      vertical-align: middle;
      color: ${cStyle.border};
      background: ${cStyle.bg};
    `;
    badge.textContent = `${cStyle.label} ${(confidence || 0.5).toFixed(1)}`;

    const textSpan = document.createElement('span');
    textSpan.textContent = translatedText;

    translationDiv.appendChild(badge);
    translationDiv.appendChild(textSpan);
    translationDiv.style.cssText = `
      color: #6b7280;
      font-size: 0.9em;
      line-height: 1.6;
      margin-top: 2px;
      padding-left: 8px;
      border-left: 2px solid ${cStyle.border};
      background: ${cStyle.bg};
      font-style: italic;
    `;

    element.parentNode.insertBefore(translationDiv, element.nextSibling);
    element.dataset.verityTranslated = 'true';
  },

  async translatePage(sourceLang, targetLang, config, onProgress) {
    const paragraphs = this.extractParagraphs();
    if (paragraphs.length === 0) return { translated: 0, total: 0 };

    const untranslateable = paragraphs.filter(p => !p.dataset.verityTranslated);
    if (untranslateable.length === 0) return { translated: 0, total: paragraphs.length };

    const batches = this.createBatches(untranslateable, sourceLang);
    let translatedCount = 0;

    const processBatch = async (batch, batchIdx) => {
      const texts = batch.map(p => p.textContent.trim());

      const translations = {};
      const toTranslate = [];
      const toTranslateIndices = [];

      for (let i = 0; i < texts.length; i++) {
        const key = this._cacheKey(texts[i], sourceLang, targetLang);
        if (this._cache[key]) {
          translations[i + 1] = this._cache[key];
        } else {
          toTranslate.push(texts[i]);
          toTranslateIndices.push(i);
        }
      }

      if (toTranslate.length > 0) {
        let apiResults = {};
        try {
          if (config.apiKey && config.apiProvider) {
            apiResults = await this.translateViaAPI(
              toTranslate, sourceLang, targetLang,
              config.apiProvider, config.apiKey, config.apiModel
            );
          } else {
            for (let j = 0; j < toTranslate.length; j++) {
              apiResults[j + 1] = { text: `[${this.LANG_NAMES[sourceLang] || sourceLang} → ${this.LANG_NAMES[targetLang] || targetLang} 需要云端翻译]`, confidence: 0.1 };
            }
          }
        } catch {
          for (let j = 0; j < toTranslate.length; j++) {
            apiResults[j + 1] = { text: `[翻译失败，请重试]`, confidence: 0.1 };
          }
        }

        for (let j = 0; j < toTranslate.length; j++) {
          const result = apiResults[j + 1];
          const origIdx = toTranslateIndices[j] + 1;
          if (result) {
            const translatedText = typeof result === 'string' ? result : result.text;
            const llmConf = typeof result === 'string' ? 0.5 : result.confidence;
            const finalConf = this.localConfidenceCheck(toTranslate[j], translatedText, llmConf);
            translations[origIdx] = { text: translatedText, confidence: finalConf };
            const key = this._cacheKey(toTranslate[j], sourceLang, targetLang);
            this._cache[key] = { text: translatedText, confidence: finalConf };
          }
        }
      }

      for (let i = 0; i < batch.length; i++) {
        const result = translations[i + 1];
        if (result) {
          const translatedText = typeof result === 'string' ? result : result.text;
          const confidence = typeof result === 'string' ? 0.5 : result.confidence;
          this.insertTranslation(batch[i], translatedText, targetLang, confidence);
          translatedCount++;
        }
      }

      if (onProgress) {
        onProgress({
          translated: translatedCount,
          total: untranslateable.length,
          batch: batchIdx + 1,
          totalBatches: batches.length
        });
      }
    };

    for (let i = 0; i < batches.length; i += this.PARALLEL_BATCHES) {
      const chunk = batches.slice(i, i + this.PARALLEL_BATCHES);
      await Promise.all(chunk.map((batch, idx) => processBatch(batch, i + idx)));

      if (i + this.PARALLEL_BATCHES < batches.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return { translated: translatedCount, total: untranslateable.length };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VerityTranslator };
}
if (typeof window !== 'undefined') {
  window.VerityTranslator = VerityTranslator;
}