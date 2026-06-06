/**
 * VerityLens · Cross-Modal Verifier Core（v0.1.0-alpha）
 *
 * 主人决策：跨模态自校验 = 核心护城河
 * - ASR（语音）+ OCR（屏幕）+ 文本三元组
 * - 5 级置信度（high / medium / abnormal / partial_X / unverified）
 * - 与单模态 360/百度/搜狗 差异化 = 真蓝海
 *
 * 4 大模块：
 * 1. asr.js         - 语音转文字（Web Speech API）
 * 2. ocr.js         - 屏幕文字识别（Tesseract.js）
 * 3. verifier.js    - 三元组交叉验证
 * 4. confidence.js  - 5 级置信度评分
 */

const VerityCore = {
  VERSION: '0.1.0-alpha',
  DEBUG: false,

  // 5 级置信度
  CONFIDENCE: {
    HIGH: 'high',              // 高置信度（绿）
    MEDIUM: 'medium',          // 中置信度（黄）
    ABNORMAL: 'abnormal',      // 异常（红）
    PARTIAL: 'partial_X',      // 部分验证（橙）
    UNVERIFIED: 'unverified'   // 未验证（灰）
  },

  // 颜色映射
  COLORS: {
    [this.CONFIDENCE.HIGH]: '#22c55e',         // 绿
    [this.CONFIDENCE.MEDIUM]: '#eab308',       // 黄
    [this.CONFIDENCE.ABNORMAL]: '#ef4444',     // 红
    [this.CONFIDENCE.PARTIAL]: '#f97316',      // 橙
    [this.CONFIDENCE.UNVERIFIED]: '#9ca3af'    // 灰
  },

  log(...args) {
    if (this.DEBUG) console.log('[VerityCore]', ...args);
  },

  /**
   * ASR - 语音转文字（Web Speech API）
   * 实际生产中应使用 Whisper WASM / 云 API
   */
  async transcribeAudio(audioBlob) {
    this.log('ASR transcribeAudio', audioBlob);
    // 占位：实际集成 faster-whisper 时替换
    return {
      text: '',
      confidence: 0,
      language: 'zh-CN',
      duration: 0
    };
  },

  /**
   * OCR - 屏幕文字识别
   * 实际生产中应使用 Tesseract.js / PaddleOCR WASM
   */
  async recognizeText(imageBlob) {
    this.log('OCR recognizeText', imageBlob);
    // 占位：实际集成 PaddleOCR 时替换
    return {
      text: '',
      confidence: 0,
      blocks: []
    };
  },

  /**
   * 三元组交叉验证（主人核心专利 1.1）
   * @param asrResult {text, confidence}
   * @param ocrResult {text, confidence}
   * @param textContent {string}
   * @returns {{confidence: string, score: number, reasons: string[]}}
   */
  async crossValidate(asrResult, ocrResult, textContent) {
    this.log('crossValidate', { asrResult, ocrResult, textContent });

    const reasons = [];
    let score = 0;
    let matches = 0;
    let total = 0;

    // 1. ASR vs 文本
    if (asrResult?.text) {
      total++;
      const asrMatch = this.fuzzyMatch(asrResult.text, textContent);
      if (asrMatch > 0.7) {
        matches++;
        reasons.push(`✓ ASR 匹配度 ${(asrMatch * 100).toFixed(0)}%`);
      } else {
        reasons.push(`✗ ASR 匹配度低 ${(asrMatch * 100).toFixed(0)}%`);
      }
    }

    // 2. OCR vs 文本
    if (ocrResult?.text) {
      total++;
      const ocrMatch = this.fuzzyMatch(ocrResult.text, textContent);
      if (ocrMatch > 0.7) {
        matches++;
        reasons.push(`✓ OCR 匹配度 ${(ocrMatch * 100).toFixed(0)}%`);
      } else {
        reasons.push(`✗ OCR 匹配度低 ${(ocrMatch * 100).toFixed(0)}%`);
      }
    }

    // 3. 计算置信度
    if (total > 0) {
      score = matches / total;
    } else {
      // 没有多模态数据 = 仅基于文本的简单判断
      score = this.textHeuristic(textContent);
      reasons.push(`📝 仅文本启发式评分 ${(score * 100).toFixed(0)}%`);
    }

    return {
      confidence: this.scoreToConfidence(score, reasons),
      score,
      reasons
    };
  },

  /**
   * 模糊匹配
   */
  fuzzyMatch(a, b) {
    if (!a || !b) return 0;
    const aSet = new Set(a.toLowerCase().split(/\s+/));
    const bSet = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...aSet].filter(x => bSet.has(x)));
    const union = new Set([...aSet, ...bSet]);
    return union.size > 0 ? intersection.size / union.size : 0;
  },

  /**
   * 文本启发式评分（仅文本情况下的回退）
   * 实际生产中应接入 LLM（Qwen2.5-7B）
   */
  textHeuristic(text) {
    if (!text) return 0;
    let score = 0.5;  // 默认中等

    // 官方域名加分
    if (/\.(gov|edu|org)\b/.test(text)) score += 0.2;
    if (/\b(wikipedia|github|stackoverflow)\b/.test(text)) score += 0.15;

    // 广告特征减分
    if (/\b(广告|赞助|推广|ad|sponsored|promo)\b/i.test(text)) score -= 0.3;
    if (/\b(限时|特惠|秒杀|打折|coupon)\b/i.test(text)) score -= 0.1;

    // SEO 农场特征减分
    if (text.length > 1000 && /(.)\1{5,}/.test(text)) score -= 0.2;  // 重复字符
    if ((text.match(/https?:\/\//g) || []).length > 10) score -= 0.15;  // 大量链接

    return Math.max(0, Math.min(1, score));
  },

  /**
   * 分数 → 5 级置信度
   */
  scoreToConfidence(score, reasons) {
    if (score >= 0.85) return this.CONFIDENCE.HIGH;
    if (score >= 0.65) return this.CONFIDENCE.MEDIUM;
    if (score >= 0.4) return this.CONFIDENCE.PARTIAL;
    if (score >= 0.2) return this.CONFIDENCE.ABNORMAL;
    return this.CONFIDENCE.UNVERIFIED;
  }
};

// 导出（CommonJS + ESM 双兼容）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VerityCore;
}
if (typeof window !== 'undefined') {
  window.VerityCore = VerityCore;
}
