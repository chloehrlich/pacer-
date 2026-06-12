// Claude-powered rest-day recovery guidance. Reads overnight recovery markers
// plus recent load and tomorrow's session, and advises full rest vs. light
// cross-training (with modality). Degrades gracefully: if ANTHROPIC_API_KEY is
// unset or the call fails, the client falls back to its built-in rule-based
// readout. Env: ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const SYSTEM = `You are an experienced endurance coach advising a marathoner (Pfitzinger 18/55 plan, building toward Chicago) on a scheduled REST or cross-training day. Read their overnight recovery markers and tell them whether to rest fully or do light cross-training, and if so what kind.

Write 2-4 sentences of warm, specific, plain prose - no headings, no bullet points, no markdown, no emoji. Guidelines:
- Read readiness, sleep, HRV vs baseline, and resting HR vs baseline together to judge how recovered they are.
- Make a clear call: genuine full rest, or optional light cross-training. Never prescribe hard or structured work on a rest day - the point is absorbing training, not adding stress.
- If cross-training fits, name concrete low-stress options (easy spin or bike, easy swim, brisk walk, yoga or mobility, stretching) and keep it easy and conversational.
- Factor in recent training load (last-7-day mileage, recent RPEs) and what's scheduled tomorrow - protect a big session that's coming.
- If they left a note (travel, available equipment, niggles, how they feel), honor it.
- Close with one concrete takeaway. Be honest and kind; never invent numbers you weren't given.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "ANTHROPIC_API_KEY not set - using built-in readout." });
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
        content: `Goal finish time: ${ctx.goal}. Here is today's recovery picture and recent context as JSON:\n\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n\nWrite the recovery guidance.`,
      }],
    });
    const readout = (response.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim();
    if (!readout) return res.status(502).json({ error: "Empty response from model." });
    return res.status(200).json({ readout });
  } catch (e) {
    return res.status(502).json({ error: "Recovery guidance failed: " + e.message });
  }
}
