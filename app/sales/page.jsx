"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const CLOUD_TABLE = "app_state";
const CLOUD_ID = "gff_os_quote_settings_kinetic_v6";
const LOCAL_KEY = "gff_os_quote_settings_kinetic_v6";
const PIN = "6969";

const DEFAULT_SETTINGS = {
  title: "Kinetic Fiber Quote",
  eyebrow: "Authorized Kinetic quote tool",
  subline: "Show the real monthly, the first 5 months, and the bigger savings without the clutter.",
  primaryPlanId: "fiber-1g",
  plans: [
    {
      id: "fiber-300",
      name: "Fiber 300",
      speed: "300 Mbps",
      price: 34.99,
      badge: "Starter",
      featured: false,
      details: ["Good everyday internet for browsing, streaming, email, and smaller homes."]
    },
    {
      id: "fiber-1g",
      name: "Fiber 1 Gig",
      speed: "1 Gig",
      price: 39.99,
      badge: "Best value",
      featured: true,
      details: ["The main pitch. Fast fiber for streaming, gaming, work, and busy homes."]
    },
    {
      id: "fiber-2g",
      name: "Fiber 2 Gig",
      speed: "2 Gig",
      price: 59.99,
      badge: "Ultra fast",
      featured: false,
      details: ["Built for heavier households with a lot of devices running at once."]
    },
    {
      id: "fiber-2g-max",
      name: "Fiber 2 Gig Max",
      speed: "2 Gig Max",
      price: 79.99,
      badge: "Whole-home setup",
      featured: false,
      details: ["Includes two extenders and the upgraded Wi-Fi setup."]
    }
  ],
  modem: {
    enabled: true,
    selectedByDefault: true,
    name: "Standard modem rental",
    price: 10.99,
    description: "Standard modem/router rental. Defaulted on so the quote reflects the real monthly."
  },
  youtubeTv: {
    enabled: true,
    selectedByDefault: false,
    name: "YouTube TV",
    price: 82.99,
    description: "Live TV without the cable box. Good for customers worried about losing normal channels.",
    channels: ["ABC", "CBS", "NBC", "FOX", "ESPN", "NFL", "TNT", "TBS", "FX", "CNN", "HGTV", "Food"]
  },
  mastercard: {
    enabled: true,
    selectedByDefault: false,
    name: "$100 Mastercard",
    amount: 100,
    description: "After 90 days"
  },
  disclaimer: "Internal quote helper. Final address availability, taxes, fees, autopay requirements, YouTube TV availability, equipment requirements, and active promos must be confirmed in the official order platform."
};

function money(value) {
  const n = Number(value || 0);
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.abs(n).toFixed(2);
}

function wholeMoney(value) {
  const n = Number(value || 0);
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.round(Math.abs(n)).toLocaleString();
}

function parseMoney(value) {
  const raw = String(value || "").replace(/[^0-9.]/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePlans(plans) {
  if (!Array.isArray(plans) || !plans.length) return DEFAULT_SETTINGS.plans;
  const cleaned = plans
    .filter((p) => !String(p?.speed || "").toLowerCase().includes("100 mbps"))
    .map((p) => ({ details: [], featured: false, badge: "", ...p }));
  return cleaned.length ? cleaned : DEFAULT_SETTINGS.plans;
}

function mergeSettings(saved) {
  if (!saved || typeof saved !== "object") return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    title: saved.title || DEFAULT_SETTINGS.title,
    eyebrow: saved.eyebrow || DEFAULT_SETTINGS.eyebrow,
    subline: saved.subline || DEFAULT_SETTINGS.subline,
    primaryPlanId: saved.primaryPlanId || DEFAULT_SETTINGS.primaryPlanId,
    plans: normalizePlans(saved.plans),
    modem: { ...DEFAULT_SETTINGS.modem, ...(saved.modem || saved.router || {}) },
    youtubeTv: { ...DEFAULT_SETTINGS.youtubeTv, ...(saved.youtubeTv || {}) },
    mastercard: { ...DEFAULT_SETTINGS.mastercard, ...(saved.mastercard || saved.promo || {}) },
    disclaimer: saved.disclaimer || DEFAULT_SETTINGS.disclaimer
  };
}

async function loadCloudSettings() {
  if (!supabase) return null;
  try {
    const res = await supabase.from(CLOUD_TABLE).select("data").eq("id", CLOUD_ID).single();
    if (!res.error && res.data?.data) return res.data.data;
    return null;
  } catch {
    return null;
  }
}

async function saveCloudSettings(settings) {
  if (!supabase) return { ok: false, error: "Missing Supabase env vars." };
  try {
    const res = await supabase.from(CLOUD_TABLE).upsert({ id: CLOUD_ID, data: clone(settings), updated_at: new Date().toISOString() });
    if (res.error) return { ok: false, error: res.error.message || "Cloud save failed." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || "Cloud save failed." };
  }
}

function loadLocalSettings() {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalSettings(settings) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(LOCAL_KEY, JSON.stringify(settings));
  } catch {}
}

