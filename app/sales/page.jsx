"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const CLOUD_TABLE = "app_state";
const CLOUD_ID = "gff_os_quote_settings_v2";
const OLD_CLOUD_ID = "gff_os_quote_settings_v1";
const LOCAL_KEY = "gff_os_quote_settings_v2";
const OLD_LOCAL_KEY = "gff_os_quote_settings_v1";
const PIN = "6969";

const DEFAULT_SETTINGS = {
  title: "Kinetic Fiber Quote",
  eyebrow: "Authorized dealer quote tool",
  subline: "Show the real monthly and the bigger savings without the clutter.",
  primaryPlanId: "fiber-1g",
  plans: [
    { id: "fiber-100", name: "fiber", speed: "100 Mbps", price: 19.99, badge: "Saver", featured: false, details: ["Reliable support for essentials like email, browsing, and video chat.", "Perfect for individuals and small families"] },
    { id: "fiber-300", name: "fiber", speed: "300 Mbps", price: 34.99, badge: "Everyday", featured: false, details: ["Good for most day-to-day internet uses including streaming video.", "AT&T Wireless customers may save $20/mo"] },
    { id: "fiber-1g", name: "fiber 1 gig", speed: "1 Gig", price: 39.99, badge: "Best value", featured: true, details: ["Boosted speed and capacity for working from home and gaming.", "Faster upload speeds than cable", "AT&T Wireless customers may save $20/mo"] },
    { id: "fiber-2g", name: "fiber 2 gig", speed: "2 Gig", price: 59.99, badge: "Ultra fast", featured: false, details: ["Ultra-fast speeds for large smart homes.", "Supports dozens of devices streaming simultaneously", "The most advanced Wi-Fi 7 technology"] },
    { id: "fiber-max-2g", name: "fiber max", speed: "2 Gig", price: 79.99, badge: "Complete bundle", featured: false, details: ["Worry-free internet for the whole home.", "Premium Wi-Fi Gateway and Kinetic Secure Plus", "24/7 always-on Premium Technical Support"] },
  ],
  router: {
    enabled: true,
    selectedByDefault: true,
    name: "Kinetic Gateway rental",
    price: 10.99,
    description: "Router/Wi‑Fi gateway rental. Defaulted on because most quotes need it.",
  },
  attDiscount: {
    enabled: true,
    amount: 20,
    title: "AT&T Wireless bundle credit",
    label: "AT&T Wireless customer",
    description: "Applies a monthly credit when they qualify through the AT&T partnership.",
  },
  promo: {
    enabled: false,
    amount: 0,
    label: "Promo / reward card",
    subtractFromSavings: false,
  },
  disclaimer: "Internal quote helper. Final address availability, taxes, fees, autopay requirements, router requirements, and active promos must be confirmed in the official Kinetic order platform.",
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
  return plans.map((p) => ({ details: [], featured: false, badge: "", ...p }));
}

function mergeSettings(saved) {
  if (!saved || typeof saved !== "object") return DEFAULT_SETTINGS;
  const migrated = { ...DEFAULT_SETTINGS, ...saved };
  // Kill the old provider field if the v1 settings were saved locally/cloud.
  delete migrated.currentProviderOptions;
  return {
    ...migrated,
    primaryPlanId: saved.primaryPlanId || DEFAULT_SETTINGS.primaryPlanId,
    router: { ...DEFAULT_SETTINGS.router, ...(saved.router || {}) },
    attDiscount: { ...DEFAULT_SETTINGS.attDiscount, ...(saved.attDiscount || {}) },
    promo: { ...DEFAULT_SETTINGS.promo, ...(saved.promo || {}) },
    plans: normalizePlans(saved.plans && saved.plans.length > 4 ? saved.plans : DEFAULT_SETTINGS.plans),
  };
}

