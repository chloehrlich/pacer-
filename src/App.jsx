import React, { useState, useEffect, useMemo } from "react";

/* ============================================================
   PACER — Chicago 2026 daily training companion (standalone)
   Pfitzinger 18/55 · Jun 8 → Oct 11, 2026
   Live Oura v2 sync via /api/oura · weather via Open-Meteo
   ============================================================ */

const PLAN_START = new Date(2026, 5, 8);
const RACE_DAY = new Date(2026, 9, 11);

const PLAN = [
  { wk: 17, block: "Endurance", days: ["Rest or cross-train","LT 8 mi with 4 mi @ LT","Rest or cross-train","Gen-aerobic 9 mi","Rest or cross-train","Recovery 4 mi","Med-long run 12 mi"], vol: "33 mi" },
  { wk: 16, block: "Endurance", days: ["Rest or cross-train","GA + speed 8 mi · 6×10s hills + 8×100m strides","Rest or cross-train","Gen-aerobic 10 mi","Rest or cross-train","Recovery 4 mi","MP run 13 mi with 8 @ marathon pace"], vol: "36 mi" },
  { wk: 15, block: "Endurance", days: ["Rest or cross-train","GA + speed 8 mi · 6×10s hills + 8×100m strides","Recovery 4 mi","LT 8 mi with 4 mi @ LT","Rest or cross-train","Recovery 4 mi","Med-long run 14 mi"], vol: "40 mi" },
  { wk: 14, block: "Endurance", days: ["Rest or cross-train","GA + speed 8 mi · 6×10s hills + 8×100m strides","Recovery 5 mi","Gen-aerobic 10 mi","Rest or cross-train","Recovery 5 mi","Med-long run 15 mi"], vol: "42 mi" },
  { wk: 13, block: "Endurance", days: ["Rest or cross-train","LT 9 mi with 5 mi @ LT","Recovery 5 mi","Gen-aerobic 10 mi","Rest or cross-train","Recovery 5 mi","MP run 16 mi with 10 @ marathon pace"], vol: "45 mi" },
  { wk: 12, block: "Endurance · recovery wk", days: ["Rest or cross-train","GA + speed 8 mi · 10×100m strides","Recovery 5 mi","Gen-aerobic 8 mi","Rest or cross-train","Recovery 4 mi","Med-long run 12 mi"], vol: "37 mi", recovery: true },
  { wk: 11, block: "LT + Endurance", days: ["Rest or cross-train","LT 10 mi with 5 mi @ LT","Recovery 4 mi","Med-long run 11 mi","Rest or cross-train","GA + speed 7 mi · 8×100m strides","Long run 18 mi"], vol: "50 mi" },
  { wk: 10, block: "LT + Endurance", days: ["Rest or cross-train","Recovery + speed 7 mi · 6×100m strides","Med-long run 12 mi","Rest or cross-train","LT 10 mi with 6 mi @ LT","Recovery 5 mi","Long run 20 mi"], vol: "54 mi" },
  { wk: 9, block: "LT + Endurance", days: ["Rest or cross-train","Recovery 6 mi","Med-long run 14 mi","Recovery 6 mi","Rest or cross-train","Recovery + speed 6 mi · 6×100m strides","MP run 16 mi with 12 @ marathon pace"], vol: "48 mi" },
  { wk: 8, block: "LT + Endurance · recovery wk", days: ["Rest or cross-train","Gen-aerobic 8 mi","VO2max 8 mi · 5×800m @ 5K pace","Recovery 5 mi","GA + speed 8 mi · 6×10s hills + 8×100m strides","Med-long run 14 mi","Rest or cross-train"], vol: "43 mi", recovery: true },
  { wk: 7, block: "LT + Endurance", days: ["Rest or cross-train","Recovery + speed 7 mi · 6×100m strides","LT 11 mi with 7 mi @ LT","Med-long run 12 mi","Rest or cross-train","Recovery 5 mi","Long run 20 mi"], vol: "55 mi" },
  { wk: 6, block: "Race Prep", days: ["Rest or cross-train","VO2max 8 mi · 5×600m @ 5K pace","Med-long run 12 mi","Rest or cross-train","Recovery + speed 5 mi · 6×100m strides","Tune-up race 8K–15K (9–13 mi total)","Long run 17 mi"], vol: "51–55 mi" },
  { wk: 5, block: "Race Prep", days: ["Rest or cross-train","Gen-aerobic 8 mi","VO2max 9 mi · 5×1000m @ 5K pace","Rest or cross-train","Med-long run 12 mi","Recovery 5 mi","MP run 18 mi with 14 @ marathon pace"], vol: "52 mi" },
  { wk: 4, block: "Race Prep", days: ["Rest or cross-train","VO2max 8 mi · 5×600m @ 5K pace","Med-long run 11 mi","Rest or cross-train","Recovery + speed 4 mi · 6×100m strides","Tune-up race 8K–15K (9–13 mi total)","Long run 17 mi"], vol: "49–53 mi" },
  { wk: 3, block: "Race Prep", days: ["Rest or cross-train","VO2max 10 mi · 4×1200m @ 5K pace","Med-long run 11 mi","Rest or cross-train","Recovery + speed 7 mi · 6×100m strides","Recovery 4 mi","Long run 20 mi"], vol: "52 mi" },
  { wk: 2, block: "Taper", days: ["Rest or cross-train","VO2max 8 mi · 5×600m @ 5K pace","Recovery 6 mi","Rest or cross-train","Recovery + speed 4 mi · 6×100m strides","Tune-up race 8K–10K (9–11 mi total)","Long run 16 mi"], vol: "43–45 mi" },
  { wk: 1, block: "Taper", days: ["Rest or cross-train","VO2max 8 mi · 4×1200m @ 5K pace","Recovery + speed 5 mi · 6×100m strides","Rest or cross-train","Recovery + speed 5 mi · 6×100m strides","Rest or cross-train","Med-long run 12 mi"], vol: "32 mi" },
  { wk: 0, block: "Race week", days: ["Rest","Recovery 6 mi","Dress rehearsal 7 mi with 2 @ MP","Rest","Recovery + speed 5 mi · 6×100m strides","Rest","GOAL MARATHON — Chicago"], vol: "22 mi" },
];

const DAY_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

function classify(text) {
  const t = text.toLowerCase();
  if (t.includes("goal marathon")) return "race";
  if (t.startsWith("rest")) return "rest";
  if (t.includes("dress rehearsal")) return "mp";
  if (t.includes("tune-up")) return "tuneup";
  if (t.includes("vo2max")) return "vo2";
  if (t.startsWith("lt")) return "lt";
  if (t.includes("mp run") || t.includes("marathon pace")) return "mp";
  if (t.includes("long run")) return "long";
  if (t.includes("med-long")) return "medlong";
  if (t.includes("recovery")) return "recovery";
  return "ga";
}

const TYPE_META = {
  rest: { label: "Rest / cross-train", quality: false },
  recovery: { label: "Recovery", quality: false },
  ga: { label: "General aerobic", quality: false },
  medlong: { label: "Medium-long run", quality: false },
  long: { label: "Long run", quality: true },
  mp: { label: "Marathon-pace run", quality: true },
  lt: { label: "Lactate threshold", quality: true },
  vo2: { label: "VO₂max intervals", quality: true },
  tuneup: { label: "Tune-up race", quality: true },
  race: { label: "Race day", quality: true },
};

