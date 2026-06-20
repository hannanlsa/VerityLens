const PROVIDERS = {
  deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  zhipu: { name: '智谱GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  qwen: { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo' },
  siliconflow: { name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
  groq: { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  custom: { name: '自定义', baseUrl: '', model: '' }
};

function textHeuristic(text) {
  if (!text) return { confidence: 'unverified', score: 0, reasons: ['空文本'] };
  let score = 0.5;
  const reasons = [];
  if (/\.(gov|edu|org)\b/.test(text)) { score += 0.2; reasons.push('✓ 官方域名'); }
  if (/\b(wikipedia|github|stackoverflow)\b/.test(text)) { score += 0.15; reasons.push('✓ 可信来源'); }
  if (/\b(广告|赞助|推广|ad|sponsored|promo)\b/i.test(text)) { score -= 0.3; reasons.push('✗ 广告特征'); }
  if (/\b(限时|特惠|秒杀|打折|coupon)\b/i.test(text)) { score -= 0.15; reasons.push('✗ 营销特征'); }
  if (text.length > 1000 && /(.)\1{5,}/.test(text)) { score -= 0.2; reasons.push('✗ SEO农场特征'); }
  score = Math.max(0, Math.min(1, score));
  if (!reasons.length) reasons.push('📝 本地启发式评分');
  const confidence = score >= 0.85 ? 'high' : score >= 0.65 ? 'medium' : score >= 0.4 ? 'partial_X' : score >= 0.2 ? 'abnormal' : 'unverified';
  return { confidence, score, reasons, channel: 'local' };
}

async function cloudVerify(text, config) {
  const provider = PROVIDERS[config.provider];
  if (!provider || !config.apiKey) return textHeuristic(text);

  const baseUrl = config.customBaseUrl || provider.baseUrl;
  const model = provider.model;

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '评估搜索结果真实性。返回JSON：{"confidence":"high|medium|abnormal|partial_X|unverified","score":0.0-1.0,"reasons":["原因"]}' },
          { role: 'user', content: text }
        ],
        temperature: 0.1, max_tokens: 512
      }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return {
      confidence: parsed.confidence || 'unverified',
      score: Math.max(0, Math.min(1, parsed.score || 0.5)),
      reasons: parsed.reasons || ['LLM评估'],
      channel: 'cloud', model
    };
  } catch {
    return { ...textHeuristic(text), reasons: ['⚠️ API失败，回退本地'] };
  }
}

async function verify(text) {
  const mode = document.querySelector('input[name=mode]:checked')?.value || 'local';
  const config = {
    provider: localStorage.getItem('provider') || '',
    apiKey: localStorage.getItem('apiKey') || '',
    customBaseUrl: localStorage.getItem('baseUrl') || ''
  };

  if (mode === 'local') return textHeuristic(text);
  if (mode === 'cloud') return cloudVerify(text, config);
  if (mode === 'smart' && text.length > 500 && config.apiKey) return cloudVerify(text, config);
  return textHeuristic(text);
}

function renderResult(el, result) {
  const colors = { high: '#22c55e', medium: '#eab308', abnormal: '#ef4444', partial_X: '#f97316', unverified: '#9ca3af' };
  const labels = { high: '高置信', medium: '中等', abnormal: '异常', partial_X: '部分验证', unverified: '未验证' };
  const color = colors[result.confidence] || colors.unverified;
  const label = labels[result.confidence] || '未验证';
  el.style.display = 'block';
  el.innerHTML = `
    <div class="score" style="color:${color}">${label} ${(result.score * 100).toFixed(0)}%</div>
    <div class="reasons">${result.reasons.map(r => `<div>${r}</div>`).join('')}</div>
    <div style="font-size:11px;opacity:0.5;margin-top:6px">${result.channel === 'cloud' ? '☁️ ' + (result.model || 'LLM') : '🔒 本地'} · VerityLens v0.4.0</div>
  `;
}

document.getElementById('verifyBtn').addEventListener('click', async () => {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return;
  const result = await verify(url);
  renderResult(document.getElementById('result'), result);
});

document.getElementById('textVerifyBtn').addEventListener('click', async () => {
  const text = document.getElementById('textInput').value.trim();
  if (!text) return;
  const result = await verify(text);
  renderResult(document.getElementById('textResult'), result);
});

document.getElementById('saveCloudBtn').addEventListener('click', () => {
  const provider = document.getElementById('provider').value;
  const apiKey = document.getElementById('apiKey').value;
  const baseUrl = document.getElementById('baseUrl').value;
  if (provider) localStorage.setItem('provider', provider);
  if (apiKey) localStorage.setItem('apiKey', apiKey);
  if (baseUrl) localStorage.setItem('baseUrl', baseUrl);
  alert('✅ 已保存');
});