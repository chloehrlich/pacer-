// One-time Strava OAuth2 connect. Visit /api/strava-setup with no params: it
// redirects to Strava's consent screen. Strava redirects back here with ?code=,
// we exchange it and persist tokens in Redis. Re-visit any time to re-connect.
// The Strava app's "Authorization Callback Domain" must be set to exactly your
// app's host, e.g. pacer-rouge.vercel.app. Env: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET.

import { Redis } from "@upstash/redis";

const TOKEN_KEY = "pacer:strava_tokens";
const SCOPE = "activity:read_all";

// Vercel's Upstash/KV integration injects KV_REST_API_* names; older setups use
// UPSTASH_REDIS_REST_*. Accept either so Redis.fromEnv()'s naming isn't required.
function redisFromEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Redis env vars not set");
  return new Redis({ url, token });
}

export default async function handler(req, res) {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } = process.env;
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    return res.status(503).send("Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in Vercel env vars, redeploy, then revisit this page.");
  }
  const redirectUri = `https://${req.headers.host}/api/strava-setup`;

  // Step 2: back from Strava with an authorization code
  if (req.query.code) {
    try {
      const r = await fetch("https://www.strava.com/api/v3/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          code: req.query.code,
          grant_type: "authorization_code",
        }),
      });
      const j = await r.json();
      if (!j.access_token || !j.refresh_token) {
        return res.status(400).send("Token exchange failed: " + JSON.stringify(j).slice(0, 300) + " — authorization codes are single-use; revisit /api/strava-setup to get a fresh one.");
      }
      const redis = redisFromEnv();
      await redis.set(TOKEN_KEY, JSON.stringify({
        access_token: j.access_token,
        refresh_token: j.refresh_token,
        expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 21600),
      }));
      res.setHeader("Content-Type", "text/html");
      return res.status(200).send(`<body style="font-family:sans-serif;padding:24px;max-width:480px;margin:auto">
        <h2>Strava connected ✓</h2>
        <p>Tokens stored${j.athlete ? " for " + j.athlete.firstname + " " + j.athlete.lastname : ""}. In Pacer, open the <b>Log run</b> tab and tap <b>Pull from Strava</b> after your watch syncs — distance, time, heart rate, elevation, cadence, and per-mile splits will fill in automatically.</p>
      </body>`);
    } catch (e) {
      return res.status(502).send("Error: " + e.message);
    }
  }

  // Step 1: kick off the consent flow
  if (req.query.error) return res.status(400).send("Strava authorization was denied: " + req.query.error);
  const authUrl = "https://www.strava.com/oauth/authorize?" + new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    approval_prompt: "force",
    scope: SCOPE,
  });
  res.writeHead(302, { Location: authUrl });
  return res.end();
}
