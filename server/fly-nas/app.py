"""VerityLens API Server · OpenAI 兼容接口代理 v0.5.0"""

import os
import re
import json
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("verity-lens")

app = FastAPI(
    title="VerityLens API",
    version="0.5.0",
    description="VerityLens · 真实透镜 · OpenAI 兼容接口代理",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://ollama:11434/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:7b")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")

SYSTEM_PROMPT = """你是搜索结果真实性评估助手。评估给定搜索结果文本的真实性可信度。

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
- unverified: 无法判断"""


class VerifyRequest(BaseModel):
    text: str
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str = ""
    messages: list[ChatMessage]
    temperature: float = 0.1
    max_tokens: int = 512


def text_heuristic(text: str) -> dict:
    if not text:
        return {"confidence": "unverified", "score": 0.0, "reasons": ["空文本"], "channel": "local"}

    score = 0.5
    reasons = []

    if re.search(r"\.(gov|edu|org)\b", text):
        score += 0.2
        reasons.append("✓ 官方域名")
    if re.search(r"\b(wikipedia|github|stackoverflow|mozilla|w3\.org)\b", text):
        score += 0.15
        reasons.append("✓ 可信来源")
    if re.search(r"\b(官方|官网|documentation|docs)\b", text, re.IGNORECASE):
        score += 0.1
        reasons.append("✓ 官方文档特征")
    if re.search(r"\b(广告|赞助|推广|ad|sponsored|promo)\b", text, re.IGNORECASE):
        score -= 0.3
        reasons.append("✗ 广告特征")
    if re.search(r"\b(限时|特惠|秒杀|打折|coupon|优惠|折扣)\b", text, re.IGNORECASE):
        score -= 0.15
        reasons.append("✗ 营销特征")
    if re.search(r"\b(点击|下载app|立即购买|马上注册)\b", text, re.IGNORECASE):
        score -= 0.1
        reasons.append("✗ 诱导点击")

    score = max(0.0, min(1.0, score))
    if not reasons:
        reasons.append(f"📝 本地启发式评分 {score * 100:.0f}%")

    confidence = (
        "high" if score >= 0.85
        else "medium" if score >= 0.65
        else "partial_X" if score >= 0.4
        else "abnormal" if score >= 0.2
        else "unverified"
    )

    return {"confidence": confidence, "score": score, "reasons": reasons, "channel": "local"}


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.5.0"}


@app.get("/v1/models")
async def list_models():
    return {
        "object": "list",
        "data": [
            {"id": LLM_MODEL, "object": "model", "owned_by": "local"},
            {"id": "verity-local", "object": "model", "owned_by": "verity-lens"},
        ],
    }


@app.post("/verify")
async def verify(req: VerifyRequest):
    if not req.text:
        raise HTTPException(status_code=400, detail="text is required")

    if req.provider and req.api_key:
        providers = {
            "deepseek": "https://api.deepseek.com/v1",
            "zhipu": "https://open.bigmodel.cn/api/paas/v4",
            "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "siliconflow": "https://api.siliconflow.cn/v1",
            "groq": "https://api.groq.com/openai/v1",
            "moonshot": "https://api.moonshot.cn/v1",
            "yi": "https://api.lingyiwanwu.com/v1",
            "minimax": "https://api.minimax.chat/v1",
            "baidu": "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop",
        }
        base_url = req.base_url or providers.get(req.provider, "")
        if base_url:
            return await _cloud_verify(req.text, base_url, req.api_key, req.model or "")

    if len(req.text) > 500:
        return await _cloud_verify(req.text, LLM_BASE_URL, LLM_API_KEY, req.model or LLM_MODEL)

    return text_heuristic(req.text)


@app.post("/v1/chat/completions")
async def chat_completions(req: ChatCompletionRequest, authorization: str = Header(default="")):
    api_key = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else LLM_API_KEY
    base_url = LLM_BASE_URL
    model = req.model or LLM_MODEL

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    **({"Authorization": f"Bearer {api_key}"} if api_key else {}),
                },
                json={
                    "model": model,
                    "messages": [{"role": m.role, "content": m.content} for m in req.messages],
                    "temperature": req.temperature,
                    "max_tokens": req.max_tokens,
                },
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        logger.warning(f"Upstream error: {e.response.status_code}")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"Proxy error: {e}")
        raise HTTPException(status_code=502, detail=str(e))


async def _cloud_verify(text: str, base_url: str, api_key: str, model: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"

            resp = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": text},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 512,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

            match = re.search(r"\{[\s\S]*\}", content)
            if not match:
                raise ValueError("no JSON in response")

            parsed = json.loads(match.group())
            return {
                "confidence": parsed.get("confidence", "unverified"),
                "score": max(0.0, min(1.0, parsed.get("score", 0.5))),
                "reasons": parsed.get("reasons", ["LLM评估"]),
                "channel": "cloud",
                "model": model,
            }
    except Exception as e:
        logger.warning(f"Cloud verify failed: {e}")
        result = text_heuristic(text)
        result["reasons"].insert(0, f"⚠️ 云端失败({str(e)[:40]})，回退本地")
        return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)