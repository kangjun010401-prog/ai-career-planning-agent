/**
 * 心理测评题库（v1.0 · 2026-03-26）
 * 对应知识库：Holland RIASEC / MBTI / 工作价值观 / 多元智能
 */

/* ---------------- 1. Holland RIASEC ---------------- */

export type HollandType = "R" | "I" | "A" | "S" | "E" | "C";

export const HOLLAND_LABELS: Record<HollandType, string> = {
  R: "R 实际型",
  I: "I 研究型",
  A: "A 艺术型",
  S: "S 社会型",
  E: "E 企业型",
  C: "C 常规型",
};

export const HOLLAND_ORDER: HollandType[] = ["R", "I", "A", "S", "E", "C"];

export const HOLLAND_QUESTIONS: { id: string; type: HollandType; text: string }[] = [
  // R 实际型
  { id: "R01", type: "R", text: "我喜欢亲手组装或修理电子设备（如组装电脑、修手机）" },
  { id: "R02", type: "R", text: "比起写报告，我更享受动手操作的工作" },
  { id: "R03", type: "R", text: "我喜欢研究机械或硬件的工作原理" },
  { id: "R04", type: "R", text: "参加实验室实验或设备调试让我感到充实" },
  { id: "R05", type: "R", text: "我愿意花时间学习某种操作技能（如编程语言语法、硬件配置）" },
  { id: "R06", type: "R", text: "我偏好在有具体操作步骤的环境中工作" },
  { id: "R07", type: "R", text: "建造或搭建某样东西（实体或代码架构）让我有成就感" },
  { id: "R08", type: "R", text: "我享受处理需要体力或精细操作的任务" },
  { id: "R09", type: "R", text: "我喜欢独立完成技术性的具体任务，不需要太多沟通" },
  { id: "R10", type: "R", text: "我对工程、建筑、网络基础设施等领域感兴趣" },
  // I 研究型
  { id: "I01", type: "I", text: "我喜欢研究一个问题背后的深层原因，而不只是找到解决方法" },
  { id: "I02", type: "I", text: "我会主动查阅论文、技术文档来满足自己的好奇心" },
  { id: "I03", type: "I", text: "遇到复杂问题时，我倾向于独立分析，而非直接问别人" },
  { id: "I04", type: "I", text: "我享受数学推导、逻辑证明或统计分析的过程" },
  { id: "I05", type: "I", text: "我对“为什么”的追问比“怎么做”更感兴趣" },
  { id: "I06", type: "I", text: "我会自发地对身边的现象提出假设并尝试验证" },
  { id: "I07", type: "I", text: "做研究或数据分析类的项目让我感到兴奋" },
  { id: "I08", type: "I", text: "我喜欢在不确定的情境中通过推理找到答案" },
  { id: "I09", type: "I", text: "参加学科竞赛或研究项目是我喜欢的经历" },
  { id: "I10", type: "I", text: "我对人工智能、数学、物理、认知科学等领域有持续兴趣" },
  // A 艺术型
  { id: "A01", type: "A", text: "我享受创作：写作、画画、摄影、音乐或设计" },
  { id: "A02", type: "A", text: "我对视觉美感很敏感，会注意颜色、排版、构图等细节" },
  { id: "A03", type: "A", text: "比起按规则执行，我更喜欢自由发挥和创意表达" },
  { id: "A04", type: "A", text: "我喜欢通过作品传达情感或观点" },
  { id: "A05", type: "A", text: "我对界面设计、品牌设计、交互体验等方向感兴趣" },
  { id: "A06", type: "A", text: "我在创作过程中会进入心流状态，忘记时间" },
  { id: "A07", type: "A", text: "我不喜欢高度重复、标准化的工作，偏好有创意空间的任务" },
  { id: "A08", type: "A", text: "我会主动欣赏艺术作品，并有自己的审美判断" },
  { id: "A09", type: "A", text: "用视觉或文字讲述一个故事让我感到满足" },
  { id: "A10", type: "A", text: "我对文案、内容创作、品牌策划等工作有兴趣" },
  // S 社会型
  { id: "S01", type: "S", text: "帮助他人解决问题让我感到有价值" },
  { id: "S02", type: "S", text: "我善于倾听，朋友喜欢找我倾诉" },
  { id: "S03", type: "S", text: "我对人的心理、行为、动机感到好奇" },
  { id: "S04", type: "S", text: "我喜欢教别人学东西，耐心辅导让我有成就感" },
  { id: "S05", type: "S", text: "我在团队中容易察觉他人的情绪状态" },
  { id: "S06", type: "S", text: "我愿意从事有社会意义的工作，即使薪资不是最高" },
  { id: "S07", type: "S", text: "组织活动、协调不同人的需求让我感到擅长" },
  { id: "S08", type: "S", text: "我在人际交往中感到自在，能快速建立信任" },
  { id: "S09", type: "S", text: "用户研究、用户访谈类的工作让我感兴趣" },
  { id: "S10", type: "S", text: "我对教育、心理咨询、公益类方向有持续关注" },
  // E 企业型
  { id: "E01", type: "E", text: "我喜欢说服别人接受我的观点或方案" },
  { id: "E02", type: "E", text: "推动一件事从无到有让我感到兴奋" },
  { id: "E03", type: "E", text: "我有较强的目标感，会主动为自己设定挑战" },
  { id: "E04", type: "E", text: "在团队中我通常会自然地承担领导角色" },
  { id: "E05", type: "E", text: "我对商业模式、市场竞争、增长策略感兴趣" },
  { id: "E06", type: "E", text: "我愿意承担风险去获得更大的回报" },
  { id: "E07", type: "E", text: "谈判、提案、演讲类的任务对我来说并不困难" },
  { id: "E08", type: "E", text: "我对产品经理、创业、投融资等方向有持续兴趣" },
  { id: "E09", type: "E", text: "我关注行业动态和商业新闻，喜欢分析商业逻辑" },
  { id: "E10", type: "E", text: "我希望自己的工作能影响更多人或产生较大的商业价值" },
  // C 常规型
  { id: "C01", type: "C", text: "我喜欢有明确规则和流程的工作环境" },
  { id: "C02", type: "C", text: "维护数据准确、文档规范让我感到踏实" },
  { id: "C03", type: "C", text: "我擅长处理需要高度细致和专注的任务" },
  { id: "C04", type: "C", text: "我对数字、表格、数据库处理感到得心应手" },
  { id: "C05", type: "C", text: "在重复性较高的工作中我也能保持高质量" },
  { id: "C06", type: "C", text: "我喜欢按计划推进工作，不喜欢临时变动" },
  { id: "C07", type: "C", text: "测试、质检、数据核验类工作让我感到有意义" },
  { id: "C08", type: "C", text: "我注重工作流程的规范化和可追溯性" },
  { id: "C09", type: "C", text: "我对财务、运营、行政管理类岗位有一定兴趣" },
  { id: "C10", type: "C", text: "稳定可预期的工作环境比充满变化的环境更让我安心" },
];