function parseGoal(str) {
  const p = String(str).split(":").map(Number);
  if (p.some(isNaN)) return null;
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 3600 + p[1] * 60;
  return null;
}
function fmtPace(sec) {
  if (!sec || !isFinite(sec)) return "—";
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
function fmtDuration(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
function zones(goalSec) {
  const mp = goalSec / 26.2188;
  return {
    recovery: [mp * 1.25, mp * 1.38], ga: [mp * 1.12, mp * 1.25],
    medlong: [mp * 1.10, mp * 1.20], long: [mp * 1.10, mp * 1.20],
    mp: [mp * 0.99, mp * 1.02], lt: [mp * 0.93, mp * 0.96],
    vo2: [mp * 0.88, mp * 0.91], tuneup: [mp * 0.90, mp * 0.94],
    race: [mp * 0.99, mp * 1.01],
  };
}
/* ---------- heat adjustment: Hadley temp + dew point method ----------
   Sum air temp (°F) + dew point (°F), map to a pace-adjustment % range.
   For intervals ≤ 1 mile (VO2max days), use half the adjustment.
   Sum > 180: hard running not recommended — effort only. */
const HADLEY_TABLE = [
  [100, 0.000, 0.000],
  [110, 0.000, 0.005],
  [120, 0.005, 0.010],
  [130, 0.010, 0.020],
  [140, 0.020, 0.030],
  [150, 0.030, 0.045],
  [160, 0.045, 0.060],
  [170, 0.060, 0.080],
  [180, 0.080, 0.100],
];
function dewPointF(tempF, humidity) {
  // Magnus formula, via °C
  const tC = (tempF - 32) / 1.8;
  const g = (17.62 * tC) / (243.12 + tC) + Math.log(Math.max(1, Math.min(100, humidity)) / 100);
  const dpC = (243.12 * g) / (17.62 - g);
  return dpC * 1.8 + 32;
}
function heatModel(tempF, dewF, isShortIntervals) {
  const sum = Math.round(tempF + dewF);
  if (sum > 180) return { sum, lo: 0.10, hi: 0.12, noHard: true };
  let lo = 0, hi = 0;
  for (const [cap, l, h] of HADLEY_TABLE) { if (sum <= cap) { lo = l; hi = h; break; } }
  if (isShortIntervals) { lo /= 2; hi /= 2; }
  return { sum, lo, hi, noHard: false };
}
function assessReadiness({ readiness, sleep, hrvDelta, rhrDelta }, isQuality) {
  const flags = [];
  if (hrvDelta <= -10) flags.push("HRV well below your baseline");
  if (rhrDelta >= 5) flags.push("resting HR elevated vs baseline");
  if (sleep !== "" && Number(sleep) < 65) flags.push("poor sleep score");
  const r = Number(readiness);
  let tier;
  if (r >= 78 && flags.length === 0) tier = 0;
  else if (r >= 65 && flags.length <= 1) tier = 1;
  else tier = 2;
  let title, advice;
  if (tier === 0) {
    title = "Green light";
    advice = isQuality
      ? "Body's ready. Run the session as written — work the middle of your target range and let the last reps be the fastest."
      : "All systems normal. Run by feel and keep it genuinely easy.";
  } else if (tier === 1) {
    title = "Proceed, but soften it";
    advice = isQuality
      ? "Keep the full volume but sit at the slow end of your quality range. Skip chasing splits today — effort over pace."
      : "Fine to run, but hold the easy end of easy. Cut a mile if it feels like work.";
  } else {
    title = "Downgrade today";
    advice = isQuality
      ? "Your recovery data says no hard work today. Convert this to an easy general-aerobic run of similar distance (or shorter), and slide the quality session a day or two if the week allows."
      : "Take the shortest version of today — or a full rest day. One skipped easy run costs nothing; digging the hole deeper does.";
  }
  return { tier, title, advice, flags };
}
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function planIndex(d) {
  const ms = new Date(d.getFullYear(), d.getMonth(), d.getDate()) - PLAN_START;
  const dd = Math.floor(ms / 86400000);
  if (dd < 0 || dd >= PLAN.length * 7) return null;
  return { week: Math.floor(dd / 7), day: dd % 7 };
}

/* localStorage persistence */
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.error(e); }
}

/* ---------- live data sync ---------- */
async function fetchOura(forDate) {
  // Pull 35 days so we can compute baselines and grab today's scores in one call.
  const end = forDate;
  const startD = new Date(forDate + "T12:00:00"); startD.setDate(startD.getDate() - 35);
  const start = dateKey(startD);
  const r = await fetch(`/api/oura?start=${start}&end=${end}`);
  if (!r.ok) throw new Error((await r.json()).error || `Oura proxy returned ${r.status}`);
  const { readiness, dailySleep, sleepDetail } = await r.json();

  const rToday = (readiness.data || []).find(d => d.day === forDate);
  const sToday = (dailySleep.data || []).find(d => d.day === forDate);

  // Nightly HRV / lowest HR from the long sleep period ending on forDate
  const nights = (sleepDetail.data || []).filter(d => d.day === forDate && d.type !== "rest");
  const main = nights.sort((a, b) => (b.total_sleep_duration || 0) - (a.total_sleep_duration || 0))[0];

  // Baselines: mean over the window (excluding today)
  const hrvVals = (sleepDetail.data || []).filter(d => d.day !== forDate && d.average_hrv).map(d => d.average_hrv);
  const rhrVals = (sleepDetail.data || []).filter(d => d.day !== forDate && d.lowest_heart_rate).map(d => d.lowest_heart_rate);
  const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;

  return {
    readiness: rToday ? rToday.score : null,
    sleep: sToday ? sToday.score : null,
    hrv: main && main.average_hrv ? Math.round(main.average_hrv) : null,
    rhr: main && main.lowest_heart_rate ? main.lowest_heart_rate : null,
    baseHRV: mean(hrvVals) ? Math.round(mean(hrvVals)) : null,
    baseRHR: mean(rhrVals) ? Math.round(mean(rhrVals)) : null,
  };
}

