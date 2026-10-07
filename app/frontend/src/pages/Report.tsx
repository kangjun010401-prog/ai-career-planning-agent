import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../store";

/**
 * 极简 Markdown 渲染（只处理报告里常见的语法）：
 *   **bold**           -> <strong>
 *   ### heading        -> <h4>
 *   - bullet           -> <li>
 *   空行                -> 段落分隔
 */
function mdToHtml(text: string): string {
  if (!text) return "";
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = text.split("\n");
  const out: string[] = [];
  let inList = false;
  const flushList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushList(); out.push(""); continue; }
    const h = /^(#{1,4})\s+(.+)$/.exec(line);
    if (h) {
      flushList();
      out.push(`<div class="mt-5 mb-2 text-[13px] font-semibold tracking-wide text-ink/80 uppercase" style="break-after:avoid">${inline(escape(h[2]))}</div>`);
      continue;
    }
    if (/^[-•*]\s+/.test(line)) {
      if (!inList) { out.push('<ul class="space-y-2 my-2" style="break-inside:avoid">'); inList = true; }
      out.push(`<li class="flex gap-2.5 items-start"><span class="mt-[7px] w-1 h-1 rounded-full bg-ink/30 shrink-0"></span><span>${inline(escape(line.replace(/^[-•*]\s+/, "")))}</span></li>`);
      continue;
    }
    flushList();
    out.push(`<p class="mb-2.5">${inline(escape(line))}</p>`);
  }
  flushList();
  return out.join("\n");

  function inline(s: string): string {
    return s
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="bg-ink/5 text-ink/70 px-1.5 py-0.5 rounded text-[12px] font-mono">$1</code>');
  }
}

function Markdown({ children, className, columns }: { children: string; className?: string; columns?: number }) {
  const colStyle = columns ? { columnCount: columns, columnGap: "2rem" } as const : undefined;
  return (
    <div
      className={`text-[13.5px] text-ink/70 leading-[1.8] tracking-[0.01em] ${className || ""}`}
      style={colStyle}
      dangerouslySetInnerHTML={{ __html: mdToHtml(children || "") }}
    />
  );
}

type Region = "foundation" | "stable" | "prospect" | "growth" | null;

const REGION_META: Record<Exclude<Region, null>, { name: string; color: string; desc: string }> = {
  foundation: { name: "基石区", color: "#FFAB00", desc: "个人兴趣 ∩ 职业经验：最易上手、最能获得成就感的领域" },
  stable: { name: "稳定区", color: "#DE350B", desc: "职业经验 ∩ 岗位情况：路径清晰、风险较低" },
  prospect: { name: "前景区", color: "#0052CC", desc: "个人兴趣 ∩ 岗位情况：时代红利与内在热情并存" },
  growth: { name: "发展区", color: "#172B4D", desc: "三者交集 · 最理想的职业落点" },
};

