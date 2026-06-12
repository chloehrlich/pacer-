// Claude-powered pre-run briefing voice. The app computes the recommendation
// and the heat-adjusted pace targets; this writes the coaching paragraph around
// them. Degrades gracefully: if ANTHROPIC_API_KEY is unset or the call fails,
// the client falls back to its built-in advice. Env: ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const SYSTEM = `You are an experienced marathon coach giving an athlete their pre-run briefing for today's scheduled session on the Pfitzinger 18/55 plan, building toward Chicago. The app has already computed the recommendation and the heat-adjusted pace targets - your job is the coaching voice around that, not to override the numbers.

Write 2-4 sentences of warm, specific, plain prose - no headings, no bullet points, no markdown, no emoji. Guidelines:
- Open with how to approach today given the recommendation (run as written / soften to the easy end / downgrade to easy), the recovery markers (readiness, sleep, HRV vs baseline, resting HR vs baseline), and the heat.
- Coach execution and effort - how it should feel, how to pace the session, what to watch - rather than repeating exact pace numbers, which the athlete already sees on screen.
- Factor in recent load and tomorrow's session; protect the key workouts.
- Tie to the goal time when it's relevant. Honor any note the athlete left (travel, how they feel, equipment).
- Be honest and encouraging. Never invent numbers you weren't given, and do not contradict the app's recommendation.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "ANTHROPIC_API_KEY not set - using built-in advice." });
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
        content: `Goal finish time: ${ctx.goal}. Here is today's session, conditions, and recent context as JSON:\n\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n\nWrite the pre-run briefing.`,
      }],
    });
    const advice = (response.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim();
    if (!advice) return res.status(502).json({ error: "Empty response from model." });
    return res.status(200).json({ advice });
  } catch (e) {
    return res.status(502).json({ error: "Briefing generation failed: " + e.message });
  }
}
