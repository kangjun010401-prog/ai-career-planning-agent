import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../store";

type PageMode = "login" | "register";
type LoginMode = "password" | "sms";

export default function Login() {
  const [pageMode, setPageMode] = useState<PageMode>("login");
  const [loginMode, setLoginMode] = useState<LoginMode>("password");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");

  const setUser = useApp((s) => s.setUser);
  const nav = useNavigate();

  const handleAuth = (data: { token: string; username: string }) => {
    localStorage.setItem("token", data.token);
    setUser(data.username);
    nav("/avatar");
  };

  const demoEnter = () => {
    localStorage.setItem("token", "demo");
    setUser("demo");
    nav("/avatar");
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (loginMode === "password") {
      if (!account.trim()) { setError("请输入账号"); return; }
      if (!password) { setError("请输入密码"); return; }
      setLoading(true);
      try {
        const data = await api.login(account.trim(), password);
        handleAuth(data);
      } catch (err: any) {
        setError(err.message || "登录失败");
      } finally {
        setLoading(false);
      }
    } else {
      if (!phone || phone.length !== 11) { setError("请输入 11 位手机号"); return; }
      if (!code || code.length !== 6) { setError("请输入 6 位验证码"); return; }
      setLoading(true);
      try {
        const data = await api.smsLogin(phone, code);
        handleAuth(data);
      } catch (err: any) {
        setError(err.message || "登录失败");
      } finally {
        setLoading(false);
      }
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!account.trim()) { setError("请输入账号"); return; }
    if (!password) { setError("请输入密码"); return; }
    if (password.length < 4) { setError("密码至少 4 位"); return; }
    if (password !== confirmPwd) { setError("两次密码不一致"); return; }
    setLoading(true);
    try {
      const data = await api.register(account.trim(), password);
      handleAuth(data);
    } catch (err: any) {
      setError(err.message || "注册失败");
    } finally {
      setLoading(false);
    }
  };

  const sendSms = async () => {
    if (!phone || phone.length !== 11 || countdown > 0) return;
    setError("");
    try {
      await api.smsSend(phone);
      setSmsSent(true);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message || "发送失败");
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      {/* Left visual panel */}
      <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-amber-200 via-orange-200 to-orange-300 text-orange-900 p-16 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, #fff 1px, transparent 1px), radial-gradient(circle at 70% 60%, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative z-10 max-w-md">
          <img src="/penguin.png" alt="penguin" className="w-40 h-40 object-contain mb-6" />
          <h1 className="text-4xl font-bold mb-4 leading-tight">高雅人士分析中</h1>
          <p className="text-orange-700/70 leading-relaxed">
            可以解决、问题不大、不要暴躁、不要急躁、放轻松
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {pageMode === "login" ? (
            <>
              {/* Tab: 密码登录 / 短信登录 */}
              <div className="flex justify-center gap-8 mb-8">
                <button
                  onClick={() => { setLoginMode("password"); setError(""); }}
                  className={`text-lg font-semibold pb-1 border-b-2 transition ${
                    loginMode === "password"
                      ? "text-orange-500 border-orange-500"
                      : "text-ink border-transparent hover:text-orange-500"
                  }`}
                >
                  密码登录
                </button>
                <button
                  onClick={() => { setLoginMode("sms"); setError(""); }}
                  className={`text-lg font-semibold pb-1 border-b-2 transition ${
                    loginMode === "sms"
                      ? "text-orange-500 border-orange-500"
                      : "text-ink border-transparent hover:text-orange-500"
                  }`}
                >
                  短信登录
                </button>
              </div>

              <form onSubmit={submitLogin} className="space-y-4">
                {loginMode === "password" ? (
                  <>
                    <input
                      className="input bg-gray-50"
                      placeholder="账号名"
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                    />
                    <div className="relative">
                      <input
                        className="input bg-gray-50 pr-10"
                        type={showPwd ? "text" : "password"}
                        placeholder="密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                        onClick={() => setShowPwd(!showPwd)}
                        tabIndex={-1}
                      >
                        {showPwd ? "🙈" : "👁"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <input
                      className="input bg-gray-50"
                      placeholder="请输入手机号"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      maxLength={11}
                    />
                    <div className="flex gap-3">
                      <input
                        className="input bg-gray-50 flex-1"
                        placeholder="请输入验证码"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        maxLength={6}
                      />
                      <button
                        type="button"
                        onClick={sendSms}
                        disabled={countdown > 0 || !phone || phone.length !== 11}
                        className="whitespace-nowrap px-4 py-2.5 rounded border border-red-300 text-red-400 text-sm
                                   hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {countdown > 0 ? `${countdown}s` : smsSent ? "重新发送" : "获取验证码"}
                      </button>
                    </div>
                  </>
                )}

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg text-white font-semibold text-base transition
                             bg-gradient-to-r from-orange-400 to-amber-500 hover:from-orange-500 hover:to-amber-600
                             disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                >
                  {loading ? "登录中…" : "登录"}
                </button>
              </form>

              <button
                type="button"
                onClick={demoEnter}
                className="w-full py-3 rounded-lg font-semibold text-base transition
                           border border-gray-300 text-muted hover:text-ink hover:border-gray-400 mt-3"
              >
                免登录体验 Demo
              </button>

              <div className="mt-6 flex items-center justify-center gap-3 text-sm text-muted flex-wrap">
                <button
                  onClick={() => alert("请联系管理员重置密码")}
                  className="hover:text-orange-500 transition"
                >
                  忘记密码
                </button>
                <span className="text-line">|</span>
                <button
                  onClick={() => { setPageMode("register"); setError(""); }}
                  className="hover:text-orange-500 transition"
                >
                  立即注册
                </button>
              </div>
            </>
          ) : (
            <>
              {/* 注册表单 */}
              <h2 className="text-2xl font-bold text-center mb-8 text-ink">注册新账号</h2>
              <form onSubmit={submitRegister} className="space-y-4">
                <input
                  className="input bg-gray-50"
                  placeholder="账号名"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                />
                <div className="relative">
                  <input
                    className="input bg-gray-50 pr-10"
                    type={showPwd ? "text" : "password"}
                    placeholder="密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                    onClick={() => setShowPwd(!showPwd)}
                    tabIndex={-1}
                  >
                    {showPwd ? "🙈" : "👁"}
                  </button>
                </div>
                <input
                  className="input bg-gray-50"
                  type="password"
                  placeholder="确认密码"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                />

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg text-white font-semibold text-base transition
                             bg-gradient-to-r from-orange-400 to-amber-500 hover:from-orange-500 hover:to-amber-600
                             disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                >
                  {loading ? "注册中…" : "注册"}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-muted">
                已有账号？
                <button
                  onClick={() => { setPageMode("login"); setError(""); }}
                  className="text-red-400 hover:text-red-500 ml-1"
                >
                  返回登录
                </button>
              </div>
            </>
          )}

          {/* 协议 */}
          <p className="mt-6 text-xs text-center text-muted leading-relaxed">
            登录即代表同意
            <a className="text-orange-500 hover:underline mx-0.5">《用户协议》</a>
            和
            <a className="text-orange-500 hover:underline mx-0.5">《隐私政策》</a>
          </p>
        </div>
      </div>
    </div>
  );
}
