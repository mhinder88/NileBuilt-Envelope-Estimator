/**
 * Smart Defaults — learns from a builder's past estimates and pre-fills
 * fields they consistently use with the same values.
 *
 * Uses the existing `estimates` table (estimate_data JSONB column) to
 * derive defaults — no additional Supabase table needed.
 *
 * Also stores explicit builder defaults in localStorage as a fallback
 * and for instant loading (Supabase fetch runs in background to update).
 */

import { supabase } from "./supabaseClient";

// ─── Fields eligible for smart defaults ─────────────────────────────────────
// Each entry: { key, path (in estimate_data), label (for UI) }
const DEFAULTABLE_FIELDS = [
  { key: "concreteCost", label: "Concrete Cost/Yard" },
  { key: "laborRate", label: "Labor Rate/Hour" },
  { key: "openingAllowance", label: "Opening Allowance %" },
  { key: "solarCostPerKW", label: "Solar Cost/KW" },
  { key: "batteryCostPerUnit", label: "Battery Cost/Unit" },
];

// Budget line items are handled separately — they track bid/units/price per item

const STORAGE_KEY = "nilebuilt_builder_defaults";

// ─── Load defaults from localStorage (instant) ─────────────────────────────
function loadLocalDefaults(userId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Save defaults to localStorage ──────────────────────────────────────────
function saveLocalDefaults(userId, defaults) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(defaults));
  } catch {
    // silently fail
  }
}

