// Oura v2 proxy — OAuth2 with rotating refresh tokens persisted in Upstash Redis.
// One-time connect: visit /api/oura-setup. Env: OURA_CLIENT_ID, OURA_CLIENT_SECRET.

import { Redis } from "@upstash/redis";

const TOKEN_KEY = "pacer:oura_tokens";

async function getValidAccessToken(redis) {
  const stored = await redis.get(TOKEN_KEY);
  if (!stored) return { error: "Oura not connected yet — visit /api/oura-setup once to authorize." };
  const tok = typeof stored === "string" ? JSON.parse(stored) : stored;

  // Still valid (60s safety margin)?
  if (tok.expires_at && Date.now() < tok.expires_at - 60000) return { access: tok.access_token };

  // Refresh (Oura rotates refresh tokens — must persist the new one)
  const r = await fetch("https://api.ouraring.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tok.refresh_token,
      client_id: process.env.OURA_CLIENT_ID,
      client_secret: process.env.OURA_CLIENT_SECRET,
    }),
  });
  const j = await r.json();
  if (!j.access_token) {
    return { error: "Oura token refresh failed — re-connect at /api/oura-setup. (" + JSON.stringify(j).slice(0, 200) + ")" };
  }
  await redis.set(TOKEN_KEY, JSON.stringify({
    access_token: j.access_token,
    refresh_token: j.refresh_token || tok.refresh_token,
    expires_at: Date.now() + (j.expires_in || 86400) * 1000,
  }));
  return { access: j.access_token };
}

export default async function handler(req, res) {
  if (!process.env.OURA_CLIENT_ID || !process.env.OURA_CLIENT_SECRET) {
    return res.status(503).json({ error: "Set OURA_CLIENT_ID and OURA_CLIENT_SECRET in Vercel env vars." });
  }
  let redis;
  try { redis = Redis.fromEnv(); }
  catch { return res.status(503).json({ error: "Connect Upstash Redis in Vercel → Storage first (token storage lives there)." }); }

  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: "start and end query params required (YYYY-MM-DD)." });

  const auth = await getValidAccessToken(redis);
  if (auth.error) return res.status(401).json({ error: auth.error });
  const headers = { Authorization: `Bearer ${auth.access}` };
  const base = "https://api.ouraring.com/v2/usercollection";

  try {
    const [readiness, dailySleep, sleepDetail] = await Promise.all([
      fetch(`${base}/daily_readiness?start_date=${start}&end_date=${end}`, { headers }).then(r => r.json()),
      fetch(`${base}/daily_sleep?start_date=${start}&end_date=${end}`, { headers }).then(r => r.json()),
      fetch(`${base}/sleep?start_date=${start}&end_date=${end}`, { headers }).then(r => r.json()),
    ]);
    res.setHeader("Cache-Control", "s-maxage=300");
    return res.status(200).json({ readiness, dailySleep, sleepDetail });
  } catch (e) {
    return res.status(502).json({ error: "Oura API request failed: " + e.message });
  }
}
