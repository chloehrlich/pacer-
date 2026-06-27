// Claude-powered "coach check" on a rearranged training week. Given the original
// week, the athlete's reshuffle, recent training, and any travel context, it judges
// whether the move is sound and how to adjust the moved workouts. Falls back to a
// clear message if ANTHROPIC_API_KEY is unset or the call fails. Env: ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const SYSTEM = `You are an experienced marathon coach reviewing a runner's rearranged training week on the Pfitzinger 18/55 plan, building toward Chicago. They've moved sessions around (usually for travel) and want a fast sanity check.

Write 3-6 short sentences of plain prose - no headings, no markdown, no emoji. Judge the reshuffle against sound principles:
- Protect the long run; don't place two long runs <5 days apart or drop it in a peak week.
- Never stack two hard sessions (LT, VO2, MP, long) back-to-back without an easy or rest day between.
- When days are lost, cut by priority: long run > marathon-pace/LT > VO2 > easy miles. Drop easy mileage first.
- Treat travel days as easy/rest; the day after travel usually shouldn't be a key session.
- Dropping a session beats cramming and digging a fatigue hole.

Open with a quick verdict (solid / mostly good with one fix / needs rework). Call out any specific collisions or risks by day. Then say whether any MOVED workout should itself be adjusted - e.g. shorten the long run if days are tight, or reduce the second hard session if two land close together. Honor the travel context. Be concrete and encouraging; never invent data you weren't given.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "Set ANTHROPIC_API_KEY in Vercel to enable the coach check." });
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
        content: `Goal finish time: ${ctx.goal}. Here is the week and the athlete's reshuffle as JSON:\n\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n\nIs this a good rearrangement, and should any moved workout be adjusted?`,
      }],
    });
    const advice = (response.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    if (!advice) return res.status(502).json({ error: "Empty response from model." });
    return res.status(200).json({ advice });
  } catch (e) {
    return res.status(502).json({ error: "Coach check failed: " + e.message });
  }
}
