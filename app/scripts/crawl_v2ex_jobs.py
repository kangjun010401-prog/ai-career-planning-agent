"""
V2EX 招聘节点爬虫（合规版 · 使用官方 RSS 源）
========================================

数据源：https://www.v2ex.com/feed/jobs.xml
       —— V2EX 在 HTML 头部以 <link rel="alternate"> 明确宣告的 RSS 源，
          是官方提供给程序读取的公开接口，比 HTML 抓取更稳定且完全合规。

说明：
    - RSS 是站方主动提供给机器读取的接口，无须破防
    - 请求间隔 2 秒，严格遵守礼貌抓取原则
    - 仅用于学术/比赛项目，不做商业化使用
    - 输出字段与 A13数据.xls 对齐，便于后续合并

用法：
    python app/scripts/crawl_v2ex_jobs.py                    # 抓取最新 ~20 条
    python app/scripts/crawl_v2ex_jobs.py --rounds 5         # 多次轮询 RSS 累积
    python app/scripts/crawl_v2ex_jobs.py --merge            # 合并到扩展 Excel
"""
from __future__ import annotations
import argparse
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "app" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

RSS_URL = "https://www.v2ex.com/feed/jobs.xml"
ATOM_NS = "{http://www.w3.org/2005/Atom}"

HEADERS = {
    "User-Agent": (
        "A13-Academic-Crawler/1.0 "
        "(educational research project; uses public RSS; 2s rate limit)"
    ),
    "Accept": "application/atom+xml,application/xml;q=0.9",
    "Accept-Language": "zh-CN,zh;q=0.9",
}


# ---------- 字段抽取 ----------

CITIES = [
    "北京", "上海", "广州", "深圳", "杭州", "南京", "苏州", "成都", "武汉",
    "西安", "天津", "重庆", "青岛", "厦门", "长沙", "宁波", "东莞", "佛山",
    "济南", "郑州", "合肥", "福州", "昆明", "大连", "沈阳", "哈尔滨", "长春",
    "石家庄", "太原", "珠海", "无锡", "常州", "徐州", "嘉兴", "绍兴", "台州",
    "温州", "中山", "惠州", "湛江", "泉州", "贵阳", "南宁", "海口", "三亚",
    "兰州", "银川", "西宁", "乌鲁木齐", "呼和浩特", "拉萨", "香港", "澳门",
    "远程", "全国", "台北", "新加坡",
]
CITY_RE = re.compile("(" + "|".join(CITIES) + ")")

SAL_PATTERNS = [
    re.compile(r"(\d+(?:\.\d+)?)\s*[-~～]\s*(\d+(?:\.\d+)?)\s*[KkwW万]"),
    re.compile(r"(\d{4,6})\s*[-~～]\s*(\d{4,6})\s*元?/?月?"),
    re.compile(r"月薪\s*(\d+(?:\.\d+)?)\s*[-~～]\s*(\d+(?:\.\d+)?)"),
    re.compile(r"年薪\s*(\d+(?:\.\d+)?)\s*[-~～]\s*(\d+(?:\.\d+)?)"),
]

COMPANY_HINTS = re.compile(
    r"(字节跳动|字节|腾讯|阿里巴巴|阿里|美团|百度|京东|拼多多|滴滴|快手|抖音|"
    r"小红书|微软|谷歌|Google|苹果|Apple|华为|小米|OPPO|VIVO|Shopee|Lazada|"
    r"商汤|旷视|地平线|寒武纪|网易|搜狐|新浪|爱奇艺|B站|哔哩哔哩|Bilibili|"
    r"斗鱼|虎牙|金山|TikTok|SHEIN|得物|理想|蔚来|小鹏|比亚迪|携程|"
    r"去哪儿|58 同城|陆金所|平安|中兴|联想|Intel|IBM|Cisco|Amazon|AWS|"
    r"Microsoft|Meta|Oracle|SAP|DeepSeek|月之暗面|智谱|百川|零一万物|MiniMax)"
)