async function loadCloudSettings() {
  if (!supabase) return null;
  try {
    let res = await supabase.from(CLOUD_TABLE).select("data").eq("id", CLOUD_ID).single();
    if (!res.error && res.data?.data) return res.data.data;
    res = await supabase.from(CLOUD_TABLE).select("data").eq("id", OLD_CLOUD_ID).single();
    if (!res.error && res.data?.data) return null; // ignore old quote settings so the Kinetic price reset actually happens
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
    if (raw) return JSON.parse(raw);
    return null;
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
  const [routerSelected, setRouterSelected] = useState(DEFAULT_SETTINGS.router.selectedByDefault);
  const [attSelected, setAttSelected] = useState(false);
  const [promoSelected, setPromoSelected] = useState(false);

  useEffect(() => {
    let dead = false;
    async function boot() {
      const local = loadLocalSettings();
      const cloud = await loadCloudSettings();
      if (dead) return;
      const next = mergeSettings(cloud || local || DEFAULT_SETTINGS);
      setSettings(next);
      setActivePlanId(next.primaryPlanId || next.plans.find((p) => p.featured)?.id || next.plans[0]?.id || "");
      setRouterSelected(Boolean(next.router.selectedByDefault));
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
    const router = settings.router.enabled && routerSelected ? Number(settings.router.price || 0) : 0;
    const att = settings.attDiscount.enabled && attSelected ? Number(settings.attDiscount.amount || 0) : 0;
    const monthly = Math.max(0, base + router - att);
    const current = Number(currentBill || 0);
    const monthlySavings = current - monthly;
    const promoValue = settings.promo.enabled && promoSelected ? Number(settings.promo.amount || 0) : 0;
    return {
      base,
      router,
      att,
      monthly,
      current,
      monthlySavings,
      yearSavings: monthlySavings * 12 + promoValue,
      threeYearSavings: monthlySavings * 36 + promoValue,
      promoValue,
    };
  }, [activePlan, settings, currentBill, routerSelected, attSelected, promoSelected]);

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
    setRouterSelected(Boolean(settings.router.selectedByDefault));
    setAttSelected(false);
    setPromoSelected(false);
  }

  if (!loaded) {
    return <main className="quote-shell quote-loading"><div>Loading Kinetic quote...</div></main>;
  }

  return (
    <main className="quote-shell">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <section className="quote-hero">
        <div className="brand-row">
          <button className="back-button" onClick={() => { if (typeof window !== "undefined") window.location.href = "/"; }}>← GFF Turf</button>
          <div className="kinetic-mark">kinetic<span>fiber</span></div>
          <span className="dealer-pill">Authorized dealer quote helper</span>
        </div>
        <div className="hero-copy">
          <div>
            <p>{settings.eyebrow}</p>
            <h1>{settings.title}</h1>
            <span>{settings.subline}</span>
          </div>
          <div className="monthly-card">
            <small>Estimated monthly</small>
            <strong>{money(math.monthly)}</strong>
            <em>{money(math.base)} plan {routerSelected ? `+ ${money(math.router)} gateway` : "without gateway"}{attSelected ? ` − ${money(math.att)} AT&T credit` : ""}</em>
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
                const cardMonthly = Number(plan.price || 0) + (settings.router.enabled && routerSelected ? Number(settings.router.price || 0) : 0) - (settings.attDiscount.enabled && attSelected ? Number(settings.attDiscount.amount || 0) : 0);
                return (
                  <button key={plan.id} className={active ? "plan active" : plan.featured ? "plan featured" : "plan"} onClick={() => setActivePlanId(plan.id)}>
                    {plan.featured && <span className="best-strip">best value</span>}
                    <div className="plan-head">
                      <div><strong>{plan.name}</strong><em>{plan.speed}</em></div>
                      <b>{money(Math.max(0, cardMonthly))}<small>/mo</small></b>
                    </div>
                    <p>{plan.details?.[0] || plan.badge || "Kinetic fiber plan"}</p>
                    <div className="plan-base">{money(plan.price)}/mo base {routerSelected ? `+ ${money(settings.router.price)} gateway` : ""}</div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card label="03" title="Monthly adjustments">
            <div className="toggles">
              {settings.router.enabled && (
                <Toggle active={routerSelected} onClick={() => setRouterSelected(!routerSelected)} title={settings.router.name} value={(routerSelected ? "+" : "") + money(settings.router.price) + "/mo"} body={settings.router.description} />
              )}
              {settings.attDiscount.enabled && (
                <Toggle active={attSelected} onClick={() => setAttSelected(!attSelected)} title={settings.attDiscount.label} value={attSelected ? "-" + money(settings.attDiscount.amount) + "/mo" : "Tap to apply"} body={settings.attDiscount.description} />
              )}
              {settings.promo.enabled && (
                <Toggle active={promoSelected} onClick={() => setPromoSelected(!promoSelected)} title={settings.promo.label} value={promoSelected ? "+" + money(settings.promo.amount) + " value" : "Tap if active"} body="Optional promo/reward value. Edit this in admin when promos change." />
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
          <div className="year-save">
            <span>1-year savings</span>
            <strong>{wholeMoney(math.yearSavings)}</strong>
          </div>
          <div className="monthly-save">
            <span>Monthly difference</span>
            <strong className={math.monthlySavings >= 0 ? "good" : "bad"}>{money(math.monthlySavings)}</strong>
          </div>

          <div className="comparison">
            <div><span>Current bill</span><strong>{money(math.current)}</strong></div>
            <div><span>{activePlan.name}</span><strong>{money(math.base)}</strong></div>
            {settings.router.enabled && routerSelected && <div><span>Gateway rental</span><strong>+{money(math.router)}</strong></div>}
            {settings.attDiscount.enabled && attSelected && <div><span>AT&T credit</span><strong>-{money(math.att)}</strong></div>}
            <div className="total"><span>Estimated monthly</span><strong>{money(math.monthly)}</strong></div>
          </div>

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

function Toggle({ active, onClick, title, value, body }) {
  return <button className={active ? "toggle active" : "toggle"} onClick={onClick}><div><strong>{title}</strong><p>{body}</p></div><span>{value}</span></button>;
}

function AdminEditor({ settings, setSettings, saveCloud, saveStatus }) {
  function updatePlan(id, field, value) {
    setSettings({ ...settings, plans: settings.plans.map((p) => p.id === id ? { ...p, [field]: field === "price" ? parseMoney(value) : field === "featured" ? Boolean(value) : value } : field === "featured" && value ? { ...p, featured: false } : p), primaryPlanId: field === "featured" && value ? id : settings.primaryPlanId });
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
  return (
    <div className="admin-editor">
      <div className="admin-head"><h2>Pricing editor</h2><button onClick={saveCloud}>Save cloud</button><span>{saveStatus}</span></div>
      <div className="admin-form two">
        <label>Title<input value={settings.title} onChange={(e) => setSettings({ ...settings, title: e.target.value })} /></label>
        <label>Subline<input value={settings.subline} onChange={(e) => setSettings({ ...settings, subline: e.target.value })} /></label>
      </div>
      <h3>Plans drag-ish controls</h3>
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
      <h3>Router / AT&T / promo</h3>
      <div className="admin-form three">
        <label>Router price<input value={settings.router.price} onChange={(e) => setSettings({ ...settings, router: { ...settings.router, price: parseMoney(e.target.value) } })} /></label>
        <label>AT&T credit<input value={settings.attDiscount.amount} onChange={(e) => setSettings({ ...settings, attDiscount: { ...settings.attDiscount, amount: parseMoney(e.target.value) } })} /></label>
        <label>Promo amount<input value={settings.promo.amount} onChange={(e) => setSettings({ ...settings, promo: { ...settings.promo, amount: parseMoney(e.target.value) } })} /></label>
      </div>
      <div className="admin-checks">
        <label><input type="checkbox" checked={settings.router.enabled} onChange={(e) => setSettings({ ...settings, router: { ...settings.router, enabled: e.target.checked } })} /> Show router</label>
        <label><input type="checkbox" checked={settings.router.selectedByDefault} onChange={(e) => setSettings({ ...settings, router: { ...settings.router, selectedByDefault: e.target.checked } })} /> Router default on</label>
        <label><input type="checkbox" checked={settings.attDiscount.enabled} onChange={(e) => setSettings({ ...settings, attDiscount: { ...settings.attDiscount, enabled: e.target.checked } })} /> Show AT&T credit</label>
        <label><input type="checkbox" checked={settings.promo.enabled} onChange={(e) => setSettings({ ...settings, promo: { ...settings.promo, enabled: e.target.checked } })} /> Show promo</label>
      </div>
    </div>
  );
}

const css = `
  :root{background:#f6f7f2;color:#02002f}*{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer;border:0}input{border:0;outline:0}.quote-shell{min-height:100vh;background:linear-gradient(180deg,#eff3ea 0%,#ffffff 42%,#eff3ea 100%);padding:18px;color:#02002f;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.quote-loading{display:grid;place-items:center;font-size:34px;font-weight:1000}.quote-hero,.card,.summary-card,.admin-card{border:1px solid rgba(2,0,47,.10);background:#fff;box-shadow:0 20px 55px rgba(2,0,47,.13);border-radius:28px}.quote-hero{padding:18px;margin:0 auto 18px;max-width:1240px;border-top:10px solid #eaff00}.brand-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.back-button{border-radius:999px;background:#02002f;color:#fff;padding:10px 14px;font-weight:1000}.kinetic-mark{font-size:34px;line-height:.9;font-weight:1000;letter-spacing:-.06em;color:#26a96c}.kinetic-mark span{display:block;color:#02002f;font-size:15px;letter-spacing:.18em;text-transform:uppercase}.dealer-pill{border-radius:999px;background:#eaff00;color:#02002f;padding:9px 13px;font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.12em}.hero-copy{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end;margin-top:22px}.hero-copy p{margin:0 0 8px;color:#26a96c;font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.16em}.hero-copy h1{font-size:clamp(48px,7vw,92px);line-height:.88;margin:0;letter-spacing:-.08em;color:#02002f}.hero-copy span{display:block;margin-top:12px;color:#4b5563;font-size:18px;font-weight:850}.monthly-card{border-radius:26px;background:#02002f;color:#fff;padding:20px 24px;min-width:300px;text-align:right}.monthly-card small{display:block;color:#eaff00;text-transform:uppercase;font-size:11px;font-weight:1000;letter-spacing:.16em}.monthly-card strong{display:block;font-size:54px;letter-spacing:-.08em}.monthly-card em{display:block;color:#cbd5e1;font-size:12px;font-style:normal;font-weight:850}.quote-grid{display:grid;grid-template-columns:minmax(0,1fr) 410px;gap:18px;max-width:1240px;margin:0 auto}.left-stack{display:grid;gap:18px}.card,.summary-card,.admin-card{padding:18px}.card-title{display:flex;align-items:center;gap:12px;margin-bottom:16px}.card-title span{display:grid;place-items:center;min-width:38px;height:34px;border-radius:999px;background:#eaff00;color:#02002f;font-weight:1000}.card-title h2{margin:0;font-size:24px;letter-spacing:-.04em}.bill-row label{display:block;color:#26a96c;font-size:13px;font-weight:1000;text-transform:uppercase;letter-spacing:.12em}.money-input{margin-top:8px;display:flex;align-items:center;gap:8px;border-radius:24px;background:#f3f6ef;border:2px solid #eaff00;padding:10px 18px}.money-input span{font-size:42px;font-weight:1000;color:#26a96c}.money-input input{width:100%;background:transparent;color:#02002f;font-size:64px;font-weight:1000;letter-spacing:-.08em}.plan-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.plan{position:relative;overflow:hidden;text-align:left;border-radius:22px;background:#fff;border:1px solid rgba(2,0,47,.12);color:#02002f;padding:16px;min-height:210px;transition:.18s ease}.plan.featured{border-color:#eaff00}.plan.active{background:#02002f;color:#fff;border-color:#02002f;box-shadow:0 18px 45px rgba(2,0,47,.22);transform:translateY(-2px)}.best-strip{position:absolute;inset:0 0 auto 0;background:#eaff00;color:#02002f;text-align:center;font-size:11px;font-weight:1000;text-transform:uppercase;letter-spacing:.1em;padding:5px}.plan-head{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start;margin-top:8px}.plan strong{display:block;color:#26a96c;font-size:21px;letter-spacing:-.04em}.plan.active strong{color:#eaff00}.plan em{display:block;margin-top:3px;color:inherit;font-style:normal;font-weight:1000}.plan b{display:block;font-size:30px;letter-spacing:-.07em}.plan b small{font-size:12px;letter-spacing:0}.plan p{margin:18px 0 0;min-height:58px;color:inherit;font-size:13px;font-weight:850;line-height:1.35}.plan-base{margin-top:12px;border-radius:999px;background:#f2f3f0;color:#02002f;padding:8px 10px;font-size:11px;font-weight:1000}.plan.active .plan-base{background:rgba(255,255,255,.14);color:#fff}.toggles{display:grid;gap:10px}.toggle{display:flex;justify-content:space-between;align-items:center;text-align:left;gap:14px;border-radius:22px;background:#f3f6ef;color:#02002f;padding:16px;border:2px solid transparent;transition:.18s ease}.toggle.active{border-color:#eaff00;background:#f8ffe0}.toggle strong{display:block;font-size:18px}.toggle p{margin:5px 0 0;color:#4b5563;font-weight:750}.toggle span{font-weight:1000;color:#26a96c;white-space:nowrap}.summary-card{position:sticky;top:18px;align-self:start;background:#02002f;color:#fff;border-top:10px solid #eaff00}.summary-pill{display:inline-flex;border-radius:999px;background:#eaff00;color:#02002f;padding:9px 12px;font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.12em}.big-save{margin-top:18px}.big-save small{display:block;color:#cbd5e1;font-size:13px;font-weight:1000;text-transform:uppercase;letter-spacing:.12em}.big-save strong{display:block;font-size:78px;letter-spacing:-.09em;color:#eaff00;line-height:.95}.year-save{margin-top:10px;border-radius:22px;background:#26a96c;color:#fff;padding:16px}.year-save span,.monthly-save span{display:block;font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.12em;opacity:.85}.year-save strong{display:block;font-size:42px;letter-spacing:-.07em}.monthly-save{margin-top:10px;border-radius:18px;background:rgba(255,255,255,.10);padding:14px}.monthly-save strong{display:block;font-size:28px;letter-spacing:-.05em}.good{color:#eaff00}.bad{color:#fca5a5}.comparison{display:grid;gap:9px;margin-top:14px}.comparison div{display:flex;justify-content:space-between;gap:10px;border-radius:16px;background:rgba(255,255,255,.08);padding:13px}.comparison span{color:#cbd5e1;font-weight:800}.comparison strong{font-weight:1000}.comparison .total{background:#fff;color:#02002f}.comparison .total span{color:#02002f}.reset-button{width:100%;margin-top:14px;border-radius:18px;background:#eaff00;color:#02002f;padding:14px;font-weight:1000}.disclaimer{color:#cbd5e1;font-size:12px;line-height:1.45;font-weight:700}.admin-card{max-width:1240px;margin:18px auto 0}.admin-login{display:flex;gap:10px;align-items:center}.admin-login span{font-weight:1000;color:#02002f}.admin-login input{border-radius:14px;background:#f3f6ef;color:#02002f;padding:12px;width:110px}.admin-login button,.admin-head button,.mini-add,.plan-admin button,.reorder button{border-radius:14px;background:#02002f;color:#fff;padding:12px 14px;font-weight:1000}.admin-head{display:flex;gap:12px;align-items:center;justify-content:space-between}.admin-head h2,.admin-editor h3{margin:0}.admin-form{display:grid;gap:10px;margin:12px 0}.admin-form.two{grid-template-columns:1fr 1fr}.admin-form.three{grid-template-columns:repeat(3,1fr)}.admin-form label,.admin-checks label{color:#4b5563;font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.08em}.admin-form input,.plan-admin input{display:block;margin-top:6px;width:100%;border-radius:14px;background:#f3f6ef;color:#02002f;padding:12px}.plan-admin-list{display:grid;gap:10px;margin:12px 0}.plan-admin{display:grid;grid-template-columns:auto 1.1fr .8fr .6fr .9fr auto auto;gap:8px;align-items:center}.reorder{display:flex;gap:4px}.reorder button{padding:10px}.check{display:flex;gap:6px;align-items:center;color:#4b5563;font-size:12px;font-weight:900}.admin-checks{display:flex;flex-wrap:wrap;gap:14px;margin-top:14px}.admin-checks label{display:flex;gap:8px;align-items:center}
  @media(max-width:1120px){.plan-grid{grid-template-columns:repeat(2,1fr)}.quote-grid{grid-template-columns:1fr}.summary-card{position:relative;top:auto}.hero-copy{grid-template-columns:1fr}.monthly-card{text-align:left}.admin-form.two,.admin-form.three,.plan-admin{grid-template-columns:1fr}.plan-admin .reorder{justify-content:start}}
  @media(max-width:560px){.quote-shell{padding:10px}.quote-hero,.card,.summary-card,.admin-card{border-radius:22px;padding:14px}.plan-grid{grid-template-columns:1fr}.hero-copy h1{font-size:46px}.money-input input{font-size:44px}.monthly-card strong{font-size:42px}.big-save strong{font-size:58px}.brand-row{flex-wrap:wrap}.admin-login{flex-wrap:wrap}}
`;
