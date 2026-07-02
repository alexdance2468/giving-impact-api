import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SCHEMA = `
You are a SQL expert helping query an Australian charity database.
The database has 3 tables:

TABLE: charities
- "ABN" text (primary key)
- "Charity_Legal_Name" text
- "Town_City" text (suburb/town where charity is based)
- "State" text (e.g. NSW, VIC, QLD)
- "Postcode" text
- "Charity_Website" text
- "Charity_Size" text (Small, Medium, Large, Extra Large)
- "Date_Organisation_Established" text
- "Registration_Date" text
- "People_at_risk_of_homelessness" text (Y or null)
- "People_with_Disabilities" text (Y or null)
- "Youth" text (Y or null)
- "Advancing_Education" text (Y or null)
- "Advancing_Health" text (Y or null)
- "Advancing_Religion" text (Y or null)
- "Advancing_social_or_public_welfare" text (Y or null)
- "Advancing_Culture" text (Y or null)
- "Advancing_natual_environment" text (Y or null)
- "Promoting_or_protecting_human_rights" text (Y or null)
- "Preventing_or_relieving_suffering_of_animals" text (Y or null)
- "Financially_Disadvantaged" text (Y or null)
- "Aboriginal_or_TSI" text (Y or null)
- "Families" text (Y or null)
- "Children" text (Y or null)
- "Aged_Persons" text (Y or null)
- "Migrants_Refugees_or_Asylum_Seekers" text (Y or null)
- "environment" text (Y or null)
- "animals" text (Y or null)
- "Veterans_or_their_families" text (Y or null)
- "Victims_of_Disasters" text (Y or null)

TABLE: financials
- "abn" text (primary key, joins to charities."ABN")
- "how purposes were pursued" text (narrative description of what charity does)
- "total revenue" text (convert to number with ::numeric for comparisons)
- "total expenses" text
- "net surplus/deficit" text
- "donations and bequests" text
- "revenue from government" text
- "revenue from goods and services" text
- "revenue from investments" text
- "all other revenue" text
- "total assets" text
- "total liabilities" text
- "net assets/liabilities" text
- "total full time equivalent staff" text
- "staff - volunteers" text
- "employee expenses" text
- "grants and donations made for use in Australia" text
- "grants and donations made for use outside Australia" text
- "Key Management Personnel" text
- "Number of Key Management Personnel" text
- "Total paid to Key Management Personnel" text
- "fin report from" text
- "fin report to" text
- "charity size" text

TABLE: programs
- "id" bigint (primary key)
- "ABN" text (joins to charities."ABN")
- "Charity Name" text
- "Program name" text
- "Classification" text
- "Operating Location 1" text (full address string)
- "Charity weblink" text
- "People at risk of homelessness/ people experiencing homelessness" text (Y or N)
- "People with disabilities" text (Y or N)
- "Youth - 15 to under 25" text (Y or N)
- "Families" text (Y or N)
- "Aboriginal and Torres Strait Islander people" text (Y or N)
- "Children - aged 6 to under 15" text (Y or N)
- "Early childhood - aged under 6" text (Y or N)
- "Females" text (Y or N)
- "Males" text (Y or N)
- "Financially disadvantaged people" text (Y or N)
- "Migrants, refugees or asylum seekers" text (Y or N)
- "Veterans and/or their families" text (Y or N)
- "Victims of disaster" text (Y or N)
- "Environment" text (Y or N)
- "Animals" text (Y or N)
- "People with chronic illness (including terminal illness)" text (Y or N)
- "Adults - aged 65 and over" text (Y or N)
- "Adults - aged 25 to under 65" text (Y or N)
- "General community in Australia" text (Y or N)
- "Overseas communities or charities" text (Y or N)
- "Unemployed persons" text (Y or N)
- "People in rural/regional/remote communities" text (Y or N)
- "Gay, lesbian, bisexual, transgender or intersex persons" text (Y or N)
- "Pre/post release offenders and/or their families" text (Y or N)
- "Other charities" text (Y or N)
- "People from a culturally and linguistically diverse background" text (Y or N)

GENERAL RULES:
- Always return valid PostgreSQL
- For location searches on programs use: "Operating Location 1" ILIKE '%suburb%'
- For location searches on charities use: "Town_City" ILIKE '%suburb%'
- Numeric fields are stored as text, cast with ::numeric for comparisons e.g. "total revenue"::numeric
- Y/N fields: check with = 'Y'
- Always join programs to charities on programs."ABN" = charities."ABN"
- Always join financials to charities on financials."abn" = charities."ABN"
- Limit results to 20 unless asked for more
- Return only SQL, no explanation, no markdown, no backticks
- For general charity searches ALWAYS query the charities table joined with financials — never query programs table alone
- ALWAYS include c."Charity_Legal_Name", c."Town_City", c."State", c."ABN" in SELECT for any general search

BENEFICIARY/CAUSE SEARCH RULES:
- For any search by beneficiary or cause (e.g. Aboriginal, disability, youth, environment, homelessness, aged, veterans, refugees, animals, mental health) ALWAYS apply a triple filter to ensure results are genuinely focused on that cause:
  1. The relevant Y/N flag on the charities table = 'Y'
  2. The matching Y/N flag on the programs table = 'Y' (join programs on ABN)
  3. A keyword match in financials."how purposes were pursued" using ILIKE
- Use DISTINCT to avoid duplicate rows from the programs join
- Use DISTINCT to avoid duplicate rows from the programs join
- When using DISTINCT, ORDER BY must only use columns that appear in the SELECT list — to sort by revenue use ORDER BY f."total revenue"::numeric DESC NULLS LAST only when f."total revenue" is in the SELECT, or wrap in a subquery like: SELECT * FROM (...) sub ORDER BY sub."total revenue"::numeric DESC NULLS LAST


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

  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "No question provided" });

  try {
    // Step 1: Convert natural language to SQL (Haiku is sufficient for SQL generation)
    const sqlResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SCHEMA,
      messages: [{ role: "user", content: question }],
    });

    const rawSQL = sqlResponse.content[0].text.trim().replace(/;+$/, "");
    console.log("Generated SQL:", rawSQL);
    console.log("SQL tokens:", sqlResponse.usage);

    // Step 2: Check if we have two queries (specific charity lookup)
    const parts = rawSQL.split("---PROGRAMS---");
    const mainSQL = parts[0].trim().replace(/;+$/, "");
    const programsSQL = parts[1] ? parts[1].trim().replace(/;+$/, "") : null;

    // Run main query
// Run main query
    let results;
    try {
      results = await runSQL(mainSQL);
    } catch (dbErr) {
      console.error("Database query failed:", dbErr.message);
      console.error("Failed SQL:", mainSQL);
      return res.status(500).json({
        error: "Database query failed",
        sql: mainSQL,
        detail: dbErr.message,
      });
    }

    // Run programs query if present
    let programs = null;
    if (programsSQL) {
      try {
        programs = await runSQL(programsSQL);
      } catch (e) {
        console.error("Programs query failed:", e.message);
      }
    }

    // No results check
    if (results?.length === 0) {
      return res.status(200).json({
        summary: "No charities found matching your search. Try different keywords.",
        results: [],
        programs: null
      });
    }

    // Step 3: Summarise results in plain English (Sonnet for quality summaries)
    const summaryResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `The user asked: "${question}"

Main results (${results?.length ?? 0} rows):
${JSON.stringify(results?.slice(0, 20), null, 2)}

${programs ? `Programs (${programs.length} programs):
${JSON.stringify(programs.slice(0, 10), null, 2)}` : ""}

Write a clear summary of what was found. For a specific charity include:
- Organisation overview (name, ABN, size, location, website, established date)
- Mission and purpose — what they do and who they help (beneficiaries)
- Key impact highlights from "how purposes were pursued" if available
- A brief financial narrative (e.g. total revenue, whether donation-dependent, surplus/deficit) but DO NOT include a detailed financial table — financials are shown separately
- Staff overview (FTE, volunteers, board size)
- DO NOT list programs — these are shown separately

For list results (multiple charities) give a concise overview of what was found and any interesting patterns.

Format numbers as dollars with commas. Be concise and informative.`,
        },
      ],
    });

    console.log("Summary tokens:", summaryResponse.usage);
    const summary = summaryResponse.content[0].text;
    return res.status(200).json({ summary, results, programs, sql: mainSQL });

  } catch (err) {
    console.error("Top level error:", err.message);
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