JOB_KEYWORDS = [
    # 语言 / 技术栈
    "Java", "C/C++", "C++", "Python", "Go", "Golang", "PHP", "Node.js", "Node",
    "Rust", "Kotlin", "Swift",
    # 方向
    "前端", "后端", "全栈", "iOS", "Android", "鸿蒙", "小程序",
    "算法", "机器学习", "深度学习", "NLP", "CV", "大模型", "LLM", "AIGC",
    "数据分析", "数据工程", "大数据", "数据科学", "BI",
    "测试", "自动化测试", "运维", "DevOps", "SRE", "DBA", "安全",
    # 岗位类型
    "产品经理", "产品", "运营", "市场", "商务", "HR", "销售",
    "UI", "UX", "视觉设计", "交互设计", "设计师",
    "游戏策划", "游戏开发", "Unity", "UE",
    "项目经理", "架构师", "技术总监", "CTO", "技术专家",
]

SUFFIXES_THAT_NEED_POSITION = {"Java", "C++", "Python", "Go", "前端", "后端", "Android", "iOS", "全栈"}


def extract_city(text: str) -> str:
    m = CITY_RE.search(text)
    return m.group(1) if m else ""


def extract_salary(text: str) -> str:
    for pat in SAL_PATTERNS:
        m = pat.search(text)
        if m:
            return m.group(0)
    return ""


def extract_company(title: str, content: str) -> str:
    for src in (title, content[:500]):
        m = COMPANY_HINTS.search(src)
        if m:
            return m.group(1)
    # 回退：标题开头的中文 token
    cleaned = re.sub(r"[\[【（(][^\]】）)]+[\]】）)]", " ", title).strip()
    m = re.match(r"([A-Za-z0-9\u4e00-\u9fa5]{2,12})", cleaned)
    return m.group(1) if m else ""


def extract_job_name(title: str, content: str) -> str:
    full = title + " " + content[:500]
    m = re.search(
        r"招\s*聘?\s*([\u4e00-\u9fa5A-Za-z0-9/+ ]{2,25}?(?:工程师|开发|经理|专员|设计师|策划|运营|顾问|总监|架构师|科学家))",
        full,
    )
    if m:
        return m.group(1).strip()
    for kw in JOB_KEYWORDS:
        if kw in title or kw in content[:300]:
            if kw in SUFFIXES_THAT_NEED_POSITION:
                return f"{kw}工程师"
            return kw
    return "技术岗位"


