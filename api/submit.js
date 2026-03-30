// Vercel Serverless Function — POST /api/submit
// Saves envelope estimate data to Zoho Creator

// ─── Token cache ────────────────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;

  const domain = process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
  });

  const res = await fetch(`${domain}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();
  if (data.error) throw new Error(`Token error: ${data.error}`);
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

// ─── Currency formatter ─────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n || 0);
}

// ─── Main handler ───────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const p = req.body;
    if (!p || !p.Project_Title) {
      return res.status(400).json({ error: "Missing required field: Project_Title" });
    }

    // Get access token
    let token;
    try {
      token = await getAccessToken();
    } catch (tokenErr) {
      console.error("Token error:", tokenErr.message);
      return res.status(500).json({ error: "Authentication failed: " + tokenErr.message });
    }

    // Save to Zoho Creator — Envelope_Estimate form
    let creatorResult = null;
    try {
      const owner = process.env.ZOHO_CREATOR_OWNER || "nilebuilt";
      const app = process.env.ZOHO_CREATOR_APP || "nilebuilt-envelope-estimator";
      const form = process.env.ZOHO_CREATOR_FORM || "Envelope_Estimate";
      const url = `https://creator.zoho.com/api/v2.1/${owner}/${app}/form/${form}`;

      const totalSqft = p.totalSqft || 0;
      const avgSqft = totalSqft > 0 && p.stories > 0 ? Math.round(totalSqft / p.stories) : 0;
      const costPerSqft = totalSqft > 0 ? Math.round((p.totalEnvelope || 0) / totalSqft * 100) / 100 : 0;

      const creatorData = {
        data: {
          // Project info
          Project_Title: p.Project_Title || "",
          Street_Address: p.street || "",
          City: p.city || "",
          State: p.state || "",
          County: p.county || "",

          // Builder info
          First_Name: p.Builder_First_Name || "",
          Last_Name: p.Builder_Last_Name || "",
          Builder_Email: p.builderEmail || "",
          Builder_Phone: p.builderPhone || "",

          // Structure
          Number_of_Stories: String(p.stories || 1),
          Story_1_Square_Footage: p.sqft1 || 0,
          Story_2_Square_Footage: p.sqft2 || 0,
          Story_3_Square_Footage: p.sqft3 || 0,
          Total_Square_Footage: totalSqft,
          Avg_Sqft_per_Story: avgSqft,

          // Costs
          Builder_Sales_Price: p.salesPrice || 0,
          Concrete_Cost_per_Yard: p.concreteCost || 200,
          General_Labor_Cost_per_Hour: p.laborRate || 75,

          // Envelope breakdown
          Wall_System_Cost: p.wallMaterials || 0,
          Roof_Cost: p.roof || 0,
          Floor_Deck_Cost: p.floorDeck || 0,
          NileBuilt_Technology_Fee: p.totalTechFees || 0,
          Total_Envelope_Cost: p.totalEnvelope || 0,
          Cost_Per_Square_Foot: costPerSqft,

          // Formatted display fields
          Fmt_Wall_System: fmt(p.wallMaterials),
          Fmt_Wall_Labor: fmt(p.wallLabor),
          Fmt_Floor_Deck: fmt(p.floorDeck),
          Fmt_Roof: fmt(p.roof),
          Fmt_Structure_Subtotal: fmt(p.structureSubtotal),
          Fmt_Tech_Fee: fmt(p.totalTechFees),
          Fmt_Total_Envelope: fmt(p.totalEnvelope),
          Fmt_Cost_Per_Sqft: fmt(costPerSqft),
        },
      };

      const creatorRes = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(creatorData),
      });

      const creatorText = await creatorRes.text();
      try {
        creatorResult = JSON.parse(creatorText);
      } catch (e) {
        console.error("Creator non-JSON response:", creatorText);
        throw new Error("Creator returned invalid response");
      }

      if (creatorResult.code !== 3000) {
        console.error("Creator error:", JSON.stringify(creatorResult));
        throw new Error(creatorResult.error?.message || `Creator error code: ${creatorResult.code}`);
      }
    } catch (creatorErr) {
      console.error("Creator save error:", creatorErr.message);
      return res.status(500).json({ error: "Failed to save estimate to backend. " + creatorErr.message });
    }

    return res.status(200).json({
      success: true,
      recordId: creatorResult?.data?.ID,
      message: "Envelope estimate submitted successfully",
    });
  } catch (err) {
    console.error("Submit error:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
