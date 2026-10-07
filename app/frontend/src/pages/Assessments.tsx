import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import { api } from "../api";
import { useApp } from "../store";
import {
  HOLLAND_QUESTIONS, HOLLAND_ORDER, HOLLAND_LABELS, scoreHolland, hollandCode,
  MBTI_QUESTIONS, MBTI_DIMS, MBTI_PAIRS, scoreMbti, mbtiType,
  VALUE_QUESTIONS, VALUE_ORDER, VALUE_LABELS, scoreValues,
  MI_QUESTIONS, MI_ORDER, MI_LABELS, scoreMi,
} from "../data/assessmentQuestions";
import { STEP_META, STEP_ORDER, STEP1_FIELDS, type StepId } from "../data/deepQuestions";


type Results = {
  holland?: number[]; multi_intel?: number[]; values?: number[]; mbti?: number[];
};

const HOLLAND_LABEL_LIST = HOLLAND_ORDER.map((k) => HOLLAND_LABELS[k]);
const VALUE_LABEL_LIST = VALUE_ORDER.map((k) => VALUE_LABELS[k]);
const MI_LABEL_LIST = MI_ORDER.map((k) => MI_LABELS[k]);
const MBTI_AXES = MBTI_DIMS.map((d) => MBTI_PAIRS[d]);

type OpenState = { type: string; mode: "quiz" | "direct" } | null;