# 把从 RSS 抽出来的原始岗位名，归一化到 A13数据.xls 里已有的 51 个标准岗位，
# 这样合并后聚合时会提高这些岗位的样本量而非产生一堆孤立的一条记录。
# 键：正则模式（对原始岗位名做 re.search）；值：规范岗位名
JOB_NORMALIZATION: list[tuple[str, str]] = [
    # 后端 / 技术栈
    (r"(?:Java|后端|后台|SpringBoot|Spring)", "Java"),
    (r"(?:C/C\+\+|C\+\+|C 语言)", "C/C++"),
    # 新增的互联网核心岗位（A13 原数据没有，保留为独立类别以丰富互联网覆盖）
    (r"(?:Python\s*工程师|Python\s*开发)", "Python工程师"),
    (r"(?:Go\s*工程师|Go\s*开发|Golang)", "Go工程师"),
    (r"(?:iOS\s*工程师|iOS\s*开发)", "iOS工程师"),
    (r"(?:Android\s*工程师|Android\s*开发|Android)", "Android工程师"),
    (r"(?:全栈\s*工程师|全栈\s*开发|全栈)", "全栈工程师"),
    (r"(?:机器学习|深度学习|算法\s*工程师|算法|推荐算法|搜索算法|NLP|CV|大模型|LLM|AIGC|AI\s*全栈)", "算法工程师"),
    (r"(?:数据\s*分析|数据\s*工程|数据\s*开发|数据\s*科学|大数据|BI)", "数据工程师"),
    (r"(?:运维\s*工程师|SRE|DevOps|DBA)", "运维工程师"),
    # 产品 / 技术支持
    (r"产品", "产品专员/助理"),
    # 前端
    (r"(?:前端|Web前端|H5|Vue|React(?!.*native)|JavaScript)", "前端开发"),
    # 测试
    (r"(?:软件测试|自动化测试|测试开发|功能测试|性能测试|测试工程)", "测试工程师"),
    (r"硬件测试", "硬件测试"),
    (r"(?:质量管理|QA)", "质量管理/测试"),
    # 实施 / 支持
    (r"(?:实施顾问|实施工程|ERP 实施)", "实施工程师"),
    (r"(?:技术支持|售后工程|售前工程|FAE)", "技术支持工程师"),
    # 产品 / 运营
    (r"(?:产品经理|产品专员|产品助理|PM|Product\s*Manager)", "产品专员/助理"),
    (r"(?:社区运营|内容运营|新媒体运营|用户运营|产品运营)", "运营助理/专员"),
    (r"游戏运营", "游戏运营"),
    (r"(?:游戏推广|APP\s*推广|推广)", "APP推广"),
    (r"内容审核", "内容审核"),
    # 人力 / 法务 / 行政
    (r"(?:HR|招聘|人力资源)", "招聘专员/助理"),
    (r"猎头", "猎头顾问"),
    (r"培训师", "培训师"),
    (r"(?:律师助理)", "律师助理"),
    (r"律师", "律师"),
    (r"(?:法务)", "法务专员/助理"),
    (r"(?:知识产权|专利|商标)", "知识产权/专利代理"),
    (r"(?:档案)", "档案管理"),
    (r"资料", "资料管理"),
    (r"(?:总助|CEO 助理|董事长助理)", "总助/CEO助理/董事长助理"),
    # 销售 / 商务
    (r"(?:电话销售)", "电话销售"),
    (r"(?:网络销售|在线销售)", "网络销售"),
    (r"(?:广告销售)", "广告销售"),
    (r"销售工程师", "销售工程师"),
    (r"销售运营", "销售运营"),
    (r"销售助理", "销售助理"),
    (r"大客户", "大客户代表"),
    (r"(?:客服|客户服务)", "电话客服"),
    (r"(?:商务专员|BD)", "商务专员"),
    (r"BD 经理", "BD经理"),
    # 项目 / 管理
    (r"(?:项目经理|项目主管|PM\s*Senior)", "项目经理/主管"),
    (r"(?:项目专员|项目助理)", "项目专员/助理"),
    (r"(?:项目招投标|招投标)", "项目招投标"),
    (r"(?:管培生|储备干部)", "管培生/储备干部"),
    (r"(?:储备经理)", "储备经理人"),
    # 翻译 / 科研 / 数据
    (r"英语翻译", "英语翻译"),
    (r"日语翻译", "日语翻译"),
    (r"(?:科研|研究员)", "科研人员"),
    (r"(?:统计员|统计)", "统计员"),
    (r"(?:质检)", "质检员"),
    (r"(?:风电)", "风电工程师"),
    (r"(?:咨询顾问|顾问)", "咨询顾问"),
]


def normalize_job_name(raw: str) -> str:
    """归一化到 A13 标准岗位名；如果不匹配则返回原值。"""
    if not raw:
        return raw
    for pattern, canonical in JOB_NORMALIZATION:
        if re.search(pattern, raw, re.IGNORECASE):
            return canonical
    return raw


def strip_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text("\n", strip=True)
    return text


# ---------- RSS ----------

