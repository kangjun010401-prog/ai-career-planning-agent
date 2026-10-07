"""
A13 Data Preparation
====================
Reads `A13数据.xls`, aggregates rows into per-position profiles, extracts
skills/salary/city/env, and builds a simple vertical-promotion + lateral
switch graph. Produces two JSON files consumed by the backend.

Usage:
    python app/scripts/prepare_data.py

Outputs:
    app/data/positions.json   # list of position profiles
    app/data/graph.json       # {nodes: [...], edges: [...]}
"""
from __future__ import annotations
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
XLS = ROOT / "A13数据.xls"
# 可选的扩展数据（来自爬虫等外部源），若存在则与主数据合并
EXT_XLSX = ROOT / "A13数据_扩展.xlsx"
OUT_DIR = ROOT / "app" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# --- Skill lexicon (keyword-based extraction from JD) ---
SKILL_KEYWORDS = [
    # Languages
    "Java", "Python", "C++", "C语言", "JavaScript", "TypeScript", "Go", "Rust",
    "PHP", "Kotlin", "Swift", "Scala", "R语言", "MATLAB", "SQL",
    # Frontend
    "HTML", "CSS", "Vue", "React", "Angular", "小程序", "uni-app", "微信小程序",
    "Webpack", "Vite", "Axure",
    # Backend / framework
    "SpringBoot", "Spring", "MyBatis", "Django", "Flask", "FastAPI", "Node.js",
    ".NET", "Express",
    # Data / AI
    "MySQL", "Redis", "MongoDB", "Oracle", "PostgreSQL", "Kafka", "RabbitMQ",
    "Hadoop", "Spark", "Flink", "TensorFlow", "PyTorch", "OpenCV", "NLP",
    "机器学习", "深度学习", "数据分析", "Excel", "SPSS", "Tableau", "PowerBI",
    # Infra
    "Linux", "Docker", "K8s", "Kubernetes", "Git", "Jenkins", "CI/CD", "AWS",
    "阿里云", "腾讯云",
    # Testing
    "JUnit", "Selenium", "Jmeter", "Postman", "自动化测试", "性能测试",
    # Soft / domain
    "沟通能力", "团队协作", "抗压", "学习能力", "创新",
]

CERT_KEYWORDS = [
    "英语四级", "英语六级", "CET-4", "CET-6", "PMP", "软考", "计算机二级",
    "计算机三级", "CPA", "ACCA", "司法考试", "教师资格证", "驾照",
]

CITY_RE = re.compile(r"^([^\-\s]+)")
# Range of two decimal numbers separated by a dash-like character
RANGE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*[-~～至到—]\s*(\d+(?:\.\d+)?)")
# promotion tiers (rough, heuristic) keyed by position name substring
TIER_RULES = [
    (re.compile(r"(初级|实习|助理)"), 1),
    (re.compile(r"(^|\b)(中级|专员|工程师|开发|人员)"), 2),
    (re.compile(r"(高级|senior)", re.I), 3),
    (re.compile(r"(经理|主管|lead|组长)", re.I), 4),
    (re.compile(r"(总监|架构师|专家|CEO|董事)", re.I), 5),
]


def clean_html(s: str) -> str:
    if not isinstance(s, str):
        return ""
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    return s.strip()


