"""VerityLens CLI · 真实透镜命令行工具 v0.6.0"""

import json
import re
import sys

import click
import httpx
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

PROVIDERS = {
    "deepseek": {"name": "DeepSeek", "base_url": "https://api.deepseek.com/v1", "model": "deepseek-chat"},
    "zhipu": {"name": "智谱GLM", "base_url": "https://open.bigmodel.cn/api/paas/v4", "model": "glm-4-flash"},
    "qwen": {"name": "通义千问", "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1", "model": "qwen-turbo"},
    "siliconflow": {"name": "硅基流动", "base_url": "https://api.siliconflow.cn/v1", "model": "Qwen/Qwen2.5-7B-Instruct"},
    "groq": {"name": "Groq", "base_url": "https://api.groq.com/openai/v1", "model": "llama-3.3-70b-versatile"},
    "moonshot": {"name": "Moonshot", "base_url": "https://api.moonshot.cn/v1", "model": "moonshot-v1-8k"},
    "yi": {"name": "零一万物", "base_url": "https://api.lingyiwanwu.com/v1", "model": "yi-lightning"},
    "minimax": {"name": "MiniMax", "base_url": "https://api.minimax.chat/v1", "model": "abab6.5s-chat"},
    "baidu": {"name": "百度千帆", "base_url": "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop", "model": "ernie-lite-8k"},
}

CONFIDENCE_COLORS = {
    "high": "green",
    "medium": "yellow",
    "abnormal": "red",
    "partial_X": "orange3",
    "unverified": "dim",
}

CONFIDENCE_LABELS = {
    "high": "高置信",
    "medium": "中等",
    "abnormal": "异常",
    "partial_X": "部分验证",
    "unverified": "未验证",
}


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
    if len(text) > 1000 and re.search(r"(.)\1{5,}", text):
        score -= 0.2
        reasons.append("✗ SEO农场特征（重复字符）")
    if len(re.findall(r"https?://", text)) > 10:
        score -= 0.15
        reasons.append("✗ SEO农场特征（大量链接）")

    score = max(0.0, min(1.0, score))
    if not reasons:
        reasons.append("📝 本地启发式评分")

    confidence = (
        "high" if score >= 0.85
        else "medium" if score >= 0.65
        else "partial_X" if score >= 0.4
        else "abnormal" if score >= 0.2
        else "unverified"
    )

    return {"confidence": confidence, "score": score, "reasons": reasons, "channel": "local"}


def cloud_verify(text: str, provider: str, api_key: str, base_url: str = None, model: str = None) -> dict:
    provider_info = PROVIDERS.get(provider, {})
    url = f"{base_url or provider_info.get('base_url', '')}/chat/completions"
    model = model or provider_info.get("model", "")

    if not url or not api_key:
        return {**text_heuristic(text), "reasons": ["⚠️ 未配置API，回退本地"]}

    try:
        resp = httpx.post(
            url,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": '评估搜索结果真实性。返回JSON：{"confidence":"high|medium|abnormal|partial_X|unverified","score":0.0-1.0,"reasons":["原因"]}'},
                    {"role": "user", "content": text},
                ],
                "temperature": 0.1,
                "max_tokens": 512,
            },
            timeout=15.0,
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
        return {**text_heuristic(text), "reasons": [f"⚠️ API失败({str(e)[:40]})，回退本地"]}


def verify(text: str, provider: str = None, api_key: str = None, base_url: str = None, model: str = None, local: bool = False) -> dict:
    if local or not provider or not api_key:
        return text_heuristic(text)

    if len(text) <= 500:
        return text_heuristic(text)

    return cloud_verify(text, provider, api_key, base_url, model)


def render_result(result: dict):
    confidence = result.get("confidence", "unverified")
    score = result.get("score", 0)
    reasons = result.get("reasons", [])
    channel = result.get("channel", "local")
    model = result.get("model", "")

    color = CONFIDENCE_COLORS.get(confidence, "dim")
    label = CONFIDENCE_LABELS.get(confidence, "未验证")
    channel_label = f"☁️ {model}" if channel == "cloud" else "🔒 本地"

    console.print()
    console.print(Panel(
        f"[{color}][bold]{label} {score * 100:.0f}%[/{color}][/bold]\n\n"
        + "\n".join(f"  {r}" for r in reasons)
        + f"\n\n[dim]{channel_label} · VerityLens v0.6.0[/]",
        title="🛡️ 验证结果",
        border_style=color,
    ))


@click.group()
@click.version_option("0.6.0", prog_name="verity")
def main():
    """🛡️ VerityLens CLI · 真实透镜命令行工具"""
    pass


@main.command()
@click.argument("text")
@click.option("--provider", "-p", help="LLM提供商 (deepseek/zhipu/qwen/siliconflow/groq/...)")
@click.option("--api-key", "-k", envvar="VERITY_API_KEY", help="API Key")
@click.option("--base-url", envvar="VERITY_BASE_URL", help="自定义API地址")
@click.option("--model", "-m", help="模型名称")
@click.option("--local", "-l", is_flag=True, help="强制本地模式")
def check(text, provider, api_key, base_url, model, local):
    """验证文本真实性"""
    result = verify(text, provider, api_key, base_url, model, local)
    render_result(result)


@main.command()
@click.argument("file", type=click.Path(exists=True))
@click.option("--provider", "-p", help="LLM提供商")
@click.option("--api-key", "-k", envvar="VERITY_API_KEY", help="API Key")
@click.option("--local", "-l", is_flag=True, help="强制本地模式")
def file(file, provider, api_key, local):
    """验证文件内容真实性"""
    with open(file, "r", encoding="utf-8") as f:
        text = f.read()
    result = verify(text, provider, api_key, local=local)
    render_result(result)


@main.command()
def providers():
    """列出支持的LLM提供商"""
    table = Table(title="🆓 免费模型提供商")
    table.add_column("ID", style="cyan")
    table.add_column("名称", style="white")
    table.add_column("默认模型", style="green")
    table.add_column("免费", style="yellow")

    free_info = {
        "zhipu": "永久免费",
        "deepseek": "注册送500万token",
        "siliconflow": "注册送2000万token",
        "qwen": "新用户100万token",
        "groq": "免费速率限制",
        "moonshot": "新用户送额度",
        "yi": "注册送额度",
        "minimax": "注册送额度",
        "baidu": "每月免费额度",
    }

    for pid, info in PROVIDERS.items():
        free = free_info.get(pid, "")
        table.add_row(pid, info["name"], info["model"], f"🆓 {free}" if free else "")

    console.print(table)


if __name__ == "__main__":
    main()