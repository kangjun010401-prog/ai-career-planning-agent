"""Person-job matching engine.

优先级（由强到弱）：
    专业 → 学历 → 实习经历 → 技能匹配 → 软技能 → 兴趣（霍兰德）

记分规则：
  - 专业匹配     → 综合分基线 = 60；不匹配则 = 30；未填专业 = 45
  - 学历满足     → +8
  - 实习经历     → +0~12（有实习 +6，且与岗位相关再 +6）
  - 技能覆盖率   → +0~12（命中率线性映射）
  - 软技能       → +0~4
  - 兴趣（霍兰德）→ +0~4

Breakdown 以三个维度展示（便于圆环可视化）：
  - 基础要求 = 专业 70% + 学历 30%
  - 职业技能 = 技能 60% + 实习 40%
  - 职业素养 = 软技能 50% + 兴趣 50%
"""
from __future__ import annotations
from typing import Any

# ---------- 通用辅助 ----------

DEGREE_RANK = {"不限": 0, "高中": 1, "大专": 2, "本科": 3, "硕士": 4, "博士": 5}


def _student_highest_degree(student: dict) -> str:
    candidates: list[str] = []
    edu_list = student.get("education") or []
    if isinstance(edu_list, list):
        for e in edu_list:
            if isinstance(e, dict) and e.get("degree"):
                candidates.append(str(e["degree"]))
    legacy = (student.get("basic") or {}).get("education")
    if legacy:
        candidates.append(str(legacy))
    best = ""
    best_rank = -1
    for raw in candidates:
        for k, r in DEGREE_RANK.items():
            if k and k in raw and r > best_rank:
                best, best_rank = k, r
    return best


def _meets_degree(student_degree: str, job_degree: str | None) -> bool:
    jd = (job_degree or "").strip() or "不限"
    if jd == "不限":
        return True
    return DEGREE_RANK.get(student_degree, 0) >= DEGREE_RANK.get(jd, 0)


# ---------- 专业 → 岗位关键词映射 ----------

MAJOR_KEYWORDS: dict[str, list[str]] = {
    "计算机": ["开发", "Java", "C/C++", "前端", "算法", "测试", "软件", "硬件", "技术支持", "实施", "数据", "运维"],
    "软件": ["开发", "Java", "C/C++", "前端", "算法", "测试", "软件"],
    "信息": ["开发", "硬件", "技术支持", "实施", "数据", "运维", "网络"],
    "电子": ["硬件", "风电", "电", "实施", "技术支持"],
    "电气": ["硬件", "风电", "电", "实施"],
    "通信": ["硬件", "技术支持", "实施", "网络"],
    "自动化": ["硬件", "实施", "风电", "技术支持"],
    "机械": ["硬件", "风电", "实施", "技术支持", "质检", "质量"],
    "数据": ["数据", "算法", "统计"],
    "人工智能": ["算法", "数据", "开发"],
    "数学": ["算法", "数据", "统计", "质量"],
    "统计": ["统计", "数据", "质量", "质检"],
    "应用统计": ["统计", "数据", "质量", "质检"],
    "金融": ["销售", "BD", "客户", "投", "项目招投标"],
    "经济": ["销售", "BD", "运营", "商务", "项目招投标"],
    "市场": ["销售", "推广", "BD", "市场", "运营", "商务"],
    "营销": ["销售", "推广", "BD", "市场", "运营"],
    "工商": ["管培", "储备", "项目", "运营", "销售", "咨询", "商务", "总助"],
    "管理": ["管培", "储备", "项目", "运营", "总助", "行政"],
    "人力": ["招聘", "猎头", "培训", "人力"],
    "心理": ["招聘", "培训", "咨询", "客服", "用户"],
    "法学": ["律师", "法务", "知识产权", "项目招投标"],
    "法律": ["律师", "法务", "知识产权"],
    "新闻": ["内容", "运营", "推广", "编辑", "审核"],
    "传播": ["内容", "运营", "推广", "审核"],
    "广告": ["推广", "广告", "运营"],
    "设计": ["设计", "前端", "推广"],
    "艺术": ["设计", "内容", "推广"],
    "英语": ["英语翻译", "翻译", "BD", "外贸"],
    "日语": ["日语翻译", "翻译"],
    "外语": ["翻译"],
    "翻译": ["翻译"],
    "教育": ["培训", "教育", "内容", "咨询"],
    "汉语": ["内容", "文案", "审核", "翻译"],
    "中文": ["内容", "文案", "审核"],
    "行政": ["行政", "档案", "资料", "助理", "总助"],
    "会计": ["财务", "审计", "质量", "档案"],
    "财务": ["财务", "审计"],
    "审计": ["审计", "质量"],
    "物流": ["实施", "项目", "运营"],
    "档案": ["档案", "资料"],
    "图书情报": ["档案", "资料", "内容"],
    "生物": ["科研", "质检", "质量"],
    "化学": ["科研", "质检", "质量"],
    "物理": ["科研", "硬件"],
    "科研": ["科研"],
}


