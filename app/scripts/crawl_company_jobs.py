"""
大厂公开招聘 API 爬虫
=====================
从腾讯招聘等公开 API 抓取岗位数据，字段对齐 A13数据.xls 格式。

数据源：
  - 腾讯招聘 https://careers.tencent.com （公开 API，无需登录）

用法：
    python app/scripts/crawl_company_jobs.py
    python app/scripts/crawl_company_jobs.py --merge
"""
from __future__ import annotations
import argparse
import json
import re
import time
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "app" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://careers.tencent.com/search.html",
    "Accept": "application/json",
}

# ---- 岗位名称归一化（和 crawl_v2ex_jobs.py 相同规则） ----
JOB_NORMALIZATION: list[tuple[str, str]] = [
    (r"(?:Java|后端|后台|服务端|服务器)", "Java"),
    (r"(?:C/C\+\+|C\+\+)", "C/C++"),
    (r"(?:Python)", "Python工程师"),
    (r"(?:Go\b|Golang)", "Go工程师"),
    (r"(?:iOS)", "iOS工程师"),
    (r"(?:Android)", "Android工程师"),
    (r"(?:全栈)", "全栈工程师"),
    (r"(?:前端|Web前端|H5)", "前端开发"),
    (r"(?:算法|机器学习|深度学习|NLP|CV|大模型|LLM|AIGC|AI)", "算法工程师"),
    (r"(?:数据分析|数据工程|数据开发|数据科学|大数据|BI|数据挖掘)", "数据工程师"),
    (r"(?:测试开发|测试工程|软件测试|QA|自动化测试|质量)", "测试工程师"),
    (r"(?:运维|SRE|DevOps|DBA)", "运维工程师"),
    (r"(?:产品经理|产品策划|产品专员|产品助理)", "产品专员/助理"),
    (r"(?:运营经理|运营专员|用户运营|活动运营|内容运营|社区运营|游戏运营)", "运营助理/专员"),
    (r"(?:项目经理|项目管理)", "项目经理/主管"),
    (r"(?:UI|视觉设计|交互设计|UX|用户体验设计)", "UI设计师"),
    (r"(?:安全|信息安全|网络安全)", "安全工程师"),
    (r"(?:嵌入式|硬件)", "嵌入式软件工程师"),
    (r"(?:营销|市场|品牌|公关|传播)", "文案策划"),
    (r"(?:商务|BD)", "商务专员"),
    (r"(?:HR|人力|招聘|HRBP)", "HRBP"),
    (r"(?:法务|合规|法律)", "法务专员"),
    (r"(?:财务|会计|审计|税务)", "审计专员"),
    (r"(?:客服|客户服务)", "电话客服"),
    (r"(?:架构师|技术专家)", "架构师"),
    (r"(?:游戏策划|游戏设计)", "游戏运营"),
    (r"(?:音视频|多媒体)", "音视频研发工程师"),
    (r"(?:用户研究|用研)", "用户研究"),
    (r"(?:技术支持|售前|售后|FAE)", "技术支持工程师"),
    (r"(?:项目经理|项目管理)", "项目经理/主管"),
    (r"(?:培训|讲师)", "培训师"),
    (r"(?:翻译)", "英语翻译"),
    (r"(?:内容审核|审核)", "内容审核"),
    (r"(?:风控|风险)", "风控专员"),
    (r"(?:投资|投行)", "投资分析师"),
    (r"(?:供应链|采购)", "供应链专员"),
]


def normalize_job(name: str) -> str | None:
    """归一化岗位名，无法归一化时返回 None（会被过滤掉）"""
    for pat, canonical in JOB_NORMALIZATION:
        if re.search(pat, name, re.IGNORECASE):
            return canonical
    return None


def clean_html(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("&nbsp;", " ").replace("&amp;", "&")
    return s.strip()


# ---- 腾讯招聘 ----

def crawl_tencent(max_pages: int = 10) -> list[dict]:
    """从腾讯招聘公开 API 抓取岗位"""
    url = "https://careers.tencent.com/tencentcareer/api/post/Query"
    all_rows = []
    seen = set()

    for page in range(1, max_pages + 1):
        params = {
            "pageIndex": page,
            "pageSize": 20,
            "language": "zh-cn",
            "area": "cn",
            "timestamp": int(time.time() * 1000),
        }
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=15)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f"  [tencent] page {page} failed: {e}")
            break

        posts = data.get("Data", {}).get("Posts", [])
        if not posts:
            break

        for p in posts:
            pid = str(p.get("RecruitPostId", ""))
            if pid in seen:
                continue
            seen.add(pid)

            raw_name = p.get("RecruitPostName", "")
            category = p.get("CategoryName", "")
            city = p.get("LocationName", "")
            bg = p.get("BGName", "")
            product = p.get("ProductName", "")
            responsibility = clean_html(p.get("Responsibility", ""))
            requirement = clean_html(p.get("Requirement", ""))
            last_update = p.get("LastUpdateTime", "")

            # 归一化岗位名（无法归一化的跳过）
            job_name = normalize_job(raw_name) or normalize_job(category)
            if not job_name:
                continue

            jd = ""
            if responsibility:
                jd += f"岗位职责：\n{responsibility}\n\n"
            if requirement:
                jd += f"任职要求：\n{requirement}"

            row = {
                "岗位名称": job_name,
                "地址": city or "深圳",
                "薪资范围": "面议",
                "公司名称": "腾讯",
                "所属行业": f"互联网/IT",
                "公司规模": "10000人以上",
                "公司类型": "上市公司",
                "岗位编码": f"TX-{pid}",
                "岗位详情": jd[:3000],
                "更新日期": last_update[:10] if last_update else datetime.now().strftime("%Y-%m-%d"),
                "公司详情": f"{bg} · {product}" if bg else "",
                "岗位来源地址": f"https://careers.tencent.com/jobdesc.html?postId={pid}",
            }
            all_rows.append(row)

        print(f"  [tencent] page {page}: +{len(posts)} posts (total {len(all_rows)})")
        time.sleep(1.5)  # 礼貌间隔

    return all_rows


def crawl_all() -> pd.DataFrame:
    rows: list[dict] = []

    print("[crawl] 腾讯招聘...")
    rows.extend(crawl_tencent(max_pages=10))

    if not rows:
        print("[crawl] 未抓取到任何数据")
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    print(f"\n[crawl] 共抓取 {len(df)} 条岗位")
    print(f"  归一化后岗位类别: {df['岗位名称'].nunique()} 种")
    print(f"  TOP 岗位:")
    for name, cnt in df["岗位名称"].value_counts().head(10).items():
        print(f"    {name}: {cnt}")
    return df


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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--merge", action="store_true", help="合并到 A13数据_扩展.xlsx")
    args = ap.parse_args()

    df = crawl_all()
    if df.empty:
        return

    out = OUT_DIR / "company_jobs.xlsx"
    df.to_excel(out, index=False)
    print(f"[done] saved {len(df)} rows -> {out}")

    if args.merge:
        merge_into_main(df)


if __name__ == "__main__":
    main()