async function fetchWeather() {
  const pos = await new Promise((res, rej) =>
    navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
  );
  const { latitude, longitude } = pos.coords;
  const r = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,dew_point_2m&temperature_unit=fahrenheit`
  );
  if (!r.ok) throw new Error("Weather lookup failed");
  const j = await r.json();
  return {
    temp: Math.round(j.current.temperature_2m),
    humidity: Math.round(j.current.relative_humidity_2m),
    dew: Math.round(j.current.dew_point_2m),
  };
}

/* ---------- cloud sync (Upstash Redis via /api/data) ---------- */
let pushTimer = null;
function pushCloud(logs, settings, setCloud) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs, settings, savedAt: Date.now() }),
      });
      setCloud(r.ok ? "synced" : "local");
    } catch { setCloud("local"); }
  }, 800);
}
function mergeLogs(local, cloud) {
  const out = { ...local };
  for (const [k, v] of Object.entries(cloud || {})) {
    out[k] = { ...(out[k] || {}), ...v };
  }
  return out;
}

/* ---------- fueling engine ----------
   Pre-run + intra-run plan built from duration, intensity, heat, and
   block phase. Carb targets progress across the block (gut training):
   Endurance 60 g/hr → LT+Endurance 70 g/hr → Race Prep/Taper 75–80 g/hr.
   Beta Fuel gel = 40 g carbs. SaltStick by heat (temp+dew sum). */
function parseMiles(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*mi/);
  return m ? Number(m[1]) : null;
}
function fuelPlan({ type, miles, paceMidSec, heatSum, weeksToGoal }) {
  if (type === "rest" || !miles || !paceMidSec) return null;
  const durationMin = (miles * paceMidSec) / 60;
  const carbTarget = weeksToGoal >= 12 ? 60 : weeksToGoal >= 7 ? 70 : 78;
  const isQuality = ["lt", "vo2", "mp", "long", "tuneup", "race"].includes(type);
  const raceSpecific = ["mp", "long", "tuneup", "race"].includes(type);
  const hot = heatSum >= 130, veryHot = heatSum >= 150;

  // --- pre-run ---
  let pre;
  if (durationMin <= 70 && !isQuality) {
    pre = "Optional — water + coffee is fine. If hungry: half a banana or a few dates ~30 min out. Low-fiber, low-fat.";
  } else if (isQuality && durationMin <= 90) {
    pre = "30–40 g carbs 60–90 min before (toast + honey, banana, or an applesauce pouch) + 8–12 oz water. Caffeine if you want it — quality work earns it.";
  } else {
    pre = "50–75 g carbs 90–120 min before (oatmeal + honey + banana is the GI-safe combo) + 16 oz water, then a few sips 15 min out.";
  }

  // --- intra-run ---
  const intra = [];
  if (durationMin >= 75) {
    const fueledHours = Math.max(0, (durationMin - 20) / 60); // first gel ~25 min in
    const gels = Math.max(1, Math.round((fueledHours * carbTarget) / 40));
    const interval = Math.max(20, Math.min(35, Math.round((durationMin - 25) / gels)));
    const times = Array.from({ length: gels }, (_, i) => {
      const t = 25 + i * interval;
      const h = Math.floor(t / 60), mm = t % 60;
      return h > 0 ? `${h}:${String(mm).padStart(2, "0")}` : `:${mm}`;
    });
    const fuel = raceSpecific ? "SiS Beta Fuel — race-specific day, train the race gut" : "homemade malto/fructose flask — save the Beta Fuel";
    intra.push(`~${carbTarget} g carbs/hr → ${gels} gel${gels > 1 ? "s" : ""} (${fuel}), at ${times.join(", ")}.`);
  } else if (durationMin >= 55 && isQuality) {
    intra.push("Carbs optional at this duration — but practice sipping fluids between reps.");
  } else {
    intra.push("No fuel needed at this duration. Water if you want it.");
  }

  // --- hydration + sodium ---
  let hydro = null;
  if (durationMin >= 60 || hot) {
    const oz = veryHot ? "20–28" : hot ? "16–24" : "12–16";
    hydro = `${oz} oz fluid/hr`;
    if (durationMin >= 75 && hot) {
      const capsEvery = veryHot ? 40 : 60;
      const caps = Math.max(1, Math.floor(durationMin / capsEvery));
      hydro += ` + ${caps} SaltStick cap${caps > 1 ? "s" : ""} (one every ~${capsEvery} min — temp+dew of ${heatSum} means real sodium loss)`;
    }
    hydro += ".";
  }

  return { pre, intra, hydro, durationMin: Math.round(durationMin), carbTarget };
}

/* ---------- daily carb targets: periodized + day-before priming ----------
   g/kg by day type (sports-nutrition standard), raised when tomorrow is a
   big day (glycogen is built 24–36h ahead), full load mode in race week. */
const G_PER_KG = {
  rest: [3, 4], recovery: [4, 5], ga: [5, 7], medlong: [5, 7],
  lt: [5, 7], vo2: [5, 7], long: [7, 10], mp: [7, 10], tuneup: [7, 10], race: [8, 10],
};
const BIG_DAYS = ["long", "mp", "tuneup", "race"];
function dailyCarbs({ type, tomorrowType, isRaceLoad, weightKg, durationMin }) {
  if (!weightKg) return null;
  const today = G_PER_KG[type] || [4, 5];
  let range = today, reason = null;
  if (isRaceLoad) {
    range = [8, 10]; reason = "race-week carb load — mileage is tiny, eat big anyway";
  } else if (tomorrowType && BIG_DAYS.includes(tomorrowType) && (today[0] + today[1]) / 2 < 7) {
    range = [6, 8]; reason = "primed for tomorrow's big day — weight it toward dinner, keep it GI-familiar";
  }
  const lo = Math.round((range[0] * weightKg) / 5) * 5;
  const hi = Math.round((range[1] * weightKg) / 5) * 5;
  // post-run window: quality sessions and runs ≥90 min
  let postRun = null;
  const qualityDay = ["lt", "vo2", "mp", "long", "tuneup", "race"].includes(type);
  if ((qualityDay || (durationMin && durationMin >= 90)) && type !== "rest") {
    const pLo = Math.round((1.0 * weightKg) / 5) * 5;
    const pHi = Math.round((1.2 * weightKg) / 5) * 5;
    postRun = `${pLo}–${pHi} g carbs + 20–30 g protein within ~60 min of finishing. Heat kills appetite — a smoothie or chocolate milk counts; don't skip it.`;
  }
  return { lo, hi, reason, postRun };
}

