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
- "Other charities" text (Y or null)
- "People from a culturally and linguistically diverse background" text (Y or N)

GENERAL RULES:
- Always return valid PostgreSQL
- For location searches on programs use: "Operating Location 1" ILIKE '%suburb%'
- For location searches on charities use: "Town_City" ILIKE '%suburb%'
- Numeric fields are stored as text, cast with ::numeric for comparisons e.g. "total revenue"::numeric
- Y/N fields: check with = 'Y'
- Always join programs to charities on programs."ABN" = charities."ABN"
- Always join financials to charities on financials."abn" = charities."ABN"
- Limit results to 50 unless asked for more
- Return only SQL, no explanation, no markdown, no backticks
- For general charity searches ALWAYS query the charities table joined with financials — never query programs table alone
- ALWAYS include c."Charity_Legal_Name", c."Town_City", c."State", c."ABN", c."Charity_Website", c."Charity_Size" in SELECT for any general search

BENEFICIARY/CAUSE SEARCH RULES:
- For any search by beneficiary or cause (e.g. Aboriginal, disability, youth, environment, homelessness, aged, veterans, refugees, animals, mental health) apply a dual filter:
  1. The relevant Y/N flag on the charities table = 'Y'
  2. A keyword match in financials."how purposes were pursued" using ILIKE
- Join charities and financials only — do NOT join programs table for cause searches as it causes timeouts
- Order by total revenue descending

Example for Aboriginal/TSI charities:
SELECT c."Charity_Legal_Name", c."ABN", c."Town_City", c."State", c."Charity_Size", c."Charity_Website", f."total revenue", f."donations and bequests" FROM charities c JOIN financials f ON f."abn" = c."ABN" WHERE c."Aboriginal_or_TSI" = 'Y' AND (f."how purposes were pursued" ILIKE '%aboriginal%' OR f."how purposes were pursued" ILIKE '%indigenous%' OR f."how purposes were pursued" ILIKE '%torres strait%') ORDER BY f."total revenue"::numeric DESC NULLS LAST LIMIT 50

Example for disability charities:
SELECT c."Charity_Legal_Name", c."ABN", c."Town_City", c."State", c."Charity_Size", c."Charity_Website", f."total revenue", f."donations and bequests" FROM charities c JOIN financials f ON f."abn" = c."ABN" WHERE c."People_with_Disabilities" = 'Y' AND (f."how purposes were pursued" ILIKE '%disabilit%' OR f."how purposes were pursued" ILIKE '%ndis%') ORDER BY f."total revenue"::numeric DESC NULLS LAST LIMIT 50

Example for youth charities:
SELECT c."Charity_Legal_Name", c."ABN", c."Town_City", c."State", c."Charity_Size", c."Charity_Website", f."total revenue", f."donations and bequests" FROM charities c JOIN financials f ON f."abn" = c."ABN" WHERE c."Youth" = 'Y' AND (f."how purposes were pursued" ILIKE '%youth%' OR f."how purposes were pursued" ILIKE '%young people%') ORDER BY f."total revenue"::numeric DESC NULLS LAST LIMIT 50

SPECIFIC CHARITY LOOKUP RULES:
- When the user asks about a specific named charity (e.g. "tell me about X", "give me details on X", "everything about X"), search using ILIKE on "Charity_Legal_Name"
- For specific charity lookups always write TWO queries separated by exactly this text on its own line: ---PROGRAMS---
- Query 1: join charities and financials, return ALL columns from both tables for that charity
- Query 2: select "Program name", "Classification", "Operating Location 1", "Charity weblink" from programs where "ABN" matches

Example for "tell me about Fred Hollows Foundation":
SELECT c.*, f.* FROM charities c LEFT JOIN financials f ON f."abn" = c."ABN" WHERE c."Charity_Legal_Name" ILIKE '%fred hollows%' LIMIT 5
---PROGRAMS---
SELECT p."Program name", p."Classification", p."Operating Location 1", p."Charity weblink" FROM programs p WHERE p."ABN" = (SELECT "ABN" FROM charities WHERE "Charity_Legal_Name" ILIKE '%fred hollows%' LIMIT 1)

LOCATION SEARCH RULES:
- When multiple suburbs are provided (e.g. "also include results from these nearby suburbs: X, Y, Z"), generate OR conditions for each suburb
- For charities table use: (c."Town_City" ILIKE '%suburb1%' OR c."Town_City" ILIKE '%suburb2%' OR ...)
- For programs table use: (p."Operating Location 1" ILIKE '%suburb1%' OR p."Operating Location 1" ILIKE '%suburb2%' OR ...)
`;

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

async function expandSuburbs(question) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: `Analyse this search query: "${question}"
      
If it mentions a specific Australian suburb or area (e.g. "near Chatswood", "in Parramatta"), return a JSON object with:
- "detected": true
- "suburbs": an array of 6-8 nearby suburbs including the original (use real Australian suburbs)
- "original": the original suburb name

If no suburb is mentioned, return: { "detected": false }

Return ONLY valid JSON, no explanation, no markdown.`
    }]
  });

  try {
    const text = response.content[0].text.trim();
    return JSON.parse(text);
  } catch {
    return { detected: false };
  }
}

async function detectSimilarIntent(question) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 150,
    messages: [{
      role: "user",
      content: `Analyse this search query: "${question}"