/** 计分：每类占比（0-100，方便雷达图展示） */
export function scoreHolland(ans: Record<string, boolean>): number[] {
  return HOLLAND_ORDER.map((t) => {
    const qs = HOLLAND_QUESTIONS.filter((q) => q.type === t);
    const hit = qs.filter((q) => ans[q.id]).length;
    return Math.round((hit / qs.length) * 100);
  });
}

export function hollandCode(scores: number[]): string {
  return HOLLAND_ORDER
    .map((t, i) => ({ t, s: scores[i] }))
    .sort((a, b) => b.s - a.s || HOLLAND_ORDER.indexOf(a.t) - HOLLAND_ORDER.indexOf(b.t))
    .slice(0, 3)
    .map((x) => x.t)
    .join("");
}

/* ---------------- 2. MBTI ---------------- */

export type MbtiDim = "EI" | "SN" | "TF" | "JP";

export const MBTI_DIMS: MbtiDim[] = ["EI", "SN", "TF", "JP"];
export const MBTI_PAIRS: Record<MbtiDim, [string, string]> = {
  EI: ["E 外向", "I 内向"],
  SN: ["S 感觉", "N 直觉"],
  TF: ["T 思考", "F 情感"],
  JP: ["J 判断", "P 感知"],
};

/** a = 左侧（E/S/T/J），b = 右侧（I/N/F/P） */
export const MBTI_QUESTIONS: { id: string; dim: MbtiDim; a: string; b: string }[] = [
  { id: "EI01", dim: "EI", a: "和一群人社交后，我感到充电了", b: "和一群人社交后，我感到需要独处恢复" },
  { id: "EI02", dim: "EI", a: "我倾向于先说出想法，再边讲边思考", b: "我倾向于先在脑中想清楚，再开口表达" },
  { id: "EI03", dim: "EI", a: "我喜欢在热闹的环境中工作", b: "我在安静独立的环境中效率最高" },
  { id: "EI04", dim: "EI", a: "我主动发起对话和认识新朋友", b: "我通常等待他人先发起对话" },
  { id: "EI05", dim: "EI", a: "我有很多朋友，关系多而广", b: "我有少数亲密朋友，关系深而精" },
  { id: "EI06", dim: "EI", a: "长时间一个人工作让我感到无聊", b: "长时间一个人工作让我感到专注充实" },
  { id: "EI07", dim: "EI", a: "我在会议或讨论中倾向于积极发言", b: "我在会议或讨论中倾向于先听再说" },
  { id: "EI08", dim: "EI", a: "我通过和别人聊天来整理思路", b: "我通过写日记或独自思考来整理思路" },
  { id: "EI09", dim: "EI", a: "我喜欢多线程同时处理多个社交任务", b: "我喜欢一次专注于一件事" },
  { id: "EI10", dim: "EI", a: "他人认为我开朗健谈、精力充沛", b: "他人认为我安静深沉、善于倾听" },

  { id: "SN01", dim: "SN", a: "我更信赖已有的经验和事实", b: "我更相信灵感和对未来的预感" },
  { id: "SN02", dim: "SN", a: "我关注细节，注意事物的具体状态", b: "我关注整体，注意事物之间的联系" },
  { id: "SN03", dim: "SN", a: "我喜欢有具体可操作步骤的任务", b: "我喜欢开放式、探索性的任务" },
  { id: "SN04", dim: "SN", a: "我倾向于“如何做”而非“为什么做”", b: "我倾向于“为什么做”而非“如何做”" },
  { id: "SN05", dim: "SN", a: "我更喜欢务实、接地气的对话", b: "我更喜欢探讨抽象概念和未来可能性" },
  { id: "SN06", dim: "SN", a: "我按顺序一步步处理任务", b: "我会跳跃思维，反复跳回修改整体框架" },
  { id: "SN07", dim: "SN", a: "我对已验证的方法更有信心", b: "我对新颖的、未经验证的想法更感兴趣" },
  { id: "SN08", dim: "SN", a: "我注意并记得具体的细节（日期/数字/名字）", b: "我善于把握整体印象，容易忘记细节" },
  { id: "SN09", dim: "SN", a: "我更信任数据和亲身经历", b: "我更信任直觉和理论框架" },
  { id: "SN10", dim: "SN", a: "我享受把一件事情做到极致精确", b: "我享受探索各种可能性，即使还未落地" },

  { id: "TF01", dim: "TF", a: "做决定时，我优先考虑逻辑和客观标准", b: "做决定时，我优先考虑对人的影响和价值观" },
  { id: "TF02", dim: "TF", a: "我能给出直接批评，即使对方可能不舒服", b: "我会先照顾对方感受，再委婉提出问题" },
  { id: "TF03", dim: "TF", a: "在冲突中，我倾向于就事论事", b: "在冲突中，我倾向于先修复关系" },
  { id: "TF04", dim: "TF", a: "我被别人评价为客观理性", b: "我被别人评价为温暖体贴" },
  { id: "TF05", dim: "TF", a: "我认为公平比和谐更重要", b: "我认为和谐比公平更重要" },
  { id: "TF06", dim: "TF", a: "我可以在情绪不好时仍做出冷静判断", b: "我的情绪状态会明显影响我的判断" },
  { id: "TF07", dim: "TF", a: "我分析问题时更关注逻辑漏洞", b: "我分析问题时更关注人的感受和动机" },
  { id: "TF08", dim: "TF", a: "对我来说，真相比感受更重要", b: "对我来说，感受与真相同样重要" },
  { id: "TF09", dim: "TF", a: "我在决策时更少受人际关系影响", b: "我在决策时很难忽视人际关系因素" },
  { id: "TF10", dim: "TF", a: "我欣赏逻辑严密、论证清晰的人", b: "我欣赏真诚、有温度、善于共情的人" },

  { id: "JP01", dim: "JP", a: "我喜欢提前计划，对临时变动感到不适", b: "我喜欢保持选项开放，随机应变" },
  { id: "JP02", dim: "JP", a: "完成待办清单让我感到满足", b: "我的待办清单经常没有固定优先级" },
  { id: "JP03", dim: "JP", a: "我在开始工作前喜欢把任务规划清楚", b: "我喜欢在行动中探索，边做边调整" },
  { id: "JP04", dim: "JP", a: "DDL 到来前我通常已提前完成任务", b: "我在接近 DDL 时工作效率反而更高" },
  { id: "JP05", dim: "JP", a: "我生活有条理，物品有固定位置", b: "我的空间比较随意，但我知道东西在哪" },
  { id: "JP06", dim: "JP", a: "我倾向于快速做决定，不喜欢悬而未决", b: "我喜欢保留更多信息再做最终决定" },
  { id: "JP07", dim: "JP", a: "我执行任务时严格按照计划进行", b: "我经常在执行中调整方向" },
  { id: "JP08", dim: "JP", a: "我对规则和截止时间持认真态度", b: "我认为规则是参考而非绝对约束" },
  { id: "JP09", dim: "JP", a: "他人认为我可靠、有条理", b: "他人认为我灵活、随性" },
  { id: "JP10", dim: "JP", a: "我更喜欢明确结论的对话", b: "我更享受开放式探索的对话" },
];

