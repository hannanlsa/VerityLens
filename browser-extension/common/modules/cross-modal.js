/**
 * VerityLens · Cross-Modal Verifier · 三元组交叉验证（v0.6.0）
 *
 * 原创算法：跨模态自校验框架
 * - ASR（语音）+ OCR（屏幕）+ 文本 三元组交叉验证
 * - 统一时间轴 + 实体宇宙
 * - 5 级置信度 + 跨模态实体链接
 */

const CrossModalVerifier = {
  entityCache: new Map(),
  timeline: [],

  reset() {
    this.entityCache.clear();
    this.timeline = [];
  },

  _t(key, params) {
    if (typeof VerityI18n !== 'undefined' && VerityI18n._loaded) {
      return VerityI18n.t(key, params);
    }
    const fallback = {
      verify_asr_match: `✓ ASR verified (entity links: ${params?.links}, text match: ${params?.match}%)`,
      verify_asr_partial: `⚠ ASR partial (entity links: ${params?.links}, text match: ${params?.match}%)`,
      verify_asr_mismatch: `✗ ASR mismatch (text match: ${params?.match}%)`,
      verify_ocr_match: `✓ OCR verified (entity links: ${params?.links}, text match: ${params?.match}%)`,
      verify_ocr_partial: `⚠ OCR partial (entity links: ${params?.links}, text match: ${params?.match}%)`,
      verify_ocr_mismatch: `✗ OCR mismatch (text match: ${params?.match}%)`,
      verify_asr_ocr_consistent: `✓ ASR-OCR consistent (shared entities: ${params?.links})`,
      verify_heuristic_only: `📝 Text heuristic ${params?.score}%`,
      verify_triple_cross: `🔬 Triple cross-verification (${params?.count} modalities)`,
      verify_dual_cross: `🔬 Dual-modal cross-verification`
    };
    return fallback[key] || key;
  },

  extractEntities(text) {
    if (!text) return [];
    const entities = new Set();

    const urlPattern = /https?:\/\/[^\s<>"']+/g;
    const emailPattern = /[\w.-]+@[\w.-]+\.\w+/g;
    const phonePattern = /(?:\+?86[-\s]?)?1[3-9]\d{9}/g;
    const datePattern = /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]?/g;
    const numberPattern = /\d+(?:\.\d+)?%?/g;
    const orgPattern = /[\u4e00-\u9fa5]{2,6}(?:公司|集团|机构|研究院|大学|学院|医院|银行|部门|委员会|中心)/g;
    const personPattern = /[\u4e00-\u9fa5]{2,4}(?:教授|博士|先生|女士|主任|院长|部长|工程师)/g;

    const patterns = [
      { type: 'url', regex: urlPattern },
      { type: 'email', regex: emailPattern },
      { type: 'phone', regex: phonePattern },
      { type: 'date', regex: datePattern },
      { type: 'number', regex: numberPattern },
      { type: 'org', regex: orgPattern },
      { type: 'person', regex: personPattern }
    ];

    for (const { type, regex } of patterns) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        entities.add({ type, value: match[0], position: match.index });
      }
    }

    const keywords = text.split(/[\s,，。.!！?？;；:：、\n]+/).filter(w => w.length >= 2 && w.length <= 20);
    for (const kw of keywords) {
      if (!entities.has(kw)) {
        entities.add({ type: 'keyword', value: kw, position: -1 });
      }
    }

    return [...entities];
  },

  linkEntities(entitiesA, entitiesB) {
    const links = [];
    const valuesA = new Map();

    for (const e of entitiesA) {
      const key = `${e.type}:${e.value.toLowerCase()}`;
      if (!valuesA.has(key)) valuesA.set(key, []);
      valuesA.get(key).push(e);
    }

    for (const e of entitiesB) {
      const key = `${e.type}:${e.value.toLowerCase()}`;
      if (valuesA.has(key)) {
        for (const match of valuesA.get(key)) {
          links.push({
            entity: e.value,
            type: e.type,
            sourceA: match,
            sourceB: e,
            matchType: 'exact'
          });
        }
      }
    }

    return links;
  },

  async verify(textContent, asrResult, ocrResult, options = {}) {
    this.reset();
    const reasons = [];
    let totalWeight = 0;
    let weightedScore = 0;

    const textEntities = this.extractEntities(textContent);
    VerityCore.log('Text entities:', textEntities.length);

    if (asrResult?.text) {
      const asrEntities = this.extractEntities(asrResult.text);
      const asrLinks = this.linkEntities(textEntities, asrEntities);
      const asrTextMatch = VerityCore.fuzzyMatch(asrResult.text, textContent);

      const asrScore = asrLinks.length > 0
        ? Math.min(1, asrLinks.length / Math.max(textEntities.length, 1) * 2) * 0.6 + asrTextMatch * 0.4
        : asrTextMatch;

      const asrWeight = asrResult.confidence || 0.7;
      weightedScore += asrScore * asrWeight;
      totalWeight += asrWeight;

      if (asrScore > 0.7) {
        reasons.push(this._t('verify_asr_match', { links: asrLinks.length, match: (asrTextMatch * 100).toFixed(0) }));
      } else if (asrScore > 0.4) {
        reasons.push(this._t('verify_asr_partial', { links: asrLinks.length, match: (asrTextMatch * 100).toFixed(0) }));
      } else {
        reasons.push(this._t('verify_asr_mismatch', { match: (asrTextMatch * 100).toFixed(0) }));
      }

      this.timeline.push({
        modality: 'asr',
        timestamp: Date.now(),
        score: asrScore,
        entities: asrEntities.length,
        links: asrLinks.length
      });
    }

    if (ocrResult?.text) {
      const ocrEntities = this.extractEntities(ocrResult.text);
      const ocrLinks = this.linkEntities(textEntities, ocrEntities);
      const ocrTextMatch = VerityCore.fuzzyMatch(ocrResult.text, textContent);

      const ocrScore = ocrLinks.length > 0
        ? Math.min(1, ocrLinks.length / Math.max(textEntities.length, 1) * 2) * 0.6 + ocrTextMatch * 0.4
        : ocrTextMatch;

      const ocrWeight = ocrResult.confidence || 0.7;
      weightedScore += ocrScore * ocrWeight;
      totalWeight += ocrWeight;

      if (ocrScore > 0.7) {
        reasons.push(this._t('verify_ocr_match', { links: ocrLinks.length, match: (ocrTextMatch * 100).toFixed(0) }));
      } else if (ocrScore > 0.4) {
        reasons.push(this._t('verify_ocr_partial', { links: ocrLinks.length, match: (ocrTextMatch * 100).toFixed(0) }));
      } else {
        reasons.push(this._t('verify_ocr_mismatch', { match: (ocrTextMatch * 100).toFixed(0) }));
      }

      this.timeline.push({
        modality: 'ocr',
        timestamp: Date.now(),
        score: ocrScore,
        entities: ocrEntities.length,
        links: ocrLinks.length
      });
    }

    if (asrResult?.text && ocrResult?.text) {
      const asrOcrLinks = this.linkEntities(
        this.extractEntities(asrResult.text),
        this.extractEntities(ocrResult.text)
      );
      if (asrOcrLinks.length > 0) {
        reasons.push(this._t('verify_asr_ocr_consistent', { links: asrOcrLinks.length }));
        weightedScore += 0.1;
        totalWeight += 0.1;
      }
    }

    let finalScore;
    if (totalWeight > 0) {
      finalScore = weightedScore / totalWeight;
    } else {
      finalScore = VerityCore.textHeuristic(textContent);
      reasons.push(this._t('verify_heuristic_only', { score: (finalScore * 100).toFixed(0) }));
    }

    const modalityCount = [asrResult?.text, ocrResult?.text, textContent].filter(Boolean).length;
    if (modalityCount >= 3) {
      reasons.push(this._t('verify_triple_cross', { count: modalityCount }));
    } else if (modalityCount === 2) {
      reasons.push(this._t('verify_dual_cross'));
    }

    return {
      confidence: VerityCore.scoreToConfidence(finalScore),
      score: Math.max(0, Math.min(1, finalScore)),
      reasons,
      channel: 'cross-modal',
      timeline: [...this.timeline],
      entityCount: textEntities.length,
      modalityCount
    };
  }
};

if (typeof window !== 'undefined') {
  window.CrossModalVerifier = CrossModalVerifier;
}