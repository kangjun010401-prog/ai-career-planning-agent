/**
 * 深度自我认识 —— "思索工作的步骤"四步法
 * Step 1 头脑风暴：列出擅长的、喜欢的、追求的
 * Step 2 找交叉点：AI / 规则从 Step1 提炼交集方向
 * Step 3 穷举岗位：根据方向推荐岗位 + 用户补充
 * Step 4 过滤筛选：按追求和现实条件过滤出最终推荐
 */

export type StepId = "step1" | "step2" | "step3" | "step4";

export const STEP_META: Record<StepId, { name: string; desc: string; color: string }> = {
  step1: {
    name: "头脑风暴",
    desc: "列出你擅长的、喜欢的、追求的",
    color: "#FFAB00",
  },
  step2: {
    name: "找交叉点",
    desc: "从三个维度中找到交集方向",
    color: "#DE350B",
  },
  step3: {
    name: "穷举岗位",
    desc: "列举方向下的具体岗位",
    color: "#0052CC",
  },
  step4: {
    name: "过滤筛选",
    desc: "按现实条件筛选出最终推荐",
    color: "#00875A",
  },
};

export const STEP_ORDER: StepId[] = ["step1", "step2", "step3", "step4"];

/** Step1 的三个文本框字段 */
export const STEP1_FIELDS = [
  { key: "good_at" as const, label: "我擅长的", placeholder: "例如：数据分析、写作、沟通协调、编程、组织活动……\n可以是技能、学科、工具，也可以是你觉得自己做得比别人好的事", color: "#0052CC" },
  { key: "like" as const, label: "我喜欢的", placeholder: "例如：解决复杂问题、和人打交道、设计创意方案、研究新技术……\n想想哪些事情让你乐在其中、不觉得累", color: "#DE350B" },
  { key: "pursue" as const, label: "我追求的", placeholder: "例如：高收入、工作自由、社会影响力、稳定安全感、持续成长……\n你希望工作带给你什么？", color: "#00875A" },
] as const;
