import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { api } from "../api";
import { useApp } from "../store";
import {
  JOB_TAXONOMY, HOT_JOBS,
} from "../data/jobTaxonomy";
import { CHINA_PROVINCES, HOT_CITIES, provinceOfCity } from "../data/chinaCities";

declare global {
  interface Window { html2pdf: any }
}

const AVATAR_EMOJI: Record<string, string> = {
  sport: "⚾", tech: "🔌", surf: "🏄", mic: "🎤",
  stop: "🛑", ball: "🏀", skate: "🛹", time: "⏱️",
};

type Profile = {
  basic: any;
  education: any[];
  internships: any[];
  work_experiences: any[];
  projects: any[];
  experiences: any[];
  works: any[];
  competitions: any[];
  certificates: any[];
  languages: any[];
  self_eval: string;
  socials: any[];
  skills: string[];
  soft_skills: Record<string, number>;
  intent: any;
};

const DEFAULT_SOFT: Record<string, number> = {
  创新能力: 70, 学习能力: 80, 抗压能力: 70, 沟通能力: 75,
};

// 24 小时制，每 30 分钟一个选项，覆盖 06:00-24:00
const HOUR_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 24; h++) {
    out.push(`${String(h === 24 ? 0 : h).padStart(2, "0")}:00`);
    if (h < 24) out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
})();

const DEFAULT_PROFILE: Profile = {
  basic: {},
  education: [],
  internships: [],
  work_experiences: [],
  projects: [],
  experiences: [],
  works: [],
  competitions: [],
  certificates: [],
  languages: [],
  self_eval: "",
  socials: [],
  skills: [],
  soft_skills: DEFAULT_SOFT,
  intent: {},
};

const SECTIONS: { id: string; label: string }[] = [
  { id: "basic", label: "基本信息" },
  { id: "education", label: "教育经历" },
  { id: "internships", label: "实习经历" },
  { id: "work", label: "工作经历" },
  { id: "projects", label: "项目经历" },
  { id: "works", label: "作品" },
  { id: "competitions", label: "竞赛" },
  { id: "certificates", label: "证书" },
  { id: "languages", label: "语言能力" },
  { id: "skills", label: "专业技能" },
  { id: "self_eval", label: "自我评价" },
  { id: "intent", label: "求职意向" },
];

function normalize(p: any): Profile {
  const rawSoft = p?.soft_skills && Object.keys(p.soft_skills).length ? p.soft_skills : DEFAULT_SOFT;
  // Strip legacy keys (e.g. 实习能力 removed from the UI)
  const soft: Record<string, number> = {};
  for (const k of Object.keys(DEFAULT_SOFT)) {
    soft[k] = rawSoft[k] ?? DEFAULT_SOFT[k];
  }
  return { ...DEFAULT_PROFILE, ...(p || {}), soft_skills: soft };
}

type Toast = { msg: string; kind: "ok" | "err" | "info" };