/** 返回每维度 b 侧占比（0 全左 / 1 全右），用于 MBTIBars 渲染 */
export function scoreMbti(ans: Record<string, "a" | "b">): number[] {
  return MBTI_DIMS.map((d) => {
    const qs = MBTI_QUESTIONS.filter((q) => q.dim === d);
    const bCount = qs.filter((q) => ans[q.id] === "b").length;
    return bCount / qs.length;
  });
}

export function mbtiType(scores: number[]): string {
  // scores: [EI, SN, TF, JP], 0 = left, 1 = right
  const letters = [
    scores[0] < 0.5 ? "E" : "I",
    scores[1] < 0.5 ? "S" : "N",
    scores[2] < 0.5 ? "T" : "F",
    scores[3] < 0.5 ? "J" : "P",
  ];
  return letters.join("");
}

/* ---------------- 3. 工作价值观 ---------------- */

export type ValueDim =
  | "AO" | "ER" | "SS" | "AI" | "CC"
  | "SI" | "IR" | "LG" | "WL" | "PR";

export const VALUE_ORDER: ValueDim[] = [
  "AO", "ER", "SS", "AI", "CC", "SI", "IR", "LG", "WL", "PR",
];

export const VALUE_LABELS: Record<ValueDim, string> = {
  AO: "成就感",
  ER: "经济回报",
  SS: "稳定安全",
  AI: "自主独立",
  CC: "创造创新",
  SI: "社会影响",
  IR: "人际关系",
  LG: "学习成长",
  WL: "生活平衡",
  PR: "声望地位",
};