def _collect_student_majors(student: dict) -> list[str]:
    majors: list[str] = []
    for e in student.get("education") or []:
        if isinstance(e, dict) and e.get("major"):
            majors.append(str(e["major"]))
    basic = student.get("basic") or {}
    for k in ("major", "专业"):
        if basic.get(k):
            majors.append(str(basic[k]))
    intent_job = ((student.get("intent") or {}).get("job") or "").strip()
    if intent_job:
        # Fallback: use declared target job if no major is filled
        majors.append(intent_job)
    return [m.strip() for m in majors if m and m.strip()]


def _major_matches_job(student_majors: list[str], job_name: str) -> tuple[str, bool]:
    """Return ("matched"|"unknown"|"unmatched", matched?)."""
    if not student_majors:
        return "unknown", False
    job_name = (job_name or "")
    for major in student_majors:
        ml = major.lower()
        for key, keywords in MAJOR_KEYWORDS.items():
            if key.lower() in ml or ml in key.lower():
                for kw in keywords:
                    if kw in job_name:
                        return "matched", True
        # direct fuzzy match: student major substring appears in job name
        if len(ml) >= 2 and ml in job_name.lower():
            return "matched", True
    return "unmatched", False


# ---------- 6 个维度打分（0-100） ----------

def score_major(student: dict, job: dict) -> tuple[int, str]:
    majors = _collect_student_majors(student)
    state, matched = _major_matches_job(majors, job.get("name", ""))
    if matched:
        return 90, state
    if state == "unknown":
        return 50, state
    return 40, state


def score_degree(student: dict, job: dict) -> tuple[int, bool]:
    student_degree = _student_highest_degree(student)
    met = _meets_degree(student_degree, job.get("education"))
    if not student_degree:
        return 55, False
    return (100 if met else 45), met


def score_internship(student: dict, job: dict) -> int:
    """有实习 = 70，相关实习 = 100，没实习 = 40。"""
    exp_lists = [
        student.get("internships") or [],
        student.get("work_experiences") or [],
        student.get("experiences") or [],
        student.get("projects") or [],
    ]
    all_exp: list[dict] = []
    for lst in exp_lists:
        if isinstance(lst, list):
            all_exp.extend([e for e in lst if isinstance(e, dict)])
    if not all_exp:
        return 40

    job_name = (job.get("name") or "").lower()
    job_skills = [s.lower() for s in (job.get("skills") or [])]
    job_inds = [i.lower() for i in (job.get("industries") or [])]
    keywords = {job_name} | set(job_skills) | set(job_inds)
    keywords.discard("")

    for e in all_exp:
        blob = " ".join(
            str(e.get(k, "")) for k in ("company", "position", "title", "role", "desc", "name")
        ).lower()
        if not blob:
            continue
        for kw in keywords:
            if kw and len(kw) >= 2 and kw in blob:
                return 100
    return 70


def score_skills(student: dict, job: dict) -> tuple[int, list[str], list[str]]:
    hit: list[str] = []
    miss: list[str] = []
    s_skills = [x.lower() for x in student.get("skills", [])]
    for k in job.get("skills", []):
        if k.lower() in s_skills:
            hit.append(k)
        else:
            miss.append(k)
    if not job.get("skills"):
        return 60, hit, miss
    cov = len(hit) / len(job["skills"])
    return int(40 + cov * 60), hit, miss


def score_soft(student: dict, job: dict) -> int:
    s_soft = student.get("soft_skills") or {}
    j_soft = job.get("soft_skills") or {}
    if not j_soft:
        return 70
    diffs = []
    for k, jv in j_soft.items():
        sv = s_soft.get(k, 60)
        diffs.append(max(0, 100 - abs(jv - sv)))
    return int(sum(diffs) / len(diffs)) if diffs else 70


# Position → expected Holland letter (rough mapping)
POSITION_HOLLAND = [
    ("Java", "I"), ("C/C++", "I"), ("C++", "I"), ("前端", "I"), ("算法", "I"),
    ("科研", "I"), ("数据", "I"), ("咨询", "I"),
    ("硬件", "R"), ("实施", "R"), ("风电", "R"), ("技术支持", "R"), ("运维", "R"),
    ("销售", "E"), ("BD", "E"), ("商务", "E"), ("大客户", "E"), ("推广", "E"),
    ("产品", "E"), ("项目经理", "E"), ("管培生", "E"), ("储备", "E"),
    ("总助", "E"), ("CEO", "E"), ("董事长", "E"),
    ("运营", "E"), ("游戏", "E"),
    ("客服", "S"), ("招聘", "S"), ("猎头", "S"), ("培训", "S"), ("社区", "S"),
    ("审核", "S"), ("内容", "A"), ("设计", "A"), ("翻译", "A"),
    ("律师", "I"), ("法务", "C"), ("知识产权", "C"),
    ("财务", "C"), ("审计", "C"), ("行政", "C"), ("档案", "C"), ("资料", "C"),
    ("统计", "C"), ("质检", "C"), ("质量", "C"), ("测试", "C"),
]


