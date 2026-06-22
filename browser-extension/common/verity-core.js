/**
 * VerityLens · Cross-Modal Verifier Core（v0.5.0）
 *
 * 双通道智能路由 + 跨模态自校验：
 * - 本地通道：关键词匹配 + 正则规则 + Tesseract.js OCR + WebSpeech ASR + 三元组交叉验证
 * - 云端通道：DeepSeek / 智谱GLM / 通义千问 / 硅基流动 / Groq 等（用户自填Key）
 * - Docker通道：用户自建 Ollama（OpenAI兼容接口）
 * - 智能路由：轻量→本地，复杂→云端，自动选最快可用模型
 * - 跨模态：ASR + OCR + 文本三元组交叉验证（专利 1.1）
 *
 * 5 级置信度（high / medium / abnormal / partial_X / unverified）
 */

const VerityCore = {
  VERSION: '0.5.0',
  DEBUG: false,

  CONFIDENCE: {
    HIGH: 'high',
    MEDIUM: 'medium',
    ABNORMAL: 'abnormal',
    PARTIAL: 'partial_X',
    UNVERIFIED: 'unverified'
  },

  COLORS: {
    high: '#22c55e',
    medium: '#eab308',
    abnormal: '#ef4444',
    partial_X: '#f97316',
    unverified: '#9ca3af'
  },

  CONFIDENCE_LABEL: {
    high: 'high',
    medium: 'medium',
    abnormal: 'abnormal',
    partial_X: 'partial_X',
    unverified: 'unverified'
  },

  MODE: {
    LOCAL: 'local',
    SMART: 'smart',
    CLOUD: 'cloud',
    DOCKER: 'docker'
  },

  getConfidenceLabel(confidence) {
    if (typeof VerityI18n !== 'undefined' && VerityI18n._loaded) {
      const map = {
        high: 'confidence_high',
        medium: 'confidence_medium',
        abnormal: 'confidence_abnormal',
        partial_X: 'confidence_partial',
        unverified: 'confidence_unverified'
      };
      return VerityI18n.t(map[confidence] || 'confidence_unverified');
    }
    return confidence;
  },

  log(...args) {
    if (this.DEBUG) console.log('[VerityCore]', ...args);
  },

  async transcribeAudio(audioBlob) {
    this.log('ASR transcribeAudio', audioBlob);
    if (typeof VerityASR !== 'undefined') {
      return VerityASR.transcribeAudio(audioBlob);
    }
    return { text: '', confidence: 0, language: 'zh-CN', duration: 0 };
  },

  async recognizeText(imageBlob) {
    this.log('OCR recognizeText', imageBlob);
    if (typeof VerityOCR !== 'undefined') {
      return VerityOCR.recognize(imageBlob);
    }
    return { text: '', confidence: 0, blocks: [] };
  },

  async crossValidate(asrResult, ocrResult, textContent) {
    this.log('crossValidate', { asrResult, ocrResult, textContent });

    if (typeof CrossModalVerifier !== 'undefined' && (asrResult?.text || ocrResult?.text)) {
      return CrossModalVerifier.verify(textContent, asrResult, ocrResult);
    }

    const reasons = [];
    let score = 0;
    let matches = 0;
    let total = 0;

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

    if (total > 0) {
      score = matches / total;
    } else {
      score = this.textHeuristic(textContent);
      reasons.push(`📝 本地启发式评分 ${(score * 100).toFixed(0)}%`);
    }

    return {
      confidence: this.scoreToConfidence(score),
      score,
      reasons,
      channel: 'local'
    };
  },

  fuzzyMatch(a, b) {
    if (!a || !b) return 0;
    const aSet = new Set(a.toLowerCase().split(/\s+/));
    const bSet = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...aSet].filter(x => bSet.has(x)));
    const union = new Set([...aSet, ...bSet]);
    return union.size > 0 ? intersection.size / union.size : 0;
  },

  textHeuristic(text) {
    if (!text) return 0;
    let score = 0.5;

    if (/\.(gov|edu|org)\b/.test(text)) score += 0.2;
    if (/\b(wikipedia|github|stackoverflow|mozilla|w3\.org)\b/.test(text)) score += 0.15;
    if (/\b(官方|官网|documentation|docs)\b/i.test(text)) score += 0.1;

    if (/(?:广告|赞助|推广|ad|sponsored|promo)/i.test(text)) score -= 0.3;
    if (/(?:限时|特惠|秒杀|打折|coupon|优惠|折扣)/i.test(text)) score -= 0.15;
    if (/(?:点击|下载app|立即购买|马上注册)/i.test(text)) score -= 0.1;

    if (text.length > 1000 && /(.)\1{5,}/.test(text)) score -= 0.2;
    if ((text.match(/https?:\/\//g) || []).length > 10) score -= 0.15;

    return Math.max(0, Math.min(1, score));
  },

  scoreToConfidence(score) {
    if (score >= 0.85) return this.CONFIDENCE.HIGH;
    if (score >= 0.65) return this.CONFIDENCE.MEDIUM;
    if (score >= 0.4) return this.CONFIDENCE.PARTIAL;
    if (score >= 0.2) return this.CONFIDENCE.ABNORMAL;
    return this.CONFIDENCE.UNVERIFIED;
  }
};

const MODEL_REGISTRY = {
  providers: {
    zhipu: {
      name: '智谱GLM',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      tier: 'free',
      models: [
        { id: 'glm-4-flash', name: 'GLM-4-Flash', free: '永久免费' },
        { id: 'glm-4-air', name: 'GLM-4-Air', free: '新用户送额度' }
      ],
      signupUrl: 'https://open.bigmodel.cn/'
    },
    deepseek: {
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      tier: 'free',
      models: [
        { id: 'deepseek-chat', name: 'DeepSeek-V3', free: '注册送500万token' },
        { id: 'deepseek-reasoner', name: 'DeepSeek-R1', free: '同上' }
      ],
      signupUrl: 'https://platform.deepseek.com/'
    },
    qwen: {
      name: '通义千问',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      tier: 'free',
      models: [
        { id: 'qwen-turbo', name: 'Qwen-Turbo', free: '新用户100万token' },
        { id: 'qwen-plus', name: 'Qwen-Plus', free: '新用户送额度' }
      ],
      signupUrl: 'https://dashscope.console.aliyun.com/'
    },
    siliconflow: {
      name: '硅基流动',
      baseUrl: 'https://api.siliconflow.cn/v1',
      tier: 'free',
      models: [
        { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen2.5-7B', free: '注册送2000万token' },
        { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3', free: '同上' },
        { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama-3.3-70B', free: '同上' }
      ],
      signupUrl: 'https://siliconflow.cn/'
    },
    groq: {
      name: 'Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      tier: 'free',
      models: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama-3.3-70B', free: '免费速率限制' }
      ],
      signupUrl: 'https://console.groq.com/'
    },
    moonshot: {
      name: 'Moonshot',
      baseUrl: 'https://api.moonshot.cn/v1',
      tier: 'free',
      models: [
        { id: 'moonshot-v1-8k', name: 'Moonshot-v1', free: '新用户送额度' }
      ],
      signupUrl: 'https://platform.moonshot.cn/'
    },
    minimax: {
      name: 'MiniMax',
      baseUrl: 'https://api.minimax.chat/v1',
      tier: 'free',
      models: [
        { id: 'abab6.5s-chat', name: 'ABAB-6.5s', free: '注册送额度' }
      ],
      signupUrl: 'https://platform.minimaxi.com/'
    },
    yi: {
      name: '零一万物',
      baseUrl: 'https://api.lingyiwanwu.com/v1',
      tier: 'free',
      models: [
        { id: 'yi-lightning', name: 'Yi-Lightning', free: '注册送额度' }
      ],
      signupUrl: 'https://platform.lingyiwanwu.com/'
    },
    baidu: {
      name: '百度千帆',
      baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop',
      tier: 'free',
      models: [
        { id: 'ernie-lite-8k', name: 'ERNIE-Lite', free: '每月免费额度' }
      ],
      signupUrl: 'https://console.bce.baidu.com/qianfan/'
    },
    openai: {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      tier: 'paid',
      models: [
        { id: 'gpt-4o-mini', name: 'GPT-4o-mini', free: '', price: '$0.15/1M input' },
        { id: 'gpt-4o', name: 'GPT-4o', free: '', price: '$2.50/1M input' }
      ],
      signupUrl: 'https://platform.openai.com/'
    },
    claude: {
      name: 'Anthropic Claude',
      baseUrl: 'https://api.anthropic.com/v1',
      tier: 'paid',
      models: [
        { id: 'claude-3-5-haiku-20241022', name: 'Claude-3.5-Haiku', free: '', price: '$0.80/1M input' },
        { id: 'claude-sonnet-4-20250514', name: 'Claude-Sonnet-4', free: '', price: '$3/1M input' }
      ],
      signupUrl: 'https://console.anthropic.com/'
    },
    gemini: {
      name: 'Google Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      tier: 'paid',
      models: [
        { id: 'gemini-2.0-flash', name: 'Gemini-2.0-Flash', free: '', price: '$0.10/1M input' },
        { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini-2.5-Pro', free: '', price: '$1.25/1M input' }
      ],
      signupUrl: 'https://aistudio.google.com/'
    },
    doubao: {
      name: '字节豆包',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      tier: 'paid',
      models: [
        { id: 'doubao-1-5-pro-32k-250115', name: 'Doubao-1.5-Pro', free: '', price: '¥0.5/1M input' },
        { id: 'doubao-1-5-lite-32k-250115', name: 'Doubao-1.5-Lite', free: '', price: '¥0.05/1M input' }
      ],
      signupUrl: 'https://console.volcengine.com/ark'
    },
    hunyuan: {
      name: '腾讯混元',
      baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
      tier: 'paid',
      models: [
        { id: 'hunyuan-lite', name: '混元-Lite', free: '', price: '¥0.1/1M input' },
        { id: 'hunyuan-turbos', name: '混元-TurboS', free: '', price: '¥0.8/1M input' }
      ],
      signupUrl: 'https://cloud.tencent.com/product/hunyuan'
    },
    spark: {
      name: '讯飞星火',
      baseUrl: 'https://spark-api-open.xf-yun.com/v1',
      tier: 'paid',
      models: [
        { id: 'generalv3.5', name: 'Spark-4.0-Ultra', free: '', price: '¥0.6/1M input' },
        { id: '4.0Ultra', name: 'Spark-Max', free: '', price: '¥0.2/1M input' }
      ],
      signupUrl: 'https://xinghuo.xfyun.cn/'
    },
    custom: {
      name: '自定义',
      baseUrl: '',
      tier: 'custom',
      models: [],
      signupUrl: ''
    }
  },

  getProvider(providerId) {
    return this.providers[providerId];
  },

  getAllProviders() {
    return Object.entries(this.providers)
      .filter(([k]) => k !== 'custom')
      .map(([id, p]) => ({
        id,
        name: p.name,
        tier: p.tier,
        hasFree: p.models.some(m => m.free),
        models: p.models,
        signupUrl: p.signupUrl
      }));
  },

  getFreeProviders() {
    return this.getAllProviders().filter(p => p.hasFree);
  },

  getPaidProviders() {
    return this.getAllProviders().filter(p => p.tier === 'paid');
  },

  getProvidersByTier(tier) {
    return this.getAllProviders().filter(p => p.tier === tier);
  }
};

const SmartRouter = {
  assessComplexity(text, options = {}) {
    let score = 0;
    if (text.length > 2000) score += 2;
    else if (text.length > 500) score += 1;
    if ((options.resultCount || 0) > 10) score += 2;
    else if ((options.resultCount || 0) > 5) score += 1;
    if (options.hasMedia) score += 3;
    if (options.crossModal) score += 2;
    return {
      score,
      level: score >= 5 ? 'heavy' : score >= 3 ? 'medium' : 'light'
    };
  },

  async route(text, options = {}) {
    const config = await this.loadConfig();

    if (config.mode === VerityCore.MODE.LOCAL) return { channel: 'local' };
    if (config.mode === VerityCore.MODE.CLOUD) return this.selectBestCloud(config);
    if (config.mode === VerityCore.MODE.DOCKER) return { channel: 'docker', baseUrl: config.dockerUrl };

    const complexity = this.assessComplexity(text, options);
    if (complexity.level === 'light') return { channel: 'local' };

    if (config.dockerUrl) {
      const dockerOk = await this.healthCheck(config.dockerUrl);
      if (dockerOk) return { channel: 'docker', baseUrl: config.dockerUrl };
    }

    return this.selectBestCloud(config);
  },

  async loadConfig() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        return {
          mode: VerityCore.MODE.LOCAL,
          apiProvider: '',
          apiKey: '',
          apiModel: '',
          dockerUrl: '',
          cloudProviders: []
        };
      }
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({
            mode: VerityCore.MODE.LOCAL,
            apiProvider: '',
            apiKey: '',
            apiModel: '',
            dockerUrl: '',
            cloudProviders: []
          });
        }, 2000);

        chrome.storage.local.get([
          'channelMode', 'apiProvider', 'apiKey', 'apiModel', 'dockerUrl',
          'cloudProviders'
        ], (data) => {
          clearTimeout(timeout);
          resolve({
            mode: data.channelMode || VerityCore.MODE.SMART,
            apiProvider: data.apiProvider || '',
            apiKey: data.apiKey || '',
            apiModel: data.apiModel || '',
            dockerUrl: data.dockerUrl || '',
            cloudProviders: data.cloudProviders || []
          });
        });
      });
    } catch {
      return {
        mode: VerityCore.MODE.LOCAL,
        apiProvider: '',
        apiKey: '',
        apiModel: '',
        dockerUrl: '',
        cloudProviders: []
      };
    }
  },

  async selectBestCloud(config) {
    const candidates = [];

    if (config.apiProvider && config.apiKey) {
      const provider = MODEL_REGISTRY.getProvider(config.apiProvider);
      if (provider) {
        candidates.push({
          channel: 'cloud',
          provider: config.apiProvider,
          baseUrl: provider.baseUrl,
          apiKey: config.apiKey,
          model: config.apiModel || provider.models[0]?.id || ''
        });
      }
    }

    for (const cp of config.cloudProviders) {
      if (cp.apiKey) {
        const provider = MODEL_REGISTRY.getProvider(cp.provider);
        if (provider) {
          candidates.push({
            channel: 'cloud',
            provider: cp.provider,
            baseUrl: provider.baseUrl,
            apiKey: cp.apiKey,
            model: cp.model || provider.models[0]?.id || ''
          });
        }
      }
    }

    for (const candidate of candidates) {
      const healthy = await this.healthCheck(candidate.baseUrl, candidate.apiKey);
      if (healthy) return candidate;
    }

    return { channel: 'local', fallback: true };
  },

  async healthCheck(baseUrl, apiKey) {
    if (!baseUrl) return false;
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const resp = await fetch(`${baseUrl}/models`, {
        headers,
        signal: controller.signal
      });
      clearTimeout(timer);
      return resp.ok;
    } catch {
      return false;
    }
  }
};

