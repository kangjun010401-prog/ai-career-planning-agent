import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../store";

type Rec = {
  id: string; name: string; industries: string[]; cities: string[];
  salary_range: [number, number]; skills: string[]; match: number;
};

export default function Explore() {
  const [q, setQ] = useState("");
  const [recs, setRecs] = useState<Rec[]>([]);
  const [all, setAll] = useState<any[]>([]);
  const deepJobs = useApp((s) => s.deepJobs);
  const loadDeepJobs = useApp((s) => s.loadDeepJobs);
  const loadPositions = useApp((s) => s.loadPositions);
  const nav = useNavigate();

  useEffect(() => {
    api.recommend(12).then(setRecs);
    loadPositions().then(setAll);
    loadDeepJobs();
  }, []);

  const filtered = q ? all.filter((p) => p.name.includes(q)) : all;

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <div className="relative flex-1 max-w-xl">
          <input
            className="input pl-10"
            placeholder="搜索岗位 / 公司"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="absolute left-3 top-2.5 text-muted">🔍</span>
        </div>
      </div>

      {/* Deep assessment target jobs */}
      {deepJobs && deepJobs.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2>我的意向岗位</h2>
            <div className="text-sm text-muted">来自「深入自我认识」的筛选结果，点击查看详情</div>
          </div>
          <div className="flex gap-5 overflow-x-auto pb-4 snap-x">
            {deepJobs.map((r) => (
              <RecCard key={r.id} rec={r} onClick={() => nav(`/positions/${r.id}`)} />
            ))}
          </div>
        </section>
      )}

      {/* Carousel */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2>智能匹配推荐</h2>
          <div className="text-sm text-muted">依据你的画像智能匹配，点击查看详情</div>
        </div>

        {recs.length > 0 && recs.every((r) => r.match === 0) && (
          <div className="mb-4 p-4 rounded border-l-4 border-warning bg-yellow-50 text-sm">
            ⚠ 你还没有在「我的档案」填写任何信息，系统暂时无法计算匹配度。
            请先去完善简历、求职意向并完成自我认识测评，再回来看推荐结果。
            <button
              onClick={() => nav("/profile")}
              className="ml-3 btn-ghost text-xs"
            >
              去完善档案 →
            </button>
          </div>
        )}

        <div className="flex gap-5 overflow-x-auto pb-4 snap-x">
          {recs.map((r) => (
            <RecCard key={r.id} rec={r} onClick={() => nav(`/positions/${r.id}`)} />
          ))}
        </div>
      </section>

      {/* Full list */}
      <section>
        <h2 className="mb-4">全部岗位 ({filtered.length})</h2>
        <div className="grid grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} onClick={() => nav(`/positions/${p.id}`)}
              className="card cursor-pointer hover:shadow-mid transition">
              <h3>{p.name}</h3>
              <div className="text-xs text-muted mt-1">{(p.industries || []).join(" · ")}</div>
              <div className="text-xs text-muted mt-1">{(p.cities || []).slice(0, 3).join(" / ")}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(p.skills || []).slice(0, 5).map((s: string) => <span key={s} className="tag">{s}</span>)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RecCard({ rec, onClick }: { rec: Rec; onClick: () => void }) {
  const [lo, hi] = rec.salary_range || [0, 0];
  const matchColor = rec.match >= 80 ? "#36B37E" : rec.match >= 60 ? "#0052CC" : "#FFAB00";
  return (
    <div onClick={onClick}
      className="snap-start shrink-0 w-72 card cursor-pointer hover:shadow-mid hover:-translate-y-1 transition">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center font-bold">
          {rec.name.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{rec.name}</div>
          <div className="text-xs text-muted truncate">{(rec.industries || []).join(", ")}</div>
        </div>
        <MatchRing value={rec.match} color={matchColor} />
      </div>
      <div className="mt-4 space-y-1 text-xs text-muted">
        <div>📍 {(rec.cities || [])[0] || "—"}</div>
        <div>💰 {lo ? `${lo}-${hi} 元/月` : "—"}</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(rec.skills || []).slice(0, 4).map((s) => <span key={s} className="tag">{s}</span>)}
      </div>
    </div>
  );
}

function MatchRing({ value, color }: { value: number; color: string }) {
  const size = 48, stroke = 5, r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#eef" strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${c * value / 100} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="bold" fill={color}>{value}</text>
    </svg>
  );
}
