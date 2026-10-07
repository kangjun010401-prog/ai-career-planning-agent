import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useApp } from "../store";

declare global {
  interface Window { html2pdf: any }
}

/** 极简 Markdown 渲染，与 Report.tsx 对齐 */
function mdToHtml(text: string): string {
  if (!text) return "";
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = text.split("\n");
  const out: string[] = [];
  let inList = false;
  const flushList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  const inline = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushList(); continue; }
    const h = /^(#{1,4})\s+(.+)$/.exec(line);
    if (h) {
      flushList();
      const level = Math.min(4, h[1].length + 2);
      out.push(`<h${level} style="font-weight:600;margin:8px 0 4px;">${inline(escape(h[2]))}</h${level}>`);
      continue;
    }
    if (/^[-•*]\s+/.test(line)) {
      if (!inList) { out.push('<ul style="padding-left:18px;margin:4px 0;">'); inList = true; }
      out.push(`<li style="margin-bottom:2px;">${inline(escape(line.replace(/^[-•*]\s+/, "")))}</li>`);
      continue;
    }
    flushList();
    out.push(`<p style="margin:4px 0;">${inline(escape(line))}</p>`);
  }
  flushList();
  return out.join("");
}

export default function ReportPreview() {
  const [report, setReport] = useState<any>(null);
  const [polishing, setPolishing] = useState<string | null>(null);
  const [polishResult, setPolishResult] = useState<{ orig: string; polished: string; path: string; style: string } | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  const cachedReport = useApp((s) => s.report);
  const loadReport = useApp((s) => s.loadReport);

  useEffect(() => {
    if (cachedReport) {
      setReport(cachedReport);
    } else {
      loadReport().then((r) => { if (r) setReport(r); });
    }
    // lazy load html2pdf from CDN
    if (!document.getElementById("html2pdf-script")) {
      const s = document.createElement("script");
      s.id = "html2pdf-script";
      s.src = "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js";
      document.head.appendChild(s);
    }
  }, []);

  const polish = async (path: string, style: "专业" | "亲切") => {
    const orig = pick(report, path);
    setPolishing(path);
    const r = await api.polish(orig, style);
    setPolishing(null);
    setPolishResult({ orig, polished: r.polished, path, style });
  };

  const replacePolish = async () => {
    if (!polishResult) return;
    const next = structuredClone(report);
    setAt(next, polishResult.path, polishResult.polished);
    setReport(next);
    await api.patchReport(polishResult.path, polishResult.polished);
    setPolishResult(null);
  };

  const exportPDF = () => {
    if (!paperRef.current || !window.html2pdf) return;
    window.html2pdf()
      .set({ margin: 10, filename: "职业发展规划报告.pdf", html2canvas: { scale: 2 }, jsPDF: { unit: "mm", format: "a4" } })
      .from(paperRef.current)
      .save();
  };

  if (!report) return <div className="text-muted">加载中…</div>;

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* A4 paper preview */}
      <div className="col-span-9">
        <div ref={paperRef} className="bg-white shadow-mid mx-auto" style={{ width: 820, padding: 56, minHeight: 1160 }}>
          <div className="flex items-center justify-between border-b border-line pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary" />
              <div>
                <div className="font-semibold">AI 职业规划智能体</div>
                <div className="text-xs text-muted">Report · {new Date().toLocaleDateString()}</div>
              </div>
            </div>
            <div className="text-xs text-muted">ID: {(Math.random().toString(36).slice(2, 8)).toUpperCase()}</div>
          </div>

          <h1 className="mb-6">职业发展规划报告</h1>

          <Section title="一、职业经验总结" path="summaries.experience" onPolish={polish}>
            {report.summaries.experience}
          </Section>
          <Section title="二、个人兴趣总结" path="summaries.interest" onPolish={polish}>
            {report.summaries.interest}
          </Section>
          <Section title="三、岗位情况总结" path="summaries.job" onPolish={polish}>
            {report.summaries.job}
          </Section>

          <h2 className="mt-8 mb-4">四、韦恩三环职业建议</h2>
          {[
            ["venn.foundation", "基石区（经验 ∩ 兴趣）", report.venn.foundation],
            ["venn.stable", "稳定区（经验 ∩ 岗位）", report.venn.stable],
            ["venn.prospect", "前景区（兴趣 ∩ 岗位）", report.venn.prospect],
            ["venn.growth", "发展区（三者交集 · 最佳）", report.venn.growth],
          ].map(([path, title, content]) => (
            <Section key={path as string} title={title as string} path={path as string} onPolish={polish}>
              {content as string}
            </Section>
          ))}

          <h2 className="mt-8 mb-4">五、推荐岗位 TOP 5</h2>
          <table className="w-full text-sm border border-line">
            <thead className="bg-canvas">
              <tr><th className="p-2 text-left">岗位</th><th className="p-2 text-left">行业</th><th className="p-2 text-left">城市</th><th className="p-2">匹配率</th></tr>
            </thead>
            <tbody>
              {report.recommendations.map((r: any) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="p-2 font-medium">{r.name}</td>
                  <td className="p-2 text-muted">{(r.industries || []).join(", ")}</td>
                  <td className="p-2 text-muted">{(r.cities || [])[0] || "—"}</td>
                  <td className="p-2 text-center text-primary font-semibold">{r.match}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Section title="六、分阶段行动计划" path="action_plan" onPolish={polish}>
            {report.action_plan}
          </Section>

          <div className="mt-10 text-xs text-muted text-center">— 本报告由 AI 辅助生成，供参考 —</div>
        </div>
      </div>

      {/* Toolbar */}
      <aside className="col-span-3">
        <div className="card sticky top-20">
          <h3 className="mb-4">报告工具</h3>
          <button className="btn-primary w-full mb-3" onClick={async () => {
            try {
              const token = localStorage.getItem("token") || "";
              const res = await fetch("/api/report/download", {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) throw new Error("下载失败");
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "职业发展规划报告.docx";
              a.click();
              URL.revokeObjectURL(url);
            } catch { alert("导出失败，请先生成报告"); }
          }}>一键导出 Word</button>
        </div>
      </aside>

    </div>
  );
}

function Section({ title, path, children, onPolish }: {
  title: string; path: string; children: React.ReactNode;
  onPolish: (path: string, style: "专业" | "亲切") => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div className="relative mt-6">
      <h3 className="mb-2">{title}</h3>
      <div
        className="text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: mdToHtml(String(children || "")) }}
      />
    </div>
  );
}

function pick(obj: any, path: string) {
  return path.split(".").reduce((a, k) => (a ? a[k] : undefined), obj);
}
function setAt(obj: any, path: string, value: any) {
  const keys = path.split(".");
  let d = obj;
  for (let i = 0; i < keys.length - 1; i++) d = d[keys[i]];
  d[keys[keys.length - 1]] = value;
}
