export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

const {
    size,
    state,
    cause,
    minRevenue,
    maxRevenue,
    minPay,
    maxPay,
    name,
  } = req.body;

  const CAUSE_MAP = {
    health:       `c."Advancing_Health" = 'Y'`,
    education:    `c."Advancing_Education" = 'Y'`,
    environment:  `c."environment" = 'Y'`,
    aboriginal:   `c."Aboriginal_or_TSI" = 'Y'`,
    disability:   `c."People_with_Disabilities" = 'Y'`,
    youth:        `c."Youth" = 'Y'`,
    aged:         `c."Aged_Persons" = 'Y'`,
    homelessness: `c."People_at_risk_of_homelessness" = 'Y'`,
    religion:     `c."Advancing_Religion" = 'Y'`,
    animals:      `c."animals" = 'Y'`,
  };

  const where = [
    `c."Charity_Legal_Name" NOT ILIKE '%Minaret College%'`,
    `f."Total paid to Key Management Personnel" IS NOT NULL`,
    `f."Total paid to Key Management Personnel" != ''`,
    `f."Number of Key Management Personnel" IS NOT NULL`,
    `f."Number of Key Management Personnel" != ''`,
    `f."Number of Key Management Personnel"::numeric > 0`,
    `f."total revenue" IS NOT NULL`,
    `f."total revenue" != ''`,
    `f."total revenue"::numeric > 0`,
    `f."Total paid to Key Management Personnel"::numeric > 0`,
  ];

  if (size)       where.push(`c."Charity_Size" = '${size}'`);
  if (name)       where.push(`c."Charity_Legal_Name" ILIKE '%${name.replace(/'/g, "''")}%'`);
  if (state)      where.push(`c."State" = '${state}'`);
  if (cause && CAUSE_MAP[cause]) where.push(CAUSE_MAP[cause]);
  if (minRevenue) where.push(`f."total revenue"::numeric >= ${parseFloat(minRevenue) * 1000000}`);
  if (maxRevenue) where.push(`f."total revenue"::numeric <= ${parseFloat(maxRevenue) * 1000000}`);
  if (minPay)     where.push(`(f."Total paid to Key Management Personnel"::numeric / f."Number of Key Management Personnel"::numeric) >= ${parseFloat(minPay) * 1000}`);
  if (maxPay)     where.push(`(f."Total paid to Key Management Personnel"::numeric / f."Number of Key Management Personnel"::numeric) <= ${parseFloat(maxPay) * 1000}`);

  const sql = `
    SELECT
      c."Charity_Legal_Name",
      c."Charity_Website",
      c."Charity_Size",
      c."State",
      c."Town_City",
      f."total revenue",
      f."Number of Key Management Personnel",
      f."Total paid to Key Management Personnel",
      f."total expenses",
      f."employee expenses"
    FROM charities c
    JOIN financials f ON f."abn" = c."ABN"
    WHERE ${where.join(' AND ')}
    ORDER BY (f."Total paid to Key Management Personnel"::numeric / f."Number of Key Management Personnel"::numeric) DESC NULLS LAST
    LIMIT 500
  `;

  try {
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
      console.error("Supabase error:", text);
      return res.status(500).json({ error: "Database query failed", detail: text });
    }

    const data = await response.json();
    console.log(`KMP query returned ${data.length} rows`);
    return res.status(200).json({ data });

  } catch (err) {
    console.error("KMP handler error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
