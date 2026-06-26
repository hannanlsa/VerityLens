/**
 * VerityLens · OCR Module · Tesseract.js（v0.7.0）
 *
 * 浏览器端 OCR，基于 Tesseract.js WASM
 * 支持：中英文混合识别、区域截图、置信度评分
 */

const VerityOCR = {
  worker: null,
  initialized: false,
  initializing: false,

  async init(langs = 'chi_sim+eng') {
    if (this.initialized) return;
    if (this.initializing) {
      while (this.initializing) await new Promise(r => setTimeout(r, 100));
      return;
    }

    this.initializing = true;
    try {
      if (typeof Tesseract === 'undefined') {
        VerityCore.log('Tesseract.js not loaded, OCR unavailable');
        return;
      }
      this.worker = await Tesseract.createWorker(langs, 1, {
        logger: m => VerityCore.log('OCR:', m.status, m.progress)
      });
      this.initialized = true;
      VerityCore.log('OCR initialized');
    } catch (err) {
      VerityCore.log('OCR init failed:', err.message);
    } finally {
      this.initializing = false;
    }
  },

  async recognize(imageSource) {
    if (!this.initialized) await this.init();
    if (!this.worker) {
      return { text: '', confidence: 0, blocks: [], error: 'OCR not available' };
    }

    try {
      let imageData;
      if (imageSource instanceof Blob || imageSource instanceof File) {
        imageData = imageSource;
      } else if (typeof imageSource === 'string') {
        imageData = imageSource;
      } else if (imageSource instanceof HTMLElement) {
        imageData = await this.captureElement(imageSource);
      } else {
        return { text: '', confidence: 0, blocks: [], error: 'unsupported source' };
      }

      const result = await this.worker.recognize(imageData);
      const blocks = result.data.blocks?.map(b => ({
        text: b.text,
        confidence: b.confidence,
        bbox: b.bbox
      })) || [];

      return {
        text: result.data.text?.trim() || '',
        confidence: result.data.confidence / 100,
        blocks,
        language: result.data.language
      };
    } catch (err) {
      VerityCore.log('OCR recognize failed:', err.message);
      return { text: '', confidence: 0, blocks: [], error: err.message };
    }
  },

  async captureElement(element) {
    try {
      const rect = element.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.drawWindow?.(window, rect.left, rect.top, rect.width, rect.height, '#fff');
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  },

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initialized = false;
    }
  }
};

if (typeof window !== 'undefined') {
  window.VerityOCR = VerityOCR;
}