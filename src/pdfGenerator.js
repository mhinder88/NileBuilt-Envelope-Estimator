/**
 * PDF Generator — creates a professional branded estimate PDF
 * Uses jsPDF + jspdf-autotable
 */
import jsPDF from "jspdf";
import "jspdf-autotable";

const BRAND_COLOR = [107, 126, 194]; // #6B7EC2
const BRAND_DARK = [74, 90, 155];    // #4A5A9B
const GRAY_600 = [75, 85, 99];
const GRAY_400 = [156, 163, 175];
const WHITE = [255, 255, 255];

const fmt = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n || 0);

const fmtDec = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n || 0);

export function generateEstimatePDF(estimate) {
  const d = estimate.estimate_data || {};
  const totalSqft = d.totalSqft || estimate.total_sqft || 0;
  const costPerSqft = d.costPerSqft || estimate.cost_per_sqft || 0;
  const isProforma = estimate.app_source === "proforma";

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // ─── Header bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageWidth, 30, "F");

  doc.setTextColor(...WHITE);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("NileBuilt", margin, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(isProforma ? "Full Proforma Estimate" : "Envelope Estimate", margin, 21);

  // Total cost in header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(fmt(estimate.total_cost), pageWidth - margin, 14, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Total Project Cost", pageWidth - margin, 21, { align: "right" });

  y = 38;

  // ─── Helper: Section header ──────────────────────────────────────────────────
  const sectionHeader = (title) => {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFillColor(238, 240, 248); // primaryBg
    doc.roundedRect(margin, y, contentWidth, 8, 1, 1, "F");
    doc.setTextColor(...BRAND_DARK);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin + 3, y + 5.5);
    y += 12;
  };

  // ─── Helper: Row ─────────────────────────────────────────────────────────────
  const row = (label, value, bold = false) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.setTextColor(...(bold ? [31, 41, 55] : GRAY_600));
    doc.text(label, margin + 3, y + 3.5);
    doc.setTextColor(...(bold ? [31, 41, 55] : [31, 41, 55]));
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(String(value), pageWidth - margin - 3, y + 3.5, { align: "right" });
    // divider line
    doc.setDrawColor(240, 240, 240);
    doc.line(margin + 2, y + 6, pageWidth - margin - 2, y + 6);
    y += 7.5;
  };

  // ─── Project Information ─────────────────────────────────────────────────────
  sectionHeader("Project Information");
  row("Project Name", estimate.project_title || "");
  const address = [estimate.street_address, estimate.city, estimate.state].filter(Boolean).join(", ");
  row("Address", address);
  const builder = `${estimate.builder_first_name || ""} ${estimate.builder_last_name || ""}`.trim() || estimate.builder_email;
  row("Builder", builder);
  row("Email", estimate.builder_email || "");
  if (d.builderPhone) row("Phone", d.builderPhone);
  if (d.salesPrice > 0) row("Sales Price", fmt(d.salesPrice));
  y += 4;

  // ─── Structure ───────────────────────────────────────────────────────────────
  sectionHeader("Structure");
  row("Stories", estimate.stories || "");
  row("Total Square Footage", `${Number(totalSqft).toLocaleString()} sqft`);
  if (d.concreteCost) row("Concrete Cost/Yard", fmt(d.concreteCost));
  if (d.laborRate) row("Labor Rate/Hour", fmt(d.laborRate));
  y += 4;

  // ─── Envelope Costs ──────────────────────────────────────────────────────────
  sectionHeader("Envelope Costs");
  if (d.wallMaterials != null) row("Wall Materials", fmt(d.wallMaterials));
  if (d.wallLabor != null) row("Wall Labor", fmt(d.wallLabor));
  if (d.floorDeck != null) row("Floor / Deck", fmt(d.floorDeck));
  if (d.roof != null) row("Roof", fmt(d.roof));
  if (d.structureSubtotal != null) row("Structure Subtotal", fmt(d.structureSubtotal), true);
  if (d.totalTechFees != null) row("NileBuilt Technology Fees", fmt(d.totalTechFees));
  if (d.totalEnvelope != null) row("Total Envelope", fmt(d.totalEnvelope), true);
  y += 4;

  // ─── Foundation ──────────────────────────────────────────────────────────────
  if (d.foundationSubtotal > 0) {
    sectionHeader("Foundation & Sitework");
    (d.foundationItems || []).filter(i => i.total > 0).forEach((item) => {
      row(item.name, fmt(item.total));
    });
    row("Foundation Subtotal", fmt(d.foundationSubtotal), true);
    y += 4;
  }

  // ─── Budget (Proforma only) ──────────────────────────────────────────────────
  if (isProforma && d.budgetGrandTotal > 0) {
    sectionHeader("Budget Detail");
    (d.budgetCategories || []).filter(c => c.subtotal > 0).forEach((cat) => {
      row(cat.label, fmt(cat.subtotal));
    });
    row("Budget Grand Total", fmt(d.budgetGrandTotal), true);
    y += 4;
  }

  // ─── Grand Total ─────────────────────────────────────────────────────────────
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFillColor(...BRAND_COLOR);
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Total Project Cost", margin + 5, y + 7);
  doc.setFontSize(14);
  doc.text(fmt(estimate.total_cost), pageWidth - margin - 5, y + 7, { align: "right" });
  if (costPerSqft > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${fmtDec(costPerSqft)}/sqft`, pageWidth - margin - 5, y + 13, { align: "right" });
  }
  y += 22;

  // ─── Footer ──────────────────────────────────────────────────────────────────
  doc.setTextColor(...GRAY_400);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const dateStr = new Date(estimate.created_at).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
  doc.text(`Generated ${dateStr}`, pageWidth / 2, y + 2, { align: "center" });
  doc.text("NileBuilt Corp — www.nilebuilt.com", pageWidth / 2, y + 7, { align: "center" });

  // ─── Save ────────────────────────────────────────────────────────────────────
  const safeName = (estimate.project_title || "estimate").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
  doc.save(`NileBuilt_${safeName}.pdf`);
}