export const VALUE_QUESTIONS: { id: string; dim: ValueDim; text: string }[] = [
  { id: "AO01", dim: "AO", text: "我希望工作本身让我感到有意义，而不仅仅是完成任务" },
  { id: "AO02", dim: "AO", text: "我愿意花更多时间把一件事做到让自己满意" },
  { id: "AO03", dim: "AO", text: "当我完成一个有挑战的项目时，那种成就感比奖金更重要" },

  { id: "ER01", dim: "ER", text: "薪资水平是我选择工作时最重要的考量之一" },
  { id: "ER02", dim: "ER", text: "我希望工作能让我获得良好的物质生活保障" },
  { id: "ER03", dim: "ER", text: "如果两份工作其他条件相同，我会毫不犹豫选薪资更高的那个" },

  { id: "SS01", dim: "SS", text: "我希望工作有稳定的收入和明确的职业前景" },
  { id: "SS02", dim: "SS", text: "频繁的岗位变动或公司裁员风险会让我感到很大压力" },
  { id: "SS03", dim: "SS", text: "进入体制内（国企/政府）或大公司对我有较大吸引力" },

  { id: "AI01", dim: "AI", text: "我希望在工作中有较大的自主决策空间" },
  { id: "AI02", dim: "AI", text: "被过度监管或微观管理会让我感到很不舒服" },
  { id: "AI03", dim: "AI", text: "我希望能灵活安排自己的工作方式和时间" },

  { id: "CC01", dim: "CC", text: "我享受从零开始创造一个全新事物的过程" },
  { id: "CC02", dim: "CC", text: "在工作中有机会提出自己的想法和方案对我很重要" },
  { id: "CC03", dim: "CC", text: "重复执行别人设计的流程让我感到缺乏动力" },

  { id: "SI01", dim: "SI", text: "我希望我的工作能对社会或他人产生正向影响" },
  { id: "SI02", dim: "SI", text: "即使薪资低一些，从事有社会意义的工作对我也有吸引力" },
  { id: "SI03", dim: "SI", text: "我会关注自己所在行业对社会的整体影响" },

  { id: "IR01", dim: "IR", text: "良好的同事关系和团队氛围对我的工作状态影响很大" },
  { id: "IR02", dim: "IR", text: "我希望工作中有机会与志同道合的人深度合作" },
  { id: "IR03", dim: "IR", text: "一个冷漠或竞争激烈的团队氛围会让我考虑离职" },

  { id: "LG01", dim: "LG", text: "我希望工作能让我持续学习新技能和知识" },
  { id: "LG02", dim: "LG", text: "选择工作时，成长空间比当前薪资更重要" },
  { id: "LG03", dim: "LG", text: "我会主动寻找能拉伸自己能力边界的机会" },

  { id: "WL01", dim: "WL", text: "工作之外的个人生活和兴趣爱好对我同样重要" },
  { id: "WL02", dim: "WL", text: "长期高强度加班会严重降低我对工作的满意度" },
  { id: "WL03", dim: "WL", text: "我不愿意为了事业牺牲健康、家庭或重要关系" },

  { id: "PR01", dim: "PR", text: "进入行业内知名公司或受人尊敬的岗位对我有吸引力" },
  { id: "PR02", dim: "PR", text: "获得行业内同行的认可和尊重对我有激励作用" },
  { id: "PR03", dim: "PR", text: "职位头衔和社会地位在一定程度上影响我的职业选择" },
];

