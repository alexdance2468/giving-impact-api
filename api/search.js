import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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
- "People_at_risk_of_homelessness" text (Y or null)
- "People_with_Disabilities" text (Y or null)
- "Youth" text (Y or null)
- "Advancing_Education" text (Y or null)
- "Advancing_Health" text (Y or null)
- "Advancing_Religion" text (Y or null)
- "Advancing_social_or_public_welfare" text (Y or null)
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
- "total assets" text
- "net assets/liabilities" text
- "total full time equivalent staff" text
- "staff - volunteers" text
- "employee expenses" text
- "Key Management Personnel" text
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

RULES:
- Always return valid PostgreSQL
- For location searches on programs use: "Operating Location 1" ILIKE '%suburb%'
- For location searches on charities use: "Town_City" ILIKE '%suburb%'
- Numeric fields are stored as text, cast with ::numeric for comparisons e.g. "total revenue"::numeric
- Y/N fields: check with = 'Y'
- Always join programs to charities on programs."ABN" = charities."ABN"
- Always join financials to charities on financials."abn" = charities."ABN"
- Limit results to 20 unless asked for more
- Return only the SQL query, no explanation, no markdown, no backticks
`;

export default async function handler(req, res) {
  // Allow CORS so your website can call this API
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "No question provided" });

  try {
    // Step 1: Convert natural language to SQL
    const sqlResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: SCHEMA,
      messages: [{ role: "user", content: question }],
    });

    const sql = sqlResponse.content[0].text.trim().replace(/;+$/, '');
    console.log("Generated SQL:", sql);

    // Step 2: Run the SQL against Supabase
    const { data, error } = await supabase.rpc("run_query", { query: sql });

    let results;
    if (error) {
      // Fallback: try direct query if rpc fails
      console.error("RPC error:", error);
      return res.status(500).json({
        error: "Database query failed",
        sql,
        detail: error.message,
      });
    } else {
      results = data;
    }

    // Step 3: Summarise results in plain English
    const summaryResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `The user asked: "${question}"
          
The database returned ${results?.length ?? 0} results:
${JSON.stringify(results?.slice(0, 10), null, 2)}

Write a brief, helpful 2-3 sentence summary of what was found. Be specific about numbers and names. If no results, say so and suggest a broader search.`,
        },
      ],
    });

    const summary = summaryResponse.content[0].text;

    return res.status(200).json({ summary, results, sql });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
