import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

// ─── BRAND ───────────────────────────────────────────────────────────────────
const BRAND = {
  primary: "#6B7EC2",
  primaryDark: "#4A5A9B",
  primaryLight: "#8B9BD6",
  primaryBg: "#EEF0F8",
};

const fmt = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function EstimatesDashboard({ user, onNewEstimate, onSignOut, appSource }) {
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEstimates();
  }, []);

  const fetchEstimates = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("estimates")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Optionally filter by app source
      if (appSource) {
        query = query.eq("app_source", appSource);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEstimates(data || []);
    } catch (err) {
      console.error("Error fetching estimates:", err);
    } finally {
      setLoading(false);
    }
  };

  const userName =
    user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
      : user.email;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header
        className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${BRAND.primaryDark} 0%, ${BRAND.primary} 100%)` }}
      >
        <div>
          <div className="text-lg font-bold">Welcome, {userName}</div>
          <div className="text-xs opacity-75">{user.email}</div>
        </div>
        <button
          onClick={onSignOut}
          className="text-sm px-4 py-2 rounded-lg bg-white bg-opacity-20 hover:bg-opacity-30 transition"
        >
          Sign Out
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* New Estimate Button */}
        <button
          onClick={onNewEstimate}
          className="w-full py-4 rounded-xl font-semibold text-white text-lg transition hover:opacity-90 mb-8 shadow-lg"
          style={{ backgroundColor: BRAND.primary }}
        >
          + New Estimate
        </button>

        {/* Past Estimates */}
        <h2 className="text-lg font-bold text-gray-800 mb-4">Past Estimates</h2>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading your estimates...</div>
        ) : estimates.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-sm">No estimates yet.</div>
            <div className="text-gray-400 text-sm mt-1">Click "New Estimate" to get started!</div>
          </div>
        ) : (
          <div className="space-y-3">
            {estimates.map((est) => (
              <div
                key={est.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-gray-800">{est.project_title}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {est.street_address && `${est.street_address}, `}
                      {est.city && `${est.city}, `}
                      {est.state || ""}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {est.stories && `${est.stories} stories`}
                      {est.total_sqft && ` · ${Number(est.total_sqft).toLocaleString()} sqft`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-800">{fmt(est.total_cost)}</div>
                    {est.cost_per_sqft > 0 && (
                      <div className="text-xs text-gray-400">{fmt(est.cost_per_sqft)}/sqft</div>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-300 mt-2 border-t border-gray-50 pt-2">
                  {new Date(est.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {est.app_source && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                      {est.app_source === "envelope" ? "Envelope" : "Full Proforma"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
