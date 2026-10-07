import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../store";

const AVATARS = [
  { id: "sport",  emoji: "⚾", label: "运动型" },
  { id: "tech",   emoji: "🔌", label: "极客型" },
  { id: "surf",   emoji: "🏄", label: "探索型" },
  { id: "mic",    emoji: "🎤", label: "表达型" },
  { id: "stop",   emoji: "🛑", label: "规则型" },
  { id: "ball",   emoji: "🏀", label: "竞技型" },
  { id: "skate",  emoji: "🛹", label: "自由型" },
  { id: "time",   emoji: "⏱️", label: "高效型" },
];

export default function Avatar() {
  const [picked, setPicked] = useState<string | null>(null);
  const setAvatar = useApp((s) => s.setAvatar);
  const nav = useNavigate();

  const confirm = async () => {
    if (!picked) return;
    try {
      await api.setAvatar(picked);
      setAvatar(picked);
      nav("/profile");
    } catch (err) {
      console.error("setAvatar failed:", err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto text-center">
      <h1 className="mb-2">选择你的 3D 虚拟形象</h1>
      <p className="text-muted mb-10">它将陪你一起探索职业之路</p>

      <div className="grid grid-cols-4 gap-6">
        {AVATARS.map((a) => {
          const active = picked === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setPicked(a.id)}
              className={`card flex flex-col items-center py-10 transition relative
                ${active ? "border-2 border-primary shadow-mid" : "hover:shadow-mid"}
              `}
            >
              <div className="text-6xl mb-4">{a.emoji}</div>
              <div className="text-sm text-muted">{a.label}</div>
              {active && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm">✓</div>
              )}
            </button>
          );
        })}
      </div>

      <button
        disabled={!picked}
        onClick={confirm}
        className="btn-primary mt-10 px-10"
      >
        确认选择
      </button>
    </div>
  );
}