const Channel = {
  SYSTEM_PROMPT: `你是搜索结果真实性评估助手。评估给定搜索结果文本的真实性可信度。

分析维度：
1. 是否包含广告/推广/营销特征
2. 是否来自可信来源（官方/学术/权威）
3. 是否存在SEO农场/软文特征
4. 内容质量与信息密度
5. 跨模态一致性（如有OCR/ASR辅助信息）

返回严格JSON格式：
{"confidence":"high|medium|abnormal|partial_X|unverified","score":0.0-1.0,"reasons":["原因1","原因2"]}

置信度说明：
- high: 官方/学术/权威来源，可信度高
- medium: 个人博客/中等可信来源
- partial_X: 部分可信但有疑点
- abnormal: 广告/SEO农场/软文嫌疑大
- unverified: 无法判断`,

  async verify(text, options = {}) {
    const route = await SmartRouter.route(text, options);

    if (route.channel === 'local') {
      const result = await VerityCore.crossValidate(null, null, text);
      if (route.fallback) result.reasons.unshift('⚠️ 云端不可用，回退本地');
      return result;
    }

    if (route.channel === 'docker') {
      return this.openaiVerify(text, route.baseUrl, 'local', route.model || 'qwen2.5:7b');
    }

    if (route.channel === 'cloud') {
      return this.openaiVerify(text, route.baseUrl, route.apiKey, route.model);
    }

    return VerityCore.crossValidate(null, null, text);
  },

  async openaiVerify(text, baseUrl, apiKey, model) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey && apiKey !== 'local') headers['Authorization'] = `Bearer ${apiKey}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: this.SYSTEM_PROMPT },
            { role: 'user', content: text }
          ],
          temperature: 0.1,
          max_tokens: 512
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

      return this.parseLLMResponse(content, model);
    } catch (err) {
      VerityCore.log('cloudVerify error:', err.message);
      const fallback = await VerityCore.crossValidate(null, null, text);
      fallback.reasons.unshift(`⚠️ 云端失败(${err.message.slice(0, 50)})，回退本地`);
      return fallback;
    }
  },

  parseLLMResponse(content, model) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('no JSON');

      const parsed = JSON.parse(jsonMatch[0]);
      const confidence = VerityCore.CONFIDENCE[parsed.confidence?.toUpperCase()] ||
        VerityCore.scoreToConfidence(parsed.score || 0.5);
      const score = typeof parsed.score === 'number' ? parsed.score : 0.5;
      const reasons = Array.isArray(parsed.reasons) ? parsed.reasons : ['LLM评估'];

      return {
        confidence: confidence || VerityCore.CONFIDENCE.MEDIUM,
        score: Math.max(0, Math.min(1, score)),
        reasons,
        channel: 'cloud',
        model: model || 'unknown'
      };
    } catch {
      return {
        confidence: VerityCore.CONFIDENCE.UNVERIFIED,
        score: 0.5,
        reasons: ['LLM返回解析失败'],
        channel: 'cloud',
        model: model || 'unknown'
      };
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VerityCore, MODEL_REGISTRY, SmartRouter, Channel };
}
if (typeof window !== 'undefined') {
  window.VerityCore = VerityCore;
  window.MODEL_REGISTRY = MODEL_REGISTRY;
  window.SmartRouter = SmartRouter;
  window.Channel = Channel;
}