def parse_salary(s: str) -> tuple[int, int] | None:
    """Return (lo_yuan, hi_yuan) per month.

    Handles common Chinese JD salary formats:
      - 1.2-2万            → 12000-20000
      - 1.5-3万·14薪       → 15000-30000 (薪 suffix ignored for the range)
      - 6000-12000元       → 6000-12000
      - 10-15K / 10k-15k   → 10000-15000
      - 150-200元/天       → daily × 22
      - 面议 / 详谈        → None
    """
    if not isinstance(s, str):
        return None
    s = s.strip()
    if not s or any(w in s for w in ("面议", "详谈", "薪资面议")):
        return None

    # Daily rate: convert to monthly (≈ 22 working days)
    if "元/天" in s or "/天" in s:
        m = RANGE_RE.search(s)
        if m:
            return int(float(m.group(1)) * 22), int(float(m.group(2)) * 22)
        return None

    # Hourly rate: 22 days * 8 hours
    if "元/时" in s or "/时" in s or "/小时" in s:
        m = RANGE_RE.search(s)
        if m:
            return int(float(m.group(1)) * 176), int(float(m.group(2)) * 176)
        return None

    # 万 format (multiply by 10000)
    if "万" in s:
        m = RANGE_RE.search(s)
        if m:
            return int(float(m.group(1)) * 10000), int(float(m.group(2)) * 10000)
        m2 = re.search(r"(\d+(?:\.\d+)?)\s*万", s)
        if m2:
            v = int(float(m2.group(1)) * 10000)
            return v, v
        return None

    # K / k format (multiply by 1000)
    if "k" in s.lower():
        m = re.search(
            r"(\d+(?:\.\d+)?)\s*k?\s*[-~～至到—]\s*(\d+(?:\.\d+)?)\s*k",
            s, re.IGNORECASE,
        )
        if m:
            return int(float(m.group(1)) * 1000), int(float(m.group(2)) * 1000)
        return None

    # Plain yuan: "4000-7000元" / "6000-12000"
    m = RANGE_RE.search(s)
    if m:
        lo, hi = int(float(m.group(1))), int(float(m.group(2)))
        # sanity: a realistic monthly salary is at least 500 yuan
        if lo < 500 or hi < 500:
            return None
        return lo, hi
    return None


def parse_city(addr: str) -> str:
    if not isinstance(addr, str):
        return ""
    m = CITY_RE.match(addr)
    return m.group(1) if m else addr


def infer_tier(name: str) -> int:
    for pat, tier in TIER_RULES:
        if pat.search(name):
            return tier
    return 2  # default mid


def extract_skills(text: str, keywords: list[str]) -> list[str]:
    if not isinstance(text, str):
        return []
    text_l = text.lower()
    found = []
    for kw in keywords:
        if kw.lower() in text_l:
            found.append(kw)
    return found


def build_profiles(df: pd.DataFrame) -> list[dict]:
    # Flesh out positions - group by 岗位名称
    profiles = []
    grouped = df.groupby("岗位名称")
    for name, g in grouped:
        jds = [clean_html(x) for x in g["岗位详情"].fillna("").tolist()]
        all_text = "\n".join(jds)
        # skill counter
        skills_counter = Counter()
        for jd in jds:
            for sk in extract_skills(jd, SKILL_KEYWORDS):
                skills_counter[sk] += 1
        top_skills = [s for s, _ in skills_counter.most_common(12)]
        certs_counter = Counter()
        for jd in jds:
            for c in extract_skills(jd, CERT_KEYWORDS):
                certs_counter[c] += 1
        top_certs = [c for c, _ in certs_counter.most_common(5)]

        # salary
        salaries = [parse_salary(x) for x in g["薪资范围"].fillna("").tolist()]
        salaries = [s for s in salaries if s]
        if salaries:
            sal_lo = sum(s[0] for s in salaries) // len(salaries)
            sal_hi = sum(s[1] for s in salaries) // len(salaries)
        else:
            sal_lo = sal_hi = 0
        # cities
        cities = Counter(parse_city(x) for x in g["地址"].fillna("").tolist())
        top_cities = [c for c, _ in cities.most_common(5) if c]
        industries = Counter()
        for ind in g["所属行业"].fillna("").tolist():
            for p in re.split(r"[,，/]", ind):
                p = p.strip()
                if p:
                    industries[p] += 1
        top_inds = [i for i, _ in industries.most_common(3)]

        # soft skill heuristic scores 0-100 (based on keyword frequency)
        def rate(kw_list):
            score = 0
            for kw in kw_list:
                if kw in all_text:
                    score += 1
            return min(100, 50 + score * 10)

        soft = {
            "创新能力": rate(["创新", "新产品", "研发"]),
            "学习能力": rate(["学习能力", "快速学习", "钻研"]),
            "抗压能力": rate(["抗压", "加班", "截止"]),
            "沟通能力": rate(["沟通", "协作", "对接"]),
            "实习能力": rate(["实习", "项目经验", "实践"]),
        }

        # Pick a representative JD (longest of first 3)
        rep_jd = max(jds[:5], key=len) if jds else ""

        profiles.append({
            "id": re.sub(r"\W+", "_", name),
            "name": name,
            "count": len(g),
            "industries": top_inds,
            "cities": top_cities,
            "salary_range": [sal_lo, sal_hi],
            "tier": infer_tier(name),
            "skills": top_skills,
            "certs": top_certs,
            "soft_skills": soft,
            "description": rep_jd[:600],
            "sample_companies": g["公司名称"].dropna().unique().tolist()[:5],
            "education": "本科" if "本科" in all_text else ("大专" if "大专" in all_text else "不限"),
            "work_env": "正常班制" if "965" in all_text or "双休" in all_text else "标准工时",
        })
    return profiles


