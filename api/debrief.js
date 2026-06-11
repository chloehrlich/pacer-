// Claude-powered post-run debrief. Takes the run plus recent training context
// and returns a short coach-style note. Degrades gracefully: if ANTHROPIC_API_KEY
// is unset or the call fails, the client falls back to its built-in rule-based
// debrief. Env: ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const SYSTEM = `You are an experienced marathon coach reviewing a single training run for an athlete following the Pfitzinger 18/55 plan, building toward the Chicago Marathon. You speak the way a sharp, encouraging coach texts back after seeing a run pop up on Strava: warm, direct, specific, and never generic.

Write 2-4 sentences of plain prose - no headings, no bullet points, no markdown, no emoji. Guidelines:
- Open with the headline: how the run went relative to what was planned and to the goal finish time.
- Ground every observation in the numbers you're given: pace vs the target zone, heart rate, cadence, mile splits, RPE, the morning Oura/heat check-in, and how this run fits the recent trend.
- Comment on cadence when it stands out (efficient distance running usually sits around 170-185 spm) and on heart-rate drift or an unusually high average HR when present.
- When the data supports it, tie fitness back to the goal time (e.g. heart rate at marathon pace trending down over recent weeks).
- Close with one concrete, actionable takeaway for the next day or two.
- Be honest and kind: name a soft or over-hard session for what it is. Never invent numbers you weren't given. If data is missing, just work with what you have.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "ANTHROPIC_API_KEY not set - using built-in debrief." });
  }
  try {
    const ctx = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `Goal finish time: ${ctx.goal}. Here is today's run and the recent training context as JSON:\n\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n\nWrite the debrief.`,
      }],
    });
    const verdict = (response.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim();
    if (!verdict) return res.status(502).json({ error: "Empty response from model." });
    return res.status(200).json({ verdict });
  } catch (e) {
    return res.status(502).json({ error: "Debrief generation failed: " + e.message });
  }
}