def fetch_rss(session: requests.Session) -> list[dict]:
    time.sleep(0.3)
    resp = session.get(RSS_URL, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    resp.encoding = "utf-8"
    root = ET.fromstring(resp.text)

    items: list[dict] = []
    for entry in root.findall(ATOM_NS + "entry"):
        title_el = entry.find(ATOM_NS + "title")
        id_el = entry.find(ATOM_NS + "id")
        content_el = entry.find(ATOM_NS + "content")
        link_el = entry.find(ATOM_NS + "link")
        pub_el = entry.find(ATOM_NS + "published")

        if title_el is None or content_el is None:
            continue

        title = title_el.text or ""
        raw_html = content_el.text or ""
        content_text = strip_html(raw_html)
        link_href = ""
        if link_el is not None:
            link_href = link_el.get("href", "")

        topic_id = ""
        if id_el is not None and id_el.text:
            m = re.search(r"/t/(\d+)", id_el.text)
            if m:
                topic_id = m.group(1)

        pub_date = ""
        if pub_el is not None and pub_el.text:
            try:
                pub_date = pub_el.text[:10]
            except Exception:
                pass

        items.append({
            "title": title,
            "content": content_text,
            "url": link_href,
            "topic_id": topic_id,
            "published": pub_date,
        })
    return items


def row_from_entry(entry: dict) -> dict:
    title = entry["title"]
    content = entry["content"]
    city = extract_city(title) or extract_city(content[:400])
    salary = extract_salary(title) or extract_salary(content[:800])
    company = extract_company(title, content)
    raw_job = extract_job_name(title, content)
    job_name = normalize_job_name(raw_job)

    return {
        "岗位名称": job_name,
        "地址": city or "待定",
        "薪资范围": salary or "面议",
        "公司名称": company or "V2EX招聘",
        "所属行业": "互联网/IT",
        "公司规模": "",
        "公司类型": "",
        "岗位编码": entry["topic_id"] or entry["url"].rstrip("/").split("/")[-1],
        "岗位详情": content[:3000],
        "更新日期": entry["published"] or datetime.now().strftime("%Y-%m-%d"),
        "公司详情": "",
        "岗位来源地址": entry["url"],
    }


# ---------- 主流程 ----------

def crawl(rounds: int, interval: float) -> pd.DataFrame:
    session = requests.Session()
    all_rows: dict[str, dict] = {}

    for i in range(1, rounds + 1):
        print(f"[round {i}/{rounds}] fetching RSS…")
        try:
            entries = fetch_rss(session)
        except Exception as exc:
            print(f"  failed: {exc}")
            continue
        print(f"  got {len(entries)} entries")
        new_count = 0
        for e in entries:
            tid = e["topic_id"] or e["url"]
            if tid and tid not in all_rows:
                all_rows[tid] = row_from_entry(e)
                new_count += 1
        print(f"  +{new_count} new (total unique: {len(all_rows)})")
        if i < rounds:
            time.sleep(interval)

    return pd.DataFrame(list(all_rows.values()))


def merge_into_main(new_df: pd.DataFrame) -> None:
    out_path = ROOT / "A13数据_扩展.xlsx"
    if out_path.exists():
        existing = pd.read_excel(out_path)
        merged = pd.concat([existing, new_df], ignore_index=True)
        merged.drop_duplicates(subset=["岗位编码"], keep="last", inplace=True)
    else:
        merged = new_df
    merged.to_excel(out_path, index=False)
    print(f"[merge] wrote {len(merged)} rows -> {out_path}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rounds", type=int, default=1, help="重复轮询 RSS 的次数（默认 1）")
    ap.add_argument("--interval", type=float, default=60.0, help="两次轮询之间的间隔秒数（默认 60）")
    ap.add_argument("--merge", action="store_true", help="合并到 A13数据_扩展.xlsx")
    args = ap.parse_args()

    df = crawl(args.rounds, args.interval)
    if df.empty:
        print("[done] no data collected")
        return

    out_xlsx = OUT_DIR / "v2ex_jobs.xlsx"
    df.to_excel(out_xlsx, index=False)
    print(f"[done] wrote {len(df)} rows -> {out_xlsx}")

    if args.merge:
        merge_into_main(df)


if __name__ == "__main__":
    main()