const Star = ({ size = 14, color = "#E4393F", style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
    <path d="M12 0 L14.6 9.4 L24 12 L14.6 14.6 L12 24 L9.4 14.6 L0 12 L9.4 9.4 Z" fill={color} />
  </svg>
);

/* ---------- run-time estimator (Plan tab) ----------
   Rough duration at goal-based pace, no heat. Quality days blend the work pace
   with general-aerobic since they include easy warmup/cooldown/recovery miles. */
function estimateRunSec(text, Z, goalSec) {
  const type = classify(text);
  if (type === "rest") return null;
  if (type === "race") return goalSec;
  const miles = parseMiles(text);
  if (!miles) return null;
  const gaMid = (Z.ga[0] + Z.ga[1]) / 2;
  const zoneMid = Z[type] ? (Z[type][0] + Z[type][1]) / 2 : gaMid;
  const paceMidSec = ["lt", "vo2", "mp", "tuneup"].includes(type) ? (zoneMid + gaMid) / 2 : zoneMid;
  return miles * paceMidSec;
}
function fmtEstimate(sec) {
  const total = Math.round(sec / 60); // whole minutes
  const h = Math.floor(total / 60), m = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m} min`;
}

/* ---------- rest-day recovery guidance (by readiness tier) ---------- */
const RECOVERY_TITLE = ["Well recovered", "Still absorbing", "Run down — rest up"];
const RECOVERY_ADVICE = [
  "Markers look strong — you're absorbing the work well. Rest fully, or move easy if you feel like it.",
  "Still carrying some fatigue. Lean toward genuine rest or very light movement only.",
  "Recovery's low today. Take a real rest day — protect sleep, food, and hydration.",
];
const RECOVERY_CROSS = [
  "Optional: 30–45 min easy spin, swim, or brisk walk, all conversational. A little mobility or stretching keeps you loose.",
  "If you move: an easy walk, relaxed swim, or 15–20 min of yoga/mobility. Nothing structured.",
  "Full rest, or light stretching and a short walk at most. No added load today.",
];

/* ============================================================ */

export default function App() {
  const today = new Date();
  const [tab, setTab] = useState("today");
  const [viewDate, setViewDate] = useState(dateKey(today));
  const [settings, setSettings] = useState(() => load("pacer:settings", { goal: "3:45:00", baseHRV: "", baseRHR: "" }));
  const [logs, setLogs] = useState(() => load("pacer:logs", {}));
  const [cloud, setCloud] = useState("checking"); // checking | synced | local

  // On launch: pull cloud copy, merge with anything on this device, push the union back.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/data");
        if (!r.ok) { setCloud("local"); return; }
        const remote = await r.json();
        const mergedLogs = mergeLogs(load("pacer:logs", {}), remote.logs);
        const mergedSettings = remote.settings || load("pacer:settings", { goal: "3:45:00", baseHRV: "", baseRHR: "" });
        setLogs(mergedLogs); save("pacer:logs", mergedLogs);
        setSettings(mergedSettings); save("pacer:settings", mergedSettings);
        setCloud("synced");
        pushCloud(mergedLogs, mergedSettings, setCloud);
      } catch { setCloud("local"); }
    })();
  }, []);

  const goalSec = parseGoal(settings.goal) || parseGoal("3:45:00");
  const Z = useMemo(() => zones(goalSec), [goalSec]);

  const updateLogs = (key, patch) => {
    setLogs(prev => {
      const next = { ...prev, [key]: { ...(prev[key] || {}), ...patch } };
      save("pacer:logs", next);
      pushCloud(next, settings, setCloud);
      return next;
    });
  };
  const updateSettings = (s) => {
    setSettings(s); save("pacer:settings", s);
    pushCloud(logs, s, setCloud);
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; }
    body { background:#FBFDFE; }
    .pacer { font-family:'Barlow', system-ui, sans-serif; background:#FBFDFE; color:#101C22; min-height:100vh; max-width:560px; margin:0 auto; padding-bottom:84px; }
    .disp { font-family:'Barlow Condensed', sans-serif; }
    .band { height:14px; background:#8FD3EE; }
    .mast { padding:18px 20px 14px; }
    .mast h1 { font-family:'Barlow Condensed'; font-weight:700; font-size:30px; letter-spacing:.04em; text-transform:uppercase; line-height:1; }
    .mast .sub { color:#0F5870; font-size:13px; margin-top:4px; font-weight:500; }
    .stars { display:flex; gap:10px; padding:0 20px 10px; }
    .card { background:#fff; border:1px solid #DCEDF4; border-radius:14px; padding:16px; margin:0 16px 14px; }
    .eyebrow { font-family:'Barlow Condensed'; text-transform:uppercase; letter-spacing:.12em; font-size:12px; font-weight:600; color:#0F5870; }
    .bignum { font-family:'Barlow Condensed'; font-weight:700; font-variant-numeric:tabular-nums; }
    .tabs { position:fixed; bottom:0; left:0; right:0; max-width:560px; margin:0 auto; display:flex; background:#101C22; }
    .tabs button { flex:1; padding:14px 0 16px; background:none; border:none; color:#8FD3EE; font-family:'Barlow Condensed'; font-size:15px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; }
    .tabs button.on { color:#fff; box-shadow: inset 0 3px 0 #E4393F; }
    .tabs button:focus-visible { outline:2px solid #8FD3EE; outline-offset:-2px; }
    label.f { display:block; font-size:13px; font-weight:600; color:#0F5870; margin:12px 0 4px; }
    input.f, textarea.f { width:100%; padding:10px 12px; border:1px solid #BFE0EE; border-radius:10px; font:inherit; font-size:16px; background:#fff; }
    input.f:focus, textarea.f:focus { outline:2px solid #8FD3EE; border-color:#8FD3EE; }
    .btn { width:100%; margin-top:16px; padding:13px; border:none; border-radius:10px; background:#E4393F; color:#fff; font-family:'Barlow Condensed'; font-size:18px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; }
    .btn.alt { background:#0F5870; }
    .btn.ghost { background:#fff; color:#0F5870; border:1.5px solid #0F5870; }
    .btn:focus-visible { outline:3px solid #101C22; }
    .row2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .zone { display:flex; justify-content:space-between; align-items:baseline; padding:7px 0; border-bottom:1px dashed #DCEDF4; }
    .zone:last-child { border-bottom:none; }
    .wkhead { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; cursor:pointer; background:#fff; border:1px solid #DCEDF4; border-radius:12px; margin:0 16px 8px; }
    .dayrow { display:flex; gap:10px; align-items:flex-start; padding:8px 16px; font-size:14px; }
    .dayrow .dn { width:36px; flex-shrink:0; font-family:'Barlow Condensed'; font-weight:600; color:#0F5870; }
    .syncmsg { font-size:13px; margin-top:8px; }
    @media (prefers-reduced-motion: no-preference) { .card { animation: rise .25s ease; } @keyframes rise { from { opacity:0; transform:translateY(6px);} to {opacity:1; transform:none;} } }
  `;

  return (
    <div className="pacer">
      <style>{css}</style>
      <div className="band" />
      <div className="mast">
        <h1>Pacer · Chicago 2026</h1>
        <div className="sub">
          Pfitzinger 18/55 · Race day Oct 11 · {Math.max(0, Math.ceil((RACE_DAY - today) / 86400000))} days out
          {" · "}
          {cloud === "synced" && <span style={{ color: "#1B7F4D", fontWeight: 600 }}>☁ synced</span>}
          {cloud === "local" && <span style={{ color: "#C77B00", fontWeight: 600 }}>saved on this device only</span>}
          {cloud === "checking" && <span>connecting…</span>}
        </div>
      </div>
      <div className="stars">{[0,1,2,3].map(i => <Star key={i} size={16} />)}</div>
      <div className="band" style={{ marginBottom: 16 }} />

      {tab === "today" && <Today viewDate={viewDate} logs={logs} updateLogs={updateLogs} Z={Z} settings={settings} updateSettings={updateSettings} />}
      {tab === "log" && <PostRun viewDate={viewDate} setViewDate={setViewDate} logs={logs} updateLogs={updateLogs} Z={Z} settings={settings} />}
      {tab === "plan" && <PlanView logs={logs} today={today} Z={Z} goalSec={goalSec} />}
      {tab === "setup" && <Setup settings={settings} updateSettings={updateSettings} Z={Z} />}

      <nav className="tabs" aria-label="Sections">
        {[["today","Today"],["log","Log run"],["plan","Plan"],["setup","Setup"]].map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>
    </div>
  );
}

/* ---------------- TODAY ---------------- */
function Today({ viewDate, logs, updateLogs, Z, settings, updateSettings }) {
  const d = new Date(viewDate + "T12:00:00");
  const idx = planIndex(d);
  const savedCheckin = (logs[viewDate] && logs[viewDate].checkin) || null;
  const [form, setForm] = useState(savedCheckin || { temp: "", dew: "", humidity: "", readiness: "", sleep: "", hrv: "", rhr: "" });
  const [result, setResult] = useState(savedCheckin ? savedCheckin.result : null);
  const [sync, setSync] = useState({ busy: false, msg: "" });

  if (!idx) return <div className="card">This date falls outside the 18-week block (Jun 8 – Oct 11).</div>;

  const wk = PLAN[idx.week];
  const workout = wk.days[idx.day];
  const type = classify(workout);
  const meta = TYPE_META[type];
  const isRest = type === "rest";

  const autoFill = async () => {
    setSync({ busy: true, msg: isRest ? "Pulling Oura…" : "Pulling Oura + weather…" });
    const next = { ...form };
    const msgs = [];
    if (!isRest) {
      try {
        const w = await fetchWeather();
        next.temp = String(w.temp);
        next.humidity = String(w.humidity);
        next.dew = String(w.dew);
        msgs.push(`Weather: ${w.temp}°F, dew point ${w.dew}°F (T+DP = ${w.temp + w.dew})`);
      } catch { msgs.push("Weather: location blocked — enter temp + dew point manually"); }
    }
    try {
      const o = await fetchOura(viewDate);
      if (o.readiness != null) next.readiness = String(o.readiness);
      if (o.sleep != null) next.sleep = String(o.sleep);
      if (o.hrv != null) next.hrv = String(o.hrv);
      if (o.rhr != null) next.rhr = String(o.rhr);
      if (o.baseHRV && o.baseRHR) updateSettings({ ...settings, baseHRV: String(o.baseHRV), baseRHR: String(o.baseRHR) });
      msgs.push(`Oura: readiness ${o.readiness ?? "—"}, sleep ${o.sleep ?? "—"}, HRV ${o.hrv ?? "—"}ms (30-day avg ${o.baseHRV ?? "—"}), RHR ${o.rhr ?? "—"} (avg ${o.baseRHR ?? "—"})`);
    } catch (e) { msgs.push("Oura: " + e.message); }
    setForm(next);
    setSync({ busy: false, msg: msgs.join(" · ") });
  };

  const run = () => {
    const tempF = Number(form.temp);
    const dewF = form.dew !== "" ? Number(form.dew)
      : form.humidity !== "" ? Math.round(dewPointF(tempF, Number(form.humidity)))
      : tempF; // worst-case assumption if neither given (saturated air)
    const baseHRV = Number(settings.baseHRV) || null;
    const baseRHR = Number(settings.baseRHR) || null;
    const hrvDelta = baseHRV && form.hrv ? ((Number(form.hrv) - baseHRV) / baseHRV) * 100 : 0;
    const rhrDelta = baseRHR && form.rhr ? Number(form.rhr) - baseRHR : 0;
    const heat = heatModel(tempF, dewF, type === "vo2");
    const ready = assessReadiness({ readiness: form.readiness || 80, sleep: form.sleep, hrvDelta, rhrDelta }, meta.quality);
    const adjZone = Z[type] ? [Z[type][0] * (1 + heat.lo), Z[type][1] * (1 + heat.hi)] : null;
    // Estimated whole-run pace: quality days include easy miles, so blend with GA
    const zoneMid = adjZone ? (adjZone[0] + adjZone[1]) / 2 : null;
    const gaMid = (Z.ga[0] * (1 + heat.lo) + Z.ga[1] * (1 + heat.hi)) / 2;
    const paceMidSec = zoneMid ? (["lt", "vo2", "mp", "tuneup"].includes(type) ? (zoneMid + gaMid) / 2 : zoneMid) : null;
    const fuel = fuelPlan({ type, miles: parseMiles(workout), paceMidSec, heatSum: heat.sum, weeksToGoal: wk.wk });
    // Tomorrow's workout for day-before priming; race-week load = Thu/Fri/Sat before the marathon
    const tomorrowIdx = planIndex(new Date(d.getTime() + 86400000));
    const tomorrowType = tomorrowIdx ? classify(PLAN[tomorrowIdx.week].days[tomorrowIdx.day]) : null;
    const isRaceLoad = wk.wk === 0 && idx.day >= 3 && idx.day <= 5;
    const weightKg = Number(settings.weightLb) ? Number(settings.weightLb) / 2.205 : null;
    const daily = dailyCarbs({ type, tomorrowType, isRaceLoad, weightKg, durationMin: fuel ? fuel.durationMin : null });
    const res = { heat, ready, adjZone, fuel, daily, hrvDelta: Math.round(hrvDelta), rhrDelta };
    setResult(res);
    updateLogs(viewDate, { checkin: { ...form, result: res } });
  };

  // Rest / cross-train days: read recovery markers and advise rest vs. light cross-training.
  const runRecovery = () => {
    const baseHRV = Number(settings.baseHRV) || null;
    const baseRHR = Number(settings.baseRHR) || null;
    const hrvDelta = baseHRV && form.hrv ? ((Number(form.hrv) - baseHRV) / baseHRV) * 100 : 0;
    const rhrDelta = baseRHR && form.rhr ? Number(form.rhr) - baseRHR : 0;
    const ready = assessReadiness({ readiness: form.readiness || 80, sleep: form.sleep, hrvDelta, rhrDelta }, false);
    const res = { recovery: true, ready, hrvDelta: Math.round(hrvDelta), rhrDelta };
    setResult(res);
    updateLogs(viewDate, { checkin: { ...form, result: res } });
  };

  const tierColors = ["#1B7F4D", "#C77B00", "#E4393F"];

  return (
    <>
      <div className="card">
        <div className="eyebrow">Week {18 - idx.week} of 18 · {wk.block} · {DAY_NAMES[idx.day]}</div>
        <div className="disp" style={{ fontSize: 26, fontWeight: 700, marginTop: 6, lineHeight: 1.15 }}>{workout}</div>
      </div>

      <div className="card">
        <div className="eyebrow">{isRest ? "Recovery check-in" : "Pre-run check-in"}</div>
        <button className="btn ghost" onClick={autoFill} disabled={sync.busy} style={{ marginTop: 12, opacity: sync.busy ? 0.6 : 1 }}>
          {sync.busy ? "Syncing…" : isRest ? "⟳ Sync Oura" : "⟳ Sync Oura + weather"}
        </button>
        {sync.msg && <p className="syncmsg" style={{ color: "#0F5870" }}>{sync.msg}</p>}
        {!isRest && (
          <div className="row2">
            <div><label className="f">Temperature (°F)</label>
              <input className="f" inputMode="numeric" value={form.temp} onChange={e => setForm({ ...form, temp: e.target.value })} /></div>
            <div><label className="f">Dew point (°F)</label>
              <input className="f" inputMode="numeric" value={form.dew} onChange={e => setForm({ ...form, dew: e.target.value })} placeholder="auto from sync" /></div>
          </div>
        )}
        <div className="row2">
          <div><label className="f">Oura readiness</label>
            <input className="f" inputMode="numeric" value={form.readiness} onChange={e => setForm({ ...form, readiness: e.target.value })} /></div>
          <div><label className="f">Sleep score</label>
            <input className="f" inputMode="numeric" value={form.sleep} onChange={e => setForm({ ...form, sleep: e.target.value })} /></div>
        </div>
        <div className="row2">
          <div><label className="f">Last-night HRV (ms)</label>
            <input className="f" inputMode="numeric" value={form.hrv} onChange={e => setForm({ ...form, hrv: e.target.value })} /></div>
          <div><label className="f">Resting HR (bpm)</label>
            <input className="f" inputMode="numeric" value={form.rhr} onChange={e => setForm({ ...form, rhr: e.target.value })} /></div>
        </div>
        {isRest ? (
          <button className="btn" onClick={runRecovery} disabled={!form.readiness} style={{ opacity: !form.readiness ? 0.5 : 1 }}>
            Read my recovery
          </button>
        ) : (
          <button className="btn" onClick={run} disabled={!form.temp || !form.readiness} style={{ opacity: (!form.temp || !form.readiness) ? 0.5 : 1 }}>
            Build today's briefing
          </button>
        )}
      </div>

      {result && !isRest && (
        <div className="card" style={{ borderLeft: `5px solid ${tierColors[result.ready.tier]}` }}>
          <div className="eyebrow" style={{ color: tierColors[result.ready.tier] }}>{result.ready.title}</div>
          <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.5 }}>{result.ready.advice}</p>
          {result.ready.flags.length > 0 && <p style={{ marginTop: 8, fontSize: 13, color: "#0F5870" }}>Flags: {result.ready.flags.join(" · ")}.</p>}
          {result.heat && result.heat.noHard && (
            <p style={{ marginTop: 8, fontSize: 13, color: "#E4393F", fontWeight: 600 }}>
              Temp + dew point = {result.heat.sum} — above 180, hard running isn't recommended. Run entirely by effort, shorten if needed, and move quality to a cooler day.
            </p>
          )}
          {result.heat && result.heat.hi > 0 && !result.heat.noHard && (
            <p style={{ marginTop: 8, fontSize: 13, color: "#0F5870" }}>
              Heat (Hadley method): temp + dew point = {result.heat.sum} → +{(result.heat.lo * 100).toFixed(1)}–{(result.heat.hi * 100).toFixed(1)}% on paces{" "}
              {PLAN[idx.week] && classify(PLAN[idx.week].days[idx.day]) === "vo2" ? "(halved for short intervals)" : ""}.
              Same effort, slower splits — that's the deal in summer.
            </p>
          )}
          {result.adjZone && result.ready.tier < 2 && !(result.heat && result.heat.noHard) && (
            <div style={{ marginTop: 12, background: "#F2F9FC", borderRadius: 10, padding: "10px 14px" }}>
              <div className="eyebrow">Adjusted target pace</div>
              <div className="bignum" style={{ fontSize: 34 }}>
                {fmtPace(result.adjZone[0])}–{fmtPace(result.adjZone[1])}<span style={{ fontSize: 16, fontWeight: 600 }}> /mi</span>
              </div>
              <div style={{ fontSize: 12, color: "#0F5870" }}>{meta.label}, heat-corrected{result.ready.tier === 1 ? " — favor the slow end today" : ""}</div>
            </div>
          )}
          {result.ready.tier === 2 && (
            <div style={{ marginTop: 12, background: "#FDF2F2", borderRadius: 10, padding: "10px 14px" }}>
              <div className="eyebrow" style={{ color: "#E4393F" }}>If you run: easy only</div>
              <div className="bignum" style={{ fontSize: 34 }}>
                {fmtPace(Z.recovery[0] * (1 + (result.heat ? result.heat.lo : 0)))}–{fmtPace(Z.recovery[1] * (1 + (result.heat ? result.heat.hi : 0)))}<span style={{ fontSize: 16, fontWeight: 600 }}> /mi</span>
              </div>
            </div>
          )}
        </div>
      )}

      {result && !isRest && result.fuel && (
        <div className="card" style={{ borderLeft: "5px solid #8FD3EE" }}>
          <div className="eyebrow">Fuel plan · est. {result.fuel.durationMin} min on your feet</div>
          <div style={{ marginTop: 10 }}>
            <div className="eyebrow" style={{ fontSize: 11, letterSpacing: ".14em" }}>Before</div>
            <p style={{ fontSize: 14, lineHeight: 1.5, marginTop: 2 }}>{result.fuel.pre}</p>
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="eyebrow" style={{ fontSize: 11, letterSpacing: ".14em" }}>During</div>
            {result.fuel.intra.map((line, i) => (
              <p key={i} style={{ fontSize: 14, lineHeight: 1.5, marginTop: 2 }}>{line}</p>
            ))}
          </div>
          {result.fuel.hydro && (
            <div style={{ marginTop: 10 }}>
              <div className="eyebrow" style={{ fontSize: 11, letterSpacing: ".14em" }}>Fluids + sodium</div>
              <p style={{ fontSize: 14, lineHeight: 1.5, marginTop: 2 }}>{result.fuel.hydro}</p>
            </div>
          )}
          {result.daily && result.daily.postRun && (
            <div style={{ marginTop: 10 }}>
              <div className="eyebrow" style={{ fontSize: 11, letterSpacing: ".14em" }}>After</div>
              <p style={{ fontSize: 14, lineHeight: 1.5, marginTop: 2 }}>{result.daily.postRun}</p>
            </div>
          )}
          {result.daily && (
            <div style={{ marginTop: 12, background: "#F2F9FC", borderRadius: 10, padding: "10px 14px" }}>
              <div className="eyebrow">Today's total carbs</div>
              <div className="bignum" style={{ fontSize: 30 }}>
                {result.daily.lo}–{result.daily.hi}<span style={{ fontSize: 15, fontWeight: 600 }}> g</span>
              </div>
              {result.daily.reason && <div style={{ fontSize: 12, color: "#0F5870", marginTop: 2 }}>{result.daily.reason}</div>}
            </div>
          )}
          {!result.daily && (
            <p style={{ marginTop: 10, fontSize: 12, color: "#0F5870" }}>Add your weight in Setup to get daily carb targets and post-run numbers.</p>
          )}
          {result.ready.tier === 2 && (
            <p style={{ marginTop: 10, fontSize: 12, color: "#0F5870" }}>If you take the downgrade to easy miles, scale this back — water and electrolytes only unless you're out past 75 min.</p>
          )}
        </div>
      )}

      {isRest && result && result.recovery && (
        <div className="card" style={{ borderLeft: `5px solid ${tierColors[result.ready.tier]}` }}>
          <div className="eyebrow" style={{ color: tierColors[result.ready.tier] }}>{RECOVERY_TITLE[result.ready.tier]}</div>
          <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.5 }}>{RECOVERY_ADVICE[result.ready.tier]}</p>
          <div style={{ marginTop: 12, background: "#F2F9FC", borderRadius: 10, padding: "10px 14px" }}>
            <div className="eyebrow">Today's move</div>
            <p style={{ fontSize: 14, lineHeight: 1.5, marginTop: 4 }}>{RECOVERY_CROSS[result.ready.tier]}</p>
          </div>
          {result.ready.flags.length > 0 && <p style={{ marginTop: 8, fontSize: 13, color: "#0F5870" }}>Flags: {result.ready.flags.join(" · ")}.</p>}
        </div>
      )}

      {isRest && (
        <div className="card">
          <p style={{ fontSize: 15, lineHeight: 1.5 }}>Rest or easy cross-training today. The plan only works if these days stay genuinely easy.</p>
          {(() => {
            const tomorrowIdx = planIndex(new Date(d.getTime() + 86400000));
            const tomorrowType = tomorrowIdx ? classify(PLAN[tomorrowIdx.week].days[tomorrowIdx.day]) : null;
            const isRaceLoad = wk.wk === 0 && idx.day >= 3 && idx.day <= 5;
            const weightKg = Number(settings.weightLb) ? Number(settings.weightLb) / 2.205 : null;
            const daily = dailyCarbs({ type: "rest", tomorrowType, isRaceLoad, weightKg, durationMin: null });
            if (!daily) return <p style={{ marginTop: 10, fontSize: 12, color: "#0F5870" }}>Add your weight in Setup to get daily carb targets.</p>;
            return (
              <div style={{ marginTop: 12, background: "#F2F9FC", borderRadius: 10, padding: "10px 14px" }}>
                <div className="eyebrow">Today's total carbs</div>
                <div className="bignum" style={{ fontSize: 30 }}>
                  {daily.lo}–{daily.hi}<span style={{ fontSize: 15, fontWeight: 600 }}> g</span>
                </div>
                {daily.reason && <div style={{ fontSize: 12, color: "#0F5870", marginTop: 2 }}>{daily.reason}</div>}
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
}

/* ---------------- LOG ---------------- */
// Cross-training is stored as { sessions: [...], rpe, notes }. Normalize older
// single-object saves into that shape.
function normalizeCross(c) {
  if (!c) return { sessions: [], rpe: "5", notes: "" };
  if (Array.isArray(c.sessions)) return { sessions: c.sessions, rpe: c.rpe || "5", notes: c.notes || "" };
  return {
    sessions: [{ sportType: c.sportType, name: c.name, movingTimeSec: c.movingTimeSec, avgHR: c.avgHR, maxHR: c.maxHR, distanceMi: c.distanceMi, elevGainFt: c.elevGainFt }],
    rpe: c.rpe || "5", notes: c.notes || "",
  };
}

function PostRun({ viewDate, setViewDate, logs, updateLogs, Z, settings }) {
  const saved = (logs[viewDate] && logs[viewDate].run) || null;
  const checkin = (logs[viewDate] && logs[viewDate].checkin) || null;
  const initCross = normalizeCross(logs[viewDate] && logs[viewDate].cross);
  const [form, setForm] = useState(saved || { dist: "", time: "", segPace: "", rpe: "5", notes: "", metrics: null, splits: null });
  const [verdict, setVerdict] = useState(saved ? saved.verdict : null);
  const [strava, setStrava] = useState({ busy: false, msg: "" });
  const [grading, setGrading] = useState(false);
  const [crossSessions, setCrossSessions] = useState(initCross.sessions);
  const [crossRpe, setCrossRpe] = useState(initCross.rpe);
  const [crossNotes, setCrossNotes] = useState(initCross.notes);
  const [crossSaved, setCrossSaved] = useState(false);

  useEffect(() => {
    const s = (logs[viewDate] && logs[viewDate].run) || null;
    const c = normalizeCross(logs[viewDate] && logs[viewDate].cross);
    setForm(s || { dist: "", time: "", segPace: "", rpe: "5", notes: "", metrics: null, splits: null });
    setVerdict(s ? s.verdict : null);
    setCrossSessions(c.sessions);
    setCrossRpe(c.rpe);
    setCrossNotes(c.notes);
    setStrava({ busy: false, msg: "" });
  }, [viewDate]); // eslint-disable-line

  const pullStrava = async () => {
    setStrava({ busy: true, msg: "Pulling from Strava…" });
    try {
      const r = await fetch(`/api/strava?date=${viewDate}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Strava returned ${r.status}`);
      if (j.run) {
        setForm(f => ({
          ...f,
          dist: String(j.run.distanceMi),
          time: fmtDuration(j.run.movingTimeSec),
          metrics: { avgHR: j.run.avgHR, maxHR: j.run.maxHR, elevGainFt: j.run.elevGainFt, cadenceSpm: j.run.cadenceSpm },
          splits: j.run.splits,
        }));
      }
      setCrossSessions(j.cross || []);
      const parts = [];
      if (j.run) parts.push(`${j.run.distanceMi} mi run`);
      (j.cross || []).forEach(c => parts.push(`${c.sportType} ${fmtDuration(c.movingTimeSec)}`));
      setStrava({ busy: false, msg: parts.length ? "Pulled: " + parts.join(" + ") : "Nothing found for this date." });
    } catch (e) {
      setStrava({ busy: false, msg: e.message });
    }
  };

  const saveCross = () => {
    updateLogs(viewDate, { cross: { sessions: crossSessions, rpe: crossRpe, notes: crossNotes } });
    setCrossSaved(true);
    setTimeout(() => setCrossSaved(false), 1800);
  };

  const d = new Date(viewDate + "T12:00:00");
  const idx = planIndex(d);
  const workout = idx ? PLAN[idx.week].days[idx.day] : null;
  const type = workout ? classify(workout) : "ga";
  const meta = TYPE_META[type];

  const localGrade = () => {
    const dist = Number(form.dist);
    const t = parseGoal(form.time.split(":").length === 2 ? "0:" + form.time : form.time);
    const avg = t && dist ? t / dist : null;
    const heat = checkin && checkin.result && checkin.result.heat ? checkin.result.heat : null;
    const lo = heat ? heat.lo : 0;
    const hi = heat ? heat.hi : 0;
    const zone = Z[type] ? [Z[type][0] * (1 + lo), Z[type][1] * (1 + hi)] : null;
    const segSec = form.segPace ? parseGoal("0:" + form.segPace) : null;
    const rpe = Number(form.rpe);
    const lines = [];
    if (avg) lines.push(`Average pace ${fmtPace(avg)}/mi over ${dist} mi.`);
    if (meta.quality && zone) {
      const compare = segSec || avg;
      const which = segSec ? "Work-segment pace" : "Average pace";
      if (compare) {
        if (compare <= zone[1] && compare >= zone[0] - 5) lines.push(`${which} landed inside the heat-adjusted target (${fmtPace(zone[0])}–${fmtPace(zone[1])}). That's the workout doing exactly its job.`);
        else if (compare < zone[0] - 5) lines.push(`${which} was faster than the target window (${fmtPace(zone[0])}–${fmtPace(zone[1])}). Felt great — but bank the fitness, don't spend it.`);
        else lines.push(`${which} came in slower than the heat-adjusted window (${fmtPace(zone[0])}–${fmtPace(zone[1])}). One soft session means nothing; if the next two quality days drift too, look at recovery, fueling, or the goal pace itself.`);
      }
      if (rpe >= 9) lines.push("RPE 9+ on a training day is a flag — tomorrow should be truly easy.");
    } else if (zone) {
      if (avg && avg < zone[0] - 10) lines.push(`Easy day run at ${fmtPace(avg)} — faster than the easy window (${fmtPace(zone[0])}–${fmtPace(zone[1])}). The discipline of Pfitz is going slow on slow days.`);
      else if (rpe <= 5) lines.push("Easy day kept easy. This is exactly what absorbing training looks like.");
      else lines.push("Effort ran higher than an easy day should. Worth watching sleep and the heat.");
    }
    if (form.metrics && form.metrics.avgHR && form.metrics.maxHR) {
      const drift = form.metrics.maxHR - form.metrics.avgHR;
      if (!meta.quality && hi >= 0.03) {
        lines.push(`Avg HR ${form.metrics.avgHR} in real heat — judge today by heart rate and feel, not the watch pace.`);
      } else if (meta.quality && drift >= 35) {
        lines.push(`Max HR ran ${drift} beats above average — big late-session spike. Fine in a workout, but check fueling if it came with fading splits.`);
      }
    }
    return lines.join(" ");
  };

  // Assemble the run + recent training context the AI coach reasons over.
  const buildDebrief = () => {
    const dist = Number(form.dist) || null;
    const t = form.time ? parseGoal(form.time.split(":").length === 2 ? "0:" + form.time : form.time) : null;
    const avgPace = t && dist ? fmtPace(t / dist) : null;
    const segSec = form.segPace ? parseGoal("0:" + form.segPace) : null;
    const ci = checkin ? {
      readiness: checkin.readiness || null,
      sleep: checkin.sleep || null,
      hrv: checkin.hrv || null,
      rhr: checkin.rhr || null,
      tempF: checkin.temp || null,
      tempDewSum: checkin.result && checkin.result.heat ? checkin.result.heat.sum : null,
    } : null;
    const recent = Object.entries(logs)
      .filter(([k, v]) => v.run && k < viewDate)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 10)
      .map(([k, v]) => {
        const pIdx = planIndex(new Date(k + "T12:00:00"));
        const rd = Number(v.run.dist) || null;
        const rt = v.run.time ? parseGoal(v.run.time.split(":").length === 2 ? "0:" + v.run.time : v.run.time) : null;
        return {
          date: k,
          planned: pIdx ? PLAN[pIdx.week].days[pIdx.day] : null,
          miles: rd,
          avgPace: rt && rd ? fmtPace(rt / rd) : null,
          rpe: v.run.rpe || null,
          avgHR: v.run.metrics && v.run.metrics.avgHR ? v.run.metrics.avgHR : null,
        };
      });
    const last7dMiles = +([{ date: viewDate, miles: dist || 0 }, ...recent.map(r => ({ date: r.date, miles: r.miles || 0 }))]
      .filter(e => {
        const diff = (new Date(viewDate + "T12:00:00") - new Date(e.date + "T12:00:00")) / 86400000;
        return diff >= 0 && diff < 7;
      })
      .reduce((s, e) => s + e.miles, 0)).toFixed(1);
    return {
      goal: settings.goal,
      today: {
        date: viewDate,
        dayOfWeek: idx ? DAY_NAMES[idx.day] : null,
        weekOfPlan: idx ? 18 - idx.week : null,
        block: idx ? PLAN[idx.week].block : null,
        plannedWorkout: workout,
        workoutType: meta.label,
        isQuality: meta.quality,
        distanceMi: dist,
        totalTime: form.time || null,
        avgPace,
        workSegmentPace: segSec ? fmtPace(segSec) : null,
        targetZone: Z[type] ? `${fmtPace(Z[type][0])}–${fmtPace(Z[type][1])}` : null,
        marathonPaceZone: `${fmtPace(Z.mp[0])}–${fmtPace(Z.mp[1])}`,
        rpe: form.rpe,
        notes: form.notes || null,
        metrics: form.metrics || null,
        splits: form.splits ? form.splits.map(s => ({ mile: s.mile, pace: fmtPace(s.paceSec), avgHR: s.avgHR, elevDiffFt: s.elevDiffFt })) : null,
        morningCheckin: ci,
      },
      recentRuns: recent,
      last7dMiles,
    };
  };

  const grade = async () => {
    setGrading(true);
    let v = localGrade(); // rule-based fallback if the AI debrief is unavailable
    try {
      const r = await fetch("/api/debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDebrief()),
      });
      if (r.ok) {
        const j = await r.json();
        if (j.verdict && j.verdict.trim()) v = j.verdict.trim();
      }
    } catch { /* keep the local fallback */ }
    setVerdict(v);
    updateLogs(viewDate, { run: { ...form, verdict: v } });
    setGrading(false);
  };

  return (
    <>
      <div className="card">
        <div className="eyebrow">Log a run</div>
        <label className="f">Date</label>
        <input className="f" type="date" value={viewDate} onChange={e => setViewDate(e.target.value)} />
        {workout && <p style={{ marginTop: 10, fontSize: 14, color: "#0F5870" }}>Planned: <strong>{workout}</strong></p>}
        <button className="btn ghost" onClick={pullStrava} disabled={strava.busy} style={{ marginTop: 12, opacity: strava.busy ? 0.6 : 1 }}>
          {strava.busy ? "Pulling…" : "⟳ Pull from Strava"}
        </button>
        {strava.msg && <p className="syncmsg" style={{ color: "#0F5870" }}>{strava.msg}</p>}
        {form.metrics && (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, background: "#F2F9FC", borderRadius: 10, padding: "10px 14px" }}>
            {form.metrics.avgHR && <span style={{ fontSize: 13 }}><strong className="bignum" style={{ fontSize: 17 }}>{form.metrics.avgHR}</strong> avg HR</span>}
            {form.metrics.maxHR && <span style={{ fontSize: 13 }}><strong className="bignum" style={{ fontSize: 17 }}>{form.metrics.maxHR}</strong> max HR</span>}
            {form.metrics.elevGainFt != null && <span style={{ fontSize: 13 }}><strong className="bignum" style={{ fontSize: 17 }}>{form.metrics.elevGainFt}</strong> ft gain</span>}
            {form.metrics.cadenceSpm && <span style={{ fontSize: 13 }}><strong className="bignum" style={{ fontSize: 17 }}>{form.metrics.cadenceSpm}</strong> spm</span>}
          </div>
        )}
        <div className="row2">
          <div><label className="f">Distance (mi)</label>
            <input className="f" inputMode="decimal" value={form.dist} onChange={e => setForm({ ...form, dist: e.target.value })} /></div>
          <div><label className="f">Total time (h:mm:ss)</label>
            <input className="f" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} placeholder="1:22:30" /></div>
        </div>
        {meta.quality && (
          <>
            <label className="f">Work-segment avg pace (m:ss /mi, optional)</label>
            <input className="f" value={form.segPace} onChange={e => setForm({ ...form, segPace: e.target.value })} placeholder="8:05" />
          </>
        )}
        <label className="f">Effort (RPE 1–10): {form.rpe}</label>
        <input type="range" min="1" max="10" value={form.rpe} onChange={e => setForm({ ...form, rpe: e.target.value })} style={{ width: "100%" }} />
        <label className="f">Notes</label>
        <textarea className="f" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        <button className="btn alt" onClick={grade} disabled={!form.dist || !form.time || grading} style={{ opacity: (!form.dist || !form.time || grading) ? 0.5 : 1 }}>{grading ? "Analyzing your run…" : "How did I do?"}</button>
      </div>

      {crossSessions.length > 0 && (
        <div className="card">
          <div className="eyebrow">Cross-training</div>
          {crossSessions.map((s, i) => (
            <div key={i} className="zone">
              <span style={{ fontSize: 14 }}>{s.sportType}{s.distanceMi ? ` · ${s.distanceMi} mi` : ""}{s.elevGainFt ? ` · ${s.elevGainFt} ft` : ""}</span>
              <span style={{ fontSize: 13 }}>
                <span className="bignum" style={{ fontSize: 16 }}>{fmtDuration(s.movingTimeSec)}</span>
                {s.avgHR ? <span style={{ color: "#0F5870" }}> · {s.avgHR} bpm</span> : null}
              </span>
            </div>
          ))}
          <label className="f">Effort (RPE 1–10): {crossRpe}</label>
          <input type="range" min="1" max="10" value={crossRpe} onChange={e => setCrossRpe(e.target.value)} style={{ width: "100%" }} />
          <label className="f">Notes</label>
          <textarea className="f" rows={2} value={crossNotes} onChange={e => setCrossNotes(e.target.value)} />
          <button className="btn alt" onClick={saveCross}>{crossSaved ? "Saved ✓" : `Save cross-training${crossSessions.length > 1 ? ` (${crossSessions.length})` : ""}`}</button>
        </div>
      )}
      {verdict && (
        <div className="card" style={{ borderLeft: "5px solid #0F5870" }}>
          <div className="eyebrow">Debrief</div>
          <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.55 }}>{verdict}</p>
          {form.splits && form.splits.length > 1 && (
            <div style={{ marginTop: 12 }}>
              <div className="eyebrow">Mile splits</div>
              {form.splits.map(s => (
                <div key={s.mile} className="zone">
                  <span style={{ fontSize: 13 }}>Mi {s.mile}{s.elevDiffFt ? ` · ${s.elevDiffFt > 0 ? "+" : ""}${s.elevDiffFt} ft` : ""}</span>
                  <span style={{ fontSize: 13 }}>
                    <span className="bignum" style={{ fontSize: 16 }}>{fmtPace(s.paceSec)}</span>
                    {s.avgHR ? <span style={{ color: "#0F5870" }}> · {s.avgHR} bpm</span> : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <History logs={logs} />
    </>
  );
}

function History({ logs }) {
  const entries = Object.entries(logs).filter(([, v]) => v.run).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
  if (!entries.length) return null;
  const week = entries.filter(([k]) => (Date.now() - new Date(k + "T12:00:00")) < 7 * 86400000)
    .reduce((s, [, v]) => s + (Number(v.run.dist) || 0), 0);
  return (
    <div className="card">
      <div className="eyebrow">Recent runs · last 7 days: <span className="bignum" style={{ fontSize: 16 }}>{week.toFixed(1)} mi</span></div>
      {entries.map(([k, v]) => (
        <div key={k} className="zone">
          <span style={{ fontSize: 14 }}><Star size={9} style={{ marginRight: 6 }} />{k.slice(5)} · {v.run.dist} mi</span>
          <span className="bignum" style={{ fontSize: 16 }}>{v.run.time}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- PLAN ---------------- */
function PlanView({ logs, today, Z, goalSec }) {
  const cur = planIndex(today);
  const [open, setOpen] = useState(cur ? cur.week : 0);
  return (
    <>
      <p style={{ margin: "0 16px 10px", fontSize: 12, color: "#0F5870" }}>
        Times are estimates at your goal pace (no heat) — handy for planning your wake-up. Summer mornings run a touch slower.
      </p>
      {PLAN.map((wk, wi) => {
        const monday = new Date(PLAN_START.getTime() + wi * 7 * 86400000);
        const label = monday.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        const isOpen = open === wi;
        const isCur = cur && cur.week === wi;
        return (
          <div key={wi}>
            <div className="wkhead" onClick={() => setOpen(isOpen ? -1 : wi)} style={isCur ? { borderColor: "#E4393F" } : null}>
              <div>
                <span className="disp" style={{ fontWeight: 700, fontSize: 17 }}>Week of {label}</span>
                <span style={{ fontSize: 12, color: "#0F5870", marginLeft: 8 }}>{wk.block}</span>
                {isCur && <span style={{ background: "#E4393F", color: "#fff", borderRadius: 99, padding: "2px 8px", fontSize: 11, fontWeight: 600, marginLeft: 8 }}>Now</span>}
              </div>
              <span className="bignum" style={{ fontSize: 16 }}>{wk.vol}</span>
            </div>
            {isOpen && (
              <div style={{ margin: "0 16px 14px", background: "#fff", border: "1px solid #DCEDF4", borderRadius: 12, padding: "6px 0" }}>
                {wk.days.map((dd, di) => {
                  const key = dateKey(new Date(PLAN_START.getTime() + (wi * 7 + di) * 86400000));
                  const done = logs[key] && (logs[key].run || logs[key].cross);
                  const est = estimateRunSec(dd, Z, goalSec);
                  return (
                    <div key={di} className="dayrow">
                      <span className="dn">{DAY_NAMES[di].slice(0, 3)}</span>
                      <span style={{ flex: 1, color: classify(dd) === "rest" ? "#7A99A6" : "#101C22" }}>{dd}</span>
                      {est && <span className="bignum" style={{ fontSize: 13, color: "#0F5870", whiteSpace: "nowrap", marginLeft: 8 }}>~{fmtEstimate(est)}</span>}
                      {done && <Star size={13} style={{ marginLeft: 6 }} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ---------------- SETUP ---------------- */
function Setup({ settings, updateSettings, Z }) {
  const [form, setForm] = useState(settings);
  const [saved, setSavedMsg] = useState(false);
  const doSave = () => {
    updateSettings(form);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 1800);
  };
  return (
    <>
      <div className="card">
        <div className="eyebrow">Your numbers</div>
        <label className="f">Goal marathon time (h:mm:ss)</label>
        <input className="f" value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })} placeholder="3:45:00" />
        <div className="row2">
          <div><label className="f">Baseline HRV (ms)</label>
            <input className="f" inputMode="numeric" value={form.baseHRV} onChange={e => setForm({ ...form, baseHRV: e.target.value })} placeholder="auto-set by sync" /></div>
          <div><label className="f">Baseline resting HR</label>
            <input className="f" inputMode="numeric" value={form.baseRHR} onChange={e => setForm({ ...form, baseRHR: e.target.value })} placeholder="auto-set by sync" /></div>
        </div>
        <label className="f">Weight (lb) — powers daily + post-run carb targets</label>
        <input className="f" inputMode="decimal" value={form.weightLb || ""} onChange={e => setForm({ ...form, weightLb: e.target.value })} placeholder="e.g. 130" />
        <p style={{ marginTop: 10, fontSize: 12, color: "#0F5870" }}>Baselines fill automatically from your last 30 nights the first time you sync Oura — override here anytime.</p>
        <button className="btn" onClick={doSave}>{saved ? "Saved ✓" : "Save"}</button>
      </div>
      <div className="card">
        <div className="eyebrow">Pace zones at this goal (no heat)</div>
        {[["Recovery","recovery"],["General aerobic","ga"],["Medium-long / long","long"],["Marathon pace","mp"],["Lactate threshold","lt"],["VO₂max (5K)","vo2"]].map(([l, k]) => (
          <div key={k} className="zone">
            <span style={{ fontSize: 14, fontWeight: 500 }}>{l}</span>
            <span className="bignum" style={{ fontSize: 18 }}>{fmtPace(Z[k][0])}–{fmtPace(Z[k][1])} /mi</span>
          </div>
        ))}
      </div>
    </>
  );
}
