import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { LOGO_SRC } from "./logo";
import { generateEstimatePDF } from "./pdfGenerator";

// ─── BRAND ───────────────────────────────────────────────────────────────────
const BRAND = {
  primary: "#6B7EC2",
  primaryDark: "#4A5A9B",
  primaryLight: "#8B9BD6",
  primaryBg: "#EEF0F8",
};

// ─── STATUS CONFIG ──────────────────────────────────────────────────────────
const STATUSES = {
  submitted: { label: "Submitted", color: "#6B7EC2", bg: "#EEF0F8" },
  reviewed: { label: "Reviewed", color: "#2563eb", bg: "#dbeafe" },
  approved: { label: "Approved", color: "#16a34a", bg: "#dcfce7" },
  rejected: { label: "Rejected", color: "#dc2626", bg: "#fee2e2" },
};

function StatusBadge({ status }) {
  const s = STATUSES[status] || STATUSES.submitted;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ color: s.color, backgroundColor: s.bg }}
    >
      {s.label}
    </span>
  );
}

const fmt = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);

const fmtDec = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

function NileBuiltLogo({ size = 64 }) {
  return (
    <div style={{ background: "white", borderRadius: 12, padding: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>
      <img src={LOGO_SRC} alt="NileBuilt" style={{ height: size, width: "auto", display: "block" }} />
    </div>
  );
}

// ─── COMPARE VIEW ───────────────────────────────────────────────────────────
function CompareView({ estimates, onBack }) {
  const CompareRow = ({ label, values, format = "currency", bold }) => (
    <div className={`grid border-b border-gray-100 ${bold ? "bg-gray-50" : ""}`} style={{ gridTemplateColumns: `180px repeat(${values.length}, 1fr)` }}>
      <div className={`py-2.5 px-3 text-sm ${bold ? "font-bold text-gray-800" : "text-gray-600"}`}>{label}</div>
      {values.map((v, i) => (
        <div key={i} className={`py-2.5 px-3 text-sm text-right ${bold ? "font-bold text-gray-900" : "font-semibold text-gray-800"}`}>
          {format === "currency" ? fmt(v) : format === "number" ? Number(v || 0).toLocaleString() : v}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${BRAND.primaryDark} 0%, ${BRAND.primary} 100%)` }}
      >
        <NileBuiltLogo size={48} />
        <div className="text-lg font-bold">Compare Estimates</div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold mb-4" style={{ color: BRAND.primary }}>
          ← Back to My Estimates
        </button>

        {/* Project Headers */}
        <div className="grid mb-4" style={{ gridTemplateColumns: `180px repeat(${estimates.length}, 1fr)` }}>
          <div />
          {estimates.map((est) => (
            <div key={est.id} className="px-3">
              <div className="font-bold text-gray-800 text-sm">{est.project_title}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {est.city && `${est.city}, `}{est.state || ""}
              </div>
              <div className="text-xs text-gray-400">
                {new Date(est.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
          ))}
        </div>

        {/* Structure */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
          <div className="px-4 py-3 font-bold text-gray-700 border-b border-gray-200 text-sm" style={{ backgroundColor: BRAND.primaryBg }}>
            Structure
          </div>
          <CompareRow label="Stories" values={estimates.map(e => e.stories)} format="number" />
          <CompareRow label="Total Sqft" values={estimates.map(e => e.total_sqft)} format="number" />
          <CompareRow label="Concrete $/Yard" values={estimates.map(e => e.estimate_data?.concreteCost)} />
          <CompareRow label="Labor $/Hour" values={estimates.map(e => e.estimate_data?.laborRate)} />
        </div>

        {/* Envelope Costs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
          <div className="px-4 py-3 font-bold text-gray-700 border-b border-gray-200 text-sm" style={{ backgroundColor: BRAND.primaryBg }}>
            Envelope Costs
          </div>
          <CompareRow label="Wall Materials" values={estimates.map(e => e.estimate_data?.wallMaterials)} />
          <CompareRow label="Wall Labor" values={estimates.map(e => e.estimate_data?.wallLabor)} />
          <CompareRow label="Floor / Deck" values={estimates.map(e => e.estimate_data?.floorDeck)} />
          <CompareRow label="Roof" values={estimates.map(e => e.estimate_data?.roof)} />
          <CompareRow label="Structure Subtotal" values={estimates.map(e => e.estimate_data?.structureSubtotal)} bold />
          <CompareRow label="NileBuilt Tech Fees" values={estimates.map(e => e.estimate_data?.totalTechFees)} />
          <CompareRow label="Total Envelope" values={estimates.map(e => e.estimate_data?.totalEnvelope)} bold />
        </div>

        {/* Foundation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
          <div className="px-4 py-3 font-bold text-gray-700 border-b border-gray-200 text-sm" style={{ backgroundColor: BRAND.primaryBg }}>
            Foundation & Sitework
          </div>
          <CompareRow label="Foundation Subtotal" values={estimates.map(e => e.estimate_data?.foundationSubtotal)} bold />
        </div>

        {/* Budget (if any proforma) */}
        {estimates.some(e => e.app_source === "proforma" && e.estimate_data?.budgetGrandTotal > 0) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
            <div className="px-4 py-3 font-bold text-gray-700 border-b border-gray-200 text-sm" style={{ backgroundColor: BRAND.primaryBg }}>
              Budget Detail
            </div>
            <CompareRow label="Budget Grand Total" values={estimates.map(e => e.estimate_data?.budgetGrandTotal)} bold />
          </div>
        )}

        {/* Totals */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-hidden" style={{ backgroundColor: BRAND.primaryBg }}>
          <CompareRow label="Total Project Cost" values={estimates.map(e => e.total_cost)} bold />
          <CompareRow label="Cost per Sqft" values={estimates.map(e => e.cost_per_sqft)} />
          {estimates.some(e => e.estimate_data?.salesPrice > 0) && (
            <CompareRow label="Sales Price" values={estimates.map(e => e.estimate_data?.salesPrice)} />
          )}
        </div>
      </main>
    </div>
  );
}

// ─── ESTIMATE DETAIL VIEW ────────────────────────────────────────────────────
function EstimateDetail({ estimate, onBack, onDuplicate }) {
  const d = estimate.estimate_data || {};
  const totalSqft = d.totalSqft || estimate.total_sqft || 0;
  const costPerSqft = d.costPerSqft || estimate.cost_per_sqft || 0;
  const isProforma = estimate.app_source === "proforma";

  const SummaryRow = ({ label, value, bold }) => (
    <div className={`flex justify-between py-2 border-b border-gray-100 ${bold ? "font-bold" : ""}`}>
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm ${bold ? "font-bold text-gray-900" : "font-semibold text-gray-800"}`}>{value}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${BRAND.primaryDark} 0%, ${BRAND.primary} 100%)` }}
      >
        <NileBuiltLogo size={48} />
        <div className="text-right">
          <div className="text-sm opacity-75">Estimate Summary</div>
          <div className="text-xl font-bold">{fmt(estimate.total_cost)}</div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold" style={{ color: BRAND.primary }}>
            ← Back to My Estimates
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => generateEstimatePDF(estimate)}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border transition hover:shadow-sm"
              style={{ borderColor: BRAND.primary, color: BRAND.primary }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              PDF
            </button>
            {onDuplicate && (
              <button
                onClick={() => onDuplicate(estimate)}
                className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border transition hover:shadow-sm"
                style={{ borderColor: BRAND.primary, color: BRAND.primary }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Duplicate
              </button>
            )}
          </div>
        </div>

        {/* Project Info */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4">
          <h3 className="font-bold text-gray-800 mb-3">Project Information</h3>
          <SummaryRow label="Project Name" value={estimate.project_title} />
          <SummaryRow label="Address" value={`${estimate.street_address || ""} ${estimate.city ? ", " + estimate.city : ""} ${estimate.state || ""}`} />
          <SummaryRow label="Builder" value={`${estimate.builder_first_name || ""} ${estimate.builder_last_name || ""}`.trim() || estimate.builder_email} />
          <SummaryRow label="Email" value={estimate.builder_email} />
          {d.builderPhone && <SummaryRow label="Phone" value={d.builderPhone} />}
          {d.salesPrice > 0 && <SummaryRow label="Sales Price" value={fmt(d.salesPrice)} />}
        </div>

        {/* Structure */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4">
          <h3 className="font-bold text-gray-800 mb-3">Structure</h3>
          <SummaryRow label="Stories" value={estimate.stories} />
          <SummaryRow label="Total Square Footage" value={`${Number(totalSqft).toLocaleString()} sqft`} />
          {d.concreteCost && <SummaryRow label="Concrete Cost/Yard" value={fmt(d.concreteCost)} />}
          {d.laborRate && <SummaryRow label="Labor Rate/Hour" value={fmt(d.laborRate)} />}
        </div>

        {/* Envelope Costs */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4">
          <h3 className="font-bold text-gray-800 mb-3">Envelope Costs</h3>
          {d.wallMaterials != null && <SummaryRow label="Wall Materials" value={fmt(d.wallMaterials)} />}
          {d.wallLabor != null && <SummaryRow label="Wall Labor" value={fmt(d.wallLabor)} />}
          {d.floorDeck != null && <SummaryRow label="Floor / Deck" value={fmt(d.floorDeck)} />}
          {d.roof != null && <SummaryRow label="Roof" value={fmt(d.roof)} />}
          {d.structureSubtotal != null && <SummaryRow label="Structure Subtotal" value={fmt(d.structureSubtotal)} bold />}
          {d.totalTechFees != null && <SummaryRow label="NileBuilt Technology Fees" value={fmt(d.totalTechFees)} />}
          {d.totalEnvelope != null && <SummaryRow label="Total Envelope" value={fmt(d.totalEnvelope)} bold />}
        </div>

        {/* Foundation */}
        {d.foundationSubtotal > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4">
            <h3 className="font-bold text-gray-800 mb-3">Foundation & Sitework</h3>
            {(d.foundationItems || []).filter(i => i.total > 0).map((item, idx) => (
              <SummaryRow key={idx} label={item.name} value={fmt(item.total)} />
            ))}
            <SummaryRow label="Foundation Subtotal" value={fmt(d.foundationSubtotal)} bold />
          </div>
        )}

        {/* Budget (Proforma only) */}
        {isProforma && d.budgetGrandTotal > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4">
            <h3 className="font-bold text-gray-800 mb-3">Budget Detail</h3>
            {(d.budgetCategories || []).filter(c => c.subtotal > 0).map((cat, idx) => (
              <SummaryRow key={idx} label={cat.label} value={fmt(cat.subtotal)} />
            ))}
            <SummaryRow label="Budget Grand Total" value={fmt(d.budgetGrandTotal)} bold />
          </div>
        )}

        {/* Grand Total */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4" style={{ backgroundColor: BRAND.primaryBg }}>
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold" style={{ color: BRAND.primaryDark }}>Total Project Cost</span>
            <span className="text-xl font-bold" style={{ color: BRAND.primaryDark }}>{fmt(estimate.total_cost)}</span>
          </div>
          {costPerSqft > 0 && (
            <div className="text-right text-sm text-gray-500 mt-1">{fmtDec(costPerSqft)}/sqft</div>
          )}
        </div>

        <div className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-2">
          <StatusBadge status={estimate.estimate_data?._status || "submitted"} />
          <span>
            {new Date(estimate.created_at).toLocaleDateString("en-US", {
              month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
            })}
          </span>
        </div>
      </main>
    </div>
  );
}

// ─── MAIN DASHBOARD ──────────────────────────────────────────────────────────
export default function EstimatesDashboard({ user, onNewEstimate, onSignOut, appSource }) {
  const [estimates, setEstimates] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState(new Set());
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    fetchEstimates();
  }, []);

  const fetchEstimates = async () => {
    setLoading(true);
    try {
      // Fetch submitted estimates
      let query = supabase
        .from("estimates")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (appSource) {
        query = query.eq("app_source", appSource);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEstimates(data || []);

      // Fetch draft
      const { data: draftData } = await supabase
        .from("estimates")
        .select("*")
        .eq("user_id", user.id)
        .eq("app_source", `${appSource}_draft`)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      setDraft(draftData || null);
    } catch (err) {
      console.error("Error fetching estimates:", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteDraft = async () => {
    if (!draft) return;
    await supabase
      .from("estimates")
      .delete()
      .eq("user_id", user.id)
      .eq("app_source", `${appSource}_draft`);
    setDraft(null);
  };

  const handleDuplicate = (est) => {
    const ed = est.estimate_data || {};
    // Build a data object that the estimator can use as initialData
    const duplicateData = {
      ...ed,
      projectName: (est.project_title || "") + " (Copy)",
      street: est.street_address || ed.street || "",
      city: est.city || ed.city || "",
      state: est.state || ed.state || "",
      county: ed.county || "",
      firstName: est.builder_first_name || ed.firstName || "",
      lastName: est.builder_last_name || ed.lastName || "",
      builderEmail: est.builder_email || ed.builderEmail || "",
      builderPhone: ed.builderPhone || "",
      salesPrice: ed.salesPrice || "",
      stories: String(est.stories || ed.stories || ""),
      sqft1: ed.sqft1 || "",
      sqft2: ed.sqft2 || "",
      sqft3: ed.sqft3 || "",
      sqft4: ed.sqft4 || "",
      _draftStep: 0, // Start from step 1 so they can review
    };
    onNewEstimate(duplicateData);
  };

  const toggleCompare = (id) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  };

  if (showCompare) {
    const compareEstimates = estimates.filter((e) => compareIds.has(e.id));
    return (
      <CompareView
        estimates={compareEstimates}
        onBack={() => { setShowCompare(false); setCompareMode(false); setCompareIds(new Set()); }}
      />
    );
  }

  if (selectedEstimate) {
    return (
      <EstimateDetail
        estimate={selectedEstimate}
        onBack={() => setSelectedEstimate(null)}
        onDuplicate={handleDuplicate}
      />
    );
  }

  const userName =
    user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
      : user.email;

  return (
    <div className="min-h-screen bg-gray-50">
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
        <button
          onClick={onNewEstimate}
          className="w-full py-4 rounded-xl font-semibold text-white text-lg transition hover:opacity-90 mb-8 shadow-lg"
          style={{ backgroundColor: BRAND.primary }}
        >
          + New Estimate
        </button>

        {/* Draft Card */}
        {draft && (
          <div
            className="mb-6 rounded-xl p-4 border-2 border-dashed shadow-sm"
            style={{ borderColor: BRAND.primary, backgroundColor: BRAND.primaryBg }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: BRAND.primary }}>
                    Draft
                  </span>
                  <span className="font-semibold text-gray-800">{draft.project_title || "Untitled"}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Last saved {new Date(draft.estimate_data?._savedAt || draft.created_at).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                  })}
                  {draft.estimate_data?._draftStep != null && ` · Step ${draft.estimate_data._draftStep + 1}`}
                </div>
              </div>
              <button
                onClick={deleteDraft}
                className="text-gray-400 hover:text-red-500 text-sm px-2"
                title="Discard draft"
              >
                Discard
              </button>
            </div>
            <button
              onClick={() => onNewEstimate(draft.estimate_data)}
              className="w-full mt-3 py-2.5 rounded-lg font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: BRAND.primary }}
            >
              Resume Estimate →
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">Past Estimates</h2>
          {estimates.length >= 2 && (
            <div className="flex items-center gap-2">
              {compareMode && compareIds.size >= 2 && (
                <button
                  onClick={() => setShowCompare(true)}
                  className="text-sm font-semibold px-3 py-1.5 rounded-lg text-white transition hover:opacity-90"
                  style={{ backgroundColor: BRAND.primary }}
                >
                  Compare ({compareIds.size})
                </button>
              )}
              <button
                onClick={() => { setCompareMode(!compareMode); setCompareIds(new Set()); }}
                className={`text-sm font-semibold px-3 py-1.5 rounded-lg border transition ${compareMode ? "text-white" : ""}`}
                style={compareMode
                  ? { backgroundColor: BRAND.primaryDark, borderColor: BRAND.primaryDark, color: "white" }
                  : { borderColor: BRAND.primary, color: BRAND.primary }
                }
              >
                {compareMode ? "Cancel" : "Compare"}
              </button>
            </div>
          )}
        </div>
        {compareMode && (
          <div className="text-xs text-gray-500 mb-3 -mt-2">Select 2-3 estimates to compare side by side</div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading your estimates...</div>
        ) : estimates.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-sm">No estimates yet.</div>
            <div className="text-gray-400 text-sm mt-1">Click "New Estimate" to get started!</div>
          </div>
        ) : (
          <div className="space-y-3">
            {estimates.map((est) => {
              const isSelected = compareIds.has(est.id);
              return (
                <div
                  key={est.id}
                  onClick={() => compareMode ? toggleCompare(est.id) : setSelectedEstimate(est)}
                  className={`bg-white rounded-xl p-4 shadow-sm border transition cursor-pointer ${
                    isSelected ? "border-2 ring-1" : "border-gray-100 hover:shadow-md"
                  }`}
                  style={isSelected ? { borderColor: BRAND.primary, ringColor: BRAND.primaryLight } : {}}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      {compareMode && (
                        <div className="pt-0.5">
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                              isSelected ? "text-white" : "border-gray-300"
                            }`}
                            style={isSelected ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary } : {}}
                          >
                            {isSelected && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            )}
                          </div>
                        </div>
                      )}
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
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-800">{fmt(est.total_cost)}</div>
                      {est.cost_per_sqft > 0 && (
                        <div className="text-xs text-gray-400">{fmt(est.cost_per_sqft)}/sqft</div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-300 mt-2 border-t border-gray-50 pt-2">
                    <span className="flex items-center gap-2">
                      {new Date(est.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                      <StatusBadge status={est.estimate_data?._status || "submitted"} />
                    </span>
                    {!compareMode && <span className="text-xs font-medium" style={{ color: BRAND.primary }}>View →</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
