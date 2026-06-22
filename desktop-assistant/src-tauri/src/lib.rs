use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
struct VerifyResult {
    confidence: String,
    score: f64,
    reasons: Vec<String>,
    channel: String,
    model: Option<String>,
}

fn text_heuristic(text: &str) -> VerifyResult {
    if text.is_empty() {
        return VerifyResult {
            confidence: "unverified".into(),
            score: 0.0,
            reasons: vec!["空文本".into()],
            channel: "local".into(),
            model: None,
        };
    }

    let mut score: f64 = 0.5;
    let mut reasons: Vec<String> = Vec::new();

    let re_gov = regex_lite::Regex::new(r"\.(gov|edu|org)\b").unwrap();
    let re_trust = regex_lite::Regex::new(r"(?i)\b(wikipedia|github|stackoverflow|mozilla|w3\.org)\b").unwrap();
    let re_official = regex_lite::Regex::new(r"(?i)\b(官方|官网|documentation|docs)\b").unwrap();
    let re_ad = regex_lite::Regex::new(r"(?i)\b(广告|赞助|推广|ad|sponsored|promo)\b").unwrap();
    let re_marketing = regex_lite::Regex::new(r"(?i)\b(限时|特惠|秒杀|打折|coupon|优惠|折扣)\b").unwrap();
    let re_clickbait = regex_lite::Regex::new(r"(?i)\b(点击|下载app|立即购买|马上注册)\b").unwrap();

    if re_gov.is_match(text) {
        score += 0.2;
        reasons.push("✓ 官方域名".into());
    }
    if re_trust.is_match(text) {
        score += 0.15;
        reasons.push("✓ 可信来源".into());
    }
    if re_official.is_match(text) {
        score += 0.1;
        reasons.push("✓ 官方文档特征".into());
    }
    if re_ad.is_match(text) {
        score -= 0.3;
        reasons.push("✗ 广告特征".into());
    }
    if re_marketing.is_match(text) {
        score -= 0.15;
        reasons.push("✗ 营销特征".into());
    }
    if re_clickbait.is_match(text) {
        score -= 0.1;
        reasons.push("✗ 诱导点击".into());
    }

    score = score.max(0.0).min(1.0);

    if reasons.is_empty() {
        reasons.push(format!("📝 本地启发式评分 {:.0}%", score * 100.0));
    }

    let confidence = if score >= 0.85 {
        "high"
    } else if score >= 0.65 {
        "medium"
    } else if score >= 0.4 {
        "partial_X"
    } else if score >= 0.2 {
        "abnormal"
    } else {
        "unverified"
    };

    VerifyResult {
        confidence: confidence.into(),
        score,
        reasons,
        channel: "local".into(),
        model: None,
    }
}

#[tauri::command]
fn verify_text(text: String) -> VerifyResult {
    text_heuristic(&text)
}

#[tauri::command]
async fn verify_cloud(text: String, provider: String, api_key: String, base_url: Option<String>, model: Option<String>) -> Result<VerifyResult, String> {
    let providers: std::collections::HashMap<&str, (&str, &str)> = [
        ("deepseek", ("https://api.deepseek.com/v1", "deepseek-chat")),
        ("zhipu", ("https://open.bigmodel.cn/api/paas/v4", "glm-4-flash")),
        ("qwen", ("https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-turbo")),
        ("siliconflow", ("https://api.siliconflow.cn/v1", "Qwen/Qwen2.5-7B-Instruct")),
        ("groq", ("https://api.groq.com/openai/v1", "llama-3.3-70b-versatile")),
        ("moonshot", ("https://api.moonshot.cn/v1", "moonshot-v1-8k")),
        ("yi", ("https://api.lingyiwanwu.com/v1", "yi-lightning")),
        ("minimax", ("https://api.minimax.chat/v1", "abab6.5s-chat")),
        ("baidu", ("https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop", "ernie-lite-8k")),
    ].iter().cloned().collect();

    let (default_url, default_model) = providers.get(provider.as_str())
        .copied()
        .ok_or_else(|| format!("未知提供商: {}", provider))?;

    let url = format!("{}/chat/completions", base_url.as_deref().unwrap_or(default_url));
    let model_name = model.as_deref().unwrap_or(default_model);

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": model_name,
            "messages": [
                {"role": "system", "content": "评估搜索结果真实性。返回JSON：{\"confidence\":\"high|medium|abnormal|partial_X|unverified\",\"score\":0.0-1.0,\"reasons\":[\"原因\"]}"},
                {"role": "user", "content": text}
            ],
            "temperature": 0.1,
            "max_tokens": 512
        }))
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("API请求失败: {}", e))?;

    let data: serde_json::Value = resp.json().await.map_err(|e| format!("解析响应失败: {}", e))?;
    let content = data["choices"][0]["message"]["content"].as_str().unwrap_or("");

    let json_match = regex_lite::Regex::new(r"\{[\s\S]*\}")
        .unwrap()
        .find(content);

    match json_match {
        Some(m) => {
            let parsed: serde_json::Value = serde_json::from_str(m.as_str()).unwrap_or_default();
            Ok(VerifyResult {
                confidence: parsed["confidence"].as_str().unwrap_or("unverified").into(),
                score: parsed["score"].as_f64().unwrap_or(0.5).max(0.0).min(1.0),
                reasons: parsed["reasons"].as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                    .unwrap_or_else(|| vec!["LLM评估".into()]),
                channel: "cloud".into(),
                model: Some(model_name.into()),
            })
        }
        None => Ok(VerifyResult {
            confidence: "unverified".into(),
            score: 0.5,
            reasons: vec!["LLM返回解析失败".into()],
            channel: "cloud".into(),
            model: Some(model_name.into()),
        }),
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![verify_text, verify_cloud])
        .run(tauri::generate_context!())
        .expect("error while running VerityLens");
}