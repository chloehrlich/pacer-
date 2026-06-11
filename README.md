# Pacer · Chicago 2026

Your Pfitzinger 18/55 training companion with **live Oura sync**, **auto-weather**, **cloud-saved run history**, and **home-screen install** (PWA). One tap every morning fills in readiness, sleep, HRV, resting HR, temperature, and humidity, then tells you whether to run the workout as written, soften it, or downgrade it — with heat-corrected pace targets.

## Deploy (≈7 minutes, free)

1. **Oura token** — at [cloud.ouraring.com/personal-access-tokens](https://cloud.ouraring.com/personal-access-tokens), create a Personal Access Token and copy it.
2. **Deploy the folder** — go to [vercel.com/new](https://vercel.com/new) and drag this folder in (no GitHub needed), or run `npx vercel` inside it. Vercel auto-detects Vite.
3. **Add the token** — Project → Settings → Environment Variables → `OURA_TOKEN` = your token. Redeploy if prompted.
4. **Add cloud storage** — Project → Storage → Create Database → **Upstash for Redis** (free tier) → Connect. Env vars are injected automatically; redeploy.
5. **Install on your phone** — open the URL in Safari → Share → **Add to Home Screen**. It launches full-screen with its own icon, like a native app.

The masthead shows **☁ synced** when cloud storage is live. Until step 4 is done the app still works — it just says "saved on this device only."

## What lives where

- **The app**: permanently on Vercel's servers at your URL. Closing the browser, restarting your phone — irrelevant.
- **Your logs + settings**: in Upstash Redis (cloud), mirrored to the device for speed. Open the same URL on a laptop and your history is there. Clearing browser data no longer loses anything.
- **Your Oura token**: server-side only, never in the browser.

## Run locally

```bash
npm install
npx vercel dev   # serves the app + both API functions (link the project first so env vars load)
```

## Daily flow

- **Today** → tap **Sync Oura + weather** (open the Oura app first so the ring has uploaded) → read the briefing → run.
  - The briefing includes a **fuel plan**: pre-run carbs (GI-safe options), an intra-run gel schedule with clock times (carb targets progress 60 → 70 → ~78 g/hr across the block for gut training; Beta Fuel on race-specific days, homemade flask otherwise), and fluid + SaltStick guidance scaled to the day’s temp+dew sum.
- **Log run** → distance, time, RPE → graded against the heat-adjusted window.
- **Plan** → all 18 weeks, stars on completed days.
- **Setup** → goal time drives the pace zones; HRV/RHR baselines auto-fill from your last 30 nights on first sync.

## Strava setup (one-time, ~10 minutes)

Pacer pulls your run straight from Strava after your watch syncs — distance, time, avg/max heart rate, elevation gain, cadence, and per-mile splits with HR.

1. **Create your API app** — go to [strava.com/settings/api](https://www.strava.com/settings/api). Application name: Pacer. Website: your Vercel URL. Authorization Callback Domain: `localhost`. Save, and note the **Client ID** and **Client Secret**.
1. **Authorize once** — paste this in a browser (swap in your Client ID):
   
   ```
   https://www.strava.com/oauth/authorize?client_id=YOUR_ID&response_type=code&redirect_uri=http://localhost&approval_prompt=force&scope=activity:read_all
   ```
   
   Approve. The browser lands on a localhost page that won’t load — that’s expected. Copy the `code=...` value out of the address bar.
1. **Exchange the code for a refresh token** — in any terminal:
   
   ```
   curl -X POST https://www.strava.com/api/v3/oauth/token \
     -d client_id=YOUR_ID -d client_secret=YOUR_SECRET \
     -d code=PASTED_CODE -d grant_type=authorization_code
   ```
   
   Copy the `refresh_token` from the response.
1. **Add three env vars in Vercel** — `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`. Redeploy.

That refresh token doesn’t expire with normal use; the app refreshes access tokens automatically. From then on: finish your run → watch syncs to Strava → tap **Pull from Strava** on the Log tab.

### Why Strava and not the Garmin API

Garmin’s official Connect API requires applying to their developer program with a business use case — personal projects don’t get approved. Every Garmin (and Coros, Apple Watch, etc.) auto-pushes to Strava anyway, so Strava’s open individual API is the universal hub with all the same data.
