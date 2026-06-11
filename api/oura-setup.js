// One-time Oura OAuth2 connect. Visit /api/oura-setup with no params: it
// redirects to Oura's consent screen. Oura redirects back here with ?code=,
// we exchange it and persist tokens in Redis. Re-visit any time to re-connect.
// The Oura app's Redirect URI must be set to exactly: https://<your-app>/api/oura-setup

import { Redis } from "@upstash/redis";

const TOKEN_KEY = "pacer:oura_tokens";
const SCOPES = "personal daily heartrate workout session";

export default async function handler(req, res) {
  const { OURA_CLIENT_ID, OURA_CLIENT_SECRET } = process.env;
  if (!OURA_CLIENT_ID || !OURA_CLIENT_SECRET) {
    return res.status(503).send("Set OURA_CLIENT_ID and OURA_CLIENT_SECRET in Vercel env vars, redeploy, then revisit this page.");
  }
  const redirectUri = `https://${req.headers.host}/api/oura-setup`;

  // Step 2: back from Oura with an authorization code
  if (req.query.code) {
    try {
      const r = await fetch("https://api.ouraring.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: req.query.code,
          redirect_uri: redirectUri,
          client_id: OURA_CLIENT_ID,
          client_secret: OURA_CLIENT_SECRET,
        }),
      });
      const j = await r.json();
      if (!j.access_token) {
        return res.status(400).send("Token exchange failed: " + JSON.stringify(j).slice(0, 300) + " — check that the Redirect URI in your Oura app settings is exactly " + redirectUri);
      }
      const redis = Redis.fromEnv();
      await redis.set(TOKEN_KEY, JSON.stringify({
        access_token: j.access_token,
        refresh_token: j.refresh_token,
        expires_at: Date.now() + (j.expires_in || 86400) * 1000,
      }));
      res.setHeader("Content-Type", "text/html");
      return res.status(200).send(`<body style="font-family:sans-serif;padding:24px;max-width:480px;margin:auto">
        <h2>Oura connected ✓</h2>
        <p>Tokens stored. Open Pacer and tap <b>Sync Oura + weather</b> — readiness, sleep, HRV and resting HR will fill in automatically from now on.</p>
      </body>`);
    } catch (e) {
      return res.status(502).send("Error: " + e.message);
    }
  }

  // Step 1: kick off the consent flow
  if (req.query.error) return res.status(400).send("Oura authorization was denied: " + req.query.error);
  const authUrl = "https://cloud.ouraring.com/oauth/authorize?" + new URLSearchParams({
    response_type: "code",
    client_id: OURA_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: SCOPES,
  });
  res.writeHead(302, { Location: authUrl });
  return res.end();
}