def build_graph(profiles: list[dict]) -> dict:
    """Vertical promotion edges (same family, tier+1) + lateral switch edges
    (high skill-overlap, different families)."""
    nodes = [{"id": p["id"], "name": p["name"], "tier": p["tier"]} for p in profiles]

    # Family classification via keyword
    FAMILIES = {
        "研发": ["开发", "Java", "C/C++", "前端", "硬件", "软件测试", "测试工程师", "算法", "科研",
                "Python工程师", "Go工程师", "全栈", "运维工程师", "数据工程师", "架构师", "音视频",
                "嵌入式", "iOS工程师", "Android工程师", "ReactNative", "安全工程师",
                "通信工程师", "雷达", "航天系统"],
        "产品运营": ["运营", "产品", "内容", "市场", "广告", "销售", "客服", "BD", "电商运营",
                   "APP推广", "游戏推广", "游戏运营", "社区运营", "体育运营"],
        "设计": ["UI", "设计师", "用户研究", "用户体验"],
        "金融财务": ["投资", "风控", "审计", "财务", "金融", "地产投资"],
        "咨询管理": ["咨询顾问", "管理咨询"],
        "传媒文创": ["文案", "公关", "记者", "编辑", "影视编导", "文旅策划"],
        "教育医药": ["教学", "教育", "医药", "临床", "医疗", "生物研发"],
        "工程制造": ["机械", "电气", "土木", "质量工程", "环境工程", "新能源", "风电", "建筑",
                   "实施", "技术支持", "物流", "化工", "轨道交通", "食品研发"],
        "公共服务": ["公务员", "选调生", "社会工作", "NGO"],
        "酒店旅游": ["酒店", "餐饮", "旅游"],
        "农业": ["农业技术"],
        "职能": ["助理", "专员", "经理人", "管培生", "统计", "质检", "行政", "律师", "招聘",
               "猎头", "HRBP", "法务", "知识产权", "档案", "资料", "培训师", "供应链",
               "物业管理"],
    }

    def family_of(name: str) -> str:
        for fam, kws in FAMILIES.items():
            for kw in kws:
                if kw in name:
                    return fam
        return "其他"

    by_family = defaultdict(list)
    for p in profiles:
        by_family[family_of(p["name"])].append(p)

    # Promotion duration by (src_tier, dst_tier) and family.
    # Baseline reflects realistic career ladders in China; families differ:
    #  研发     — fast early, slower late (技术专家需要长期积累)
    #  产品运营 — steady, mid-career fastest (销售/运营晋升看业绩)
    #  职能     — slower overall (论资排辈)
    #  工程实施 — steady (依赖项目经验)
    def promote_years(src_tier: int, dst_tier: int, fam: str) -> str:
        base = {
            (1, 2): (1, 2),  # 实习/助理 → 工程师/专员
            (2, 3): (2, 4),  # 工程师/专员 → 高级
            (3, 4): (3, 5),  # 高级 → 经理/主管
            (4, 5): (4, 6),  # 经理 → 总监/架构师
        }
        # Multi-level jumps: sum intermediate gaps
        if dst_tier - src_tier > 1:
            lo = sum(base.get((t, t + 1), (2, 3))[0] for t in range(src_tier, dst_tier))
            hi = sum(base.get((t, t + 1), (2, 3))[1] for t in range(src_tier, dst_tier))
        else:
            lo, hi = base.get((src_tier, dst_tier), (2, 4))

        # Family adjustments (±1 year)
        if fam == "研发" and dst_tier >= 4:
            lo += 1; hi += 1
        elif fam == "产品运营" and 2 <= src_tier <= 3:
            lo = max(1, lo - 1)  # 业绩型晋升更快
        elif fam == "职能":
            hi += 1  # 整体更慢
        # 工程实施 保持 baseline

        return f"{lo}-{hi}年" if lo != hi else f"{lo}年"

    edges = []
    # Vertical: within family, from tier t to tier t+1 of same family
    for fam, members in by_family.items():
        by_tier = defaultdict(list)
        for m in members:
            by_tier[m["tier"]].append(m)
        tiers = sorted(by_tier.keys())
        for i in range(len(tiers) - 1):
            src_t, dst_t = tiers[i], tiers[i + 1]
            years = promote_years(src_t, dst_t, fam)
            for src in by_tier[src_t]:
                for dst in by_tier[dst_t]:
                    edges.append({
                        "source": src["id"], "target": dst["id"],
                        "type": "promote", "years": years,
                        "family": fam, "src_tier": src_t, "dst_tier": dst_t,
                    })

    # Lateral: similar skill set across families (exclude generic soft skills)
    GENERIC_SKILLS = {"沟通能力", "团队协作", "抗压", "学习能力", "创新", "创新能力",
                      "沟通", "协调", "细心", "责任心", "逻辑思维"}

    def sim(a, b):
        sa = set(a["skills"]) - GENERIC_SKILLS
        sb = set(b["skills"]) - GENERIC_SKILLS
        if len(sa) < 2 or len(sb) < 2:
            return 0.0
        return len(sa & sb) / max(1, len(sa | sb))

    for i, a in enumerate(profiles):
        ranked = []
        for j, b in enumerate(profiles):
            if i == j or family_of(a["name"]) == family_of(b["name"]):
                continue
            s = sim(a, b)
            if s >= 0.25:
                ranked.append((s, b))
        ranked.sort(reverse=True, key=lambda x: x[0])
        for s, b in ranked[:3]:
            edges.append({
                "source": a["id"], "target": b["id"],
                "type": "switch", "weight": round(s, 2),
            })

    return {"nodes": nodes, "edges": edges,
            "families": {fam: [m["id"] for m in ms] for fam, ms in by_family.items()}}


