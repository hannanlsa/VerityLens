/**
 * VerityLens · Translator Module · 双语翻译核心（v0.6.0）
 *
 * 联合国六大工作语言互译：
 * - 中文(zh) · 英文(en) · 法文(fr) · 西文(es) · 俄文(ru) · 阿拉伯文(ar)
 *
 * 方案C：批量编号翻译 → 映射回DOM
 */

const VerityTranslator = {
  VERSION: '0.6.0',

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

严格要求：
1. 每段翻译前保留编号 [n]
2. 翻译要准确、自然、符合${tgtName}表达习惯
3. 保留专业术语的原文（括号标注）
4. 不要添加解释或注释

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
- 每段翻译独占一行
- 行首格式: [编号] 翻译内容
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

    const matches = response.matchAll(/\[(\d+)\]\s*([\s\S]*?)(?=\[\d+\]|$)/g);
    for (const match of matches) {
      const num = parseInt(match[1]);
      const text = match[2].trim();
      if (num > 0 && text) {
        results[num] = text;
      }
    }

    if (Object.keys(results).length === 0) {
      const lines = response.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const m = line.match(/^\[(\d+)\]\s*(.+)/);
        if (m) {
          results[parseInt(m[1])] = m[2].trim();
        }
      }
    }

    return results;
  },

  insertTranslation(element, translatedText, targetLang) {
    if (element.dataset.verityTranslated) return;

    const isRTL = this.RTL_LANGS.includes(targetLang);

    const translationDiv = document.createElement('div');
    translationDiv.className = 'verity-translate';
    translationDiv.dir = isRTL ? 'rtl' : 'ltr';
    translationDiv.textContent = translatedText;
    translationDiv.style.cssText = `
      color: #6b7280;
      font-size: 0.9em;
      line-height: 1.6;
      margin-top: 2px;
      padding-left: 8px;
      border-left: 2px solid #22c55e;
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
              apiResults[j + 1] = `[${this.LANG_NAMES[sourceLang] || sourceLang} → ${this.LANG_NAMES[targetLang] || targetLang} 需要云端翻译]`;
            }
          }
        } catch {
          for (let j = 0; j < toTranslate.length; j++) {
            apiResults[j + 1] = `[翻译失败，请重试]`;
          }
        }

        for (let j = 0; j < toTranslate.length; j++) {
          const translated = apiResults[j + 1];
          const origIdx = toTranslateIndices[j] + 1;
          if (translated) {
            translations[origIdx] = translated;
            const key = this._cacheKey(toTranslate[j], sourceLang, targetLang);
            this._cache[key] = translated;
          }
        }
      }

      for (let i = 0; i < batch.length; i++) {
        const translated = translations[i + 1];
        if (translated) {
          this.insertTranslation(batch[i], translated, targetLang);
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