export default function Report() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<Region>(null);
  const [targetId, setTargetId] = useState<string>("");
  const [positions, setPositions] = useState<any[]>([]);
  const nav = useNavigate();
  const refresh = useApp((s) => s.refresh);
  const loadReport = useApp((s) => s.loadReport);
  const clearReport = useApp((s) => s.clearReport);
  const cachedReport = useApp((s) => s.report);
  const loadPositions = useApp((s) => s.loadPositions);
  const deepJobs = useApp((s) => s.deepJobs);
  const loadDeepJobs = useApp((s) => s.loadDeepJobs);
  const [profileEmpty, setProfileEmpty] = useState<boolean | null>(null);

  const generate = (tid?: string, force?: boolean) => {
    setLoading(true);
    if (force) clearReport();
    loadReport(tid).then((r) => {
      if (r) {
        setReport(r);
        if (r?.target_position?.id) setTargetId(r.target_position.id);
      }
      refresh();
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPositions().then(setPositions).catch(() => {});
    loadDeepJobs().catch(() => {});
    // 有缓存直接用
    if (cachedReport) {
      setReport(cachedReport);
      if (cachedReport?.target_position?.id) setTargetId(cachedReport.target_position.id);
      setProfileEmpty(false);
      return;
    }
    api.getProfile().then((data: any) => {
      const c = data?.completeness ?? 0;
      setProfileEmpty(c === 0);
      if (c > 0) generate();
    }).catch(() => setProfileEmpty(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (profileEmpty === null) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (profileEmpty && !report) {
    return (
      <div className="max-w-[1200px] mx-auto mt-16">
        <h1 className="text-2xl font-bold text-ink mb-6">我的报告</h1>
        <div className="p-5 rounded-lg border-l-4 border-warning bg-yellow-50 flex items-center justify-between gap-4">
          <p className="text-sm text-ink/80">
            ⚠ 你还没有在「我的档案」填写任何信息，系统暂时无法生成报告。
            请先去完善简历、求职意向并完成自我认识测评，再回来查看职业发展规划。
          </p>
          <button onClick={() => nav("/profile")} className="btn-ghost text-xs whitespace-nowrap">
            去完善档案 →
          </button>
        </div>
      </div>
    );
  }

  if (loading || !report) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="text-[13px] text-muted tracking-wide">正在生成职业发展规划…</p>
      </div>
    );
  }

  const currentTargetName = report.target_position?.name || "—";

  const SUMMARY_COLS: { key: string; title: string; content: string; color: string; lightBg: string }[] = [
    { key: "experience", title: "职业经验", content: report.summaries.experience, color: "#DE350B", lightBg: "rgba(222,53,11,0.06)" },
    { key: "interest", title: "个人兴趣", content: report.summaries.interest, color: "#FFAB00", lightBg: "rgba(255,171,0,0.08)" },
    { key: "job", title: "岗位情况", content: report.summaries.job, color: "#0052CC", lightBg: "rgba(0,82,204,0.06)" },
  ];

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">
      {/* ── 第一层：核心结论 ── */}
      <div className="bg-white rounded-lg border border-line/60 px-6 py-5 shadow-low">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted tracking-widest uppercase mb-1">目标岗位</p>
            <h1 className="text-2xl font-bold text-ink tracking-tight leading-none">{currentTargetName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="text-[13px] border border-line/80 rounded-md px-3 py-1.5 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 bg-canvas/60 text-ink/70"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">切换岗位…</option>
              {(() => {
                // 意向岗位（来自深入自我认识）
                const deepNames = new Set((deepJobs || []).map((j: any) => j.id || j.name));
                // 推荐岗位（来自匹配）
                const recNames = new Set((report?.recommendations || []).map((r: any) => r.id));
                // 分三组：意向 → 推荐 → 其他
                const intentGroup = positions.filter((p) => deepNames.has(p.id) || deepNames.has(p.name));
                const recGroup = positions.filter((p) => recNames.has(p.id) && !deepNames.has(p.id) && !deepNames.has(p.name));
                const rest = positions.filter((p) => !deepNames.has(p.id) && !deepNames.has(p.name) && !recNames.has(p.id));
                return (
                  <>
                    {intentGroup.length > 0 && <option disabled>── 意向岗位 ──</option>}
                    {intentGroup.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    {recGroup.length > 0 && <option disabled>── 智能推荐 ──</option>}
                    {recGroup.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    <option disabled>── 全部岗位 ──</option>
                    {rest.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </>
                );
              })()}
            </select>
            <button
              className="text-[13px] text-muted hover:text-ink transition px-2 py-1.5"
              onClick={() => generate(targetId, true)}
              disabled={loading}
            >
              重新生成
            </button>
          </div>

          <div className="flex-1" />

          {/* Top5 推荐 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted/70 mr-1">推荐</span>
            {report.recommendations.map((r: any) => (
              <button
                key={r.id}
                className="group inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-[12px] bg-canvas hover:bg-primary/8 border border-line/50 hover:border-primary/30 transition-all"
                onClick={() => nav(`/explore/${r.id}`)}
              >
                <span className="text-ink/70 group-hover:text-ink truncate max-w-[5rem]">{r.name}</span>
                <span className="text-[11px] font-semibold text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full leading-none">{r.match}%</span>
              </button>
            ))}
          </div>
          <button
            className="text-[13px] font-medium text-primary hover:text-primary/80 transition ml-1"
            onClick={() => nav("/report/preview")}
          >
            预览报告 &rarr;
          </button>
        </div>
      </div>

      {/* ── 综合分析总结 ── */}
      <div>
        <div className="inline-flex items-center gap-2 mb-4">
          <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white bg-ink/70">总</span>
          <span className="text-[14px] font-semibold text-ink tracking-tight">综合分析总结</span>
        </div>
        <div className="grid grid-cols-3 gap-5">
          {SUMMARY_COLS.map((col) => (
            <div key={col.key} className="bg-white rounded-lg border border-line/60 shadow-low overflow-hidden flex flex-col">
              <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${col.color}, ${col.color}88)` }} />
              <div className="px-5 pt-4 pb-5 flex-1">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white" style={{ background: col.color }}>{col.title[0]}</span>
                  <span className="text-[14px] font-semibold text-ink tracking-tight">{col.title}</span>
                </div>
                <Markdown>{col.content}</Markdown>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 韦恩图 + 区域建议 ── */}
      <div className="grid grid-cols-12 gap-5 items-stretch">
        <div className="col-span-7 flex">
          <div className="bg-white rounded-lg border border-line/60 p-6 shadow-low flex-1">
            <VennDiagram active={active} onPick={setActive} />
          </div>
        </div>
        <div className="col-span-5 flex flex-col">
          {active ? (
            <div className="bg-white rounded-lg border border-line/60 shadow-low p-5 flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: REGION_META[active].color }} />
                <span className="text-[15px] font-semibold text-ink tracking-tight">{REGION_META[active].name}</span>
                <span className="text-[11px] text-muted ml-auto cursor-pointer hover:text-ink transition" onClick={() => nav("/profile")}>调整档案 &rarr;</span>
              </div>
              <p className="text-[12px] text-muted/80 mb-4 leading-relaxed">{REGION_META[active].desc}</p>
              <div className="border-t border-line/40 pt-4">
                <Markdown>{report.venn[active]}</Markdown>
              </div>
            </div>
          ) : (
            <div className="bg-white/60 rounded-lg border border-dashed border-line flex items-center justify-center flex-1 min-h-[200px]">
              <p className="text-[13px] text-muted/60 select-none">&larr; 点击韦恩图交集区域，查看建议</p>
            </div>
          )}
        </div>
      </div>

      {/* 行动计划 */}
      {(() => {
        const lines = (report.action_plan || "").split("\n");
        let title = "行动计划";
        let startIdx = 0;
        // 提取总标题：### heading 或第一行非空行
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i].trim();
          if (!l) continue;
          const hm = /^#{1,4}\s+(.+)$/.exec(l);
          if (hm) { title = hm[1].replace(/\*\*/g, ""); startIdx = i + 1; break; }
          title = l.replace(/\*\*/g, "");
          startIdx = i + 1;
          break;
        }
        // 按 **粗体标题** 开头的行拆成段落
        const sections: { heading: string; body: string }[] = [];
        let curHeading = "";
        let curLines: string[] = [];
        for (let i = startIdx; i < lines.length; i++) {
          const l = lines[i].trim();
          // 匹配 **xxx** 独占一行（可能带冒号等后缀）
          const bm = /^\*\*(.+?)\*\*(.*)$/.exec(l);
          if (bm && !l.replace(/\*\*(.+?)\*\*/g, "$1").includes("- ")) {
            if (curHeading || curLines.length) sections.push({ heading: curHeading, body: curLines.join("\n") });
            curHeading = bm[1] + (bm[2] || "");
            curLines = [];
          } else {
            curLines.push(lines[i]);
          }
        }
        if (curHeading || curLines.length) sections.push({ heading: curHeading, body: curLines.join("\n") });
        // 过滤掉无标题且无实质内容的空段
        const validSections = sections.filter(s => s.heading || s.body.trim());

        const sectionColors = ["#DE350B", "#FFAB00", "#0052CC"];

        return (
          <div>
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white bg-ink/70">计</span>
              <span className="text-[14px] font-semibold text-ink tracking-tight">{title}</span>
            </div>
            <div className="bg-white rounded-lg border border-line/60 shadow-low overflow-hidden">
              <div className="h-[3px] bg-gradient-to-r from-[#DE350B] via-[#FFAB00] to-[#0052CC]" />
              <div className="px-6 pt-5 pb-6 space-y-5">
                {validSections.map((sec, i) => (
                  <div key={i}>
                    {sec.heading && (
                      <div className="inline-flex items-center gap-2 mb-2">
                        <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white" style={{ background: sectionColors[i % 3] }}>{sec.heading[0]}</span>
                        <span className="text-[14px] font-semibold text-ink tracking-tight">{sec.heading}</span>
                      </div>
                    )}
                    <Markdown>{sec.body}</Markdown>
                    {i < validSections.length - 1 && <div className="border-b border-line/40 mt-4" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

function VennDiagram({ active, onPick }: { active: Region; onPick: (r: Region) => void }) {
  /*
   * 3 个圆用黄 / 红 / 蓝，等边三角形排布（圆心两两距离 = 140）。
   * 半径 r=130，4 个交集的 hotspot 位置经过手动微调，确保：
   *   - foundation (兴趣 ∩ 经验) 落在两圆上半弧的重合区
   *   - prospect   (兴趣 ∩ 岗位) 落在左下弧区
   *   - stable     (经验 ∩ 岗位) 落在右下弧区
   *   - growth     (三者交集)    落在中心
   */
  const W = 560, H = 500;
  const r = 130;
  const circles = [
    { key: "interest", cx: 205, cy: 185, color: "#FFAB00", label: "个人兴趣" },
    { key: "experience", cx: 355, cy: 185, color: "#DE350B", label: "职业经验" },
    { key: "job", cx: 280, cy: 315, color: "#0052CC", label: "岗位情况" },
  ];

  // 交集点（label 位置 & 点击热区）
  const regions: {
    key: Exclude<Region, null>;
    cx: number;
    cy: number;
    label: string;
  }[] = [
    { key: "foundation", cx: 280, cy: 165, label: "基石区" },
    { key: "prospect", cx: 215, cy: 265, label: "前景区" },
    { key: "stable", cx: 345, cy: 265, label: "稳定区" },
    { key: "growth", cx: 280, cy: 230, label: "发展区" },
  ];

  const [cI, cE, cJ] = circles;

  // 一个交集区域 = 用一个圆做填充 + clip-path 裁剪 + mask 排除第三个圆
  type RegionDef = {
    key: Exclude<Region, null>;
    // 铺底用哪个圆（任意一个落在交集内的圆即可）
    baseCx: number;
    baseCy: number;
    // 用哪些 clip-path 来裁剪（内外双层 clip = 两圆交集）
    clips: string[];
    // 还要排除哪个圆（undefined 表示不排除，即三者交集）
    mask?: string;
  };
  const regionDefs: RegionDef[] = [
    // 基石区 = 兴趣 ∩ 经验 ∩ ¬岗位
    { key: "foundation", baseCx: cE.cx, baseCy: cE.cy, clips: ["clip-interest"], mask: "not-job" },
    // 稳定区 = 经验 ∩ 岗位 ∩ ¬兴趣
    { key: "stable", baseCx: cJ.cx, baseCy: cJ.cy, clips: ["clip-experience"], mask: "not-interest" },
    // 前景区 = 兴趣 ∩ 岗位 ∩ ¬经验
    { key: "prospect", baseCx: cJ.cx, baseCy: cJ.cy, clips: ["clip-interest"], mask: "not-experience" },
    // 发展区 = 兴趣 ∩ 经验 ∩ 岗位
    { key: "growth", baseCx: cJ.cx, baseCy: cJ.cy, clips: ["clip-interest", "clip-experience"] },
  ];

  const renderRegion = (def: RegionDef) => {
    const isActive = active === def.key;
    const meta = REGION_META[def.key];
    // 用一个实心圆 + 多层 clip-path 嵌套来得到精确的交集形状
    let node: React.ReactNode = (
      <circle
        cx={def.baseCx}
        cy={def.baseCy}
        r={r}
        fill={meta.color}
        fillOpacity={isActive ? 0.8 : 0.0001}
        style={{ pointerEvents: "all" }}
        className="cursor-pointer transition-opacity"
        onClick={() => onPick(def.key)}
      />
    );
    // 从内到外包装 clip-path（每层 clip 只能作用于单一 <g>）
    for (const clip of def.clips) {
      node = <g clipPath={`url(#${clip})`}>{node}</g>;
    }
    if (def.mask) {
      node = <g mask={`url(#${def.mask})`}>{node}</g>;
    }
    return <g key={def.key}>{node}</g>;
  };

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl">
        <defs>
          {/* 每个圆对应一个 clip-path，后续用它做交集 */}
          <clipPath id="clip-interest"><circle cx={cI.cx} cy={cI.cy} r={r} /></clipPath>
          <clipPath id="clip-experience"><circle cx={cE.cx} cy={cE.cy} r={r} /></clipPath>
          <clipPath id="clip-job"><circle cx={cJ.cx} cy={cJ.cy} r={r} /></clipPath>
          {/* 对应的 "非" 掩码：白色 = 保留，黑色 = 抠掉 */}
          <mask id="not-interest">
            <rect width="100%" height="100%" fill="white" />
            <circle cx={cI.cx} cy={cI.cy} r={r} fill="black" />
          </mask>
          <mask id="not-experience">
            <rect width="100%" height="100%" fill="white" />
            <circle cx={cE.cx} cy={cE.cy} r={r} fill="black" />
          </mask>
          <mask id="not-job">
            <rect width="100%" height="100%" fill="white" />
            <circle cx={cJ.cx} cy={cJ.cy} r={r} fill="black" />
          </mask>
        </defs>

        {/* 3 base circles, 无边框 · 平面填充 · multiply 叠色 */}
        <g style={{ mixBlendMode: "multiply" }}>
          {circles.map((c) => (
            <circle
              key={c.key}
              cx={c.cx}
              cy={c.cy}
              r={r}
              fill={c.color}
              fillOpacity={0.45}
            />
          ))}
        </g>

        {/* Region overlays — 始终存在，active 时整个交集区域高亮 */}
        {regionDefs.map(renderRegion)}

        {/* Circle labels — 放在圆内靠近圆心的"纯区" */}
        {[
          { x: 170, y: 155, text: "个人兴趣" },
          { x: 390, y: 155, text: "职业经验" },
          { x: 280, y: 380, text: "岗位情况" },
        ].map((l) => (
          <text
            key={l.text}
            x={l.x}
            y={l.y}
            fontSize="18"
            fontWeight="700"
            fill="#fff"
            textAnchor="middle"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="0.6"
            paintOrder="stroke"
            style={{ pointerEvents: "none" }}
          >
            {l.text}
          </text>
        ))}

        {/* Intersection labels — 文字浮在高亮层上方，不拦截点击 */}
        {regions.map((region) => (
          <text
            key={region.key}
            x={region.cx}
            y={region.cy + 5}
            fontSize={region.key === "growth" ? "14" : "13"}
            textAnchor="middle"
            fontWeight="700"
            fill="#fff"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="0.5"
            paintOrder="stroke"
            style={{ pointerEvents: "none" }}
          >
            {region.label}
          </text>
        ))}
      </svg>

      <div className="mt-3 flex gap-1.5 flex-wrap justify-center">
        {(Object.keys(REGION_META) as Exclude<Region, null>[]).map((k) => (
          <button
            key={k}
            onClick={() => onPick(k)}
            className="px-3 py-1 rounded-full text-[11px] font-medium tracking-wide border transition-all"
            style={{
              borderColor: active === k ? REGION_META[k].color : "rgba(0,0,0,0.08)",
              background: active === k ? REGION_META[k].color : "rgba(0,0,0,0.02)",
              color: active === k ? "#fff" : "#6B778C",
            }}
          >
            {REGION_META[k].name}
          </button>
        ))}
      </div>
    </div>
  );
}
