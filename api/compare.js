import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function runSQL(sql) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/rpc/run_query`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": process.env.SUPABASE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error: ${text}`);
  }
  return response.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "No name provided" });

  // Sanitise input
  const safeName = name.replace(/'/g, "''");

  const sql = `
    SELECT
      c."ABN",
      c."Charity_Legal_Name",
      c."Charity_Website",
      c."Charity_Size",
      c."State",
      c."Town_City",
      c."Date_Organisation_Established",
      c."Advancing_Health",
      c."Advancing_Education",
      c."environment",
      c."animals",
      c."Aboriginal_or_TSI",
      c."People_with_Disabilities",
      c."Youth",
      c."Aged_Persons",
      c."Families",
      c."Children",
      c."Financially_Disadvantaged",
      c."People_at_risk_of_homelessness",
      c."Migrants_Refugees_or_Asylum_Seekers",
      c."Veterans_or_their_families",
      f."total revenue",
      f."total expenses",
      f."net surplus/deficit",
      f."donations and bequests",
      f."revenue from government",
      f."revenue from goods and services",
      f."revenue from investments",
      f."total assets",
      f."total liabilities",
      f."net assets/liabilities",
      f."total full time equivalent staff",
      f."staff - volunteers",
      f."employee expenses",
      f."Number of Key Management Personnel",
      f."Total paid to Key Management Personnel",
      f."grants and donations made for use in Australia",
      f."grants and donations made for use outside Australia",
      f."how purposes were pursued",
      f."fin report from",
      f."fin report to"
    FROM charities c
    LEFT JOIN financials f ON f."abn" = c."ABN"
    WHERE c."Charity_Legal_Name" ILIKE '%${safeName}%'
    ORDER BY c."Charity_Legal_Name"
    LIMIT 5
  `;

  const programsSQL = `
    SELECT
      p."Program name",
      p."Classification",
      p."Operating Location 1"
    FROM programs p
    WHERE p."ABN" IN (
      SELECT "ABN" FROM charities WHERE "Charity_Legal_Name" ILIKE '%${safeName}%' LIMIT 5
    )
    LIMIT 20
  `;

  try {
    const [results, programs] = await Promise.all([
      runSQL(sql),
      runSQL(programsSQL),
    ]);

    return res.status(200).json({ results, programs });
  } catch (err) {
    console.error("Compare error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