// ─── Analyze past estimates to find consistent field values ─────────────────
export async function loadSmartDefaults(userId, appSource) {
  // 1. Try localStorage for instant result
  const local = loadLocalDefaults(userId);

  // 2. Fetch last 10 estimates from Supabase
  try {
    const { data: estimates, error } = await supabase
      .from("estimates")
      .select("estimate_data")
      .eq("user_id", userId)
      .eq("app_source", appSource)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error || !estimates || estimates.length < 1) {
      return local || { fields: {}, budgetItems: {}, foundationItems: {}, hasDefaults: false };
    }

    const result = { fields: {}, budgetItems: {}, foundationItems: {}, hasDefaults: false };

    // Analyze simple fields
    DEFAULTABLE_FIELDS.forEach(({ key }) => {
      const values = estimates
        .map((e) => e.estimate_data?.[key])
        .filter((v) => v != null && v !== "" && v !== 0);

      if (values.length >= 2) {
        // Find the most common value
        const counts = {};
        values.forEach((v) => {
          const s = String(v);
          counts[s] = (counts[s] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const [mostCommon, count] = sorted[0];

        // If used in 50%+ of estimates, suggest it
        if (count >= Math.max(2, Math.floor(values.length * 0.5))) {
          result.fields[key] = {
            value: mostCommon,
            confidence: Math.round((count / values.length) * 100),
            usedIn: count,
            totalEstimates: values.length,
          };
          result.hasDefaults = true;
        }
      }
    });

    // Analyze budget line items (proforma only)
    if (appSource === "proforma") {
      const allBudgetData = estimates
        .map((e) => e.estimate_data?.budgetCategories)
        .filter(Boolean);

      if (allBudgetData.length >= 2) {
        // Build a map of item -> values across estimates
        const itemValues = {};
        allBudgetData.forEach((categories) => {
          if (!Array.isArray(categories)) return;
          categories.forEach((cat) => {
            if (!cat.items) return;
            cat.items.forEach((item) => {
              if (item.total > 0) {
                const itemKey = `${cat.key}::${item.name}`;
                if (!itemValues[itemKey]) itemValues[itemKey] = [];
                itemValues[itemKey].push({
                  bid: item.bid,
                  units: item.units,
                  price: item.price,
                  total: item.total,
                });
              }
            });
          });
        });

        // Find items with consistent values
        Object.entries(itemValues).forEach(([itemKey, vals]) => {
          if (vals.length >= 2) {
            // Check if bid values are consistent
            const bids = vals.map((v) => v.bid).filter((b) => b > 0);
            if (bids.length >= 2) {
              const counts = {};
              bids.forEach((b) => { counts[b] = (counts[b] || 0) + 1; });
              const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
              if (sorted[0][1] >= 2) {
                result.budgetItems[itemKey] = {
                  bid: sorted[0][0],
                  confidence: Math.round((sorted[0][1] / vals.length) * 100),
                };
                result.hasDefaults = true;
              }
            }

            // Check if units+price are consistent
            const unitPrices = vals
              .filter((v) => v.units > 0 && v.price > 0)
              .map((v) => `${v.units}|${v.price}`);
            if (unitPrices.length >= 2) {
              const counts = {};
              unitPrices.forEach((up) => { counts[up] = (counts[up] || 0) + 1; });
              const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
              if (sorted[0][1] >= 2) {
                const [units, price] = sorted[0][0].split("|");
                result.budgetItems[itemKey] = {
                  ...(result.budgetItems[itemKey] || {}),
                  units,
                  price,
                  confidence: Math.round((sorted[0][1] / vals.length) * 100),
                };
                result.hasDefaults = true;
              }
            }
          }
        });
      }
    }

    // Analyze foundation line items
    const allFoundation = estimates
      .map((e) => e.estimate_data?.foundationItems)
      .filter(Boolean);

    if (allFoundation.length >= 2) {
      const itemValues = {};
      allFoundation.forEach((items) => {
        if (!Array.isArray(items)) return;
        items.forEach((item) => {
          if (item.total > 0 && item.id) {
            if (!itemValues[item.id]) itemValues[item.id] = [];
            itemValues[item.id].push(item);
          }
        });
      });

      Object.entries(itemValues).forEach(([itemId, vals]) => {
        if (vals.length >= 2) {
          // Check bid consistency
          const bids = vals.map((v) => v.bid || v.bidCost).filter((b) => b > 0);
          if (bids.length >= 2) {
            const counts = {};
            bids.forEach((b) => { counts[b] = (counts[b] || 0) + 1; });
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            if (sorted[0][1] >= 2) {
              result.foundationItems[itemId] = {
                bid: sorted[0][0],
                confidence: Math.round((sorted[0][1] / vals.length) * 100),
              };
              result.hasDefaults = true;
            }
          }
        }
      });
    }

    // Cache to localStorage
    saveLocalDefaults(userId, result);
    return result;
  } catch (err) {
    console.error("Smart defaults load error:", err);
    return local || { fields: {}, budgetItems: {}, foundationItems: {}, hasDefaults: false };
  }
}

// ─── Apply defaults to state setters ────────────────────────────────────────
export function applyFieldDefaults(defaults, setters) {
  if (!defaults?.hasDefaults) return 0;
  let applied = 0;

  Object.entries(defaults.fields).forEach(([key, def]) => {
    if (setters[key]) {
      setters[key](def.value);
      applied++;
    }
  });

  return applied;
}

// ─── Apply budget item defaults ─────────────────────────────────────────────
export function applyBudgetDefaults(defaults, currentBudgetData) {
  if (!defaults?.budgetItems || Object.keys(defaults.budgetItems).length === 0) {
    return { data: currentBudgetData, applied: 0 };
  }

  const newData = { ...currentBudgetData };
  let applied = 0;

  Object.entries(defaults.budgetItems).forEach(([itemKey, def]) => {
    const [catKey, itemName] = itemKey.split("::");
    if (!catKey || !itemName) return;

    if (!newData[catKey]) newData[catKey] = {};
    if (!newData[catKey][itemName]) newData[catKey][itemName] = {};

    const existing = newData[catKey][itemName];
    // Only apply if the field is currently empty
    if (!existing.bid && !existing.units && !existing.price) {
      if (def.bid) {
        newData[catKey][itemName] = { ...existing, bid: def.bid, _autoFilled: true };
        applied++;
      }
      if (def.units && def.price) {
        newData[catKey][itemName] = {
          ...existing,
          units: def.units,
          price: def.price,
          _autoFilled: true,
        };
        applied++;
      }
    }
  });

  return { data: newData, applied };
}

// ─── Apply foundation item defaults ─────────────────────────────────────────
export function applyFoundationDefaults(defaults, currentFoundationData) {
  if (!defaults?.foundationItems || Object.keys(defaults.foundationItems).length === 0) {
    return { data: currentFoundationData, applied: 0 };
  }

  const newData = { ...currentFoundationData };
  let applied = 0;

  Object.entries(defaults.foundationItems).forEach(([itemId, def]) => {
    if (!newData[itemId]) newData[itemId] = {};
    const existing = newData[itemId];
    if (!existing.bid && !existing.units && !existing.price) {
      if (def.bid) {
        newData[itemId] = { ...existing, bid: def.bid, _autoFilled: true };
        applied++;
      }
    }
  });

  return { data: newData, applied };
}

// ─── SmartDefaultsBanner component ──────────────────────────────────────────
export function SmartDefaultsBanner({ appliedCount, onDismiss, onViewDefaults }) {
  if (!appliedCount || appliedCount === 0) return null;

  return (
    <div
      className="mx-4 mb-4 p-4 rounded-xl border flex items-start gap-3 animate-fade-in"
      style={{
        background: "linear-gradient(135deg, #EEF0F8 0%, #E8EDFB 100%)",
        borderColor: "#C5CCE8",
      }}
    >
      <span className="text-2xl mt-0.5">🧠</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-800">
          Smart Defaults Applied
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {appliedCount} field{appliedCount !== 1 ? "s" : ""} pre-filled from your
          previous estimates. Review and adjust as needed.
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-gray-400 hover:text-gray-600 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
