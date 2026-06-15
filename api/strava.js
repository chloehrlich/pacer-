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
    // Find the day's activities (any sport — runs, rides, lifts, swims, etc.)
    const after = Math.floor(new Date(date + "T00:00:00Z").getTime() / 1000) - 86400; // pad for timezones
    const acts = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=30`,
      { headers: auth }
    ).then(r => r.json());
    if (!Array.isArray(acts)) return res.status(502).json({ error: "Strava activities fetch failed." });

    const onDay = acts.filter(a => a.start_date_local && a.start_date_local.startsWith(date));
    if (!onDay.length) return res.status(404).json({ error: `No activity found on Strava for ${date}. Has your watch/app synced yet?` });

    const RUN_TYPES = ["Run", "TrailRun", "VirtualRun"];
    const isRunAct = a => RUN_TYPES.includes(a.type) || RUN_TYPES.includes(a.sport_type);
    const runActs = onDay.filter(isRunAct).sort((a, b) => (b.moving_time || 0) - (a.moving_time || 0));
    const crossActs = onDay.filter(a => !isRunAct(a)).sort((a, b) => (b.moving_time || 0) - (a.moving_time || 0));
    const totalMovingTimeSec = onDay.reduce((s, a) => s + (a.moving_time || 0), 0);

    // The day's run (longest, if there are several), with mile splits.
    let run = null;
    if (runActs.length) {
      const r0 = runActs[0];
      const detail = await fetch(
        `https://www.strava.com/api/v3/activities/${r0.id}`,
        { headers: auth }
      ).then(r => r.json());
      const splits = (detail.splits_standard || []).map(s => ({
        mile: s.split,
        paceSec: s.distance > 0 ? s.moving_time / (s.distance / 1609.344) : null, // sec per mile
        avgHR: s.average_heartrate ? Math.round(s.average_heartrate) : null,
        elevDiffFt: s.elevation_difference != null ? Math.round(s.elevation_difference * 3.28084) : null,
      }));
      run = {
        name: r0.name,
        startLocal: r0.start_date_local,
        distanceMi: +(r0.distance / 1609.344).toFixed(2),
        movingTimeSec: r0.moving_time,
        elapsedTimeSec: r0.elapsed_time,
        avgHR: r0.average_heartrate ? Math.round(r0.average_heartrate) : null,
        maxHR: r0.max_heartrate ? Math.round(r0.max_heartrate) : null,
        elevGainFt: r0.total_elevation_gain ? Math.round(r0.total_elevation_gain * 3.28084) : null,
        // Strava reports running cadence as single-leg rpm; double it for steps/min
        cadenceSpm: r0.average_cadence ? Math.round(r0.average_cadence * 2) : null,
        sufferScore: r0.suffer_score ?? null,
        splits,
      };
    }

    // Every non-run activity that day (bike, lift, swim, ...).
    const cross = crossActs.map(a => ({
      sportType: a.sport_type || a.type,
      name: a.name,
      movingTimeSec: a.moving_time,
      avgHR: a.average_heartrate ? Math.round(a.average_heartrate) : null,
      maxHR: a.max_heartrate ? Math.round(a.max_heartrate) : null,
      distanceMi: a.distance > 0 ? +(a.distance / 1609.344).toFixed(2) : null,
      elevGainFt: a.total_elevation_gain ? Math.round(a.total_elevation_gain * 3.28084) : null,
    }));

    return res.status(200).json({ run, cross, totalMovingTimeSec });
  } catch (e) {
    return res.status(502).json({ error: "Strava request failed: " + e.message });
  }
}
