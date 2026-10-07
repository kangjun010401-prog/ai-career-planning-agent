import { Link, NavLink, useNavigate } from "react-router-dom";
import { useApp } from "../store";

const Badge = ({ label, value }: { label: string; value: string }) => {
  const ok = value === "已完善" || value === "已完成";
  const running = value === "进行中";
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full opacity-70 ${
        ok
          ? "bg-green-50 text-green-600"
          : running
          ? "bg-orange-50 text-orange-500"
          : "bg-gray-100 text-gray-400"
      }`}
    >
      {label}：{value}
    </span>
  );
};

export default function Header() {
  const { avatar, progress, username, logout } = useApp();
  const nav = useNavigate();
  return (
    <header className="h-16 bg-white border-b border-line flex items-center px-8 sticky top-0 z-30">
      <Link to="/explore" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary" />
        <span className="font-semibold text-ink">AI 职业规划智能体</span>
      </Link>
      <nav className="ml-10 flex gap-1 text-sm">
        {[
          { to: "/profile", label: "我的档案" },
          { to: "/assessments", label: "自我认识" },
          { to: "/explore", label: "职业探索" },
          { to: "/report", label: "我的报告" },
        ].map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `px-4 py-1.5 rounded-full font-medium transition-all ${
                isActive
                  ? "bg-primary text-white shadow-sm"
                  : "text-ink hover:bg-orange-50 hover:text-primary"
              }`
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <Badge label="简历" value={progress.resume} />
        <Badge label="自我认识" value={progress.self} />
        <Badge label="职业规划" value={progress.plan} />
        <button
          onClick={() => { logout(); nav("/login"); }}
          className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-primary
                     text-white flex items-center justify-center ml-2 text-lg"
          title={`${username || "用户"} — 点击退出`}
        >
          {avatar ? avatar.slice(0, 1).toUpperCase() : "👤"}
        </button>
      </div>
    </header>
  );
}