def main() -> None:
    print(f"[data] reading {XLS}")
    df = pd.read_excel(XLS)
    print(f"[data] base rows={len(df)}, unique positions={df['岗位名称'].nunique()}")

    # 若存在扩展数据（爬虫抓的 / 外部导入的），按相同字段合并进来
    if EXT_XLSX.exists():
        print(f"[data] found extension {EXT_XLSX.name}")
        ext = pd.read_excel(EXT_XLSX)
        # 只保留和主表相同的列，缺列补空
        for col in df.columns:
            if col not in ext.columns:
                ext[col] = ""
        ext = ext[df.columns]
        df = pd.concat([df, ext], ignore_index=True)
        # 去重：同岗位+同公司+同地址视为重复
        df.drop_duplicates(subset=["岗位名称", "公司名称", "地址"], keep="first", inplace=True)
        print(f"[data] merged rows={len(df)}, unique positions={df['岗位名称'].nunique()}")

    profiles = build_profiles(df)
    graph = build_graph(profiles)
    (OUT_DIR / "positions.json").write_text(
        json.dumps(profiles, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT_DIR / "graph.json").write_text(
        json.dumps(graph, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[data] wrote {len(profiles)} profiles, "
          f"{len(graph['edges'])} edges -> {OUT_DIR}")


if __name__ == "__main__":
    main()
