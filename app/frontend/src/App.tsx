import { Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import Login from "./pages/Login";
import Avatar from "./pages/Avatar";
import Profile from "./pages/Profile";
import Assessments from "./pages/Assessments";
import Explore from "./pages/Explore";
import PositionDetail from "./pages/PositionDetail";
import Report from "./pages/Report";
import ReportPreview from "./pages/ReportPreview";
import { useEffect } from "react";
import { useApp } from "./store";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-8 py-8">
        {children}
      </main>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const refresh = useApp((s) => s.refresh);
  const loadDeepJobs = useApp((s) => s.loadDeepJobs);
  const token = localStorage.getItem("token");
  useEffect(() => {
    if (token) {
      refresh().catch(() => {});
      loadDeepJobs().catch(() => {});
    }
  }, [refresh, loadDeepJobs, token]);
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/avatar" element={<ProtectedRoute><Shell><Avatar /></Shell></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Shell><Profile /></Shell></ProtectedRoute>} />
      <Route path="/assessments" element={<ProtectedRoute><Shell><Assessments /></Shell></ProtectedRoute>} />
      <Route path="/explore" element={<ProtectedRoute><Shell><Explore /></Shell></ProtectedRoute>} />
      <Route path="/positions/:id" element={<ProtectedRoute><Shell><PositionDetail /></Shell></ProtectedRoute>} />
      <Route path="/report" element={<ProtectedRoute><Shell><Report /></Shell></ProtectedRoute>} />
      <Route path="/report/preview" element={<ProtectedRoute><Shell><ReportPreview /></Shell></ProtectedRoute>} />
    </Routes>
  );
}