export default function Assessments() {
  const [r, setR] = useState<Results>({});
  const [open, setOpen] = useState<OpenState>(null);
  const refresh = useApp((s) => s.refresh);
  const loadAssessments = useApp((s) => s.loadAssessments);
  const setAssessments = useApp((s) => s.setAssessments);
  const clearReport = useApp((s) => s.clearReport);

  const load = async () => {
    const data = await loadAssessments();
    if (data) setR(data);
  };
  useEffect(() => { load(); }, []);

  const save = async (type: string, result: any) => {
    await api.saveAssessment(type, result);
    // 重新拉取并更新缓存
    const fresh = await api.getAssessments();
    setAssessments(fresh);
    setR(fresh);
    clearReport(); // 测评变了，报告缓存失效
    await refresh();
    setOpen(null);
  };

  const cards = [
    { key: "holland", icon: "🎯", title: "霍兰德职业兴趣 (RIASEC)", desc: "60 题 · 识别你的兴趣倾向" },
    { key: "multi_intel", icon: "🧠", title: "多元智能分析", desc: "32 题 · 识别你的 8 种优势智能" },
    { key: "values", icon: "⚖️", title: "工作价值观分析", desc: "30 题 · 10 个维度的深层驱动" },
    { key: "mbti", icon: "🔮", title: "MBTI 人格类型", desc: "40 题 · 16 型人格的工作风格" },
  ];

  return (
    <div>
      <h1 className="mb-2">自我认识测评</h1>
      <p className="text-muted mb-8">完成以下测评，帮助 AI 更精准地理解你。</p>

      <div className="grid grid-cols-2 gap-6">
        {cards.map((c) => {
          const done = !!r[c.key as keyof Results];
          return (
            <div key={c.key} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">{c.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{c.title}</div>
                  <p className="text-xs text-muted mt-0.5">{c.desc}</p>
                </div>
                {done ? <span className="tag-ok">已完成</span> : <span className="tag-warn">待完成</span>}
              </div>

              {done && c.key === "holland" && <HollandChart data={r.holland} />}
              {done && c.key === "multi_intel" && <BarChart labels={MI_LABEL_LIST} data={r.multi_intel} />}
              {done && c.key === "values" && <BarChart labels={VALUE_LABEL_LIST} data={r.values} horizontal />}
              {done && c.key === "mbti" && <MBTIBars data={r.mbti} />}

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setOpen({ type: c.key, mode: "quiz" })}
                  className={`${done ? "btn-secondary" : "btn-primary"} flex-1 text-sm py-2`}
                >
                  {done ? "重新测评" : "去测评"}
                </button>
                <button
                  onClick={() => setOpen({ type: c.key, mode: "direct" })}
                  className="btn-secondary flex-1 text-sm py-2"
                  title="已知结果时直接填写"
                >
                  去填写
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <InterpretationCard results={r} />
      <DeepSelfCard />

      {open && open.mode === "quiz" && (
        <AssessmentModal
          type={open.type}
          onClose={() => setOpen(null)}
          onSave={(v) => save(open.type, v)}
        />
      )}
      {open && open.mode === "direct" && (
        <DirectFillModal
          type={open.type}
          initial={r[open.type as keyof Results]}
          onClose={() => setOpen(null)}
          onSave={(v) => save(open.type, v)}
        />
      )}
    </div>
  );
}

/* ---------------- 自我认识解析 ---------------- */

function InterpretationCard({ results }: { results: Results }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const doneCount = (["holland", "multi_intel", "values", "mbti"] as const)
    .filter((k) => !!results[k]).length;

  const generate = async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await api.interpretAssessments();
      setData(r);
    } catch (e: any) {
      setErr(e?.message || "生成失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card mt-8">
      <div className="flex items-start gap-4">
        <div className="text-4xl">📝</div>
        <div className="flex-1">
          <h3>自我认识解析</h3>
          <p className="text-sm text-muted mt-1">
            AI 基于你的测评结果生成综合画像，帮你更全面地理解自己
            （已完成 <span className="text-primary font-semibold">{doneCount}/4</span> 项测评）
          </p>
        </div>
        <button
          className={doneCount > 0 ? "btn-primary" : "btn-secondary"}
          disabled={loading || doneCount === 0}
          onClick={generate}
        >
          {loading ? "AI 生成中…" : data ? "重新生成" : "生成解析"}
        </button>
      </div>

      {err && <div className="mt-4 text-sm text-red-500">⚠ {err}</div>}

      {data && (
        <div className="mt-6 border-t border-line pt-6">
          {data.summary && <SummaryTags summary={data.summary} />}
          <div className="prose-sm whitespace-pre-wrap leading-relaxed text-ink mt-4"
            dangerouslySetInnerHTML={{ __html: renderNarrative(data.narrative || "") }}
          />
        </div>
      )}

      {!data && !loading && doneCount === 0 && (
        <div className="mt-4 text-sm text-muted">请先完成上方任意一项测评，然后点击「生成解析」</div>
      )}
    </div>
  );
}

function renderNarrative(text: string): string {
  // Minimal markdown: **bold** → <strong>, newlines → <br>
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-primary">$1</strong>')
    .replace(/\n\n/g, '</p><p class="mt-3">')
    .replace(/\n/g, "<br>")
    .replace(/^/, '<p>')
    .replace(/$/, "</p>");
}

function SummaryTags({ summary }: { summary: any }) {
  const chips: { label: string; value: string; tone: string }[] = [];
  if (summary.holland_code) chips.push({ label: "霍兰德代码", value: summary.holland_code, tone: "bg-blue-50 text-primary" });
  if (summary.mbti) {
    chips.push({
      label: "MBTI",
      value: summary.mbti + (summary.mbti_label ? " · " + summary.mbti_label.split("·")[0].trim() : ""),
      tone: "bg-cyan-50 text-secondary",
    });
  }
  if (summary.values_top?.length) {
    chips.push({
      label: "核心价值",
      value: summary.values_top.slice(0, 3).map((x: [string, number]) => x[0]).join(" · "),
      tone: "bg-green-50 text-green-700",
    });
  }
  if (summary.mi_top?.length) {
    chips.push({
      label: "优势智能",
      value: summary.mi_top.slice(0, 3).map((x: [string, number]) => x[0]).join(" · "),
      tone: "bg-amber-50 text-amber-700",
    });
  }
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c, i) => (
        <div key={i} className={`px-3 py-1.5 rounded-full text-xs ${c.tone}`}>
          <span className="opacity-70 mr-1">{c.label}：</span>
          <span className="font-semibold">{c.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- 图表 ---------------- */

function HollandChart({ data }: { data: any }) {
  const values = HOLLAND_LABEL_LIST.map((_, i) => data?.[i] ?? 0);
  const code = hollandCode(values);
  const opt = {
    radar: {
      indicator: HOLLAND_LABEL_LIST.map((n) => ({ name: n, max: 100 })),
      radius: "62%",
    },
    series: [{
      type: "radar",
      data: [{
        value: values,
        areaStyle: { color: "rgba(0,184,217,0.25)" },
        lineStyle: { color: "#00B8D9" },
      }],
    }],
  };
  return (
    <div>
      <ReactECharts option={opt} style={{ height: 160, marginTop: 8 }} />
      <div className="text-center text-sm text-muted"><span className="font-semibold text-primary">{code}</span></div>
    </div>
  );
}

function BarChart({ labels, data, horizontal = false }: { labels: string[]; data: any; horizontal?: boolean }) {
  const values = labels.map((_, i) => data?.[i] ?? 0);
  const h = horizontal ? Math.max(170, labels.length * 28 + 30) : 170;
  const opt: any = horizontal ? {
    grid: { left: 80, top: 10, right: 20, bottom: 20 },
    xAxis: { type: "value", max: 100 },
    yAxis: { type: "category", data: labels, axisLabel: { interval: 0 } },
    series: [{ type: "bar", data: values, itemStyle: { color: "#0052CC", borderRadius: [0, 4, 4, 0] } }],
  } : {
    grid: { left: 30, top: 10, right: 10, bottom: 40 },
    xAxis: { type: "category", data: labels, axisLabel: { interval: 0, fontSize: 10, rotate: 30 } },
    yAxis: { type: "value", max: 100 },
    series: [{ type: "bar", data: values, itemStyle: { color: "#0052CC", borderRadius: [4, 4, 0, 0] } }],
  };
  return <ReactECharts option={opt} style={{ height: h, marginTop: 8 }} />;
}

function MBTIBars({ data }: { data: any }) {
  const type = mbtiType(data || [0.5, 0.5, 0.5, 0.5]);
  return (
    <div className="space-y-1.5 mt-2">
      <div className="text-center text-xs text-muted mb-1">
        你的类型：<span className="font-semibold text-primary text-sm">{type}</span>
      </div>
      {MBTI_AXES.map(([a, b], i) => {
        const v = data?.[i] ?? 0.5;  // 0 = 全 a, 1 = 全 b
        return (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-14 text-right font-semibold text-primary">{a}</span>
            <div className="flex-1 h-2 rounded-full bg-line relative overflow-hidden">
              <div className="absolute top-0 bottom-0 bg-primary" style={{ left: 0, width: `${(1 - v) * 100}%` }} />
              <div className="absolute top-0 bottom-0 bg-secondary" style={{ right: 0, width: `${v * 100}%` }} />
            </div>
            <span className="w-14 font-semibold text-secondary">{b}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- 测评模态框 ---------------- */

type ModalProps = { type: string; onClose: () => void; onSave: (v: number[]) => void };

function AssessmentModal({ type, onClose, onSave }: ModalProps) {
  if (type === "holland") return <HollandModal onClose={onClose} onSave={onSave} />;
  if (type === "mbti") return <MbtiModal onClose={onClose} onSave={onSave} />;
  if (type === "values") return <LikertModal
    title="工作价值观量表"
    subtitle="请用 1-5 分评价以下说法与你的符合程度（1 = 完全不符合，5 = 完全符合）"
    questions={VALUE_QUESTIONS}
    onClose={onClose}
    onSave={(ans) => onSave(scoreValues(ans))}
  />;
  if (type === "multi_intel") return <LikertModal
    title="多元智能量表"
    subtitle="请用 1-5 分评价以下说法与你的符合程度"
    questions={MI_QUESTIONS}
    onClose={onClose}
    onSave={(ans) => onSave(scoreMi(ans))}
  />;
  return null;
}

function ModalShell({
  title, subtitle, done, total, children, onClose, onSubmit, canSubmit,
}: {
  title: string; subtitle: string; done: number; total: number;
  children: React.ReactNode; onClose: () => void; onSubmit: () => void; canSubmit: boolean;
}) {
  const pct = Math.round((done / total) * 100);
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-high w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="p-6 border-b border-line">
          <div className="flex items-center justify-between mb-1">
            <h2>{title}</h2>
            <button className="text-muted text-xl" onClick={onClose}>✕</button>
          </div>
          <p className="text-sm text-muted">{subtitle}</p>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1 h-2 rounded-full bg-line overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted w-24 text-right">{done} / {total} 题</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-4">{children}</div>
        <div className="p-6 border-t border-line flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {canSubmit ? "提交并生成结果" : `还有 ${total - done} 题未答`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----- Holland: 是 / 否 ----- */

function HollandModal({ onClose, onSave }: { onClose: () => void; onSave: (v: number[]) => void }) {
  const [ans, setAns] = useState<Record<string, boolean>>({});
  const total = HOLLAND_QUESTIONS.length;
  const done = Object.keys(ans).length;
  return (
    <ModalShell
      title="霍兰德职业兴趣量表 (RIASEC)"
      subtitle="请判断以下每项活动或描述是否符合你的真实偏好，符合选「是」，不符合选「否」"
      done={done}
      total={total}
      onClose={onClose}
      canSubmit={done === total}
      onSubmit={() => onSave(scoreHolland(ans))}
    >
      {HOLLAND_QUESTIONS.map((q, i) => (
        <div key={q.id} className="flex items-start gap-3 pb-3 border-b border-line last:border-0">
          <span className="text-xs text-muted w-8 pt-2">{i + 1}.</span>
          <div className="flex-1 text-sm leading-relaxed">{q.text}</div>
          <div className="flex gap-2">
            <button
              className={`px-4 py-1.5 rounded border text-sm ${
                ans[q.id] === true
                  ? "bg-primary text-white border-primary"
                  : "border-line text-muted hover:border-primary"
              }`}
              onClick={() => setAns({ ...ans, [q.id]: true })}
            >
              是
            </button>
            <button
              className={`px-4 py-1.5 rounded border text-sm ${
                ans[q.id] === false
                  ? "bg-ink text-white border-ink"
                  : "border-line text-muted hover:border-ink"
              }`}
              onClick={() => setAns({ ...ans, [q.id]: false })}
            >
              否
            </button>
          </div>
        </div>
      ))}
    </ModalShell>
  );
}

/* ----- MBTI: A / B 二选一 ----- */

function MbtiModal({ onClose, onSave }: { onClose: () => void; onSave: (v: number[]) => void }) {
  const [ans, setAns] = useState<Record<string, "a" | "b">>({});
  const total = MBTI_QUESTIONS.length;
  const done = Object.keys(ans).length;
  return (
    <ModalShell
      title="MBTI 人格类型量表"
      subtitle="请选择更符合你日常自然状态的那一项（没有好坏之分）"
      done={done}
      total={total}
      onClose={onClose}
      canSubmit={done === total}
      onSubmit={() => onSave(scoreMbti(ans))}
    >
      {MBTI_QUESTIONS.map((q, i) => (
        <div key={q.id} className="pb-3 border-b border-line last:border-0">
          <div className="text-xs text-muted mb-2">第 {i + 1} 题</div>
          <div className="grid grid-cols-2 gap-3">
            <button
              className={`text-left p-3 rounded border text-sm leading-relaxed ${
                ans[q.id] === "a"
                  ? "bg-blue-50 border-primary text-ink"
                  : "border-line text-muted hover:border-primary"
              }`}
              onClick={() => setAns({ ...ans, [q.id]: "a" })}
            >
              A. {q.a}
            </button>
            <button
              className={`text-left p-3 rounded border text-sm leading-relaxed ${
                ans[q.id] === "b"
                  ? "bg-cyan-50 border-secondary text-ink"
                  : "border-line text-muted hover:border-secondary"
              }`}
              onClick={() => setAns({ ...ans, [q.id]: "b" })}
            >
              B. {q.b}
            </button>
          </div>
        </div>
      ))}
    </ModalShell>
  );
}

/* ---------------- 直接填写模态框 ---------------- */

const MBTI_TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
];

function DirectFillModal({
  type, initial, onClose, onSave,
}: {
  type: string;
  initial?: number[];
  onClose: () => void;
  onSave: (v: number[]) => void;
}) {
  const config = useMemo(() => {
    if (type === "holland") return { title: "霍兰德 · 直接填写", labels: HOLLAND_LABEL_LIST, len: 6 };
    if (type === "multi_intel") return { title: "多元智能 · 直接填写", labels: MI_LABEL_LIST, len: 8 };
    if (type === "values") return { title: "工作价值观 · 直接填写", labels: VALUE_LABEL_LIST, len: 10 };
    return { title: "MBTI · 直接填写", labels: [], len: 4 };
  }, [type]);

  const [values, setValues] = useState<number[]>(
    () => initial || (type === "mbti" ? [0.5, 0.5, 0.5, 0.5] : Array(config.len).fill(60)),
  );

  // MBTI 直接选 16 型
  const typeFromValues = mbtiType(values);

  const pickMbti = (t: string) => {
    // 字母 → 每维度偏向（强偏向 0.85/0.15，中性 0.5 不用）
    const bias = 0.85;
    setValues([
      t[0] === "E" ? 1 - bias : bias,
      t[1] === "S" ? 1 - bias : bias,
      t[2] === "T" ? 1 - bias : bias,
      t[3] === "J" ? 1 - bias : bias,
    ]);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-high w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="p-6 border-b border-line">
          <div className="flex items-center justify-between mb-1">
            <h2>{config.title}</h2>
            <button className="text-muted text-xl" onClick={onClose}>✕</button>
          </div>
          <p className="text-sm text-muted">
            {type === "mbti"
              ? "如果你已经知道自己的 MBTI 类型，直接点选即可；也可用滑块精细调整偏向程度。"
              : "如果你已经知道测评结果，拖动滑块到对应分数（0-100）即可，无需重新答题。"}
          </p>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          {type === "mbti" ? (
            <>
              <div className="text-sm text-muted mb-2">点击选择你的类型：</div>
              <div className="grid grid-cols-4 gap-2 mb-6">
                {MBTI_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => pickMbti(t)}
                    className={`py-2 rounded border text-sm font-semibold ${
                      typeFromValues === t
                        ? "bg-primary text-white border-primary"
                        : "border-line text-muted hover:border-primary"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="text-sm text-muted mb-2">或调整各维度偏向：</div>
              {MBTI_AXES.map(([a, b], i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-14 text-right font-semibold text-primary">{a}</span>
                  <input
                    type="range" min={0} max={100}
                    value={Math.round((values[i] ?? 0.5) * 100)}
                    onChange={(e) => {
                      const n = [...values];
                      n[i] = +e.target.value / 100;
                      setValues(n);
                    }}
                    className="flex-1"
                  />
                  <span className="w-14 font-semibold text-secondary">{b}</span>
                </div>
              ))}
              <div className="text-center text-sm text-muted mt-4">
                当前类型：<span className="font-semibold text-primary text-base">{typeFromValues}</span>
              </div>
            </>
          ) : (
            config.labels.map((label, i) => (
              <div key={label} className="pb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span>{label}</span>
                  <span className="text-muted">{values[i] ?? 0}</span>
                </div>
                <input
                  type="range" min={0} max={100}
                  value={values[i] ?? 0}
                  onChange={(e) => {
                    const n = [...values];
                    n[i] = +e.target.value;
                    setValues(n);
                  }}
                  className="w-full"
                />
              </div>
            ))
          )}
        </div>

        <div className="p-6 border-t border-line flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={() => onSave(values)}>保存</button>
        </div>
      </div>
    </div>
  );
}

/* ----- 1-5 分量表（价值观 / 多元智能通用） ----- */

function LikertModal({
  title, subtitle, questions, onClose, onSave,
}: {
  title: string; subtitle: string;
  questions: { id: string; text: string }[];
  onClose: () => void;
  onSave: (ans: Record<string, number>) => void;
}) {
  const [ans, setAns] = useState<Record<string, number>>({});
  const total = questions.length;
  const done = Object.keys(ans).length;
  const scale = useMemo(
    () => [
      { v: 1, label: "完全不符合" },
      { v: 2, label: "不太符合" },
      { v: 3, label: "一般" },
      { v: 4, label: "比较符合" },
      { v: 5, label: "完全符合" },
    ],
    [],
  );
  return (
    <ModalShell
      title={title}
      subtitle={subtitle}
      done={done}
      total={total}
      onClose={onClose}
      canSubmit={done === total}
      onSubmit={() => onSave(ans)}
    >
      {questions.map((q, i) => (
        <div key={q.id} className="pb-3 border-b border-line last:border-0">
          <div className="flex items-start gap-3 mb-2">
            <span className="text-xs text-muted w-8 pt-0.5">{i + 1}.</span>
            <div className="flex-1 text-sm leading-relaxed">{q.text}</div>
          </div>
          <div className="flex gap-2 ml-11">
            {scale.map((s) => (
              <button
                key={s.v}
                className={`flex-1 py-1.5 rounded border text-xs ${
                  ans[q.id] === s.v
                    ? "bg-primary text-white border-primary"
                    : "border-line text-muted hover:border-primary"
                }`}
                onClick={() => setAns({ ...ans, [q.id]: s.v })}
              >
                <div className="font-semibold">{s.v}</div>
                <div className="text-[10px]">{s.label}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </ModalShell>
  );
}

/* ---------------- 思索工作的步骤（四步法） ---------------- */

function DeepSelfCard() {
  const [record, setRecord] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      const r = await api.getDeepAssessment();
      if (r && r.analysis) setRecord(r);
    } catch {
      /* ignore */
    }
  };
  useEffect(() => { load(); }, []);

  // 计算当前进度（基于 answers 中已填写的步骤）
  const answers = record?.answers || {};
  const completedSteps = [
    answers.good_at || answers.like || answers.pursue ? 1 : 0,
    answers.focus ? 1 : 0,
    (answers.target_jobs || []).length > 0 ? 1 : 0,
  ].reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="card mt-6">
      <div className="flex items-start gap-4">
        <div className="text-4xl">🧭</div>
        <div className="flex-1">
          <h3>深入自我认识</h3>
          <p className="text-sm text-muted mt-1">
            通过「头脑风暴 → 找交叉点 → 穷举岗位」三步引导式探索，
            帮你从内心出发找到适合的职业方向。
          </p>
          {record?.analysis && (
            <div className="text-xs text-muted mt-1">
              已完成 <span className="font-semibold text-primary">{completedSteps}/3</span> 步
            </div>
          )}
          {/* 步骤指示器（3 步） */}
          <div className="flex gap-1 mt-3">
            {STEP_ORDER.slice(0, 3).map((sid, i) => {
              const meta = STEP_META[sid];
              const done = i < completedSteps;
              return (
                <div key={sid} className="flex-1 flex items-center gap-1">
                  <div
                    className="h-1.5 flex-1 rounded-full transition-all"
                    style={{ background: done ? meta.color : "#EBECF0" }}
                  />
                  {i < 2 && <div className="text-[10px] text-muted">→</div>}
                </div>
              );
            })}
          </div>
        </div>
        <button
          className={record?.analysis ? "btn-secondary" : "btn-primary"}
          onClick={() => setOpen(true)}
        >
          {record?.analysis ? "继续探索" : "开始探索"}
        </button>
      </div>

      {record?.analysis && (
        <div className="mt-6 border-t border-line pt-6">
          <div className="prose-sm text-ink text-sm leading-relaxed">
            <MarkdownLite text={record.analysis} />
          </div>
        </div>
      )}

      {open && (
        <DeepAssessmentModal
          initial={record?.answers || {}}
          onClose={() => setOpen(false)}
          onDone={(newRecord) => {
            setRecord(newRecord);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function MarkdownLite({ text }: { text: string }) {
  const html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-ink mt-2 mb-0.5">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-primary mt-3 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-lg font-bold mt-3 mb-1">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-primary">$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="ml-5 list-disc">$1</li>')
    .replace(/\n{2,}/g, '<div class="h-2"></div>')
    .replace(/\n/g, "<br>");
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

type DeepAnswers = {
  good_at: string;
  like: string;
  pursue: string;
  focus: string;
  target_jobs: string[];
  conditions: { cities?: string[]; salary_min?: number; env_pref?: string };
};

function DeepAssessmentModal({
  initial, onClose, onDone,
}: {
  initial: Record<string, any>;
  onClose: () => void;
  onDone: (record: any) => void;
}) {
  const nav = useNavigate();
  const [step, setStep] = useState<number>(0); // 0-3 for step1-step4
  const [answers, setAnswers] = useState<DeepAnswers>({
    good_at: initial.good_at || "",
    like: initial.like || "",
    pursue: initial.pursue || "",
    focus: initial.focus || "",
    target_jobs: initial.target_jobs || [],
    conditions: initial.conditions || {},
  });
  const [step2Analysis, setStep2Analysis] = useState("");
  const [step2Loading, setStep2Loading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [customJob, setCustomJob] = useState("");
  const [recommendedJobs, setRecommendedJobs] = useState<string[]>([]);
  const [marketData, setMarketData] = useState<any[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);

  const currentStepId = STEP_ORDER[step];
  const meta = STEP_META[currentStepId];

  // Step1 → Step2: 触发 AI 分析
  const goToStep2 = async () => {
    if (!answers.good_at.trim() && !answers.like.trim() && !answers.pursue.trim()) {
      setErr("请至少填写一个维度");
      return;
    }
    setErr("");
    setStep(1);
    setStep2Loading(true);
    try {
      const r = await api.analyzeStep2(answers.good_at, answers.like, answers.pursue);
      setStep2Analysis(r.analysis || "");
      if (!answers.focus && r.focus_suggestion) {
        setAnswers((a) => ({ ...a, focus: r.focus_suggestion }));
      }
      if (r.recommended_jobs?.length) {
        setRecommendedJobs(r.recommended_jobs);
      }
    } catch (e: any) {
      setStep2Analysis("分析生成失败，请手动填写聚焦方向。");
    } finally {
      setStep2Loading(false);
    }
  };

  const goToStep4 = async () => {
    setStep(3);
    if (answers.target_jobs.length === 0) return;
    setMarketLoading(true);
    try {
      const data = await api.matchBatch(answers.target_jobs);
      setMarketData(data);
    } catch {
      setMarketData([]);
    } finally {
      setMarketLoading(false);
    }
  };

  const next = () => {
    setErr("");
    if (step === 0) {
      goToStep2();
      return;
    }
    if (step === 1 && !answers.focus.trim()) {
      setErr("请确认或填写聚焦方向");
      return;
    }
    if (step === 2) {
      goToStep4();
      return;
    }
    if (step < 3) setStep(step + 1);
  };

  const prev = () => {
    setErr("");
    if (step > 0) setStep(step - 1);
  };

  const submit = async () => {
    setSubmitting(true);
    setErr("");
    try {
      const r = await api.submitDeepAssessment(answers as any);
      onDone(r);
      // 强制刷新穷举岗位缓存
      const { loadDeepJobs } = useApp.getState();
      useApp.setState({ deepJobsLoaded: false });
      await loadDeepJobs();
      nav("/explore");
    } catch (e: any) {
      setErr(e?.message || "提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleJob = (name: string) => {
    setAnswers((a) => {
      const jobs = a.target_jobs.includes(name)
        ? a.target_jobs.filter((j) => j !== name)
        : [...a.target_jobs, name];
      return { ...a, target_jobs: jobs };
    });
  };

  const addCustomJob = () => {
    const name = customJob.trim();
    if (name && !answers.target_jobs.includes(name)) {
      setAnswers((a) => ({ ...a, target_jobs: [...a.target_jobs, name] }));
      setCustomJob("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-high w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header + Step Bar */}
        <div className="p-6 border-b border-line">
          <div className="flex items-center justify-between mb-4">
            <div />
            <button className="text-muted text-xl" onClick={onClose}>✕</button>
          </div>
          {/* Step indicator */}
          <div className="flex gap-2">
            {STEP_ORDER.map((sid, i) => {
              const m = STEP_META[sid];
              const isActive = i === step;
              const isDone = i < step;
              return (
                <button
                  key={sid}
                  onClick={() => i <= step && setStep(i)}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 text-left transition-all ${
                    isActive
                      ? "border-current shadow-sm"
                      : isDone
                        ? "border-transparent opacity-80"
                        : "border-transparent opacity-40"
                  }`}
                  style={{ borderColor: isActive ? m.color : undefined }}
                  disabled={i > step}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: isDone || isActive ? m.color : "#DFE1E6" }}
                    >
                      {isDone ? "✓" : i + 1}
                    </div>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: isActive ? m.color : undefined }}>
                        {m.name}
                      </div>
                      <div className="text-[10px] text-muted">{m.desc}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {/* Step 1: 头脑风暴 */}
          {step === 0 && (
            <div>
              <p className="text-sm text-muted mb-4">
                请在下面三个文本框中分别写下你擅长的、喜欢的、追求的内容。可以是关键词、短句或一段话。
              </p>
              <div className="grid grid-cols-3 gap-4">
                {STEP1_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="text-sm font-semibold mb-2 block" style={{ color: f.color }}>
                      {f.label}
                    </label>
                    <textarea
                      className="input"
                      rows={10}
                      placeholder={f.placeholder}
                      value={answers[f.key]}
                      onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })}
                    />
                    <div className="text-[10px] text-muted text-right mt-1">
                      {answers[f.key].length} 字
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: 找交叉点 */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-6 items-stretch" style={{ minHeight: 300 }}>
              <div className="flex flex-col">
                <h4 className="text-sm font-semibold mb-2" style={{ color: meta.color }}>
                  AI 交叉分析
                </h4>
                {step2Loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted py-8">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    正在分析你的三个维度…
                  </div>
                ) : (
                  <div className="prose-sm text-ink text-sm leading-relaxed whitespace-pre-wrap border border-line rounded-lg p-4 flex-1 overflow-auto">
                    <MarkdownLite text={step2Analysis} />
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <h4 className="text-sm font-semibold mb-2" style={{ color: meta.color }}>
                  确认聚焦方向
                </h4>
                <p className="text-xs text-muted mb-3">
                  根据 AI 分析结果，填写或修改你想聚焦的职业方向。
                </p>
                <textarea
                  className="input flex-1"
                  rows={6}
                  placeholder="例如：互联网产品方向、数据分析方向、教育培训方向……"
                  value={answers.focus}
                  onChange={(e) => setAnswers({ ...answers, focus: e.target.value })}
                />
                <div className="text-[10px] text-muted text-right mt-1">
                  {answers.focus.length} 字
                </div>
              </div>
            </div>
          )}

          {/* Step 3: 穷举岗位 */}
          {step === 2 && (
            <div>
              <p className="text-sm text-muted mb-4">
                根据你的聚焦方向「{answers.focus}」，系统为你穷举了以下可能适合的岗位。点击选中你感兴趣的。
              </p>

              {/* 推荐岗位（主体） */}
              {recommendedJobs.length > 0 && (
                <div className="mb-6">
                  <div className="text-sm font-semibold mb-3" style={{ color: meta.color }}>
                    为你推荐的岗位
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {recommendedJobs.map((j) => {
                      const selected = answers.target_jobs.includes(j);
                      return (
                        <button
                          key={j}
                          onClick={() => toggleJob(j)}
                          className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                            selected
                              ? "text-white border-transparent shadow-sm"
                              : "border-current hover:opacity-80"
                          }`}
                          style={selected ? { background: meta.color } : { color: meta.color }}
                        >
                          {selected ? `✓ ${j}` : `+ ${j}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {recommendedJobs.length === 0 && (
                <div className="text-sm text-muted py-6 text-center">
                  暂未生成推荐岗位，请返回上一步完善聚焦方向后重试。
                </div>
              )}

              {/* 已选岗位汇总 */}
              {answers.target_jobs.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-blue-50/50">
                  <div className="text-xs font-semibold text-muted mb-2">
                    已选择 {answers.target_jobs.length} 个岗位（点击可取消）
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {answers.target_jobs.map((j) => (
                      <button
                        key={j}
                        onClick={() => toggleJob(j)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                        style={{ background: meta.color }}
                      >
                        {j} ✕
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 补充添加（折叠式） */}
              <div className="border-t border-line pt-4 mt-4">
                <div className="text-xs text-muted mb-2">想补充其他岗位？</div>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="输入岗位名，按回车添加"
                    value={customJob}
                    onChange={(e) => setCustomJob(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustomJob()}
                  />
                  <button className="btn-secondary text-sm" onClick={addCustomJob}>
                    添加
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: 市场现实检验 */}
          {step === 3 && (
            <div>
              <p className="text-sm text-muted mb-4">
                以下是你选择的岗位在市场上的真实情况，帮你做出最终判断。
              </p>

              {marketLoading && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted py-12">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  正在获取市场数据…
                </div>
              )}

              {!marketLoading && marketData.length === 0 && (
                <div className="text-sm text-muted py-8 text-center">
                  没有选择目标岗位，请返回上一步选择。
                </div>
              )}

              {!marketLoading && marketData.length > 0 && (
                <div className="space-y-4">
                  {marketData.map((job) => (
                    <div key={job.name} className="border border-line rounded-lg overflow-hidden">
                      {job.found ? (
                        <div className="p-4">
                          {/* 标题行 */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                                style={{ background: meta.color }}
                              >
                                {job.name[0]}
                              </div>
                              <div>
                                <div className="font-semibold text-sm">{job.name}</div>
                                <div className="text-[10px] text-muted">
                                  {job.industries?.join(" · ")} · {job.count} 个在招岗位
                                </div>
                              </div>
                            </div>
                            {/* 匹配分数 */}
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <div className="text-xs text-muted">人岗匹配</div>
                                <div className={`text-lg font-bold ${
                                  job.match_score >= 70 ? "text-green-600"
                                    : job.match_score >= 50 ? "text-primary"
                                      : job.match_score > 0 ? "text-amber-500"
                                        : "text-muted"
                                }`}>
                                  {job.match_score > 0 ? `${job.match_score}%` : "—"}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 市场数据 */}
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            {/* 薪资 */}
                            <div className="bg-blue-50/60 rounded-lg p-2.5">
                              <div className="text-muted mb-1">薪资范围</div>
                              <div className="font-semibold text-primary">
                                {job.salary_range
                                  ? `${(job.salary_range[0] / 1000).toFixed(1)}K - ${(job.salary_range[1] / 1000).toFixed(1)}K`
                                  : "暂无数据"}
                              </div>
                            </div>
                            {/* 学历 */}
                            <div className="bg-green-50/60 rounded-lg p-2.5">
                              <div className="text-muted mb-1">学历要求</div>
                              <div className="font-semibold text-green-700">
                                {job.education || "不限"}
                              </div>
                            </div>
                          </div>

                          {/* 热门城市 */}
                          <div className="mt-3">
                            <div className="text-[10px] text-muted mb-1">热门城市</div>
                            <div className="flex flex-wrap gap-1">
                              {(job.cities || []).slice(0, 10).map((c: string) => (
                                <span key={c} className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* 核心技能 */}
                          <div className="mt-3">
                            <div className="text-[10px] text-muted mb-1">核心技能要求</div>
                            <div className="flex flex-wrap gap-1">
                              {(job.skills || []).map((s: string) => {
                                const hit = (job.skills_hit || []).includes(s);
                                return (
                                  <span
                                    key={s}
                                    className={`px-2 py-0.5 rounded text-[10px] ${
                                      hit
                                        ? "bg-green-100 text-green-700 font-semibold"
                                        : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {hit ? "✓ " : ""}{s}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          {/* 三维匹配条 */}
                          {job.match_score > 0 && job.breakdown && (
                            <div className="mt-3 grid grid-cols-3 gap-2">
                              {Object.entries(job.breakdown).map(([k, v]) => (
                                <div key={k} className="text-[10px]">
                                  <div className="flex justify-between text-muted mb-0.5">
                                    <span>{k}</span>
                                    <span>{v as number}%</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{
                                        width: `${v as number}%`,
                                        background: (v as number) >= 70 ? "#22c55e" : (v as number) >= 50 ? "#0052CC" : "#f59e0b",
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* 未找到的岗位 */
                        <div className="p-4 flex items-center justify-between bg-slate-50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 font-bold text-sm">
                              {job.name[0]}
                            </div>
                            <div>
                              <div className="font-semibold text-sm text-muted">{job.name}</div>
                              <div className="text-[10px] text-muted">暂未收录该岗位的市场数据</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-line flex items-center justify-between">
          <div className="text-sm text-muted">
            第 <span className="font-semibold" style={{ color: meta.color }}>{step + 1}</span> / 4 步
            · {meta.name}
          </div>
          {err && <div className="text-xs text-red-500 mx-4">{err}</div>}
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={prev} disabled={step === 0}>
              上一步
            </button>
            {step < 3 ? (
              <button className="btn-primary" onClick={next}>
                下一步
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={submit}
                disabled={submitting}
              >
                {submitting ? "AI 分析中…" : "去职业探索 →"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
