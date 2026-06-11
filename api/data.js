// Cloud storage for logs + settings, backed by Upstash Redis (Vercel Marketplace).
// Setup: Vercel dashboard → Storage → Create → Upstash for Redis → connect to this
// project. The UPSTASH_REDIS_REST_* env vars are injected automatically.

import { Redis } from "@upstash/redis";

export default async function handler(req, res) {
  let redis;
  try {
    redis = Redis.fromEnv();
  } catch {
    return res.status(503).json({ error: "Cloud storage not configured yet — connect Upstash Redis in Vercel → Storage." });
  }

  try {
    if (req.method === "GET") {
      const data = await redis.get("pacer:data");
      return res.status(200).json(data || { logs: {}, settings: null });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      await redis.set("pacer:data", body);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(502).json({ error: "Storage error: " + e.message });
  }
}
