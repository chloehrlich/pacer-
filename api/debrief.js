// Claude-powered post-run debrief. Takes the run plus recent training context
// and returns a short coach-style note. Degrades gracefully: if ANTHROPIC_API_KEY
// is unset or the call fails, the client falls back to its built-in rule-based
// debrief. Env: ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const SYSTEM = `You are a sharp, encouraging marathon coach reviewing one training run for an athlete on the Pfitzinger 18/55 plan, building toward Chicago. Text back the way a coach does after seeing a run pop up on Strava: warm, specific, never generic.

Write 1-2 short sentences - tight, no padding. Lead with the headline (how the run went versus the plan and the goal time), grounded in the numbers you're given (pace vs target, heart rate, cadence, splits, RPE, the recent trend). Call out anything that stands out - low cadence (efficient running is ~170-185 spm), heart-rate drift, a soft or over-hard session - and if it fits, end with one quick actionable note. No headings, bullet points, markdown, or emoji. Never invent numbers you weren't given.`;

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
      max_tokens: 512,
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