export default function ProfilePage() {
  const [data, setData] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const printableRef = useRef<HTMLDivElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const refresh = useApp((s) => s.refresh);
  const avatar = useApp((s) => s.avatar);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveCount = useRef(0);

  const flash = (msg: string, kind: Toast["kind"] = "ok", ms = 1800) => {
    setToast({ msg, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };

  useEffect(() => {
    // lazy-load html2pdf for resume export
    if (!document.getElementById("html2pdf-script")) {
      const s = document.createElement("script");
      s.id = "html2pdf-script";
      s.src = "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js";
      document.head.appendChild(s);
    }
  }, []);

  const exportResume = () => {
    if (!data?.profile?.basic?.name) {
      flash("请先填写姓名再导出", "err");
      return;
    }
    if (!printableRef.current) {
      flash("导出组件尚未就绪，请稍后再试", "err");
      return;
    }
    const filename = `${data.profile.basic.name || "我的"}-简历.doc`;
    flash("正在生成 Word…", "info", 2000);
    const html = printableRef.current.outerHTML;
    const wordDoc = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8">
        <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
        <style>
          @page { size: A4; margin: 2cm; }
          body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 12pt; color: #091E42; }
        </style>
      </head>
      <body>${html}</body></html>`;
    const blob = new Blob(["\ufeff" + wordDoc], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    flash("已导出 " + filename, "ok", 2200);
  };

  const [loadErr, setLoadErr] = useState("");
  const load = async () => {
    const r = await api.getProfile();
    r.profile = normalize(r.profile);
    setData(r);
  };

  useEffect(() => {
    load()
      .catch((e) => setLoadErr(e.message || "加载失败"));
  }, []);

  const saveFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = async (patch: Partial<Profile>) => {
    await api.putProfile(patch);
    await load();
    await refresh();
    // 防抖：连续保存只在最后一次 800ms 后弹一次提示
    if (saveFlashTimer.current) clearTimeout(saveFlashTimer.current);
    saveFlashTimer.current = setTimeout(() => flash("保存成功 ✓", "ok", 1500), 800);
  };

  const onParsed = async (msg: string) => {
    await load();
    flash(msg, "info", 2800);
  };

  const handleResumeFile = async (f: File) => {
    setUploading(true);
    try {
      const res = await api.uploadResume(f);
      const parsed = res?.parsed || {};
      const name = parsed?.basic?.name;
      const skills = (parsed?.skills || []).length;
      const msg = name
        ? `已解析：${name}${skills ? `，识别 ${skills} 项技能` : ""}`
        : `已上传，识别 ${skills} 项技能`;
      await onParsed(msg);
    } catch {
      flash("解析失败，请检查文件或稍后再试", "err");
    } finally {
      setUploading(false);
      if (resumeInputRef.current) resumeInputRef.current.value = "";
    }
  };

  // Scroll-spy：监听各分段进入视口，高亮左侧导航
  const [activeSection, setActiveSection] = useState(SECTIONS[0]?.id || "");
  const ratioMap = useRef<Record<string, number>>({});
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(`sec-${s.id}`)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id.replace("sec-", "");
          ratioMap.current[id] = e.isIntersecting ? e.intersectionRatio : 0;
        }
        // 找可见比例最大的；都为 0 则取距离顶部最近的已滚过的
        let best = "";
        let bestRatio = 0;
        for (const s of SECTIONS) {
          const r = ratioMap.current[s.id] || 0;
          if (r > bestRatio) { bestRatio = r; best = s.id; }
        }
        if (!best) {
          // 全部不可见时，取 scrollY 最近的上方 section
          const scrollY = window.scrollY + 120;
          for (const s of SECTIONS) {
            const el = document.getElementById(`sec-${s.id}`);
            if (el && el.offsetTop <= scrollY) best = s.id;
          }
        }
        if (best) setActiveSection(best);
      },
      { rootMargin: "-80px 0px -40% 0px", threshold: [0, 0.1, 0.3, 0.5, 0.7, 1] },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [data]);

  if (loadErr) return <div className="text-red-500">加载失败：{loadErr}</div>;
  if (!data) return <div className="text-muted">加载中…</div>;
  const p: Profile = data.profile;

  const scrollTo = (id: string) => {
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {showModal && <ResumeModal onClose={() => setShowModal(false)} onDone={onParsed} />}
      {toast && (
        <div className="fixed top-16 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <div
            className={`px-6 py-2.5 rounded-lg shadow-high text-sm font-medium text-white mt-2 ${
              toast.kind === "err"
                ? "bg-red-500"
                : toast.kind === "info"
                ? "bg-secondary"
                : "bg-primary"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}
      <div className="grid grid-cols-12 gap-6">
        {/* Left nav */}
        <aside className="col-span-2">
          <div className="card p-3 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`block w-full text-left px-3 py-2 rounded text-sm transition-all ${
                  activeSection === s.id
                    ? "bg-blue-50 text-primary font-semibold border-l-2 border-primary"
                    : "text-muted hover:bg-blue-50 hover:text-primary"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Main */}
        <section className="col-span-10 space-y-6">
          {/* Header card */}
          <div className="card flex items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-secondary to-primary text-white text-3xl flex items-center justify-center">{avatar ? (AVATAR_EMOJI[avatar] || "👤") : "👤"}</div>
            <div className="flex-1">
              <div className="text-lg font-semibold">{p.basic?.name || "同学"}</div>
              <div className="text-sm text-muted">
                {p.education?.[0]?.school || "未填写教育背景"}
                {p.education?.[0]?.major ? " · " + p.education[0].major : ""}
              </div>
            </div>
            <Gauge label="简历完整度" value={data.completeness} color="#0052CC" />
            <Gauge label="就业竞争力" value={data.competitiveness.score} color="#36B37E" />
            <div className="text-xs text-muted max-w-[180px]">{data.competitiveness.comment}</div>
          </div>

          {/* 上传简历引导 */}
          <div className="card flex items-center gap-6 bg-blue-50/60 border border-blue-100">
            <div className="text-4xl">📄</div>
            <div className="flex-1">
              <div className="font-semibold text-ink">上传简历，快速填写档案</div>
              <div className="text-sm text-muted mt-1">
                {uploading ? "AI 正在解析，请稍候…" : "支持 PDF / Word 格式，系统将自动解析并填充以下各项信息"}
              </div>
            </div>
            <input
              ref={resumeInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={(e) => e.target.files?.[0] && handleResumeFile(e.target.files[0])}
            />
            <button
              onClick={() => resumeInputRef.current?.click()}
              disabled={uploading}
              className="btn-primary whitespace-nowrap disabled:opacity-60"
            >
              {uploading ? "解析中…" : "上传简历"}
            </button>
          </div>

          <BasicSection profile={p} onSave={save} flash={flash} />
          <EducationSection profile={p} onSave={save} flash={flash} />
          <ExperienceSection
            id="internships" title="实习经历" hint="请填写实习经历"
            listKey="internships" profile={p} onSave={save} flash={flash}
          />
          <ExperienceSection
            id="work" title="工作经历" hint="请填写工作经历"
            listKey="work_experiences" profile={p} onSave={save} flash={flash}
          />
          <ProjectsSection profile={p} onSave={save} flash={flash} />
          <WorksSection profile={p} onSave={save} />
          <CompetitionsSection profile={p} onSave={save} flash={flash} />
          <CertificatesSection profile={p} onSave={save} flash={flash} />
          <LanguagesSection profile={p} onSave={save} flash={flash} />
          <SkillsSection profile={p} onSave={save} />
          <SelfEvalSection profile={p} onSave={save} />
          <IntentSection profile={p} onSave={save} />
          <div className="card flex items-center gap-6 bg-blue-50/60 border border-blue-100 mt-6">
            <div className="text-4xl">📝</div>
            <div className="flex-1">
              <div className="font-semibold text-ink">导出简历，一键生成 Word</div>
              <div className="text-sm text-muted mt-1">根据你填写的档案信息，自动生成标准格式简历文档</div>
            </div>
            <button onClick={exportResume} className="btn-primary whitespace-nowrap">导出简历</button>
          </div>
        </section>
      </div>

      {/* Off-screen printable resume for PDF export.
          用一个 overflow:hidden 的 wrapper 包住，把可打印区域停在视口左下角外 —
          不用 left:-99999（Safari/Chrome 的 layer culling 有时会让该区域不参与布局，
          导致 html2canvas 拿到的是空白或排版错乱的字形）*/}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <PrintableResume innerRef={printableRef} profile={p} />
      </div>
    </>
  );
}

/* ---------------- printable resume ---------------- */

function PrintableResume({
  innerRef, profile,
}: { innerRef: React.RefObject<HTMLDivElement>; profile: Profile }) {
  const b = profile.basic || {};
  const contact = [
    b.phone && `${b.phone_cc || ""}${b.phone}`,
    b.email,
    b.expected_cities && `期望：${b.expected_cities}`,
  ].filter(Boolean).join(" · ");

  const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 15, fontWeight: 600, color: "#0052CC",
        borderBottom: "2px solid #0052CC", paddingBottom: 4, marginBottom: 10,
      }}>
        {title}
      </div>
      {children}
    </div>
  );

  const period = (s: string, e: string) =>
    [s, e].filter(Boolean).join(" ~ ") || "";

  /** 把换行符转成 <br> 标签，Word 不支持 white-space: pre-wrap */
  const descHtml = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");

  /** 用 table 实现左标题右时间（Word 不支持 flex） */
  const TitleRow = ({ left, right }: { left: React.ReactNode; right: string }) => (
    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 2 }}>
      <tbody><tr>
        <td style={{ fontWeight: 600, fontSize: 14, padding: 0 }}>{left}</td>
        <td style={{ textAlign: "right", fontSize: 13, padding: 0, whiteSpace: "nowrap" }}>{right}</td>
      </tr></tbody>
    </table>
  );

  return (
    <div
      ref={innerRef}
      lang="zh-CN"
      style={{
        width: 820,
        padding: 48,
        background: "#fff",
        color: "#091E42",
        fontFamily: [
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"微软雅黑"',
          '"WenQuanYi Micro Hei"',
          '"Noto Sans CJK SC"',
          '"Noto Sans SC"',
          '"SimHei"',
          '"SimSun"',
          "sans-serif",
        ].join(", "),
        fontSize: 14,
        lineHeight: 1.7,
        fontFeatureSettings: "normal",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* Header */}
      <Block title="基本信息">
        <TitleRow
          left={<span style={{ fontSize: 22 }}>{b.name || "姓名"}</span>}
          right={[b.gender && `性别：${b.gender}`, b.birthday && `出生年月：${b.birthday}`].filter(Boolean).join(" · ")}
        />
        {b.id_type && b.id_no && <div>{b.id_type}：{b.id_no}</div>}
        {b.phone && <div>电话：{b.phone_cc || ""}{b.phone}</div>}
        {b.email && <div>邮箱：{b.email}</div>}
      </Block>

      {profile.education?.length > 0 && (
        <Block title="教育经历">
          {profile.education.map((e: any, i: number) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <TitleRow
                left={<>{[e.school, e.degree, e.college, e.major].filter(Boolean).join(" · ")}</>}
                right={period(e.period_start, e.period_end)}
              />
              {e.direction && (
                <div style={{ fontSize: 13 }}>研究方向：{e.direction}</div>
              )}
              {e.advisor && <div style={{ fontSize: 13 }}>导师：{e.advisor}</div>}
            </div>
          ))}
        </Block>
      )}

      {profile.internships?.length > 0 && (
        <Block title="实习经历">
          {profile.internships.map((e: any, i: number) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <TitleRow
                left={<>{e.company}{e.position ? ` · ${e.position}` : ""}</>}
                right={period(e.period_start, e.period_end)}
              />
              {e.desc && <div style={{ marginTop: 2, fontSize: 13 }} dangerouslySetInnerHTML={{ __html: descHtml(e.desc) }} />}
            </div>
          ))}
        </Block>
      )}

      {profile.work_experiences?.length > 0 && (
        <Block title="工作经历">
          {profile.work_experiences.map((e: any, i: number) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <TitleRow
                left={<>{e.company}{e.position ? ` · ${e.position}` : ""}</>}
                right={period(e.period_start, e.period_end)}
              />
              {e.desc && <div style={{ marginTop: 2, fontSize: 13 }} dangerouslySetInnerHTML={{ __html: descHtml(e.desc) }} />}
            </div>
          ))}
        </Block>
      )}

      {profile.projects?.length > 0 && (
        <Block title="项目经历">
          {profile.projects.map((e: any, i: number) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <TitleRow
                left={<>{e.name}{e.role ? ` · ${e.role}` : ""}</>}
                right={period(e.period_start, e.period_end)}
              />
              {e.link && <div style={{ color: "#0052CC", fontSize: 13 }}>{e.link}</div>}
              {e.desc && <div style={{ marginTop: 2, fontSize: 13 }} dangerouslySetInnerHTML={{ __html: descHtml(e.desc) }} />}
            </div>
          ))}
        </Block>
      )}

      {profile.skills?.length > 0 && (
        <Block title="专业技能">
          <div>{profile.skills.join(" · ")}</div>
        </Block>
      )}

      {profile.soft_skills && Object.keys(profile.soft_skills).length > 0 && (
        <Block title="软技能">
          <div>{Object.entries(profile.soft_skills)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([k, v]) => `${k}（${v}/100）`)
            .join(" · ")}</div>
        </Block>
      )}

      {profile.competitions?.length > 0 && (
        <Block title="竞赛">
          {profile.competitions.map((e: any, i: number) => (
            <div key={i}>
              • {e.name}{e.desc ? `：${e.desc}` : ""}
            </div>
          ))}
        </Block>
      )}

      {profile.certificates?.length > 0 && (
        <Block title="证书">
          {profile.certificates.map((e: any, i: number) => (
            <div key={i}>
              • {e.name}{e.desc ? `：${e.desc}` : ""}
            </div>
          ))}
        </Block>
      )}

      {profile.languages?.length > 0 && (
        <Block title="语言能力">
          <div>
            {profile.languages.map((l: any) =>
              `${l.language || ""}（${l.proficiency || ""}）`).join("  ")}
          </div>
        </Block>
      )}

      {profile.works?.length > 0 && (
        <Block title="作品">
          {profile.works.map((e: any, i: number) => (
            <div key={i} style={{ marginBottom: 4 }}>
              {e.link && <div style={{ color: "#0052CC" }}>{e.link}</div>}
              {e.desc && <div>{e.desc}</div>}
            </div>
          ))}
        </Block>
      )}

      {profile.self_eval && (
        <Block title="自我评价">
          <div style={{ whiteSpace: "pre-wrap" }}>{profile.self_eval}</div>
        </Block>
      )}

      {false && profile.socials?.length > 0 && (
        <Block title="社交账号">
          {profile.socials.map((s: any, i: number) => (
            <div key={i}>{s.platform}：{s.url}</div>
          ))}
        </Block>
      )}

      {(profile.intent?.jobs?.length || profile.intent?.job || profile.intent?.cities?.length || profile.intent?.city) && (
        <Block title="求职意向">
          {(profile.intent.jobs?.length || profile.intent.job) && (
            <div>岗位：{profile.intent.jobs?.length ? profile.intent.jobs.join("、") : profile.intent.job}</div>
          )}
          {(profile.intent.cities?.length || profile.intent.city) && (
            <div>意向城市：{profile.intent.cities?.length ? profile.intent.cities.join("、") : profile.intent.city}</div>
          )}
          {(profile.intent.salary_min || profile.intent.salary_max) && (
            <div>期望月薪：{[profile.intent.salary_min && `${profile.intent.salary_min} 元`, profile.intent.salary_max && `${profile.intent.salary_max} 元`].filter(Boolean).join(" ~ ")}</div>
          )}
          {profile.intent.work_time && <div>工作时间：{profile.intent.work_time}</div>}
          {profile.intent.env && <div>工作环境：{profile.intent.env}</div>}
        </Block>
      )}
    </div>
  );
}

