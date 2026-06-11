// Vercel serverless function: pulls your run from Strava with full metrics.
// OAuth2 tokens are stored in Upstash Redis (connect once at /api/strava-setup).
// Strava access tokens expire every ~6 hours; this refreshes automatically and
// persists the rotated refresh token back to Redis. Env: STRAVA_CLIENT_ID,
// STRAVA_CLIENT_SECRET.

import { Redis } from "@upstash/redis";

const TOKEN_KEY = "pacer:strava_tokens";

// Vercel's Upstash/KV integration injects KV_REST_API_* names; older setups use
// UPSTASH_REDIS_REST_*. Accept either so Redis.fromEnv()'s naming isn't required.
function redisFromEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Redis env vars not set");
  return new Redis({ url, token });
}

async function getValidAccessToken(redis) {
  const stored = await redis.get(TOKEN_KEY);
  if (!stored) return { error: "Strava not connected yet — visit /api/strava-setup once to authorize." };
  const tok = typeof stored === "string" ? JSON.parse(stored) : stored;

  // Strava expires_at is unix seconds; refresh with a 60s safety margin
  if (tok.expires_at && Date.now() / 1000 < tok.expires_at - 60) return { access: tok.access_token };

  const r = await fetch("https://www.strava.com/api/v3/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: tok.refresh_token,
    }),
  });
  const j = await r.json();
  if (!j.access_token) {
    return { error: "Strava token refresh failed — re-connect at /api/strava-setup. (" + JSON.stringify(j).slice(0, 200) + ")" };
  }
  await redis.set(TOKEN_KEY, JSON.stringify({
    access_token: j.access_token,
    refresh_token: j.refresh_token || tok.refresh_token,
    expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 21600),
  }));
  return { access: j.access_token };
}

export default async function handler(req, res) {
  if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
    return res.status(503).json({ error: "Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in Vercel env vars." });
  }
  let redis;
  try { redis = redisFromEnv(); }
  catch { return res.status(503).json({ error: "Connect Upstash Redis in Vercel → Storage first (token storage lives there)." }); }

  const date = req.query.date; // YYYY-MM-DD
  if (!date) return res.status(400).json({ error: "date query param required (YYYY-MM-DD)." });

  const tok = await getValidAccessToken(redis);
  if (tok.error) return res.status(401).json({ error: tok.error });
  const auth = { Authorization: `Bearer ${tok.access}` };

  try {
    // Find the run on the requested local date
    const after = Math.floor(new Date(date + "T00:00:00Z").getTime() / 1000) - 86400; // pad for timezones
    const acts = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=20`,
      { headers: auth }
    ).then(r => r.json());
    if (!Array.isArray(acts)) return res.status(502).json({ error: "Strava activities fetch failed." });

    const runs = acts.filter(a => a.type === "Run" && a.start_date_local && a.start_date_local.startsWith(date));
    if (!runs.length) return res.status(404).json({ error: `No run found on Strava for ${date}. Has your watch synced yet?` });
    // Longest run of the day (in case of a shakeout + main session)
    const run = runs.sort((a, b) => b.distance - a.distance)[0];

    // Pull the detailed activity for mile splits
    const detail = await fetch(
      `https://www.strava.com/api/v3/activities/${run.id}`,
      { headers: auth }
    ).then(r => r.json());

    const splits = (detail.splits_standard || []).map(s => ({
      mile: s.split,
      paceSec: s.distance > 0 ? s.moving_time / (s.distance / 1609.344) : null, // sec per mile
      avgHR: s.average_heartrate ? Math.round(s.average_heartrate) : null,
      elevDiffFt: s.elevation_difference != null ? Math.round(s.elevation_difference * 3.28084) : null,
    }));

    return res.status(200).json({
      name: run.name,
      startLocal: run.start_date_local,
      distanceMi: +(run.distance / 1609.344).toFixed(2),
      movingTimeSec: run.moving_time,
      elapsedTimeSec: run.elapsed_time,
      avgHR: run.average_heartrate ? Math.round(run.average_heartrate) : null,
      maxHR: run.max_heartrate ? Math.round(run.max_heartrate) : null,
      elevGainFt: run.total_elevation_gain != null ? Math.round(run.total_elevation_gain * 3.28084) : null,
      // Strava reports running cadence as single-leg rpm; double it for steps/min
      cadenceSpm: run.average_cadence ? Math.round(run.average_cadence * 2) : null,
      sufferScore: run.suffer_score ?? null,
      splits,
    });
  } catch (e) {
    return res.status(502).json({ error: "Strava request failed: " + e.message });
  }
}
