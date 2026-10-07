"""
工作体验数据提取
================
通过搜狗微信搜索提取各岗位的真实工作体验内容（微信公众号文章），
丰富岗位画像中的日常描述、能力要求和职业感受。

用法：
    python app/scripts/crawl_zhihu_experience.py
    python app/scripts/crawl_zhihu_experience.py --jobs "用户研究,产品经理,数据分析师"
    python app/scripts/crawl_zhihu_experience.py --top 50

合规：
    - 限速 3-5 秒/请求
    - 只提取搜索摘要片段（非全文搬运）
    - 无需登录凭证
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
from datetime import date
from html import unescape
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# Windows 中文
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "app" / "data"
POSITIONS_FILE = DATA_DIR / "positions.json"
OUTPUT_FILE = DATA_DIR / "zhihu_experience.json"

# ── HTTP ──────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def _sleep():
    """限速 3-5 秒随机间隔"""
    time.sleep(random.uniform(3.0, 5.0))


def _strip_html(html: str) -> str:
    """去除 HTML 标签，保留纯文本"""
    text = re.sub(r"<[^>]+>", "", html)
    text = unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ── 搜狗微信搜索 ─────────────────────────────────────────────────

def _sogou_wx_search(query: str) -> list[str]:
    """搜狗微信搜索，返回摘要文本列表"""
    try:
        resp = requests.get(
            "https://weixin.sogou.com/weixin",
            params={"type": "2", "query": query},
            headers=HEADERS, timeout=15,
        )
        resp.encoding = "utf-8"
        if resp.status_code != 200:
            print(f"    搜狗返回 {resp.status_code}")
            return []
    except Exception as e:
        print(f"    搜狗异常: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    texts: list[str] = []

    for item in soup.select(".txt-box"):
        parts: list[str] = []
        title_el = item.select_one("h3")
        desc_el = item.select_one("p")
        if title_el:
            parts.append(_strip_html(title_el.get_text()))
        if desc_el:
            parts.append(_strip_html(desc_el.get_text()))
        full = " ".join(parts)
        if len(full) >= 30:
            texts.append(full)

    return texts


# ── Bing 搜索（备选）─────────────────────────────────────────────

def _bing_search(query: str) -> list[str]:
    """Bing 搜索备选"""
    try:
        resp = requests.get(
            "https://cn.bing.com/search",
            params={"q": query, "ensearch": "0"},
            headers=HEADERS, timeout=15,
        )
        resp.encoding = "utf-8"
        if resp.status_code != 200:
            return []
    except Exception:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    texts: list[str] = []
    for item in soup.select(".b_caption p"):
        txt = _strip_html(item.get_text())
        if len(txt) >= 40:
            texts.append(txt)
    return texts


# ── 结构化提取 ────────────────────────────────────────────────────

DAILY_KEYWORDS = [
    "一天", "日常", "早上", "下午", "上班", "下班", "上午", "晚上",
    "早晨", "中午", "加班", "通勤", "打卡", "开会", "到公司", "下班后",
    "工作流程", "早会", "站会", "日报", "周报", "9点", "10点",
    "每天", "每日", "工作内容",
]
ABILITY_KEYWORDS = [
    "需要", "能力", "技能", "学到", "成长", "建议", "掌握",
    "要求", "基础", "核心", "素质", "提升", "锻炼", "培养",
    "重要的是", "必须", "关键", "思维", "逻辑",
]
FEELING_KEYWORDS = [
    "感觉", "体验", "压力", "成就感", "值得", "后悔", "满意",
    "幸福", "焦虑", "开心", "辛苦", "累", "充实", "无聊",
    "喜欢", "讨厌", "意义", "收获", "遗憾", "打磨", "挑战",
]


def _extract_snippets(text: str, keywords: list[str], max_len: int = 200) -> list[str]:
    """从文本中按关键词定位，提取周围片段"""
    snippets: list[str] = []
    # 按多种标点切分
    sentences = re.split(r"[。！？\n;；]", text)

    for sent in sentences:
        sent = sent.strip()
        if len(sent) < 8 or len(sent) > max_len:
            continue
        # 过滤广告和无关内容
        if any(kw in sent for kw in ["广告", "立即下载", "官方网站", "点击查看", "课程介绍"]):
            continue
        if any(kw in sent for kw in keywords):
            snippets.append(sent)

    return snippets


def extract_structured(texts: list[str]) -> dict:
    """从多条文本中提取结构化信息"""
    daily: list[str] = []
    ability: list[str] = []
    feelings: list[str] = []

    for text in texts:
        daily.extend(_extract_snippets(text, DAILY_KEYWORDS))
        ability.extend(_extract_snippets(text, ABILITY_KEYWORDS))
        feelings.extend(_extract_snippets(text, FEELING_KEYWORDS))

    # 去重 + 限制数量
    daily = list(dict.fromkeys(daily))[:10]
    ability = list(dict.fromkeys(ability))[:10]
    feelings = list(dict.fromkeys(feelings))[:10]

    return {
        "daily_snippets": daily,
        "ability_insights": ability,
        "feelings": feelings,
    }


# ── 主流程 ────────────────────────────────────────────────────────

def load_positions(top: int = 80) -> list[dict]:
    """加载岗位列表，按 count 降序取 top N"""
    with open(POSITIONS_FILE, "r", encoding="utf-8") as f:
        positions = json.load(f)
    positions.sort(key=lambda p: p.get("count", 0), reverse=True)
    return positions[:top]


def crawl_one(job_name: str) -> dict | None:
    """搜索单个岗位的工作体验数据"""
    search_queries = [
        f"{job_name} 日常工作 一天",
        f"{job_name} 工作体验 感受",
        f"{job_name} 工作 能力 成长 建议",
    ]

    all_texts: list[str] = []

    for query in search_queries:
        print(f"  搜索: {query}")

        # 搜狗微信优先
        texts = _sogou_wx_search(query)
        if len(texts) < 3:
            # Bing 补充
            texts.extend(_bing_search(query))

        print(f"    获取 {len(texts)} 条摘要")
        all_texts.extend(texts)
        _sleep()

        if len(all_texts) >= 25:
            break

    if not all_texts:
        print(f"  ✗ {job_name}: 未找到任何搜索结果")
        return None

    result = extract_structured(all_texts)
    total = len(result["daily_snippets"]) + len(result["ability_insights"]) + len(result["feelings"])
    if total == 0:
        print(f"  ✗ {job_name}: 摘要中未提取到有效片段")
        return None

    result["source_count"] = len(all_texts)
    result["updated"] = date.today().isoformat()
    print(f"  ✓ {job_name}: {len(result['daily_snippets'])} 日常 / "
          f"{len(result['ability_insights'])} 能力 / {len(result['feelings'])} 感受")
    return result


def main():
    parser = argparse.ArgumentParser(description="工作体验数据提取（搜狗微信+Bing）")
    parser.add_argument("--jobs", type=str, default="",
                        help="指定岗位名，逗号分隔（默认爬 top N）")
    parser.add_argument("--top", type=int, default=80,
                        help="按 count 降序取前 N 个岗位（默认 80）")
    args = parser.parse_args()

    # 确定岗位列表
    if args.jobs:
        job_names = [j.strip() for j in args.jobs.split(",") if j.strip()]
    else:
        positions = load_positions(args.top)
        job_names = [p["name"] for p in positions]

    print(f"共 {len(job_names)} 个岗位待爬取\n")

    # 加载已有数据（增量）
    existing: dict = {}
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            existing = json.load(f)
        print(f"已加载 {len(existing)} 条历史数据（增量模式）\n")

    success = 0
    for i, name in enumerate(job_names, 1):
        if name in existing:
            print(f"[{i}/{len(job_names)}] {name} — 已有数据，跳过")
            continue

        print(f"[{i}/{len(job_names)}] {name}")
        result = crawl_one(name)
        if result:
            existing[name] = result
            success += 1

            # 每 5 个保存一次（防中断丢失）
            if success % 5 == 0:
                with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                    json.dump(existing, f, ensure_ascii=False, indent=2)
                print(f"  [自动保存] 已保存 {len(existing)} 条\n")

    # 最终保存
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    print(f"\n完成！共爬取 {success} 个新岗位，总计 {len(existing)} 条数据")
    print(f"输出文件: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