function ExperienceRow({ item }: { item: any }) {
  const period = [item.period_start, item.period_end].filter(Boolean).join(" ~ ");
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 600 }}>
          {item.company}{item.position ? ` · ${item.position}` : ""}
        </div>
        <div style={{ color: "#6B778C" }}>{period}</div>
      </div>
      {item.desc && <div style={{ whiteSpace: "pre-wrap", marginTop: 2 }}>{item.desc}</div>}
    </div>
  );
}

/* ---------------- shared building blocks ---------------- */

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  const opt = useMemo(() => ({
    series: [{
      type: "gauge", startAngle: 200, endAngle: -20, min: 0, max: 100,
      radius: "100%", axisLine: { lineStyle: { width: 8, color: [[value / 100, color], [1, "#eee"]] } },
      pointer: { show: false },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      detail: { valueAnimation: true, fontSize: 20, offsetCenter: [0, "0%"], formatter: "{value}", color },
      data: [{ value }],
    }],
  }), [value, color]);
  return (
    <div className="w-28 text-center">
      <ReactECharts option={opt} style={{ height: 90 }} />
      <div className="text-xs text-muted -mt-2">{label}</div>
    </div>
  );
}

function Section({
  id, title, hint, children, onLeave,
}: { id: string; title: string; hint: string; children: React.ReactNode; onLeave?: () => void }) {
  return (
    <div
      id={`sec-${id}`}
      className="card p-0 overflow-hidden scroll-mt-20"
      onBlur={(e) => {
        // 只在焦点离开整个 Section 时触发保存
        if (onLeave && !e.currentTarget.contains(e.relatedTarget as Node)) {
          onLeave();
        }
      }}
    >
      <div className="grid grid-cols-[200px_1fr]">
        <div className="p-6 border-r border-line">
          <h3 className="font-semibold">{title}</h3>
          <div className="w-8 h-0.5 bg-primary mt-2 mb-3"></div>
          <p className="text-xs text-muted">{hint}</p>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <div className="text-sm mb-1 text-muted">
      {text}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </div>
  );
}

function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <Label text={label} required={required} />
      {children}
    </div>
  );
}

type Flash = (msg: string, kind?: "ok" | "err" | "info", ms?: number) => void;

/** Validate required fields. Return first missing label or empty string. */
function firstMissing(
  obj: any,
  fields: { key: string; label: string }[],
): string {
  for (const f of fields) {
    const v = obj?.[f.key];
    if (v === undefined || v === null || v === "" ||
        (Array.isArray(v) && v.length === 0)) {
      return f.label;
    }
  }
  return "";
}

function AddBtn({ onClick, label = "添加" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="text-primary text-sm mt-2 hover:underline"
    >
      ＋ {label}
    </button>
  );
}

function EndDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isNow = value === "至今";
  return (
    <div className="flex gap-2 items-center flex-1">
      <input
        className="input"
        type="month"
        value={isNow ? "" : (value || "")}
        disabled={isNow}
        onChange={(x) => onChange(x.target.value)}
      />
      <label className="flex items-center gap-1 text-sm text-muted whitespace-nowrap cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isNow}
          onChange={(x) => onChange(x.target.checked ? "至今" : "")}
        />
        至今
      </label>
    </div>
  );
}