export function scoreValues(ans: Record<string, number>): number[] {
  return VALUE_ORDER.map((d) => {
    const qs = VALUE_QUESTIONS.filter((q) => q.dim === d);
    const sum = qs.reduce((s, q) => s + (ans[q.id] || 0), 0);
    return Math.round((sum / (qs.length * 5)) * 100);
  });
}

/* ---------------- 4. 多元智能 ---------------- */

export type MiDim = "LI" | "LM" | "SP" | "MU" | "BK" | "IE" | "IA" | "NA";
export const MI_ORDER: MiDim[] = ["LI", "LM", "SP", "MU", "BK", "IE", "IA", "NA"];
export const MI_LABELS: Record<MiDim, string> = {
  LI: "语言",
  LM: "逻辑-数学",
  SP: "空间",
  MU: "音乐",
  BK: "身体-运动",
  IE: "人际",
  IA: "内省",
  NA: "自然观察",
};

export const MI_QUESTIONS: { id: string; dim: MiDim; text: string }[] = [
  { id: "LI01", dim: "LI", text: "我喜欢阅读，包括文学、非虚构类书籍" },
  { id: "LI02", dim: "LI", text: "我能清晰地用文字表达复杂的想法" },
  { id: "LI03", dim: "LI", text: "我对词汇的细微差别和语言的表达方式很敏感" },
  { id: "LI04", dim: "LI", text: "讲故事或写作是我喜欢且擅长的活动" },

  { id: "LM01", dim: "LM", text: "我享受解谜、逻辑推理或数学证明的过程" },
  { id: "LM02", dim: "LM", text: "我倾向于用数据和逻辑来解释和解决问题" },
  { id: "LM03", dim: "LM", text: "我能迅速发现规律、找到数字之间的关联" },
  { id: "LM04", dim: "LM", text: "编程或系统设计的结构化思维对我来说很自然" },

  { id: "SP01", dim: "SP", text: "我能在脑中清晰想象三维物体的样子" },
  { id: "SP02", dim: "SP", text: "我对颜色、形状、构图等视觉要素很敏感" },
  { id: "SP03", dim: "SP", text: "我在设计或绘图时有较强的直觉判断" },
  { id: "SP04", dim: "SP", text: "我能快速理解地图、图表、设计稿等视觉信息" },

  { id: "MU01", dim: "MU", text: "我能识别不同的音调、节奏和旋律" },
  { id: "MU02", dim: "MU", text: "我常常在脑中哼曲子，对音乐记忆力强" },
  { id: "MU03", dim: "MU", text: "我对背景音乐、环境声音很敏感" },
  { id: "MU04", dim: "MU", text: "我有演奏乐器或作曲的经历并感到享受" },

  { id: "BK01", dim: "BK", text: "我动手组装或调试设备时感到得心应手" },
  { id: "BK02", dim: "BK", text: "我通过亲手操作来学习效果最好" },
  { id: "BK03", dim: "BK", text: "我对身体协调性要求高的活动有较强表现" },
  { id: "BK04", dim: "BK", text: "精细的手工或硬件操作让我感到满足" },

  { id: "IE01", dim: "IE", text: "我能快速感受到他人的情绪变化" },
  { id: "IE02", dim: "IE", text: "在冲突中我能理解双方的立场并找到平衡点" },
  { id: "IE03", dim: "IE", text: "我擅长调动团队积极性，让人感到被理解" },
  { id: "IE04", dim: "IE", text: "陌生人会很快对我产生信任感" },

  { id: "IA01", dim: "IA", text: "我经常反思自己的行为和决策背后的原因" },
  { id: "IA02", dim: "IA", text: "我对自己的情绪状态有清晰的觉察和理解" },
  { id: "IA03", dim: "IA", text: "我能识别自己的核心价值观并据此做决定" },
  { id: "IA04", dim: "IA", text: "我喜欢独处时的自我探索，如写日记、冥想" },

  { id: "NA01", dim: "NA", text: "我擅长在大量信息中识别规律和分类" },
  { id: "NA02", dim: "NA", text: "我对复杂系统（生态系统、市场结构、代码架构）的整体感知力强" },
  { id: "NA03", dim: "NA", text: "我喜欢整理、归类、建立分类体系" },
  { id: "NA04", dim: "NA", text: "我能快速注意到系统中的异常和不一致之处" },
];

/** 按知识库公式：(原始分 - 4) / 16 × 100 */
export function scoreMi(ans: Record<string, number>): number[] {
  return MI_ORDER.map((d) => {
    const qs = MI_QUESTIONS.filter((q) => q.dim === d);
    const raw = qs.reduce((s, q) => s + (ans[q.id] || 0), 0);
    const normalized = (raw - qs.length) / (qs.length * 4); // 0..1
    return Math.round(Math.max(0, Math.min(1, normalized)) * 100);
  });
}
