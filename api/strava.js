// Vercel serverless function: pulls your run from Strava with full metrics.
// One-time setup (see README): create a Strava API app, authorize once, then set
// STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN in Vercel env vars.
// Strava access tokens expire every 6 hours; this function refreshes automatically.

export default async function handler(req, res) {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = process.env;
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
    return res.status(503).json({ error: "Strava not configured — set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN in Vercel." });
  }
  const date = req.query.date; // YYYY-MM-DD
  if (!date) return res.status(400).json({ error: "date query param required (YYYY-MM-DD)." });

  try {
    // 1. Refresh the access token
    const tokenResp = await fetch("https://www.strava.com/api/v3/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: STRAVA_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) {
      return res.status(502).json({ error: "Strava token refresh failed — re-check the three env vars." });
    }
    const auth = { Authorization: `Bearer ${tokenData.access_token}` };

    // 2. Find the run on the requested local date
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

    // 3. Pull the detailed activity for mile splits
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
