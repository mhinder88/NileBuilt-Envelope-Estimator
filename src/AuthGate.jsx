import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

// ─── BRAND (must match main app) ─────────────────────────────────────────────
const BRAND = {
  primary: "#6B7EC2",
  primaryDark: "#4A5A9B",
  primaryLight: "#8B9BD6",
  primaryBg: "#EEF0F8",
  accent: "#7C8FD4",
};

// ─── NileBuilt Logo SVG ─────────────────────────────────────────────────────
function NileBuiltLogo({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <rect width="120" height="120" rx="24" fill="white" fillOpacity="0.15" />
      <path d="M30 85V35l30 50V35" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M70 85V35l20 25 20-25v50" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="25" y="90" width="70" height="4" rx="2" fill="white" fillOpacity="0.5" />
    </svg>
  );
}

// ─── AUTH GATE COMPONENT ─────────────────────────────────────────────────────
export default function AuthGate({ appTitle = "Envelope Estimator", children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName, last_name: lastName },
        },
      });
      if (error) throw error;
      setMessage("Account created! Check your email to confirm, then sign in.");
      setMode("login");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setMessage("Password reset email sent! Check your inbox.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${BRAND.primaryDark} 0%, ${BRAND.accent} 100%)` }}>
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  // If authenticated, render the app with session context
  if (session) {
    return children({ session, user: session.user, signOut: handleSignOut });
  }

  // ─── AUTH FORMS ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: `linear-gradient(135deg, ${BRAND.primaryDark} 0%, ${BRAND.accent} 100%)` }}>
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="rounded-2xl p-2" style={{ background: `linear-gradient(135deg, ${BRAND.primaryDark} 0%, ${BRAND.accent} 100%)` }}>
              <NileBuiltLogo size={60} />
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-800">{appTitle}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === "login" && "Sign in to your builder account"}
            {mode === "register" && "Create your builder account"}
            {mode === "forgot" && "Reset your password"}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
            {message}
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <input
              type="password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg font-semibold text-white transition disabled:opacity-50"
              style={{ backgroundColor: BRAND.primary }}
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
            <div className="flex justify-between text-xs mt-2">
              <button type="button" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }} className="text-blue-500 hover:underline">
                Forgot password?
              </button>
              <button type="button" onClick={() => { setMode("register"); setError(""); setMessage(""); }} className="text-blue-500 hover:underline">
                Create account
              </button>
            </div>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <input
              type="email"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg font-semibold text-white transition disabled:opacity-50"
              style={{ backgroundColor: BRAND.primary }}
            >
              {submitting ? "Creating account..." : "Create Account"}
            </button>
            <div className="text-center text-xs mt-2">
              <button type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }} className="text-blue-500 hover:underline">
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}

        {/* FORGOT PASSWORD FORM */}
        {mode === "forgot" && (
          <form onSubmit={handleForgotPassword} className="space-y-3">
            <input
              type="email"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg font-semibold text-white transition disabled:opacity-50"
              style={{ backgroundColor: BRAND.primary }}
            >
              {submitting ? "Sending..." : "Send Reset Email"}
            </button>
            <div className="text-center text-xs mt-2">
              <button type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }} className="text-blue-500 hover:underline">
                Back to sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
