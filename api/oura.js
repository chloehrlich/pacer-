// Vercel serverless function: proxies Oura v2 API so your token stays server-side.
// Set OURA_TOKEN in Vercel → Project → Settings → Environment Variables.

export default async function handler(req, res) {
  const token = process.env.OURA_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "OURA_TOKEN env var not set in Vercel." });
  }
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: "start and end query params required (YYYY-MM-DD)." });
  }

  const base = "https://api.ouraring.com/v2/usercollection";
  const headers = { Authorization: `Bearer ${token}` };

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
