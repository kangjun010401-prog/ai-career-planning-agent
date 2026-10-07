const BASE = "/api";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req<T = any>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const r = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts.headers || {}) },
    ...opts,
  });
  if (r.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    if (window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
    throw new Error("未登录或登录已过期");
  }
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || `${r.status} ${r.statusText}`);
  }
  return r.json();
}

export const api = {
  login: (username: string, password: string) =>
    req("/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  register: (username: string, password: string) =>
    req("/register", { method: "POST", body: JSON.stringify({ username, password }) }),
  smsSend: (phone: string) =>
    req("/sms/send", { method: "POST", body: JSON.stringify({ phone }) }),
  smsLogin: (phone: string, code: string) =>
    req("/sms/login", { method: "POST", body: JSON.stringify({ phone, code }) }),
  me: () => req("/me"),
  setAvatar: (avatar: string) =>
    req("/avatar", { method: "POST", body: JSON.stringify({ avatar }) }),

  getProfile: () => req("/profile"),
  putProfile: (body: any) =>
    req("/profile", { method: "PUT", body: JSON.stringify(body) }),
  uploadResume: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(BASE + "/resume/upload", {
      method: "POST",
      body: fd,
      headers: authHeaders(),
    });
    if (r.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      window.location.href = "/login";
      throw new Error("未登录或登录已过期");
    }
    return r.json();
  },

  getAssessments: () => req("/assessment"),
  saveAssessment: (type: string, result: any) =>
    req("/assessment", { method: "POST", body: JSON.stringify({ type, result }) }),
  interpretAssessments: () => req("/assessment/interpret"),
  uploadFile: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/files/upload", {
      method: "POST",
      body: fd,
      headers: authHeaders(),
    });
    if (r.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      window.location.href = "/login";
      throw new Error("未登录或登录已过期");
    }
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(err.detail || "上传失败");
    }
    return r.json();
  },
  getDeepAssessment: () => req("/assessment/deep"),
  submitDeepAssessment: (answers: Record<string, any>) =>
    req("/assessment/deep", { method: "POST", body: JSON.stringify({ answers }) }),
  analyzeStep2: (good_at: string, like: string, pursue: string) =>
    req("/assessment/deep/analyze-step2", {
      method: "POST",
      body: JSON.stringify({ good_at, like, pursue }),
    }),

  listPositions: (q = "") => req(`/positions?q=${encodeURIComponent(q)}`),
  getPosition: (id: string) => req(`/positions/${id}`),
  positionDay: (id: string) => req(`/positions/${id}/typical-day`),
  positionGraph: (id: string) => req(`/positions/${id}/graph`),
  graph: () => req("/graph"),

  recommend: (limit = 10) => req(`/match/recommend?limit=${limit}`),
  match: (id: string) => req(`/match/${id}`),
  matchBatch: (jobNames: string[]) =>
    req("/match/batch", { method: "POST", body: JSON.stringify({ job_names: jobNames }) }),

  genReport: (targetPositionId?: string) =>
    req("/report/generate", {
      method: "POST",
      body: JSON.stringify({ target_position_id: targetPositionId ?? null }),
    }),
  polish: (text: string, style = "专业") =>
    req("/report/polish", { method: "POST", body: JSON.stringify({ text, style }) }),
  patchReport: (path: string, value: any) =>
    req("/report/patch", { method: "POST", body: JSON.stringify({ path, value }) }),
};
