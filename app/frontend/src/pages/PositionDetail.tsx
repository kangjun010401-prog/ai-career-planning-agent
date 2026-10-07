import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import { api } from "../api";

export default function PositionDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [pos, setPos] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const [day, setDay] = useState<any>(null);
  const [graph, setGraph] = useState<any>(null);
  const [tab, setTab] = useState<"promote" | "switch">("promote");
  const [animScore, setAnimScore] = useState(0);

  useEffect(() => {
    if (!id) return;
    api.getPosition(id).then(setPos);
    api.match(id).then((m) => {
      setMatch(m);
      let v = 0;
      const t = setInterval(() => {
        v += Math.max(1, Math.round((m.score - v) / 6));
        if (v >= m.score) { v = m.score; clearInterval(t); }
        setAnimScore(v);
      }, 30);
    });
    api.positionDay(id).then(setDay);
    api.positionGraph(id).then(setGraph);
  }, [id]);

  if (!pos) return <div className="text-muted">加载中…</div>;

  return (
    <div className="fixed inset-0 bg-black/30 z-40 overflow-auto">
      <div className="min-h-screen bg-canvas">
        {/* top bar */}
        <div className="bg-white border-b border-line px-8 py-4 flex items-center gap-4 sticky top-0 z-10">
          <button onClick={() => nav(-1)} className="text-muted hover:text-ink">← 返回</button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center font-bold">
            {pos.name.slice(0, 1)}
          </div>
          <div>
            <h2>{pos.name}</h2>
            <div className="text-xs text-muted">{pos.sample_companies?.[0] || "多家公司在招"}</div>
          </div>
          <div className="ml-auto flex items-center gap-4">
            {match && (
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{animScore}%</div>
                <div className="text-xs text-muted">综合匹配率</div>
              </div>
            )}
            <button className="btn-primary">投递简历</button>
          </div>
        </div>

        <div className="max-w-[1440px] mx-auto p-8 grid grid-cols-12 gap-6">
          {/* left 2/3 */}
          <div className="col-span-8 space-y-6">
            <div className="card">
              <h3 className="mb-3">岗位描述</h3>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-ink font-sans">
                {pos.description}
              </pre>
              <div className="mt-4 flex flex-wrap gap-2">
                {pos.skills.map((s: string) => <span key={s} className="tag">{s}</span>)}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <Info label="学历要求" value={pos.education} />
                <Info label="主要城市" value={(pos.cities || []).slice(0, 3).join(" / ") || "—"} />
                <Info label="薪资范围" value={pos.salary_range[0] > 0 ? `${pos.salary_range[0]}-${pos.salary_range[1]} 元/月` : "待探索"} />
                <Info label="行业" value={(pos.industries || []).join(", ")} />
              </div>
            </div>

            <div className="card">
              <h3 className="mb-4">典型的一天</h3>
              {day ? (
                <>
                  <div className="relative pl-6 border-l-2 border-line">
                    {day.items.map((it: any, i: number) => (
                      <div key={i} className="mb-4 relative">
                        <div className="absolute -left-[30px] w-4 h-4 rounded-full bg-primary border-4 border-white" />
                        <div className="text-xs text-muted">{it.time}</div>
                        <div className="text-sm">{it.event}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <div className="text-xs text-muted mb-2">工作关键词</div>
                    <div className="flex flex-wrap gap-2">
                      {(day.keywords || []).map((k: string) => (
                        <span key={k} className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-50 to-cyan-50 text-primary text-sm">{k}</span>
                      ))}
                    </div>
                  </div>

                </>
              ) : <div className="text-muted text-sm">AI 生成中…</div>}
            </div>
          </div>

          {/* right 1/3 */}
          <div className="col-span-4 space-y-6">
            {match && (
              <div className="card">
                <h3 className="mb-3">人岗匹配</h3>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(match.breakdown).map(([k, v]) => (
                    <RingGauge key={k} label={k} value={v as number} />
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <h3 className="mb-3">发展前景</h3>
              <div className="flex gap-4 mb-4 border-b border-line">
                {[
                  ["promote", "晋升路径"],
                  ["switch", "换岗路径"],
                ].map(([k, label]) => (
                  <button key={k as string}
                    onClick={() => setTab(k as any)}
                    className={`pb-2 text-sm ${tab === k ? "text-primary border-b-2 border-primary font-semibold" : "text-muted"}`}
                  >{label}</button>
                ))}
              </div>
              {graph && <GraphView data={tab === "promote" ? graph.promote : graph.switch} kind={tab} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm mt-0.5">{value}</div>
    </div>
  );
}

function RingGauge({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? "#36B37E" : value >= 50 ? "#0052CC" : "#FF8B00";
  const option = {
    series: [{
      type: "gauge",
      startAngle: 90,
      endAngle: -270,
      min: 0,
      max: 100,
      radius: "90%",
      progress: { show: true, width: 8, itemStyle: { color } },
      axisLine: { lineStyle: { width: 8, color: [[1, "#EBECF0"]] } },
      pointer: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      anchor: { show: false },
      title: { show: false },
      detail: {
        valueAnimation: true,
        fontSize: 16,
        fontWeight: 600,
        color,
        offsetCenter: [0, 0],
        formatter: "{value}",
      },
      data: [{ value }],
    }],
  };
  return (
    <div className="text-center">
      <ReactECharts option={option} style={{ height: 90 }} />
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  );
}

function GraphView({ data, kind }: { data: any; kind: string }) {
  if (!data || data.nodes.length === 0) {
    return <div className="text-muted text-sm py-8 text-center">有待探索</div>;
  }
  // vertical promote: render as ordered tiers
  if (kind === "promote") {
    const tiers: Record<number, any[]> = {};
    data.nodes.forEach((n: any) => {
      (tiers[n.tier] = tiers[n.tier] || []).push(n);
    });
    const order = Object.keys(tiers).map(Number).sort();

    // Look up the representative "years" label for each tier transition
    // by finding any promote edge whose src/dst tiers match.
    const yearsFor = (srcTier: number, dstTier: number): string => {
      const nodeTier = new Map<string, number>();
      data.nodes.forEach((n: any) => nodeTier.set(n.id, n.tier));
      const edge = (data.edges || []).find(
        (e: any) =>
          nodeTier.get(e.source) === srcTier &&
          nodeTier.get(e.target) === dstTier,
      );
      return edge?.years || "";
    };

    return (
      <div>
        {order.map((t, i) => (
          <div key={t}>
            <div className="flex flex-wrap gap-2 justify-center">
              {tiers[t].map((n) => (
                <span key={n.id} className="px-3 py-2 rounded bg-blue-50 text-primary text-sm border border-blue-100">
                  {n.name}
                </span>
              ))}
            </div>
            {i < order.length - 1 && (
              <div className="flex justify-center my-2 text-muted text-xs">
                ↓ {yearsFor(t, order[i + 1]) || "若干年"}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
  // switch: tree/force layout
  const nodes = data.nodes.map((n: any, i: number) => ({
    name: n.name, id: n.id, x: i === 0 ? 200 : 100 + Math.cos(i) * 140,
    y: i === 0 ? 180 : 180 + Math.sin(i) * 140,
    symbolSize: i === 0 ? 60 : 40,
    itemStyle: { color: i === 0 ? "#0052CC" : "#00B8D9" },
    label: { show: true, color: "#172B4D", fontSize: 11 },
  }));
  const links = data.edges.map((e: any) => ({
    source: e.source, target: e.target,
    lineStyle: { width: 1 + (e.weight || 0.3) * 3, color: "#DFE1E6" },
  }));
  return (
    <ReactECharts
      option={{
        series: [{
          type: "graph", layout: "none", roam: false,
          data: nodes, links, edgeSymbol: ["none", "arrow"],
        }],
      }}
      style={{ height: 320 }}
    />
  );
}