def _position_holland(job: dict) -> str:
    name = job.get("name", "")
    for kw, t in POSITION_HOLLAND:
        if kw in name:
            return t
    return ""


# Holland hexagon adjacency (R-I-A-S-E-C)
HOLLAND_ADJ = {
    "R": {"I", "C"}, "I": {"R", "A"}, "A": {"I", "S"},
    "S": {"A", "E"}, "E": {"S", "C"}, "C": {"E", "R"},
}


def score_interest(student: dict, job: dict) -> int:
    assessments = student.get("assessments") or {}
    holland = assessments.get("holland") or []
    expected = _position_holland(job)
    if not holland or len(holland) < 6 or not expected:
        return 65  # neutral when unknown
    types = ["R", "I", "A", "S", "E", "C"]
    # Rank by score
    order = sorted(range(6), key=lambda i: -holland[i])
    top_letters = [types[i] for i in order[:3]]
    if expected == top_letters[0]:
        return 100
    if expected in top_letters:
        return 80
    if expected in HOLLAND_ADJ.get(top_letters[0], set()):
        return 65
    return 45


# ---------- 最终聚合 ----------


def _profile_is_empty(student: dict) -> bool:
    """Return True when the student has provided essentially no档案 data.

    Criteria: no skills, no usable education (with a degree), no experiences,
    no projects, no intent, no self-assessment.
    """
    if student.get("skills"):
        return False
    edu_list = student.get("education") or []
    if isinstance(edu_list, list) and any(
        isinstance(e, dict) and (e.get("degree") or e.get("major") or e.get("school"))
        for e in edu_list
    ):
        return False
    for key in ("internships", "work_experiences", "experiences", "projects"):
        lst = student.get(key) or []
        if isinstance(lst, list) and any(
            isinstance(e, dict) and any(e.values()) for e in lst
        ):
            return False
    intent = student.get("intent") or {}
    if isinstance(intent, dict) and any(intent.values()):
        return False
    assess = student.get("assessments") or {}
    if isinstance(assess, dict) and any(v for v in assess.values()):
        return False
    return True


def match(student: dict, job: dict) -> dict[str, Any]:
    # 档案全空时直接返回 0，避免显示一堆相同的 50% 迷惑用户
    if _profile_is_empty(student):
        return {
            "score": 0,
            "breakdown": {"基础要求": 0, "职业技能": 0, "职业素养": 0},
            "details": {},
            "weights": {"major_floor": 60, "order": ["专业", "学历", "实习", "技能", "软技能", "兴趣"]},
            "skills_hit": [],
            "skills_miss": list((job.get("skills") or [])[:5]),
            "empty_profile": True,
        }

    major_s, major_state = score_major(student, job)
    degree_s, degree_met = score_degree(student, job)
    intern_s = score_internship(student, job)
    skill_s, hit, miss = score_skills(student, job)
    soft_s = score_soft(student, job)
    interest_s = score_interest(student, job)

    # ----- 总分：按用户指定的优先级加权 -----
    # 1) 专业决定基线
    if major_state == "matched":
        base = 60
    elif major_state == "unknown":
        base = 45
    else:
        base = 30
    # 2) 在基线上逐项加分（顺序即优先级）
    bonus = 0
    bonus += 8 if degree_met else 0                   # 学历：最多 +8
    bonus += round((intern_s - 40) * 12 / 60)         # 实习：最多 +12
    bonus += round((skill_s - 40) * 12 / 60)          # 技能：最多 +12
    bonus += round((soft_s - 50) * 4 / 50)            # 软技能：最多 +4
    bonus += round((interest_s - 50) * 4 / 50)        # 兴趣：最多 +4
    total = max(0, min(100, base + bonus))

    # ----- 三维度 breakdown（供前端圆环展示） -----
    breakdown = {
        "基础要求": int(round(major_s * 0.7 + degree_s * 0.3)),
        "职业技能": int(round(skill_s * 0.6 + intern_s * 0.4)),
        "职业素养": int(round(soft_s * 0.5 + interest_s * 0.5)),
    }

    return {
        "score": total,
        "breakdown": breakdown,
        "details": {
            "专业": {"score": major_s, "state": major_state},
            "学历": {"score": degree_s, "met": degree_met},
            "实习经历": {"score": intern_s},
            "技能匹配": {"score": skill_s},
            "软技能": {"score": soft_s},
            "兴趣匹配": {"score": interest_s},
        },
        "weights": {"major_floor": 60, "order": ["专业", "学历", "实习", "技能", "软技能", "兴趣"]},
        "skills_hit": hit,
        "skills_miss": miss,
    }