If the user is asking for charities similar to a specific named charity (e.g. "charities similar to Fred Hollows", "find me something like the Salvos", "alternatives to Beyond Blue"), return:
{ "detected": true, "charityName": "the charity name they mentioned" }

Otherwise return: { "detected": false }

Return ONLY valid JSON, no explanation, no markdown.`
    }]
  });

  try {
    const text = response.content[0].text.trim();
    return JSON.parse(text);
  } catch {
    return { detected: false };
  }
}

async function findSimilarCharities(charityName) {
  // Step 1: Look up the reference charity's flags
  const lookupSQL = `
    SELECT c."ABN", c."Charity_Legal_Name", c."State", c."Charity_Size",
      c."People_at_risk_of_homelessness", c."People_with_Disabilities", c."Youth",
      c."Advancing_Education", c."Advancing_Health", c."Advancing_Religion",
      c."Advancing_social_or_public_welfare", c."Advancing_Culture",
      c."Advancing_natual_environment", c."Promoting_or_protecting_human_rights",
      c."Preventing_or_relieving_suffering_of_animals", c."Financially_Disadvantaged",
      c."Aboriginal_or_TSI", c."Families", c."Children", c."Aged_Persons",
      c."Migrants_Refugees_or_Asylum_Seekers", c."environment", c."animals",
      c."Veterans_or_their_families", c."Victims_of_Disasters"
    FROM charities c
    WHERE c."Charity_Legal_Name" ILIKE '%${charityName.replace(/'/g, "''")}%'
    LIMIT 1
  `;

  let reference;
  try {
    const rows = await runSQL(lookupSQL);
    if (!rows || rows.length === 0) return null;
    reference = rows[0];
  } catch {
    return null;
  }

  // Step 2: Build OR conditions from active flags
  const flagColumns = [
    "People_at_risk_of_homelessness", "People_with_Disabilities", "Youth",
    "Advancing_Education", "Advancing_Health", "Advancing_Religion",
    "Advancing_social_or_public_welfare", "Advancing_Culture",
    "Advancing_natual_environment", "Promoting_or_protecting_human_rights",
    "Preventing_or_relieving_suffering_of_animals", "Financially_Disadvantaged",
    "Aboriginal_or_TSI", "Families", "Children", "Aged_Persons",
    "Migrants_Refugees_or_Asylum_Seekers", "environment", "animals",
    "Veterans_or_their_families", "Victims_of_Disasters"
  ];

  const activeFlags = flagColumns.filter(col => reference[col] === 'Y');
  if (activeFlags.length === 0) return null;

  // Match on at least 2 active flags using a CASE score
  const scoreExpression = activeFlags
    .map(col => `CASE WHEN c."${col}" = 'Y' THEN 1 ELSE 0 END`)
    .join(' + ');

  const similarSQL = `
    SELECT c."Charity_Legal_Name", c."ABN", c."Town_City", c."State",
      c."Charity_Size", c."Charity_Website", f."total revenue",
      f."donations and bequests",
      (${scoreExpression}) AS match_score
    FROM charities c
    JOIN financials f ON f."abn" = c."ABN"
WHERE c."ABN" != '${reference['ABN']}'
      AND (${scoreExpression}) >= 2
    ORDER BY match_score DESC, f."total revenue"::numeric DESC NULLS LAST
LIMIT 6
  `;

  try {
    const similar = await runSQL(similarSQL);
    return { reference, similar };
  } catch {
    return null;
  }
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
    // Step 0a: Check for "similar to X" intent
    const similarIntent = await detectSimilarIntent(question);
    if (similarIntent.detected && similarIntent.charityName) {
      const similarData = await findSimilarCharities(similarIntent.charityName);
      if (similarData) {
        const summaryResponse = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          messages: [{
            role: "user",
            content: `The user searched for charities similar to "${similarIntent.charityName}".
The reference charity is: ${JSON.stringify(similarData.reference)}
Similar charities found: ${JSON.stringify(similarData.similar)}

Write 2-3 sentences explaining what "${similarIntent.charityName}" does and why these charities are similar (shared causes, beneficiaries, size). Be concise.`
          }]
        });

        return res.status(200).json({
          summary: summaryResponse.content[0].text,
          results: [],
          programs: null,
          similarResults: similarData.similar,
          similarTo: similarIntent.charityName
        });
      }
    }

    // Step 0b: Expand suburbs if location mentioned
    const locationData = await expandSuburbs(question);
    let enrichedQuestion = question;

    if (locationData.detected && locationData.suburbs?.length) {
      const suburbList = locationData.suburbs.join(", ");
      enrichedQuestion = `${question} (also include results from these nearby suburbs: ${suburbList})`;
      console.log("Expanded suburbs:", suburbList);
    }

    // Step 1: Convert natural language to SQL
    const sqlResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SCHEMA,
      messages: [{ role: "user", content: enrichedQuestion }],
    });

    const rawSQL = sqlResponse.content[0].text.trim().replace(/;+$/, "");
    console.log("Generated SQL:", rawSQL);
    console.log("SQL tokens:", sqlResponse.usage);

    // Step 2: Check if we have two queries (specific charity lookup)
    const parts = rawSQL.split("---PROGRAMS---");
    const mainSQL = parts[0].trim().replace(/;+$/, "");
    const programsSQL = parts[1] ? parts[1].trim().replace(/;+$/, "") : null;

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

    // Step 3: Summarise results in plain English
    const summaryResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{
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
      }]
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
