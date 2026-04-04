/**
 * Draft Manager — auto-saves estimate progress to Supabase
 * so builders can close the browser and pick up where they left off.
 *
 * Uses the existing `estimates` table with app_source = "envelope_draft"
 * or "proforma_draft" to avoid schema changes. Only one draft per user
 * per app is allowed (upsert via delete+insert).
 */

import { supabase } from "./supabaseClient";

// ─── Save draft (debounced — call frequently, writes sparingly) ─────────────
let saveTimer = null;

export function saveDraftDebounced(userId, appSource, step, formData, delay = 2000) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveDraft(userId, appSource, step, formData);
  }, delay);
}

export async function saveDraft(userId, appSource, step, formData) {
  if (!userId) return;
  const draftSource = `${appSource}_draft`;

  try {
    // Delete existing draft
    await supabase
      .from("estimates")
      .delete()
      .eq("user_id", userId)
      .eq("app_source", draftSource);

    // Insert new draft
    const { error } = await supabase.from("estimates").insert({
      user_id: userId,
      app_source: draftSource,
      project_title: formData.projectName || "Untitled Draft",
      builder_email: formData.builderEmail || "",
      builder_first_name: formData.firstName || "",
      builder_last_name: formData.lastName || "",
      street_address: formData.street || "",
      city: formData.city || "",
      state: formData.state || "",
      stories: parseInt(formData.stories) || 0,
      total_sqft: formData.totalSqft || 0,
      total_cost: 0,
      cost_per_sqft: 0,
      estimate_data: {
        ...formData,
        _draftStep: step,
        _savedAt: new Date().toISOString(),
      },
    });

    if (error) {
      console.error("Draft save error:", error);
    }
  } catch (err) {
    console.error("Draft save error:", err);
  }
}

// ─── Load draft ─────────────────────────────────────────────────────────────
export async function loadDraft(userId, appSource) {
  if (!userId) return null;
  const draftSource = `${appSource}_draft`;

  try {
    const { data, error } = await supabase
      .from("estimates")
      .select("*")
      .eq("user_id", userId)
      .eq("app_source", draftSource)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── Delete draft (after successful submit) ─────────────────────────────────
export async function deleteDraft(userId, appSource) {
  if (!userId) return;
  const draftSource = `${appSource}_draft`;

  try {
    await supabase
      .from("estimates")
      .delete()
      .eq("user_id", userId)
      .eq("app_source", draftSource);
  } catch (err) {
    console.error("Draft delete error:", err);
  }
}

// ─── Cancel any pending save ────────────────────────────────────────────────
export function cancelPendingSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}
