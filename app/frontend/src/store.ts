import { create } from "zustand";
import { api } from "./api";

type Progress = { resume: string; self: string; plan: string };

interface S {
  username: string;
  avatar: string | null;
  progress: Progress;
  deepJobs: any[] | null;
  deepJobsLoaded: boolean;
  // 缓存：测评结果
  assessments: any | null;
  assessmentsLoaded: boolean;
  // 缓存：职业报告
  report: any | null;
  reportTargetId: string | null;
  // 缓存：岗位列表
  positions: any[] | null;
  setUser: (u: string) => void;
  setAvatar: (a: string) => void;
  refresh: () => Promise<void>;
  loadDeepJobs: () => Promise<void>;
  loadAssessments: () => Promise<any>;
  setAssessments: (a: any) => void;
  loadReport: (targetId?: string) => Promise<any>;
  clearReport: () => void;
  loadPositions: () => Promise<any[]>;
  logout: () => void;
}

export const useApp = create<S>((set, get) => ({
  username: localStorage.getItem("username") || "",
  avatar: null,
  progress: { resume: "待完善", self: "待完善", plan: "未开始" },
  deepJobs: null,
  deepJobsLoaded: false,
  assessments: null,
  assessmentsLoaded: false,
  report: null,
  reportTargetId: null,
  positions: null,
  setUser: (u) => {
    localStorage.setItem("username", u);
    set({ username: u });
  },
  setAvatar: (a) => set({ avatar: a }),
  refresh: async () => {
    const me = await api.me();
    set({ avatar: me.avatar, progress: me.progress });
  },
  loadDeepJobs: async () => {
    if (get().deepJobsLoaded && get().deepJobs !== null) return;
    try {
      const record = await api.getDeepAssessment();
      const names: string[] = record?.answers?.target_jobs || [];
      if (names.length) {
        const results = await api.matchBatch(names);
        set({
          deepJobs: results.filter((r: any) => r.found).map((r: any) => ({
            id: r.id || r.name, name: r.name,
            industries: r.industries || [], cities: r.cities || [],
            salary_range: r.salary_range || [0, 0],
            skills: r.skills || [], match: r.match_score || 0,
          })),
          deepJobsLoaded: true,
        });
      } else {
        set({ deepJobs: [], deepJobsLoaded: true });
      }
    } catch {
      set({ deepJobs: [], deepJobsLoaded: true });
    }
  },
  // ── 测评缓存 ──
  loadAssessments: async () => {
    if (get().assessmentsLoaded && get().assessments !== null) return get().assessments;
    try {
      const r = await api.getAssessments();
      set({ assessments: r, assessmentsLoaded: true });
      return r;
    } catch {
      return null;
    }
  },
  setAssessments: (a) => set({ assessments: a, assessmentsLoaded: true }),
  // ── 报告缓存（按目标岗位 ID） ──
  loadReport: async (targetId?: string) => {
    const tid = targetId || null;
    const cached = get().report;
    const cachedTid = get().reportTargetId;
    // 同一目标岗位且已有缓存 → 直接返回
    if (cached && tid === cachedTid) return cached;
    // 目标岗位变化或无缓存 → 重新生成
    try {
      const r = await api.genReport(tid || undefined);
      set({ report: r, reportTargetId: r?.target_position?.id || tid });
      return r;
    } catch {
      return null;
    }
  },
  clearReport: () => set({ report: null, reportTargetId: null }),
  // ── 岗位列表缓存 ──
  loadPositions: async () => {
    if (get().positions) return get().positions!;
    try {
      const r = await api.listPositions();
      set({ positions: r });
      return r;
    } catch {
      return [];
    }
  },
  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    set({
      username: "", avatar: null,
      progress: { resume: "待完善", self: "待完善", plan: "未开始" },
      deepJobs: null, deepJobsLoaded: false,
      assessments: null, assessmentsLoaded: false,
      report: null, reportTargetId: null,
      positions: null,
    });
  },
}));
