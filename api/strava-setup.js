// ONE-TIME SETUP HELPER — phone-friendly replacement for the curl step.
// Visit in a browser after authorizing your Strava app:
//   /api/strava-setup?client_id=...&client_secret=...&code=...
// It exchanges the code and shows your refresh token. Copy it into the
// STRAVA_REFRESH_TOKEN env var, then this endpoint is no longer needed.
// (It only works with credentials YOU supply in the URL — it stores nothing.)

export default async function handler(req, res) {
  const { client_id, client_secret, code } = req.query;
  if (!client_id || !client_secret || !code) {
    return res.status(400).send(
      "Usage: /api/strava-setup?client_id=YOUR_ID&client_secret=YOUR_SECRET&code=CODE_FROM_AUTH_REDIRECT"
    );
  }
  try {
    const r = await fetch("https://www.strava.com/api/v3/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id, client_secret, code, grant_type: "authorization_code" }),
    });
    const j = await r.json();
    if (!j.refresh_token) {
      return res.status(400).send("Exchange failed: " + JSON.stringify(j) + " — authorization codes are single-use; re-run the authorize URL to get a fresh one.");
    }
    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(
      `<body style="font-family:sans-serif;padding:24px;max-width:480px;margin:auto">
        <h2>Strava connected ✓</h2>
        <p>Copy this refresh token into Vercel → Settings → Environment Variables as <b>STRAVA_REFRESH_TOKEN</b> (along with STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET), then redeploy:</p>
        <p style="font-size:18px;background:#eef;padding:12px;border-radius:8px;word-break:break-all"><b>${j.refresh_token}</b></p>
        <p>Athlete: ${j.athlete ? j.athlete.firstname + " " + j.athlete.lastname : "—"}</p>
      </body>`
    );
  } catch (e) {
    return res.status(502).send("Error: " + e.message);
  }
}
