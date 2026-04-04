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

// ─── Find or create Lead, then link estimate ───────────────────────────────
async function findOrCreateLead(token, { email, firstName, lastName, phone, street, city, state, county, company }) {
  if (!email) return null;

  // 1. Search for existing Lead by email
  try {
    const searchRes = await fetch(
      `https://www.zohoapis.com/crm/v2/Leads/search?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const searchData = await searchRes.json();
    if (searchData.data && searchData.data.length > 0) {
      console.log("Found existing Lead:", searchData.data[0].id);
      return searchData.data[0].id;
    }
  } catch (err) {
    console.error("Lead search error:", err.message);
  }

  // 2. Search Contacts by email (in case they were converted)
  try {
    const contactRes = await fetch(
      `https://www.zohoapis.com/crm/v2/Contacts/search?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const contactData = await contactRes.json();
    if (contactData.data && contactData.data.length > 0) {
      console.log("Found existing Contact:", contactData.data[0].id);
      // Builder_Lead field points to Leads module, so we can't link a Contact ID here
      return null;
    }
  } catch (err) {
    console.error("Contact search error:", err.message);
  }

  // 3. Create new Lead
  try {
    const leadData = {
      data: [{
        First_Name: firstName || "",
        Last_Name: lastName || email.split("@")[0],
        Email: email,
        Phone: phone || "",
        Company: company || "Individual",
        Lead_Source: "NileBuilt Estimator App",
        Street: street || "",
        City: city || "",
        State: state || "",
        Description: `Lead created automatically from NileBuilt Estimator App submission.`,
      }],
    };

    const createRes = await fetch("https://www.zohoapis.com/crm/v2/Leads", {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(leadData),
    });

    const createData = await createRes.json();
    if (createData.data?.[0]?.code === "SUCCESS") {
      const leadId = createData.data[0].details.id;
      console.log("Created new Lead:", leadId);
      return leadId;
    } else {
      console.error("Lead creation error:", JSON.stringify(createData));
      return null;
    }
  } catch (err) {
    console.error("Lead creation error:", err.message);
    return null;
  }
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
      const avgSqft = p.avgSqft || (totalSqft > 0 && p.stories > 0 ? Math.round(totalSqft / p.stories) : 0);
      const costPerSqft = totalSqft > 0 ? Math.round((p.totalEnvelope || 0) / totalSqft * 100) / 100 : 0;

      // Round all currency values to 2 decimal places to stay within Creator field limits
      const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

      // Build foundation subform rows
      const foundationRows = (p.foundationItems || [])
        .filter(item => item.total > 0)
        .map(item => ({
          Line_Item: item.name || "",
          Bid_Cost: Math.round((Number(item.bidCost) || 0) * 100) / 100,
          Number_of_Units: Math.round((Number(item.units) || 0) * 100) / 100,
          Unit_Price: Math.round((Number(item.unitPrice) || 0) * 100) / 100,
        }));

      // Map individual foundation costs by name lookup (not array index)
      const fi = p.foundationItems || [];
      const findCost = (name) => (fi.find(i => i.name === name) || {}).total || 0;
      const footingsCost = findCost("Footings");
      const foundationCost = findCost("Foundation");
      const slabCost = findCost("Slab");
      const wasteSlabCost = findCost("Waste Slab");
      const excavationCost = findCost("Excavation / Soil");

      const creatorData = {
        data: {
          // Project info
          Project_Title: p.Project_Title || "",
          Street_Address: p.street || "",
          City: p.city || "",
          State: p.state || "",
          County: p.county || "",

          // Builder info
          First_Name: p.firstName || "",
          Last_Name: p.lastName || "",
          Builder_Email: p.builderEmail || "",
          Builder_Phone: p.builderPhone || "",

          // Structure
          Number_of_Stories: String(p.stories || 1),
          Story_1_Square_Footage: p.sqft1 || 0,
          Story_2_Square_Footage: p.sqft2 || 0,
          Story_3_Square_Footage: p.sqft3 || 0,
          Story_4_Square_Footage: p.sqft4 || 0,
          Total_Square_Footage: totalSqft,
          Avg_Sqft_per_Story: avgSqft,

          // Costs
          Builder_Sales_Price: p.salesPrice || 0,
          Concrete_Cost_per_Yard: p.concreteCost || 200,
          General_Labor_Cost_per_Hour: p.laborRate || 75,

          // Foundation & Sitework
          Foundation_Sitework1: foundationRows.length > 0 ? foundationRows : undefined,
          Footings_Cost: r2(footingsCost),
          Foundation_Cost: r2(foundationCost),
          Slab_Cost: r2(slabCost),
          Waste_Slab_Cost: r2(wasteSlabCost),
          Excavation_Soil_Cost: r2(excavationCost),
          Foundation_Subtotal: r2(p.foundationSubtotal),
          Foundation_Cost_per_Sqft: r2(p.foundationCostPerSqft),

          // Envelope breakdown
          Wall_System_Cost: r2(p.wallMaterials),
          Roof_Cost: r2(p.roof),
          Floor_Deck_Cost: r2(p.floorDeck),
          NileBuilt_Technology_Fee: r2(p.totalTechFees),
          Total_Envelope_Cost: r2(p.totalEnvelope),
          Cost_Per_Square_Foot: r2(costPerSqft),

          // Formatted display fields
          Fmt_Wall_System_Cost: fmt(p.wallMaterials),
          Fmt_Floor_Deck_Cost: fmt(p.floorDeck),
          Fmt_Roof_Cost: fmt(p.roof),
          Fmt_NileBuilt_Technology_Fee: fmt(p.totalTechFees),
          Fmt_Total_Envelope_Cost: fmt(p.totalEnvelope),
          Fmt_Cost_Per_Square_Foot: fmt(costPerSqft),
          Fmt_Foundation_Subtotal: fmt(p.foundationSubtotal),
          Fmt_Total_Square_Footage: totalSqft.toLocaleString(),
        },
      };

      // Remove undefined fields
      Object.keys(creatorData.data).forEach(key => {
        if (creatorData.data[key] === undefined) delete creatorData.data[key];
      });

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
        // Include full error details so we can debug field-level issues
        const errMsg = creatorResult.error?.message || creatorResult.message || "";
        const errDetails = JSON.stringify(creatorResult);
        throw new Error(`Creator error code: ${creatorResult.code} — ${errMsg} — ${errDetails}`);
      }
    } catch (creatorErr) {
      console.error("Creator save error:", creatorErr.message);
      return res.status(500).json({ error: "Failed to save estimate to backend. " + creatorErr.message });
    }

    // 2. Find or create Lead in CRM
    let leadId = null;
    try {
      leadId = await findOrCreateLead(token, {
        email: p.builderEmail,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.builderPhone,
        street: p.street,
        city: p.city,
        state: p.state,
        county: p.county,
        company: "",
      });
    } catch (leadErr) {
      console.error("Lead lookup error:", leadErr.message);
    }

    // 3. Sync to Zoho CRM — NileBuilt_Estimates module
    let crmResult = null;
    try {
      const totalSqft = p.totalSqft || 0;
      const totalEnvelope = p.totalEnvelope || 0;
      const costPerSqft = totalSqft > 0 ? Math.round(totalEnvelope / totalSqft * 100) / 100 : 0;

      const crmData = {
        data: [{
          Name: p.Project_Title || "",
          Estimate_Type: "Envelope",
          Estimate_Date: new Date().toISOString().split("T")[0],
          Street_Address: p.street || "",
          City: p.city || "",
          State: p.state || "",
          County: p.county || "",
          Builder_Email: p.builderEmail || "",
          Homeowner_Name: `${p.firstName || ""} ${p.lastName || ""}`.trim(),
          Number_of_Stories: parseInt(p.stories) || 1,
          Total_Square_Footage: totalSqft,
          Avg_Sqft_Per_Story: totalSqft > 0 && p.stories > 0 ? Math.round(totalSqft / p.stories) : 0,
          ...(leadId ? { Builder_Lead: { id: leadId } } : {}),

          // Envelope costs
          Subtotal_Wall_Materials: p.wallMaterials || 0,
          Total_Wall_Cost: p.wallMaterials || 0,
          Total_Floor_Deck_Cost: p.floorDeck || 0,
          Floor_Deck_Cost: p.floorDeck || 0,
          Total_Roof_Cost: p.roof || 0,
          Structure_Subtotal: p.structureSubtotal || ((p.wallMaterials || 0) + (p.floorDeck || 0) + (p.roof || 0)),
          Subtotal_NileBuilt_Technology: p.totalTechFees || 0,

          // Foundation
          Subtotal_Foundation: p.foundationSubtotal || 0,

          // Totals
          Total_Project_Cost: totalEnvelope + (p.foundationSubtotal || 0),
          Cost_Per_SF: costPerSqft,
          Status: "New",
        }],
      };

      const crmRes = await fetch("https://www.zohoapis.com/crm/v2/NileBuilt_Estimates", {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(crmData),
      });

      const crmText = await crmRes.text();
      try { crmResult = JSON.parse(crmText); } catch (e) { console.error("CRM non-JSON:", crmText); }

      if (crmResult?.data?.[0]?.code !== "SUCCESS") {
        console.error("CRM error:", JSON.stringify(crmResult));
      } else {
        console.log("CRM record created:", crmResult.data[0].details.id);
      }
    } catch (crmErr) {
      console.error("CRM sync error:", crmErr.message);
      // Don't fail the request — Creator save is the primary target
    }

    return res.status(200).json({
      success: true,
      recordId: creatorResult?.data?.ID,
      crmRecordId: crmResult?.data?.[0]?.details?.id,
      message: "Envelope estimate submitted successfully",
    });
  } catch (err) {
    console.error("Submit error:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