export default function GFFQuoteBuilder() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [pin, setPin] = useState("");
  const [saveStatus, setSaveStatus] = useState("local");

  const [currentBill, setCurrentBill] = useState(100);
  const [activePlanId, setActivePlanId] = useState(DEFAULT_SETTINGS.primaryPlanId);
  const [modemSelected, setModemSelected] = useState(DEFAULT_SETTINGS.modem.selectedByDefault);
  const [youtubeSelected, setYoutubeSelected] = useState(DEFAULT_SETTINGS.youtubeTv.selectedByDefault);
  const [mastercardSelected, setMastercardSelected] = useState(DEFAULT_SETTINGS.mastercard.selectedByDefault);

  useEffect(() => {
    let dead = false;
    async function boot() {
      const local = loadLocalSettings();
      const cloud = await loadCloudSettings();
      if (dead) return;
      const next = mergeSettings(cloud || local || DEFAULT_SETTINGS);
      setSettings(next);
      setActivePlanId(next.primaryPlanId || next.plans.find((p) => p.featured)?.id || next.plans[0]?.id || "");
      setModemSelected(Boolean(next.modem.selectedByDefault));
      setYoutubeSelected(Boolean(next.youtubeTv.selectedByDefault));
      setMastercardSelected(Boolean(next.mastercard.selectedByDefault));
      setSaveStatus(cloud ? "cloud loaded" : local ? "local loaded" : "default pricing");
      setLoaded(true);
    }
    boot();
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveLocalSettings(settings);
  }, [settings, loaded]);

  const activePlan = useMemo(() => settings.plans.find((p) => p.id === activePlanId) || settings.plans[0] || { price: 0, name: "No plan", speed: "" }, [settings.plans, activePlanId]);

  const math = useMemo(() => {
    const base = Number(activePlan.price || 0);
    const modem = settings.modem.enabled && modemSelected ? Number(settings.modem.price || 0) : 0;
    const youtube = settings.youtubeTv.enabled && youtubeSelected ? Number(settings.youtubeTv.price || 0) : 0;
    const monthly = Math.max(0, base + modem + youtube);
    const current = Number(currentBill || 0);
    const monthlySavings = current - monthly;
    const firstFiveCurrent = current * 5;
    const reward = settings.mastercard.enabled && mastercardSelected ? Number(settings.mastercard.amount || 0) : 0;
    const firstFiveFrontierBeforeReward = monthly * 5;
    const firstFiveFrontier = Math.max(0, firstFiveFrontierBeforeReward - reward);
    const firstFiveSavings = firstFiveCurrent - firstFiveFrontier;
    const effectiveFiveMonthAverage = firstFiveFrontier / 5;

    const monthRows = [1, 2, 3, 4, 5].map((month) => {
      let rewardApplied = 0;
      if (reward > 0 && month >= 4) {
        const alreadyApplied = month === 5 ? Math.min(reward, monthly) : 0;
        const remaining = Math.max(0, reward - alreadyApplied);
        rewardApplied = Math.min(monthly, remaining);
      }
      return { month, bill: monthly, rewardApplied, outOfPocket: Math.max(0, monthly - rewardApplied) };
    });

    return {
      base,
      modem,
      youtube,
      monthly,
      current,
      monthlySavings,
      yearSavings: monthlySavings * 12 + reward,
      threeYearSavings: monthlySavings * 36 + reward,
      reward,
      firstFiveCurrent,
      firstFiveFrontierBeforeReward,
      firstFiveFrontier,
      firstFiveSavings,
      effectiveFiveMonthAverage,
      monthRows
    };
  }, [activePlan, settings, currentBill, modemSelected, youtubeSelected, mastercardSelected]);

  function unlock() {
    if (pin === PIN) setAdmin(true);
    setPin("");
  }

  async function saveCloud() {
    setSaveStatus("saving...");
    const res = await saveCloudSettings(settings);
    setSaveStatus(res.ok ? "cloud saved" : res.error || "cloud failed");
  }

  function resetQuote() {
    setCurrentBill(100);
    setActivePlanId(settings.primaryPlanId || settings.plans.find((p) => p.featured)?.id || settings.plans[0]?.id || "");
    setModemSelected(Boolean(settings.modem.selectedByDefault));
    setYoutubeSelected(Boolean(settings.youtubeTv.selectedByDefault));
    setMastercardSelected(Boolean(settings.mastercard.selectedByDefault));
  }

  if (!loaded) {
    return <main className="quote-shell quote-loading"><div>Loading fiber quote...</div></main>;
  }

  return (
    <main className="quote-shell">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <section className="quote-hero">
        <div className="brand-row">
          <button className="back-button" onClick={() => { if (typeof window !== "undefined") window.location.href = "/"; }}>← GFF Turf</button>
          <div className="frontier-mark">Kinetic<span>fiber quote</span></div>
          <span className="dealer-pill">Authorized Kinetic quote helper</span>
        </div>
        <div className="hero-copy">
          <div>
            <p>{settings.eyebrow}</p>
            <h1>{settings.title}</h1>
            <span>{settings.subline}</span>
          </div>
          <div className="monthly-card monthly-hero-compare">
            <small>Monthly comparison</small>
            <div className="monthly-side-by-side">
              <div className="provider-box">
                <span>Current provider</span>
                <strong>{money(math.current)}</strong>
                <em>What they pay now</em>
              </div>
              <div className="provider-box kinetic-box">
                <span>Kinetic</span>
                <strong>{money(math.monthly)}</strong>
                <em>{activePlan.name}{modemSelected ? ` + modem` : ""}{youtubeSelected ? ` + TV` : ""}</em>
              </div>
            </div>
            <div className={math.monthlySavings >= 0 ? "hero-save good-bg" : "hero-save bad-bg"}>
              <span>Estimated monthly savings</span>
              <strong>{money(math.monthlySavings)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="quote-grid">
        <div className="left-stack">
          <Card label="01" title="Current bill">
            <div className="bill-row">
              <label>What are they paying now?</label>
              <div className="money-input"><span>$</span><input value={currentBill} onChange={(e) => setCurrentBill(parseMoney(e.target.value))} inputMode="decimal" /></div>
            </div>
          </Card>

          <Card label="02" title="Choose a Kinetic plan">
            <div className="plan-grid">
              {settings.plans.map((plan) => {
                const active = activePlan.id === plan.id;
                const cardMonthly = Number(plan.price || 0) + (settings.modem.enabled && modemSelected ? Number(settings.modem.price || 0) : 0) + (settings.youtubeTv.enabled && youtubeSelected ? Number(settings.youtubeTv.price || 0) : 0);
                return (
                  <button key={plan.id} className={active ? "plan active" : plan.featured ? "plan featured" : "plan"} onClick={() => setActivePlanId(plan.id)}>
                    {plan.featured && <span className="best-strip">best value</span>}
                    <div className="plan-head">
                      <div><strong>{plan.name}</strong><em>{plan.speed}</em></div>
                      <b>{money(Math.max(0, cardMonthly))}<small>/mo</small></b>
                    </div>
                    <p>{plan.details?.[0] || plan.badge || "Kinetic fiber plan"}</p>
                    <div className="plan-base">{money(plan.price)}/mo base{modemSelected ? ` + ${money(settings.modem.price)} modem` : ""}{youtubeSelected ? ` + ${money(settings.youtubeTv.price)} TV` : ""}</div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card label="03" title="Monthly add-ons">
            <div className="addon-grid">
              {settings.modem.enabled && (
                <AddonCard active={modemSelected} onClick={() => setModemSelected(!modemSelected)} title={settings.modem.name} price={`+${money(settings.modem.price)}/mo`} body={settings.modem.description} />
              )}

              {settings.youtubeTv.enabled && (
                <AddonCard active={youtubeSelected} onClick={() => setYoutubeSelected(!youtubeSelected)} title={settings.youtubeTv.name} price={`+${money(settings.youtubeTv.price)}/mo`} body={settings.youtubeTv.description}>
                  <div className="channel-grid">
                    {settings.youtubeTv.channels.map((channel) => <span key={channel}>{channel}</span>)}
                  </div>
                </AddonCard>
              )}

              {settings.mastercard.enabled && (
                <button className={mastercardSelected ? "reward-box active" : "reward-box"} onClick={() => setMastercardSelected(!mastercardSelected)}>
                  <span className="mini-check">{mastercardSelected ? "✓" : ""}</span>
                  <div>
                    <strong>{settings.mastercard.name}</strong>
                    <p>{settings.mastercard.description}. Unchecked by default. Tap when the promo applies.</p>
                  </div>
                  <b>{money(settings.mastercard.amount)}</b>
                </button>
              )}
            </div>
          </Card>
        </div>

        <aside className="summary-card">
          <span className="summary-pill">Savings first</span>
          <div className="big-save">
            <small>Estimated 3-year savings</small>
            <strong>{wholeMoney(math.threeYearSavings)}</strong>
          </div>

          <div className="summary-row-pair">
            <div className="year-save">
              <span>1-year savings</span>
              <strong>{wholeMoney(math.yearSavings)}</strong>
            </div>
            <div className="monthly-save">
              <span>Monthly difference</span>
              <strong className={math.monthlySavings >= 0 ? "good" : "bad"}>{money(math.monthlySavings)}</strong>
            </div>
          </div>

          <section className="five-month-card">
            <div className="five-head">
              <div>
                <span>First 5 months</span>
                <strong>{wholeMoney(math.firstFiveSavings)} saved</strong>
              </div>
              <b>{money(math.effectiveFiveMonthAverage)}<small>/mo avg</small></b>
            </div>

            <div className="five-totals">
              <div><span>Current provider</span><strong>{money(math.firstFiveCurrent)}</strong></div>
              <div><span>Kinetic before card</span><strong>{money(math.firstFiveFrontierBeforeReward)}</strong></div>
              {math.reward > 0 && <div><span>Mastercard credit</span><strong>-{money(math.reward)}</strong></div>}
              <div className="net"><span>Kinetic effective total</span><strong>{money(math.firstFiveFrontier)}</strong></div>
            </div>

            <div className="month-strip">
              {math.monthRows.map((row) => (
                <div key={row.month}>
                  <span>M{row.month}</span>
                  <strong>{money(row.outOfPocket)}</strong>
                  {row.rewardApplied > 0 && <em>{money(row.rewardApplied)} card</em>}
                </div>
              ))}
            </div>
          </section>

          <section className="monthly-feature-card">
            <div className="feature-title">
              <span>Monthly comparison</span>
              <strong>What changes today</strong>
            </div>

            <div className="side-boxes">
              <div className="side-box current-box">
                <span>Current provider</span>
                <strong>{money(math.current)}</strong>
                <em>Current monthly bill</em>
              </div>
              <div className="side-box kinetic-box-light">
                <span>Kinetic</span>
                <strong>{money(math.monthly)}</strong>
                <em>Estimated monthly</em>
              </div>
            </div>

            <div className={math.monthlySavings >= 0 ? "main-save-box good-line" : "main-save-box bad-line"}>
              <span>Estimated monthly savings</span>
              <strong>{money(math.monthlySavings)}</strong>
            </div>

            <div className="price-breakdown">
              <div><span>{activePlan.name}</span><strong>{money(math.base)}</strong></div>
              {settings.modem.enabled && modemSelected && <div><span>Modem rental</span><strong>+{money(math.modem)}</strong></div>}
              {settings.youtubeTv.enabled && youtubeSelected && <div><span>YouTube TV</span><strong>+{money(math.youtube)}</strong></div>}
            </div>
          </section>

          <button className="reset-button" onClick={resetQuote}>Reset quote</button>
          <p className="disclaimer">{settings.disclaimer}</p>
        </aside>
      </section>

      <section className="admin-card">
        {!admin ? (
          <div className="admin-login">
            <span>Admin pricing</span>
            <input value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") unlock(); }} placeholder="PIN" inputMode="numeric" />
            <button onClick={unlock}>Unlock</button>
          </div>
        ) : (
          <AdminEditor settings={settings} setSettings={setSettings} saveCloud={saveCloud} saveStatus={saveStatus} />
        )}
      </section>
    </main>
  );
}

function Card({ label, title, children }) {
  return <section className="card"><div className="card-title"><span>{label}</span><h2>{title}</h2></div>{children}</section>;
}

function AddonCard({ active, onClick, title, price, body, children }) {
  return (
    <button className={active ? "addon-card active" : "addon-card"} onClick={onClick}>
      <div className="addon-top">
        <span className="addon-check">{active ? "✓" : ""}</span>
        <div>
          <strong>{title}</strong>
          <p>{body}</p>
        </div>
        <b>{price}</b>
      </div>
      {children}
    </button>
  );
}

function AdminEditor({ settings, setSettings, saveCloud, saveStatus }) {
  function updatePlan(id, field, value) {
    setSettings({
      ...settings,
      plans: settings.plans.map((p) => p.id === id ? { ...p, [field]: field === "price" ? parseMoney(value) : field === "featured" ? Boolean(value) : value } : field === "featured" && value ? { ...p, featured: false } : p),
      primaryPlanId: field === "featured" && value ? id : settings.primaryPlanId
    });
  }

  function movePlan(id, dir) {
    const plans = [...settings.plans];
    const i = plans.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= plans.length) return;
    [plans[i], plans[j]] = [plans[j], plans[i]];
    setSettings({ ...settings, plans });
  }

  function addPlan() {
    const id = "plan-" + Date.now();
    setSettings({ ...settings, plans: [...settings.plans, { id, name: "New Plan", speed: "", price: 0, badge: "", featured: false, details: [""] }] });
  }

  function removePlan(id) {
    const plans = settings.plans.filter((p) => p.id !== id);
    setSettings({ ...settings, plans, primaryPlanId: settings.primaryPlanId === id ? plans[0]?.id || "" : settings.primaryPlanId });
  }

  function updateChannelText(value) {
    setSettings({ ...settings, youtubeTv: { ...settings.youtubeTv, channels: value.split(",").map((x) => x.trim()).filter(Boolean) } });
  }

  return (
    <div className="admin-editor">
      <div className="admin-head"><h2>Pricing editor</h2><button onClick={saveCloud}>Save cloud</button><span>{saveStatus}</span></div>
      <div className="admin-form two">
        <label>Title<input value={settings.title} onChange={(e) => setSettings({ ...settings, title: e.target.value })} /></label>
        <label>Subline<input value={settings.subline} onChange={(e) => setSettings({ ...settings, subline: e.target.value })} /></label>
      </div>

      <h3>Plans</h3>
      <div className="plan-admin-list">
        {settings.plans.map((plan) => (
          <div className="plan-admin" key={plan.id}>
            <div className="reorder"><button onClick={() => movePlan(plan.id, -1)}>↑</button><button onClick={() => movePlan(plan.id, 1)}>↓</button></div>
            <input value={plan.name} onChange={(e) => updatePlan(plan.id, "name", e.target.value)} />
            <input value={plan.speed} onChange={(e) => updatePlan(plan.id, "speed", e.target.value)} />
            <input value={plan.price} onChange={(e) => updatePlan(plan.id, "price", e.target.value)} inputMode="decimal" />
            <input value={plan.badge || ""} onChange={(e) => updatePlan(plan.id, "badge", e.target.value)} />
            <label className="check"><input type="checkbox" checked={Boolean(plan.featured)} onChange={(e) => updatePlan(plan.id, "featured", e.target.checked)} /> Best value</label>
            <button onClick={() => removePlan(plan.id)}>Delete</button>
          </div>
        ))}
      </div>
      <button className="mini-add" onClick={addPlan}>Add plan</button>

      <h3>Add-ons and promo</h3>
      <div className="admin-form three">
        <label>Modem price<input value={settings.modem.price} onChange={(e) => setSettings({ ...settings, modem: { ...settings.modem, price: parseMoney(e.target.value) } })} /></label>
        <label>YouTube TV price<input value={settings.youtubeTv.price} onChange={(e) => setSettings({ ...settings, youtubeTv: { ...settings.youtubeTv, price: parseMoney(e.target.value) } })} /></label>
        <label>Mastercard amount<input value={settings.mastercard.amount} onChange={(e) => setSettings({ ...settings, mastercard: { ...settings.mastercard, amount: parseMoney(e.target.value) } })} /></label>
      </div>
      <div className="admin-form">
        <label>YouTube TV channels, comma separated<input value={settings.youtubeTv.channels.join(", ")} onChange={(e) => updateChannelText(e.target.value)} /></label>
      </div>
      <div className="admin-checks">
        <label><input type="checkbox" checked={settings.modem.enabled} onChange={(e) => setSettings({ ...settings, modem: { ...settings.modem, enabled: e.target.checked } })} /> Show modem</label>
        <label><input type="checkbox" checked={settings.modem.selectedByDefault} onChange={(e) => setSettings({ ...settings, modem: { ...settings.modem, selectedByDefault: e.target.checked } })} /> Modem default on</label>
        <label><input type="checkbox" checked={settings.youtubeTv.enabled} onChange={(e) => setSettings({ ...settings, youtubeTv: { ...settings.youtubeTv, enabled: e.target.checked } })} /> Show YouTube TV</label>
        <label><input type="checkbox" checked={settings.mastercard.enabled} onChange={(e) => setSettings({ ...settings, mastercard: { ...settings.mastercard, enabled: e.target.checked } })} /> Show Mastercard</label>
      </div>
    </div>
  );
}

const css = `
  :root{background:#f5f7f1;color:#02002f}
  *{box-sizing:border-box}
  button,input{font:inherit}
  button{cursor:pointer;border:0}
  input{border:0;outline:0}
  .quote-shell{min-height:100vh;background:radial-gradient(circle at top left,rgba(215,255,0,.24),transparent 28%),linear-gradient(180deg,#f7faf2 0%,#ffffff 48%,#eef4e9 100%);padding:18px;color:#02002f;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .quote-loading{display:grid;place-items:center;font-size:34px;font-weight:1000}
  .quote-hero,.card,.summary-card,.admin-card{border:1px solid rgba(2,0,47,.10);background:#fff;box-shadow:0 18px 48px rgba(2,0,47,.12);border-radius:28px}
  .quote-hero{padding:20px;margin:0 auto 18px;max-width:1340px;border-top:12px solid #dfff00}
  .brand-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .back-button{border-radius:999px;background:#02002f;color:#fff;padding:11px 16px;font-weight:1000}
  .frontier-mark{font-size:36px;line-height:.85;font-weight:1000;letter-spacing:-.07em;color:#d4111e}
  .frontier-mark span{display:block;color:#02002f;font-size:13px;letter-spacing:.18em;text-transform:uppercase}
  .dealer-pill{border-radius:999px;background:#dfff00;color:#02002f;padding:10px 14px;font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.12em}
  .hero-copy{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end;margin-top:18px}
  .hero-copy p{margin:0 0 8px;color:#169b62;font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.16em}
  .hero-copy h1{font-size:clamp(44px,6vw,78px);line-height:.9;margin:0;letter-spacing:-.08em;color:#02002f}
  .hero-copy span{display:block;margin-top:10px;color:#4b5563;font-size:17px;font-weight:850}
  .monthly-card{border-radius:26px;background:#02002f;color:#fff;padding:20px 24px;min-width:310px;text-align:right}
  .monthly-card small{display:block;color:#dfff00;text-transform:uppercase;font-size:11px;font-weight:1000;letter-spacing:.16em}
  .monthly-card strong{display:block;font-size:50px;letter-spacing:-.08em}
  .monthly-card em{display:block;color:#dbe3ef;font-size:12px;font-style:normal;font-weight:850}
  .quote-grid{display:grid;grid-template-columns:minmax(0,1fr) 450px;gap:18px;max-width:1340px;margin:0 auto}
  .left-stack{display:grid;gap:18px}
  .card,.summary-card,.admin-card{padding:18px}
  .card-title{display:flex;align-items:center;gap:12px;margin-bottom:16px}
  .card-title span{display:grid;place-items:center;min-width:38px;height:34px;border-radius:999px;background:#dfff00;color:#02002f;font-weight:1000}
  .card-title h2{margin:0;font-size:24px;letter-spacing:-.04em}
  .bill-row label{display:block;color:#169b62;font-size:13px;font-weight:1000;text-transform:uppercase;letter-spacing:.12em}
  .money-input{margin-top:8px;display:flex;align-items:center;gap:8px;border-radius:24px;background:#f3f6ef;border:2px solid #dfff00;padding:10px 18px}
  .money-input span{font-size:42px;font-weight:1000;color:#169b62}
  .money-input input{width:100%;background:transparent;color:#02002f;font-size:58px;font-weight:1000;letter-spacing:-.08em}
  .plan-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
  .plan{position:relative;overflow:hidden;text-align:left;border-radius:24px;background:#fff;border:1px solid rgba(2,0,47,.14);color:#02002f;padding:18px;min-height:240px;transition:.18s ease}
  .plan.featured{border-color:#dfff00}
  .plan.active{background:#02002f;color:#fff;border-color:#02002f;box-shadow:0 18px 45px rgba(2,0,47,.22);transform:translateY(-2px)}
  .best-strip{position:absolute;inset:0 0 auto 0;background:#dfff00;color:#02002f;text-align:center;font-size:11px;font-weight:1000;text-transform:uppercase;letter-spacing:.1em;padding:6px}
  .plan-head{display:grid;grid-template-columns:1fr;gap:8px;align-items:start;margin-top:12px}
  .plan strong{display:block;color:#169b62;font-size:24px;letter-spacing:-.04em}
  .plan.active strong{color:#dfff00}
  .plan em{display:block;margin-top:3px;color:inherit;font-style:normal;font-weight:1000}
  .plan b{display:block;font-size:38px;letter-spacing:-.07em;line-height:1}
  .plan b small{font-size:12px;letter-spacing:0}
  .plan p{margin:18px 0 0;min-height:56px;color:inherit;font-size:14px;font-weight:850;line-height:1.35}
  .plan-base{margin-top:12px;border-radius:999px;background:#f2f3f0;color:#02002f;padding:8px 10px;font-size:11px;font-weight:1000}
  .plan.active .plan-base{background:rgba(255,255,255,.14);color:#fff}

  .addon-grid{display:grid;grid-template-columns:1fr;gap:12px}
  .addon-card,.reward-box{width:100%;text-align:left;border-radius:22px;background:#f5f7f1;color:#02002f;border:2px solid rgba(2,0,47,.08);padding:15px;transition:.18s ease}
  .addon-card.active,.reward-box.active{background:#f9ffe5;border-color:#dfff00;box-shadow:0 10px 30px rgba(2,0,47,.08)}
  .addon-top{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px}
  .addon-check,.mini-check{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;border:2px solid rgba(2,0,47,.18);background:#fff;color:#02002f;font-weight:1000}
  .addon-card.active .addon-check,.reward-box.active .mini-check{background:#dfff00;border-color:#dfff00}
  .addon-top strong,.reward-box strong{display:block;font-size:18px;font-weight:1000}
  .addon-top p,.reward-box p{margin:4px 0 0;color:#4b5563;font-weight:750;font-size:13px;line-height:1.35}
  .addon-top b,.reward-box b{justify-self:end;color:#169b62;font-size:18px;font-weight:1000;white-space:nowrap}
  .channel-grid{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0 0 40px}
  .channel-grid span{border-radius:999px;background:#fff;border:1px solid rgba(2,0,47,.10);padding:7px 10px;font-size:12px;font-weight:1000;color:#02002f}
  .reward-box{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;max-width:520px}
  .reward-box b{font-size:20px}

  .summary-card{position:sticky;top:18px;align-self:start;background:#fff;color:#02002f;border-top:12px solid #dfff00}
  .summary-pill{display:inline-flex;border-radius:999px;background:#02002f;color:#fff;padding:9px 12px;font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.12em}
  .big-save{margin-top:18px;border-radius:24px;background:#02002f;padding:18px}
  .big-save small{display:block;color:#dbe3ef;font-size:13px;font-weight:1000;text-transform:uppercase;letter-spacing:.12em}
  .big-save strong{display:block;font-size:68px;letter-spacing:-.09em;color:#dfff00;line-height:.95}
  .summary-row-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
  .year-save,.monthly-save{border-radius:18px;padding:14px}
  .year-save{background:#22a86b;color:#fff}
  .monthly-save{background:#eef3ea;color:#02002f}
  .year-save span,.monthly-save span{display:block;font-size:11px;font-weight:1000;text-transform:uppercase;letter-spacing:.1em;opacity:.85}
  .year-save strong,.monthly-save strong{display:block;font-size:26px;letter-spacing:-.05em}
  .good{color:#169b62}.bad{color:#c2410c}

  .five-month-card{margin-top:12px;border-radius:22px;background:#f5f7f1;border:1px solid rgba(2,0,47,.08);padding:14px}
  .five-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .five-head span{display:block;color:#4b5563;font-size:11px;font-weight:1000;text-transform:uppercase;letter-spacing:.12em}
  .five-head strong{display:block;color:#169b62;font-size:25px;letter-spacing:-.05em}
  .five-head b{font-size:24px;letter-spacing:-.05em;color:#02002f;text-align:right}
  .five-head small{display:block;font-size:11px;letter-spacing:0;color:#4b5563}
  .five-totals{display:grid;gap:7px;margin-top:12px}
  .five-totals div{display:flex;justify-content:space-between;gap:10px;border-radius:13px;background:#fff;padding:10px}
  .five-totals span{color:#4b5563;font-weight:850}
  .five-totals strong{font-weight:1000}
  .five-totals .net{background:#02002f;color:#fff}
  .five-totals .net span{color:#fff}
  .month-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-top:10px}
  .month-strip div{border-radius:13px;background:#fff;padding:9px;text-align:center;border:1px solid rgba(2,0,47,.08)}
  .month-strip span{display:block;color:#4b5563;font-size:11px;font-weight:1000}
  .month-strip strong{display:block;font-size:15px}
  .month-strip em{display:block;color:#169b62;font-size:10px;font-style:normal;font-weight:900}

  .comparison{display:grid;gap:9px;margin-top:14px}
  .comparison div{display:flex;justify-content:space-between;gap:10px;border-radius:16px;background:#f3f6ef;padding:13px}
  .comparison span{color:#4b5563;font-weight:800}
  .comparison strong{font-weight:1000}
  .comparison .total{background:#02002f;color:#fff}
  .comparison .total span{color:#fff}
  .reset-button{width:100%;margin-top:14px;border-radius:18px;background:#dfff00;color:#02002f;padding:14px;font-weight:1000}
  .disclaimer{color:#4b5563;font-size:12px;line-height:1.45;font-weight:700}

  .admin-card{max-width:1340px;margin:18px auto 0}
  .admin-login{display:flex;gap:10px;align-items:center}
  .admin-login span{font-weight:1000;color:#02002f}
  .admin-login input{border-radius:14px;background:#f3f6ef;color:#02002f;padding:12px;width:110px}
  .admin-login button,.admin-head button,.mini-add,.plan-admin button,.reorder button{border-radius:14px;background:#02002f;color:#fff;padding:12px 14px;font-weight:1000}
  .admin-head{display:flex;gap:12px;align-items:center;justify-content:space-between}
  .admin-head h2,.admin-editor h3{margin:0}
  .admin-form{display:grid;gap:10px;margin:12px 0}
  .admin-form.two{grid-template-columns:1fr 1fr}
  .admin-form.three{grid-template-columns:repeat(3,1fr)}
  .admin-form label,.admin-checks label{color:#4b5563;font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.08em}
  .admin-form input,.plan-admin input{display:block;margin-top:6px;width:100%;border-radius:14px;background:#f3f6ef;color:#02002f;padding:12px}
  .plan-admin-list{display:grid;gap:10px;margin:12px 0}
  .plan-admin{display:grid;grid-template-columns:auto 1.1fr .8fr .6fr .9fr auto auto;gap:8px;align-items:center}
  .reorder{display:flex;gap:4px}
  .reorder button{padding:10px}
  .check{display:flex;gap:6px;align-items:center;color:#4b5563;font-size:12px;font-weight:900}
  .admin-checks{display:flex;flex-wrap:wrap;gap:14px;margin-top:14px}
  .admin-checks label{display:flex;gap:8px;align-items:center}


  .monthly-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
  .monthly-mini-grid div{border-radius:16px;background:rgba(255,255,255,.12);padding:11px;text-align:left}
  .monthly-mini-grid div span{display:block;margin:0 0 4px;color:#dbe3ef;font-size:10px;font-weight:1000;text-transform:uppercase;letter-spacing:.1em}
  .monthly-mini-grid div strong{display:block;color:#fff;font-size:30px;letter-spacing:-.06em;line-height:1}
  .monthly-mini-grid .mini-save{grid-column:1 / -1}
  .monthly-mini-grid .mini-save.good-bg{background:#dfff00}
  .monthly-mini-grid .mini-save.good-bg span{color:#02002f}
  .monthly-mini-grid .mini-save.good-bg strong{color:#02002f}
  .monthly-mini-grid .mini-save.bad-bg{background:#fee2e2}
  .monthly-mini-grid .mini-save.bad-bg span,.monthly-mini-grid .mini-save.bad-bg strong{color:#991b1b}
  .monthly-clarity{border-radius:22px;background:#f5f7f1;padding:10px}
  .comparison.monthly-clarity div{border-radius:14px;background:#fff}
  .comparison.monthly-clarity .their-guy{background:#eef3ea}
  .comparison.monthly-clarity .our-total{background:#02002f;color:#fff}
  .comparison.monthly-clarity .our-total span{color:#fff}
  .comparison.monthly-clarity .save-line{border:2px solid #dfff00}
  .comparison.monthly-clarity .good-line{background:#f9ffe5}
  .comparison.monthly-clarity .good-line strong{color:#169b62}
  .comparison.monthly-clarity .bad-line{background:#fee2e2;border-color:#fecaca}
  .comparison.monthly-clarity .bad-line strong{color:#991b1b}
  .comparison.monthly-clarity .detail{background:#fff;color:#02002f;padding-top:9px;padding-bottom:9px}
  .comparison.monthly-clarity .detail span{font-size:13px}


  .monthly-hero-compare{text-align:left}
  .monthly-side-by-side{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
  .provider-box{border-radius:18px;background:rgba(255,255,255,.12);padding:13px}
  .provider-box span{display:block;color:#dbe3ef;font-size:10px;font-weight:1000;text-transform:uppercase;letter-spacing:.12em}
  .provider-box strong{display:block;color:#fff;font-size:34px;letter-spacing:-.07em;line-height:1;margin-top:4px}
  .provider-box em{display:block;color:#dbe3ef;font-size:11px;font-style:normal;font-weight:850;margin-top:4px}
  .monthly-side-by-side .kinetic-box{background:#dfff00}
  .monthly-side-by-side .kinetic-box span,.monthly-side-by-side .kinetic-box strong,.monthly-side-by-side .kinetic-box em{color:#02002f}
  .hero-save{margin-top:10px;border-radius:18px;padding:13px}
  .hero-save span{display:block;font-size:11px;font-weight:1000;text-transform:uppercase;letter-spacing:.12em}
  .hero-save strong{display:block;font-size:38px;letter-spacing:-.08em;line-height:1}
  .hero-save.good-bg{background:#169b62;color:#fff}
  .hero-save.bad-bg{background:#fee2e2;color:#991b1b}

  .monthly-feature-card{margin-top:14px;border-radius:24px;background:#f5f7f1;border:1px solid rgba(2,0,47,.08);padding:14px}
  .feature-title{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:10px}
  .feature-title span{display:block;color:#169b62;font-size:11px;font-weight:1000;text-transform:uppercase;letter-spacing:.12em}
  .feature-title strong{display:block;color:#02002f;font-size:20px;letter-spacing:-.04em}
  .side-boxes{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .side-box{border-radius:18px;padding:14px;border:1px solid rgba(2,0,47,.08)}
  .current-box{background:#fff}
  .kinetic-box-light{background:#02002f;color:#fff}
  .side-box span{display:block;color:#4b5563;font-size:11px;font-weight:1000;text-transform:uppercase;letter-spacing:.11em}
  .kinetic-box-light span{color:#dfff00}
  .side-box strong{display:block;font-size:34px;letter-spacing:-.07em;line-height:1;margin-top:5px}
  .side-box em{display:block;margin-top:6px;color:#4b5563;font-size:12px;font-style:normal;font-weight:800}
  .kinetic-box-light em{color:#dbe3ef}
  .main-save-box{margin-top:10px;border-radius:18px;padding:14px;text-align:center;border:2px solid #dfff00}
  .main-save-box span{display:block;font-size:11px;font-weight:1000;text-transform:uppercase;letter-spacing:.12em}
  .main-save-box strong{display:block;font-size:42px;letter-spacing:-.08em;line-height:1;margin-top:4px}
  .main-save-box.good-line{background:#f9ffe5;color:#169b62}
  .main-save-box.bad-line{background:#fee2e2;color:#991b1b;border-color:#fecaca}
  .price-breakdown{display:grid;gap:7px;margin-top:10px}
  .price-breakdown div{display:flex;justify-content:space-between;gap:10px;border-radius:13px;background:#fff;padding:10px}
  .price-breakdown span{color:#4b5563;font-weight:850}
  .price-breakdown strong{font-weight:1000}

  @media(max-width:1120px){
    .quote-grid{grid-template-columns:1fr}
    .summary-card{position:relative;top:auto}
    .hero-copy{grid-template-columns:1fr}
    .monthly-card{text-align:left}
    .admin-form.two,.admin-form.three,.plan-admin{grid-template-columns:1fr}
    .plan-admin .reorder{justify-content:start}
  }
  @media(max-width:700px){
    .plan-grid{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px}
    .plan{min-width:260px;scroll-snap-align:start}
    .quote-shell{padding:10px}
    .quote-hero,.card,.summary-card,.admin-card{border-radius:22px;padding:14px}
    .hero-copy h1{font-size:44px}
    .money-input input{font-size:44px}
    .monthly-card strong{font-size:42px}
    .big-save strong{font-size:52px}
    .brand-row{flex-wrap:wrap}
    .summary-row-pair{grid-template-columns:1fr}

    .monthly-side-by-side,.side-boxes{grid-template-columns:1fr}

    .month-strip{grid-template-columns:repeat(5,minmax(62px,1fr));overflow-x:auto}
    .reward-box{max-width:none}
    .admin-login{flex-wrap:wrap}
  }
`;