function DelBtn({ onClick }: { onClick: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setConfirming(true)}
        className="text-muted hover:text-red-500 text-sm" title="删除">
        🗑 删除
      </button>
      {confirming && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-high p-6 w-full max-w-sm text-center">
            <div className="text-lg font-semibold mb-2">确认删除</div>
            <p className="text-sm text-muted mb-6">删除后不可恢复，确定要删除吗？</p>
            <div className="flex gap-3 justify-center">
              <button className="btn-secondary" onClick={() => setConfirming(false)}>取消</button>
              <button
                className="bg-red-500 text-white px-5 py-2.5 rounded font-medium hover:bg-red-600 transition"
                onClick={() => { setConfirming(false); onClick(); }}
              >
                确定删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- sections ---------------- */

function BasicSection({ profile, onSave, flash }: { profile: any; onSave: any; flash: Flash }) {
  const [b, setB] = useState<any>(profile.basic || {});
  useEffect(() => setB(profile.basic || {}), [profile.basic]);
  const set = (k: string, v: any) => setB({ ...b, [k]: v });
  const doSave = () => {
    const miss = firstMissing(b, [
      { key: "name", label: "姓名" },
      { key: "phone", label: "手机号码" },
      { key: "email", label: "邮箱" },
      { key: "id_no", label: "个人证件号码" },
    ]);
    if (miss) return flash(`请填写「${miss}」`, "err");
    onSave({ basic: b });
  };
  return (
    <Section id="basic" title="基本信息" hint="请填写基本信息" onLeave={doSave}>
      <Field label="姓名" required>
        <input className="input" value={b.name || ""} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="性别">
        <select className="input" value={b.gender || ""} onChange={(e) => set("gender", e.target.value)}>
          <option value="">请选择</option><option>男</option><option>女</option>
        </select>
      </Field>
      <Field label="手机号码" required>
        <div className="flex gap-2">
          <select className="input w-24" value={b.phone_cc || "+86"} onChange={(e) => set("phone_cc", e.target.value)}>
            <option>+86</option><option>+852</option><option>+1</option>
          </select>
          <input className="input flex-1" value={b.phone || ""} onChange={(e) => set("phone", e.target.value)} />
        </div>
      </Field>
      <Field label="邮箱" required>
        <input className="input" type="email" value={b.email || ""} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="个人证件" required>
        <div className="flex gap-2">
          <select className="input w-40" value={b.id_type || "中国 - 居民身份证"} onChange={(e) => set("id_type", e.target.value)}>
            <option>中国 - 居民身份证</option>
            <option>港澳居民通行证</option>
            <option>台湾居民通行证</option>
            <option>护照</option>
          </select>
          <input className="input flex-1" value={b.id_no || ""} onChange={(e) => set("id_no", e.target.value)} />
        </div>
      </Field>
    </Section>
  );
}

function EducationSection({ profile, onSave, flash }: { profile: any; onSave: any; flash: Flash }) {
  const [list, setList] = useState<any[]>(profile.education || []);
  useEffect(() => setList(profile.education || []), [profile.education]);
  const add = () => setList([...list, {
    period_start: "", period_end: "", degree_type: "", school: "",
    degree: "", college: "", major: "", lab: "", direction: "", advisor: "",
  }]);
  const upd = (i: number, k: string, v: string) => {
    const n = [...list]; n[i] = { ...n[i], [k]: v }; setList(n);
  };
  const del = (i: number) => setList(list.filter((_, j) => j !== i));
  const doSave = () => {
    for (let i = 0; i < list.length; i++) {
      const miss = firstMissing(list[i], [
        { key: "period_start", label: "起始时间" },
        { key: "period_end", label: "结束时间" },
        { key: "degree_type", label: "学历类型" },
        { key: "school", label: "学校名称" },
        { key: "degree", label: "学历" },
        { key: "college", label: "学院" },
        { key: "major", label: "专业" },
      ]);
      if (miss) return flash(`教育经历 第${i + 1}条：请填写「${miss}」`, "err");
    }
    onSave({ education: list });
  };
  return (
    <Section id="education" title="教育经历" hint="请填写教育经历" onLeave={doSave}>
      {list.length === 0 && <div className="text-muted text-sm mb-3">暂无，点击下方「添加」</div>}
      {list.map((e, i) => (
        <div key={i} className="mb-6 pb-4 border-b border-line last:border-0">
          <Field label="起止时间" required>
            <div className="text-xs text-muted mb-1">无准确的毕业时间可填写预计毕业时间</div>
            <div className="flex gap-2 items-center">
              <input className="input" type="month" value={e.period_start || ""} onChange={(x) => upd(i, "period_start", x.target.value)} />
              <span>－</span>
              <EndDateInput value={e.period_end || ""} onChange={(v) => upd(i, "period_end", v)} />
            </div>
          </Field>
          <Field label="学历类型" required>
            <select className="input" value={e.degree_type || ""} onChange={(x) => upd(i, "degree_type", x.target.value)}>
              <option value="">请选择</option>
              <option>海外及港澳台</option><option>统招全日制</option><option>统招非全日制</option><option>自考</option><option>其他</option>
            </select>
          </Field>
          <Field label="学校名称" required>
            <input className="input" value={e.school || ""} onChange={(x) => upd(i, "school", x.target.value)} />
          </Field>
          <Field label="学历" required>
            <select className="input" value={e.degree || ""} onChange={(x) => upd(i, "degree", x.target.value)}>
              <option value="">请选择</option>
              <option>博士</option><option>MBA</option><option>硕士</option><option>本科</option>
              <option>大专</option><option>高中</option><option>专职</option><option>初中</option><option>小学</option><option>其他</option>
            </select>
          </Field>
          <Field label="学院" required>
            <input className="input" value={e.college || ""} onChange={(x) => upd(i, "college", x.target.value)} />
          </Field>
          <Field label="专业" required>
            <input className="input" value={e.major || ""} onChange={(x) => upd(i, "major", x.target.value)} />
          </Field>
          <Field label="实验室">
            <input className="input" value={e.lab || ""} onChange={(x) => upd(i, "lab", x.target.value)} />
          </Field>
          <Field label="领域方向">
            <input className="input" value={e.direction || ""} onChange={(x) => upd(i, "direction", x.target.value)} />
          </Field>
          <Field label="导师">
            <input className="input" value={e.advisor || ""} onChange={(x) => upd(i, "advisor", x.target.value)} />
          </Field>
          <DelBtn onClick={() => del(i)} />
        </div>
      ))}
      <AddBtn onClick={add} />
    </Section>
  );
}

/** 通用经历表单：实习 / 工作共用 */
function ExperienceSection({
  id, title, hint, listKey, profile, onSave, flash,
}: { id: string; title: string; hint: string; listKey: string; profile: any; onSave: any; flash: Flash }) {
  const [list, setList] = useState<any[]>(profile[listKey] || []);
  const [noExp, setNoExp] = useState<boolean>((profile[listKey] || []).length === 0);
  useEffect(() => {
    setList(profile[listKey] || []);
    setNoExp((profile[listKey] || []).length === 0);
  }, [profile, listKey]);
  const add = () => {
    setNoExp(false);
    setList([...list, { company: "", position: "", period_start: "", period_end: "", desc: "" }]);
  };
  const upd = (i: number, k: string, v: string) => {
    const n = [...list]; n[i] = { ...n[i], [k]: v }; setList(n);
  };
  const del = (i: number) => setList(list.filter((_, j) => j !== i));
  const doSave = () => {
    if (!noExp) {
      for (let i = 0; i < list.length; i++) {
        const miss = firstMissing(list[i], [
          { key: "company", label: "公司名称" },
          { key: "position", label: "职位名称" },
          { key: "period_start", label: "起始时间" },
          { key: "period_end", label: "结束时间" },
        ]);
        if (miss) return flash(`${title} 第${i + 1}条：请填写「${miss}」`, "err");
      }
    }
    onSave({ [listKey]: noExp ? [] : list });
  };
  return (
    <Section id={id} title={title} hint={hint} onLeave={doSave}>
      <label className="flex items-center gap-2 mb-4 text-sm">
        <input type="checkbox" checked={noExp}
          onChange={(e) => {
            setNoExp(e.target.checked);
            if (e.target.checked) setList([]);
          }} />
        没有{title.replace("经历", "")}经历
      </label>
      {!noExp && list.map((e, i) => (
        <div key={i} className="mb-6 pb-4 border-b border-line last:border-0">
          <Field label="公司名称" required>
            <input className="input" value={e.company || ""} onChange={(x) => upd(i, "company", x.target.value)} />
          </Field>
          <Field label="职位名称" required>
            <input className="input" value={e.position || ""} onChange={(x) => upd(i, "position", x.target.value)} />
          </Field>
          <Field label="起止时间" required>
            <div className="flex gap-2 items-center">
              <input className="input" type="month" value={e.period_start || ""} onChange={(x) => upd(i, "period_start", x.target.value)} />
              <span>－</span>
              <EndDateInput value={e.period_end || ""} onChange={(v) => upd(i, "period_end", v)} />
            </div>
          </Field>
          <Field label="描述">
            <textarea className="input" rows={6} value={e.desc || ""} onChange={(x) => upd(i, "desc", x.target.value)} />
          </Field>
          <DelBtn onClick={() => del(i)} />
        </div>
      ))}
      {!noExp && <AddBtn onClick={add} />}
    </Section>
  );
}

function ProjectsSection({ profile, onSave, flash }: { profile: any; onSave: any; flash: Flash }) {
  const [list, setList] = useState<any[]>(profile.projects || []);
  useEffect(() => setList(profile.projects || []), [profile.projects]);
  const add = () => setList([...list, { name: "", role: "", period_start: "", period_end: "", link: "", desc: "" }]);
  const upd = (i: number, k: string, v: string) => {
    const n = [...list]; n[i] = { ...n[i], [k]: v }; setList(n);
  };
  const del = (i: number) => setList(list.filter((_, j) => j !== i));
  const doSave = () => {
    for (let i = 0; i < list.length; i++) {
      const miss = firstMissing(list[i], [
        { key: "name", label: "项目名称" },
        { key: "period_start", label: "起始时间" },
        { key: "period_end", label: "结束时间" },
        { key: "desc", label: "描述" },
      ]);
      if (miss) return flash(`项目经历 第${i + 1}条：请填写「${miss}」`, "err");
    }
    onSave({ projects: list });
  };
  return (
    <Section id="projects" title="项目经历" hint="请填写项目经历" onLeave={doSave}>
      {list.length === 0 && <div className="text-muted text-sm mb-3">暂无，点击下方「添加」</div>}
      {list.map((e, i) => (
        <div key={i} className="mb-6 pb-4 border-b border-line last:border-0">
          <Field label="项目名称" required>
            <input className="input" value={e.name || ""} onChange={(x) => upd(i, "name", x.target.value)} />
          </Field>
          <Field label="项目角色">
            <input className="input" value={e.role || ""} onChange={(x) => upd(i, "role", x.target.value)} />
          </Field>
          <Field label="起止时间" required>
            <div className="flex gap-2 items-center">
              <input className="input" type="month" value={e.period_start || ""} onChange={(x) => upd(i, "period_start", x.target.value)} />
              <span>－</span>
              <EndDateInput value={e.period_end || ""} onChange={(v) => upd(i, "period_end", v)} />
            </div>
          </Field>
          <Field label="项目链接">
            <input className="input" value={e.link || ""} onChange={(x) => upd(i, "link", x.target.value)} />
          </Field>
          <Field label="描述" required>
            <textarea className="input" rows={6} value={e.desc || ""} onChange={(x) => upd(i, "desc", x.target.value)} />
          </Field>
          <DelBtn onClick={() => del(i)} />
        </div>
      ))}
      <AddBtn onClick={add} />
    </Section>
  );
}

function WorksSection({ profile, onSave }: any) {
  const [list, setList] = useState<any[]>(profile.works || []);
  useEffect(() => setList(profile.works || []), [profile.works]);
  const add = () => setList([...list, { link: "", attachment: null, desc: "" }]);
  const upd = (i: number, k: string, v: any) => {
    const n = [...list]; n[i] = { ...n[i], [k]: v }; setList(n);
  };
  const del = (i: number) => setList(list.filter((_, j) => j !== i));
  return (
    <Section id="works" title="作品" hint="请展示作品" onLeave={() => onSave({ works: list })}>
      {list.length === 0 && <div className="text-muted text-sm mb-3">暂无，点击下方「添加」</div>}
      {list.map((e, i) => (
        <div key={i} className="mb-6 pb-4 border-b border-line last:border-0">
          <Field label="作品链接">
            <input className="input" value={e.link || ""} onChange={(x) => upd(i, "link", x.target.value)} />
          </Field>
          <Field label="作品附件">
            <FileUploadField
              value={e.attachment}
              onChange={(v) => upd(i, "attachment", v)}
            />
          </Field>
          <Field label="描述">
            <textarea className="input" rows={6} value={e.desc || ""} onChange={(x) => upd(i, "desc", x.target.value)} />
          </Field>
          <DelBtn onClick={() => del(i)} />
        </div>
      ))}
      <AddBtn onClick={add} />
    </Section>
  );
}

/** 文件上传组件：支持点击选择 + 拖拽上传，上传后显示文件名和下载链接 */
function FileUploadField({
  value,
  onChange,
}: {
  value: any; // null | { filename, url, size }
  onChange: (v: any) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const doUpload = async (file: File) => {
    if (file.size > 300 * 1024 * 1024) {
      setErr("文件大小超过 300MB 限制");
      return;
    }
    setUploading(true);
    setErr("");
    try {
      const res = await api.uploadFile(file);
      onChange({ filename: res.filename, url: res.url, size: res.size });
    } catch (e: any) {
      setErr(e?.message || "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) doUpload(file);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  };

  // 已上传状态
  if (value?.url) {
    return (
      <div className="border border-line rounded p-4 flex items-center gap-3">
        <div className="text-2xl">📎</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{value.filename}</div>
          <div className="text-xs text-muted">{value.size ? formatSize(value.size) : ""}</div>
        </div>
        <a
          href={value.url}
          target="_blank"
          rel="noreferrer"
          className="text-primary text-sm hover:underline whitespace-nowrap"
        >
          下载
        </a>
        <button
          type="button"
          className="text-muted hover:text-red-500 text-sm"
          onClick={() => onChange(null)}
        >
          移除
        </button>
      </div>
    );
  }

  // 未上传 / 上传中
  return (
    <label
      className={`block border-2 border-dashed rounded p-6 text-center cursor-pointer transition ${
        dragOver
          ? "border-primary bg-blue-50"
          : "border-line hover:border-primary hover:bg-blue-50/30"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="text-3xl mb-2">{uploading ? "⏳" : "📁"}</div>
      <div className="text-sm text-muted">
        {uploading
          ? "正在上传…"
          : dragOver
          ? "松开鼠标上传文件"
          : "将文件拖拽至此处，或点击选择文件"}
      </div>
      <div className="text-xs text-muted mt-1">支持 PDF / Word / 图片 / 压缩包等，最大 300MB</div>
      {err && <div className="text-xs text-red-500 mt-2">{err}</div>}
      <input
        type="file"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) doUpload(file);
        }}
      />
    </label>
  );
}

function CompetitionsSection({ profile, onSave, flash }: { profile: any; onSave: any; flash: Flash }) {
  const [list, setList] = useState<any[]>(profile.competitions || []);
  useEffect(() => setList(profile.competitions || []), [profile.competitions]);
  const add = () => setList([...list, { name: "", desc: "" }]);
  const upd = (i: number, k: string, v: string) => {
    const n = [...list]; n[i] = { ...n[i], [k]: v }; setList(n);
  };
  const del = (i: number) => setList(list.filter((_, j) => j !== i));
  const doSave = () => {
    for (let i = 0; i < list.length; i++) {
      if (!list[i].name) return flash(`竞赛 第${i + 1}条：请填写「竞赛名称」`, "err");
    }
    onSave({ competitions: list });
  };
  return (
    <Section id="competitions" title="竞赛" hint="请填写竞赛记录" onLeave={doSave}>
      {list.length === 0 && <div className="text-muted text-sm mb-3">暂无，点击下方「添加」</div>}
      {list.map((e, i) => (
        <div key={i} className="mb-6 pb-4 border-b border-line last:border-0">
          <Field label="竞赛名称" required>
            <input className="input" value={e.name || ""} onChange={(x) => upd(i, "name", x.target.value)} />
          </Field>
          <Field label="描述">
            <textarea className="input" rows={6} value={e.desc || ""} onChange={(x) => upd(i, "desc", x.target.value)} />
          </Field>
          <DelBtn onClick={() => del(i)} />
        </div>
      ))}
      <AddBtn onClick={add} />
    </Section>
  );
}

function CertificatesSection({ profile, onSave, flash }: { profile: any; onSave: any; flash: Flash }) {
  const [list, setList] = useState<any[]>(profile.certificates || []);
  useEffect(() => setList(profile.certificates || []), [profile.certificates]);
  const add = () => setList([...list, { name: "", desc: "" }]);
  const upd = (i: number, k: string, v: string) => {
    const n = [...list]; n[i] = { ...n[i], [k]: v }; setList(n);
  };
  const del = (i: number) => setList(list.filter((_, j) => j !== i));
  const doSave = () => {
    for (let i = 0; i < list.length; i++) {
      if (!list[i].name) return flash(`证书 第${i + 1}条：请填写「证书名称」`, "err");
    }
    onSave({ certificates: list });
  };
  return (
    <Section id="certificates" title="证书" hint="请展示证书" onLeave={doSave}>
      {list.length === 0 && <div className="text-muted text-sm mb-3">暂无，点击下方「添加」</div>}
      {list.map((e, i) => (
        <div key={i} className="mb-6 pb-4 border-b border-line last:border-0">
          <Field label="证书名称" required>
            <input className="input" value={e.name || ""} onChange={(x) => upd(i, "name", x.target.value)} />
          </Field>
          <Field label="描述">
            <textarea className="input" rows={6} value={e.desc || ""} onChange={(x) => upd(i, "desc", x.target.value)} />
          </Field>
          <DelBtn onClick={() => del(i)} />
        </div>
      ))}
      <AddBtn onClick={add} />
    </Section>
  );
}

function LanguagesSection({ profile, onSave, flash }: { profile: any; onSave: any; flash: Flash }) {
  const [list, setList] = useState<any[]>(profile.languages || []);
  useEffect(() => setList(profile.languages || []), [profile.languages]);
  const add = () => setList([...list, { language: "", proficiency: "" }]);
  const upd = (i: number, k: string, v: string) => {
    const n = [...list]; n[i] = { ...n[i], [k]: v }; setList(n);
  };
  const del = (i: number) => setList(list.filter((_, j) => j !== i));
  const doSave = () => {
    for (let i = 0; i < list.length; i++) {
      const miss = firstMissing(list[i], [
        { key: "language", label: "语言" },
        { key: "proficiency", label: "精通程度" },
      ]);
      if (miss) return flash(`语言能力 第${i + 1}条：请填写「${miss}」`, "err");
    }
    onSave({ languages: list });
  };
  return (
    <Section id="languages" title="语言能力" hint="请填写语言能力" onLeave={doSave}>
      {list.length === 0 && <div className="text-muted text-sm mb-3">暂无，点击下方「添加」</div>}
      {list.map((e, i) => (
        <div key={i} className="mb-6 pb-4 border-b border-line last:border-0">
          <Field label="语言" required>
            <select className="input" value={e.language || ""} onChange={(x) => upd(i, "language", x.target.value)}>
              <option value="">请选择</option>
              <option>英语</option><option>粤语</option>
              <option>日语</option><option>韩语</option><option>法语</option>
              <option>德语</option><option>西班牙语</option>
            </select>
          </Field>
          <Field label="精通程度" required>
            <select className="input" value={e.proficiency || ""} onChange={(x) => upd(i, "proficiency", x.target.value)}>
              <option value="">请选择</option>
              <option>入门</option><option>日常会话</option><option>商务会话</option>
              <option>无障碍沟通</option><option>母语</option>
            </select>
          </Field>
          <DelBtn onClick={() => del(i)} />
        </div>
      ))}
      <AddBtn onClick={add} />
    </Section>
  );
}

function SkillsSection({ profile, onSave }: any) {
  const [skills, setSkills] = useState<string[]>(profile.skills || []);
  const [soft, setSoft] = useState<Record<string, number>>(profile.soft_skills || DEFAULT_SOFT);
  const [input, setInput] = useState("");
  useEffect(() => {
    setSkills(profile.skills || []);
    setSoft(profile.soft_skills || DEFAULT_SOFT);
  }, [profile.skills, profile.soft_skills]);

  const radar = {
    radar: {
      indicator: Object.keys(soft).map((k) => ({ name: k, max: 100 })),
      radius: "65%",
      axisName: { color: "#6B778C" },
    },
    series: [{
      type: "radar",
      data: [{
        value: Object.values(soft), name: "我的软技能",
        areaStyle: { color: "rgba(0,82,204,0.2)" },
        lineStyle: { color: "#0052CC" }, symbol: "circle",
      }],
    }],
  };

  return (
    <Section id="skills" title="专业技能" hint="技能标签 + 软技能评分" onLeave={() => onSave({ skills, soft_skills: soft })}>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7">
          <Label text="专业技能（输入后回车添加）" />
          <div className="flex flex-wrap gap-2 mb-3">
            {skills.map((s, i) => (
              <span key={i} className="tag">
                {s}
                <button className="ml-1 text-muted" onClick={() => setSkills(skills.filter((_, j) => j !== i))}>×</button>
              </span>
            ))}
          </div>
          <input className="input" placeholder="如 Python / React / SQL" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                setSkills([...skills, input.trim()]); setInput("");
              }
            }}
          />

          <div className="text-sm text-muted mt-6 mb-2">软技能评分 (0-100)</div>
          {Object.entries(soft).map(([k, v]) => (
            <label key={k} className="flex items-center gap-3 mb-2">
              <span className="w-20 text-sm">{k}</span>
              <input type="range" min={0} max={100} value={v}
                onChange={(e) => setSoft({ ...soft, [k]: +e.target.value })}
                className="flex-1" />
              <span className="w-10 text-right text-sm">{v}</span>
            </label>
          ))}
        </div>
        <div className="col-span-5">
          <ReactECharts option={radar} style={{ height: 320 }} />
        </div>
      </div>
    </Section>
  );
}

function SelfEvalSection({ profile, onSave }: any) {
  const [text, setText] = useState<string>(profile.self_eval || "");
  useEffect(() => setText(profile.self_eval || ""), [profile.self_eval]);
  return (
    <Section id="self_eval" title="自我评价" hint="请填写自我评价" onLeave={() => onSave({ self_eval: text })}>
      <Field label="自我评价">
        <textarea className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
    </Section>
  );
}

function SocialsSection({ profile, onSave, flash }: { profile: any; onSave: any; flash: Flash }) {
  const [list, setList] = useState<any[]>(profile.socials || []);
  useEffect(() => setList(profile.socials || []), [profile.socials]);
  const add = () => setList([...list, { platform: "", url: "" }]);
  const upd = (i: number, k: string, v: string) => {
    const n = [...list]; n[i] = { ...n[i], [k]: v }; setList(n);
  };
  const del = (i: number) => setList(list.filter((_, j) => j !== i));
  const doSave = () => {
    for (let i = 0; i < list.length; i++) {
      const miss = firstMissing(list[i], [
        { key: "platform", label: "社交平台" },
        { key: "url", label: "URL / ID" },
      ]);
      if (miss) return flash(`社交账号 第${i + 1}条：请填写「${miss}」`, "err");
    }
    onSave({ socials: list });
  };
  return (
    <Section id="socials" title="社交账号" hint="请填写社交账号" onLeave={doSave}>
      {list.length === 0 && <div className="text-muted text-sm mb-3">暂无，点击下方「添加」</div>}
      {list.map((e, i) => (
        <div key={i} className="mb-6 pb-4 border-b border-line last:border-0">
          <Field label="社交平台" required>
            <select className="input" value={e.platform || ""} onChange={(x) => upd(i, "platform", x.target.value)}>
              <option value="">请选择</option>
              <option>GitHub</option><option>LinkedIn</option>
              <option>掘金</option><option>知乎</option>
              <option>微博</option><option>个人博客</option>
            </select>
          </Field>
          <Field label="URL / ID" required>
            <input className="input" value={e.url || ""} onChange={(x) => upd(i, "url", x.target.value)} />
          </Field>
          <DelBtn onClick={() => del(i)} />
        </div>
      ))}
      <AddBtn onClick={add} />
    </Section>
  );
}

function IntentSection({ profile, onSave }: any) {
  const [v, setV] = useState<any>(profile.intent || {});
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  useEffect(() => {
    const init: any = { ...(profile.intent || {}) };
    // 兼容旧数据：把单一 city 迁移到 cities 数组
    if (!Array.isArray(init.cities)) {
      init.cities = init.city ? [init.city] : [];
    }
    // 兼容旧数据：把单一 job 迁移到 jobs 数组
    if (!Array.isArray(init.jobs)) {
      init.jobs = init.job ? [init.job] : [];
    }
    setV(init);
  }, [profile.intent]);
  const set = (k: string, x: any) => setV({ ...v, [k]: x });
  const cities: string[] = v.cities || [];
  const jobs: string[] = v.jobs || [];
  const toggleJob = (j: string) => {
    const next = jobs.includes(j) ? jobs.filter((x) => x !== j) : [...jobs, j];
    setV({ ...v, jobs: next, job: next[0] || "" });
  };
  const removeJob = (j: string) => {
    const next = jobs.filter((x) => x !== j);
    setV({ ...v, jobs: next, job: next[0] || "" });
  };
  const toggleCity = (c: string) => {
    const next = cities.includes(c)
      ? cities.filter((x) => x !== c)
      : [...cities, c];
    setV({ ...v, cities: next, city: next[0] || "" });
  };
  const removeCity = (c: string) => {
    const next = cities.filter((x) => x !== c);
    setV({ ...v, cities: next, city: next[0] || "" });
  };
  return (
    <Section id="intent" title="求职意向" hint="填写期望岗位、城市等" onLeave={() => onSave({ intent: v })}>
      <Field label="意向岗位（可多选）">
        <div className="flex gap-2">
          <div className="flex-1">
            {jobs.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {jobs.map((j) => (
                  <span key={j} className="tag">
                    {j}
                    <button className="ml-1 text-muted hover:text-red-500" onClick={() => removeJob(j)}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="text-sm text-muted">{jobs.length === 0 ? "点击右侧按钮选择岗位" : `已选 ${jobs.length} 个岗位`}</div>
          </div>
          <button
            type="button"
            className="btn-secondary whitespace-nowrap self-start"
            onClick={() => setJobPickerOpen(true)}
          >
            浏览岗位库
          </button>
        </div>
      </Field>

      <Field label="意向城市（可多选）">
        <CityPicker selected={cities} onToggle={toggleCity} />
        {cities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {cities.map((c) => (
              <span key={c} className="tag">
                {c}
                <button className="ml-1 text-muted hover:text-red-500" onClick={() => removeCity(c)}>×</button>
              </span>
            ))}
          </div>
        )}
      </Field>
      <Field label="期待月薪 (元)">
        <div className="flex items-center gap-3">
          <input className="input flex-1" type="number" placeholder="最低" value={v.salary_min || ""} onChange={(e) => set("salary_min", +e.target.value)} />
          <span className="text-muted">—</span>
          <input className="input flex-1" type="number" placeholder="最高" value={v.salary_max || ""} onChange={(e) => set("salary_max", +e.target.value)} />
        </div>
      </Field>
      <Field label="可接受工作时间">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-muted mb-1">上班时间</div>
            <select
              className="input"
              value={v.work_start || ""}
              onChange={(e) => set("work_start", e.target.value)}
            >
              <option value="" disabled hidden>请选择</option>
              <option value="">不限</option>
              {HOUR_OPTIONS.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">下班时间</div>
            <select
              className="input"
              value={v.work_end || ""}
              onChange={(e) => set("work_end", e.target.value)}
            >
              <option value="" disabled hidden>请选择</option>
              <option value="">不限</option>
              {HOUR_OPTIONS.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">每周天数</div>
            <select
              className="input"
              value={v.work_days || ""}
              onChange={(e) => set("work_days", e.target.value)}
            >
              <option value="" disabled hidden>请选择</option>
              <option value="不限">不限</option>
              {["一周四天", "一周五天", "一周六天", "一周七天"].map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </div>
        </div>
      </Field>
      <Field label="希望的工作环境（请描述）">
        <textarea className="input" rows={3}
          placeholder="如：开放协作、扁平化管理、技术氛围浓厚、弹性工作制……"
          value={v.env || ""} onChange={(e) => set("env", e.target.value)} />
      </Field>
      {jobPickerOpen && (
        <JobPicker
          selected={jobs}
          onClose={() => setJobPickerOpen(false)}
          onToggle={toggleJob}
        />
      )}
    </Section>
  );
}

/** 省市双列平铺多选器（左侧省份，右侧城市，支持跨省勾选） */
function CityPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (city: string) => void;
}) {
  const [activeProv, setActiveProv] = useState(CHINA_PROVINCES[0].name);
  const activeCities = useMemo(() => {
    const p = CHINA_PROVINCES.find((x) => x.name === activeProv);
    return p ? p.cities : [];
  }, [activeProv]);

  // 每个省当前选中的城市数
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of CHINA_PROVINCES) {
      m[p.name] = p.cities.filter((c) => selected.includes(c)).length;
    }
    return m;
  }, [selected]);

  return (
    <div className="border border-line rounded">
      {/* 热门城市快捷栏 */}
      <div className="px-3 py-2 border-b border-line flex items-center gap-2 flex-wrap text-sm">
        <span className="text-muted">🔥 热门：</span>
        {HOT_CITIES.map((c) => {
          const on = selected.includes(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => onToggle(c)}
              className={`px-2 py-0.5 rounded-full border text-xs transition ${
                on
                  ? "bg-primary text-white border-primary"
                  : "border-line text-muted hover:border-primary hover:text-primary"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* 双列平铺：左省 右市 */}
      <div className="grid grid-cols-[160px_1fr] h-72">
        {/* 省份列 */}
        <div className="border-r border-line overflow-auto">
          {CHINA_PROVINCES.map((p) => {
            const active = activeProv === p.name;
            const count = counts[p.name];
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => setActiveProv(p.name)}
                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${
                  active
                    ? "bg-blue-50 text-primary font-semibold border-l-2 border-primary"
                    : "text-ink hover:bg-gray-50"
                }`}
              >
                <span>{p.name}</span>
                {count > 0 && (
                  <span className="text-xs bg-primary text-white rounded-full px-1.5 py-0.5">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* 城市列 */}
        <div className="p-4 overflow-auto">
          <div className="flex flex-wrap gap-2">
            {activeCities.map((c) => {
              const on = selected.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onToggle(c)}
                  className={`px-3 py-1 rounded border text-sm transition ${
                    on
                      ? "bg-primary text-white border-primary"
                      : "border-line text-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 三级岗位分类选择器（大类 → 子类 → 具体岗位，支持多选） */
function JobPicker({
  selected, onClose, onToggle,
}: {
  selected: string[];
  onClose: () => void;
  onToggle: (job: string) => void;
}) {
  const [activeCat, setActiveCat] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [custom, setCustom] = useState("");

  // 扁平化用于搜索
  const allJobs = useMemo(() => {
    const out: { cat: string; sub: string; job: string }[] = [];
    JOB_TAXONOMY.forEach((c) =>
      c.subs.forEach((s) =>
        s.jobs.forEach((j) => out.push({ cat: c.name, sub: s.name, job: j })),
      ),
    );
    return out;
  }, []);

  const searchResults = useMemo(() => {
    if (!keyword.trim()) return [];
    const k = keyword.trim().toLowerCase();
    return allJobs.filter(
      (x) =>
        x.job.toLowerCase().includes(k) ||
        x.sub.toLowerCase().includes(k) ||
        x.cat.toLowerCase().includes(k),
    ).slice(0, 60);
  }, [keyword, allJobs]);

  const currentCat = JOB_TAXONOMY[activeCat];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-high w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center gap-4">
          <h2 className="flex-1">选择意向岗位</h2>
          <input
            className="input max-w-xs"
            placeholder="搜索岗位，如 Java / 产品经理"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button className="text-muted text-xl" onClick={onClose}>✕</button>
        </div>

        {/* 热门岗位 */}
        {!keyword && (
          <div className="px-6 py-3 border-b border-line flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted">热门岗位：</span>
            {HOT_JOBS.map((j) => {
              const on = selected.includes(j);
              return (
                <button
                  key={j}
                  onClick={() => onToggle(j)}
                  className={`px-3 py-1 rounded-full text-sm border transition ${
                    on
                      ? "bg-primary text-white border-primary"
                      : "border-line text-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  {j}
                </button>
              );
            })}
          </div>
        )}

        {/* 主体：搜索模式 or 浏览模式 */}
        {keyword ? (
          <div className="flex-1 overflow-auto p-6">
            {searchResults.length === 0 ? (
              <div className="text-center text-muted text-sm py-12">
                未找到匹配的岗位，可直接在下方自定义输入
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {searchResults.map((x, i) => {
                  const on = selected.includes(x.job);
                  return (
                    <button
                      key={i}
                      onClick={() => onToggle(x.job)}
                      className={`px-3 py-1.5 rounded border text-sm transition ${
                        on ? "bg-primary text-white border-primary" : "border-line hover:border-primary hover:text-primary"
                      }`}
                      title={`${x.cat} · ${x.sub}`}
                    >
                      {x.job}
                      <span className={`text-xs ml-1 ${on ? "text-blue-100" : "text-muted"}`}>（{x.sub}）</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden grid grid-cols-[200px_1fr]">
            {/* Left: categories */}
            <div className="border-r border-line overflow-auto">
              {JOB_TAXONOMY.map((c, i) => (
                <button
                  key={c.name}
                  onClick={() => setActiveCat(i)}
                  className={`w-full text-left px-5 py-3 text-sm ${
                    activeCat === i
                      ? "bg-blue-50 text-primary font-semibold border-l-2 border-primary"
                      : "text-ink hover:bg-gray-50"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            {/* Right: subcategories */}
            <div className="overflow-auto p-6">
              <div className="text-base font-semibold mb-4">{currentCat.name}</div>
              {currentCat.subs.map((sub) => (
                <div key={sub.name} className="mb-5">
                  <div className="text-sm text-muted mb-2 w-24 inline-block align-top">
                    {sub.name}
                  </div>
                  <div className="inline-block" style={{ width: "calc(100% - 7rem)" }}>
                    <div className="flex flex-wrap gap-2">
                      {sub.jobs.map((j) => {
                        const on = selected.includes(j);
                        return (
                          <button
                            key={j}
                            onClick={() => onToggle(j)}
                            className={`px-3 py-1 rounded text-sm transition ${
                              on
                                ? "bg-primary text-white"
                                : "text-ink hover:text-primary hover:bg-blue-50"
                            }`}
                          >
                            {j}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer: selected + custom input */}
        <div className="px-6 py-4 border-t border-line space-y-3">
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted self-center">已选：</span>
              {selected.map((j) => (
                <span key={j} className="tag">
                  {j}
                  <button className="ml-1 text-muted hover:text-red-500" onClick={() => onToggle(j)}>×</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted whitespace-nowrap">自定义岗位：</span>
            <input
              className="input flex-1"
              placeholder="没找到？在此输入你的意向岗位名"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && custom.trim()) { onToggle(custom.trim()); setCustom(""); }
              }}
            />
            <button
              className="btn-primary"
              disabled={!custom.trim()}
              onClick={() => { if (custom.trim()) { onToggle(custom.trim()); setCustom(""); } }}
            >
              添加
            </button>
            <button className="btn-secondary" onClick={onClose}>完成</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- resume modal ---------------- */

function ResumeModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const upload = async (f: File) => {
    setBusy(true); setErr("");
    try {
      const res = await api.uploadResume(f);
      const parsed = res?.parsed || {};
      const name = parsed?.basic?.name;
      const skills = (parsed?.skills || []).length;
      const msg = name
        ? `已解析：${name}${skills ? `，识别 ${skills} 项技能` : ""}`
        : `已上传，识别 ${skills} 项技能`;
      onDone(msg);
      onClose();
    } catch (e: any) {
      setErr("解析失败，请检查文件或稍后再试");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-high w-full max-w-3xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h2>创建你的学生画像</h2>
          <button className="text-muted" onClick={onClose}>✕</button>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <label className="border-2 border-dashed border-line rounded-lg p-10 text-center cursor-pointer hover:border-primary hover:bg-blue-50 transition">
            <div className="text-5xl mb-3">📄</div>
            <div className="font-semibold">上传 PDF/Word 简历</div>
            <div className="text-xs text-muted mt-2">
              {busy ? "AI 正在解析，请稍候…" : "点击或拖拽文件至此，AI 自动解析后填入各模块"}
            </div>
            {err && <div className="text-xs text-red-500 mt-2">{err}</div>}
            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.md" disabled={busy}
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </label>
          <button onClick={onClose} className="border-2 border-line rounded-lg p-10 text-center hover:border-primary hover:bg-blue-50 transition">
            <div className="text-5xl mb-3">✏️</div>
            <div className="font-semibold">手动填写</div>
            <div className="text-xs text-muted mt-2">按结构引导一步步补全</div>
          </button>
        </div>
      </div>
    </div>
  );
}
