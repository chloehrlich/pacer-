// Cloud storage for logs + settings, backed by Upstash Redis (Vercel Marketplace).
// Setup: Vercel dashboard → Storage → Create → Upstash for Redis → connect to this
// project. The UPSTASH_REDIS_REST_* env vars are injected automatically.

import { Redis } from "@upstash/redis";

// Vercel's Upstash/KV integration injects KV_REST_API_* names; older setups use
// UPSTASH_REDIS_REST_*. Accept either so Redis.fromEnv()'s naming isn't required.
function redisFromEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Redis env vars not set");
  return new Redis({ url, token });
}

export default async function handler(req, res) {
  let redis;
  try {
    redis = redisFromEnv();
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
