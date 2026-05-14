"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const CLOUD_TABLE = "app_state";
const CLOUD_ID = "gff_os_quote_settings_v1";
const LOCAL_KEY = "gff_os_quote_settings_v1";
const PIN = "6969";

const DEFAULT_SETTINGS = {
  title: "GFF OS",
  eyebrow: "Kinetic quote builder",
  subline: "Put the numbers in their face. No fluff.",
  primaryPlanId: "gig",
  currentProviderOptions: ["Spectrum", "Xfinity", "T-Mobile", "AT&T", "Other"],
  plans: [
    { id: "threehundred", name: "Kinetic 300", speed: "300 Mbps", price: 39.99, badge: "Starter", featured: false },
    { id: "fivehundred", name: "Kinetic 500", speed: "500 Mbps", price: 49.99, badge: "Solid value", featured: false },
    { id: "gig", name: "Kinetic 1 Gig", speed: "1 Gig", price: 69.99, badge: "Most common", featured: true },
    { id: "twogig", name: "Kinetic 2 Gig", speed: "2 Gig", price: 99.99, badge: "Power home", featured: false },
  ],
  router: {
    enabled: true,
    selectedByDefault: true,
    name: "Kinetic Gateway",
    price: 10.99,
    description: "Router rental / Wi-Fi gateway.",
  },
  attDiscount: {
    enabled: true,
    amount: 20,
    title: "AT&T bundle credit",
    label: "Has AT&T wireless",
    description: "Applies a monthly Kinetic bill credit when the customer qualifies through AT&T wireless.",
  },
  promo: {
    enabled: false,
    amount: 0,
    label: "Promo / reward card",
    subtractFromSavings: true,
  },
  disclaimer: "Quote helper only. Final price, taxes, fees, address availability, router requirements, autopay, and promotions must be confirmed in the official Kinetic order platform.",
};

function money(value) {
  const n = Number(value || 0);
  return "$" + n.toFixed(2);
}

function parseMoney(value) {
  const raw = String(value || "").replace(/[^0-9.]/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeSettings(saved) {
  if (!saved || typeof saved !== "object") return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    router: { ...DEFAULT_SETTINGS.router, ...(saved.router || {}) },
    attDiscount: { ...DEFAULT_SETTINGS.attDiscount, ...(saved.attDiscount || {}) },
    promo: { ...DEFAULT_SETTINGS.promo, ...(saved.promo || {}) },
    plans: Array.isArray(saved.plans) && saved.plans.length ? saved.plans : DEFAULT_SETTINGS.plans,
    currentProviderOptions: Array.isArray(saved.currentProviderOptions) && saved.currentProviderOptions.length ? saved.currentProviderOptions : DEFAULT_SETTINGS.currentProviderOptions,
  };
}

async function loadCloudSettings() {
  if (!supabase) return null;
  try {
    const res = await supabase.from(CLOUD_TABLE).select("data").eq("id", CLOUD_ID).single();
    if (res.error) return null;
    return res.data?.data || null;
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

  const [provider, setProvider] = useState("Spectrum");
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
      setActivePlanId(next.primaryPlanId || next.plans[0]?.id || "");
      setRouterSelected(Boolean(next.router.selectedByDefault));
      setSaveStatus(cloud ? "cloud loaded" : local ? "local loaded" : "default");
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
    setProvider(settings.currentProviderOptions[0] || "Spectrum");
    setCurrentBill(100);
    setActivePlanId(settings.primaryPlanId || settings.plans[0]?.id || "");
    setRouterSelected(Boolean(settings.router.selectedByDefault));
    setAttSelected(false);
    setPromoSelected(false);
  }

  if (!loaded) {
    return <main className="quote-shell quote-loading"><div>Loading GFF OS...</div></main>;
  }

  return (
    <main className="quote-shell">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <section className="hero-card">
        <div className="hero-topline">
          <button className="back-button" onClick={() => { if (typeof window !== "undefined") window.location.href = "/"; }}>← Turf</button>
          <span>{settings.eyebrow}</span>
          <span>{saveStatus}</span>
        </div>
        <div className="hero-grid">
          <div>
            <h1>{settings.title}</h1>
            <p>{settings.subline}</p>
          </div>
          <div className="final-number">
            <span>New monthly</span>
            <strong>{money(math.monthly)}</strong>
          </div>
        </div>
      </section>

      <section className="quote-grid">
        <div className="left-stack">
          <Card label="1" title="What are they paying now?">
            <div className="provider-grid">
              {settings.currentProviderOptions.map((name) => (
                <button key={name} className={provider === name ? "choice active" : "choice"} onClick={() => setProvider(name)}>{name}</button>
              ))}
            </div>
            <label className="money-input-label">Current bill</label>
            <div className="money-input"><span>$</span><input value={currentBill} onChange={(e) => setCurrentBill(parseMoney(e.target.value))} inputMode="decimal" /></div>
          </Card>

          <Card label="2" title="Pick the Kinetic plan">
            <div className="plan-grid">
              {settings.plans.map((plan) => {
                const active = activePlan.id === plan.id;
                return (
                  <button key={plan.id} className={active ? "plan active" : plan.featured ? "plan featured" : "plan"} onClick={() => setActivePlanId(plan.id)}>
                    <span>{plan.badge}</span>
                    <strong>{plan.name}</strong>
                    <em>{plan.speed}</em>
                    <b>{money(plan.price)}/mo</b>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card label="3" title="Adjust the monthly math">
            <div className="toggles">
              {settings.router.enabled && (
                <Toggle active={routerSelected} onClick={() => setRouterSelected(!routerSelected)} title={settings.router.name} value={"+" + money(settings.router.price) + "/mo"} body={settings.router.description} />
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
          <span className="summary-pill">{provider} → Kinetic</span>
          <h2>{money(math.threeYearSavings)}</h2>
          <p className={math.monthlySavings >= 0 ? "save-line good" : "save-line bad"}>{math.monthlySavings >= 0 ? "Estimated 3-year savings" : "More expensive over 3 years"}</p>

          <div className="comparison">
            <div><span>Current bill</span><strong>{money(math.current)}</strong></div>
            <div><span>Kinetic plan</span><strong>{money(math.base)}</strong></div>
            {settings.router.enabled && routerSelected && <div><span>Router</span><strong>+{money(math.router)}</strong></div>}
            {settings.attDiscount.enabled && attSelected && <div><span>AT&T credit</span><strong>-{money(math.att)}</strong></div>}
            <div className="total"><span>Final monthly</span><strong>{money(math.monthly)}</strong></div>
          </div>

          <div className="savings-row">
            <div><span>Monthly</span><strong>{money(math.monthlySavings)}</strong></div>
            <div><span>1 year</span><strong>{money(math.yearSavings)}</strong></div>
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
    setSettings({ ...settings, plans: settings.plans.map((p) => p.id === id ? { ...p, [field]: field === "price" ? parseMoney(value) : field === "featured" ? Boolean(value) : value } : p) });
  }
  function addPlan() {
    const id = "plan-" + Date.now();
    setSettings({ ...settings, plans: [...settings.plans, { id, name: "New Plan", speed: "", price: 0, badge: "", featured: false }] });
  }
  function removePlan(id) {
    setSettings({ ...settings, plans: settings.plans.filter((p) => p.id !== id) });
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
            <input value={plan.name} onChange={(e) => updatePlan(plan.id, "name", e.target.value)} />
            <input value={plan.speed} onChange={(e) => updatePlan(plan.id, "speed", e.target.value)} />
            <input value={plan.price} onChange={(e) => updatePlan(plan.id, "price", e.target.value)} inputMode="decimal" />
            <input value={plan.badge || ""} onChange={(e) => updatePlan(plan.id, "badge", e.target.value)} />
            <label className="check"><input type="checkbox" checked={Boolean(plan.featured)} onChange={(e) => updatePlan(plan.id, "featured", e.target.checked)} /> Featured</label>
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
  :root{background:#07120f;color:#f8fafc}*{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer;border:0}input{border:0;outline:0}.quote-shell{min-height:100vh;background:radial-gradient(circle at top left,rgba(34,197,94,.26),transparent 32rem),radial-gradient(circle at top right,rgba(14,165,233,.22),transparent 34rem),linear-gradient(135deg,#07120f,#0b1220 48%,#09110d);padding:18px;color:#f8fafc;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.quote-loading{display:grid;place-items:center;font-size:34px;font-weight:1000}.hero-card,.card,.summary-card,.admin-card{border:1px solid rgba(148,163,184,.16);background:rgba(9,16,29,.78);box-shadow:0 24px 80px rgba(0,0,0,.35);backdrop-filter:blur(22px);border-radius:28px}.hero-card{padding:18px;margin:0 auto 18px;max-width:1180px}.hero-topline{display:flex;justify-content:space-between;gap:12px;align-items:center;color:#93f4c3;text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:900}.back-button{border-radius:999px;background:rgba(34,197,94,.12);color:#bbf7d0;padding:10px 14px}.hero-grid{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end;margin-top:18px}.hero-grid h1{font-size:clamp(48px,8vw,92px);line-height:.88;margin:0;letter-spacing:-.08em;background:linear-gradient(90deg,#f8fafc,#22c55e,#38bdf8);-webkit-background-clip:text;background-clip:text;color:transparent}.hero-grid p{margin:12px 0 0;color:#94a3b8;font-size:18px;font-weight:800}.final-number{border-radius:24px;background:linear-gradient(135deg,#22c55e,#38bdf8);color:#03130c;padding:18px 24px;min-width:230px;text-align:right}.final-number span{display:block;text-transform:uppercase;font-size:11px;font-weight:1000;letter-spacing:.16em;opacity:.72}.final-number strong{display:block;font-size:44px;letter-spacing:-.07em}.quote-grid{display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:18px;max-width:1180px;margin:0 auto}.left-stack{display:grid;gap:18px}.card,.summary-card,.admin-card{padding:18px}.card-title{display:flex;align-items:center;gap:12px;margin-bottom:16px}.card-title span{display:grid;place-items:center;width:34px;height:34px;border-radius:12px;background:#22c55e;color:#04130b;font-weight:1000}.card-title h2{margin:0;font-size:24px;letter-spacing:-.04em}.provider-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.choice,.plan,.toggle{transition:.18s ease}.choice{border-radius:18px;padding:14px;background:rgba(255,255,255,.06);color:#dbeafe;font-weight:1000}.choice.active{background:#22c55e;color:#04130b;box-shadow:0 10px 28px rgba(34,197,94,.23)}.money-input-label{display:block;margin-top:18px;margin-bottom:8px;color:#94a3b8;font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.14em}.money-input{display:flex;align-items:center;gap:8px;border-radius:24px;background:#050b13;border:1px solid rgba(34,197,94,.22);padding:10px 18px}.money-input span{font-size:42px;font-weight:1000;color:#22c55e}.money-input input{width:100%;background:transparent;color:#fff;font-size:64px;font-weight:1000;letter-spacing:-.08em}.plan-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.plan{text-align:left;border-radius:22px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#f8fafc;padding:16px;min-height:160px}.plan.featured{border-color:rgba(56,189,248,.35)}.plan.active{background:linear-gradient(145deg,rgba(34,197,94,.24),rgba(56,189,248,.18));border-color:#22c55e;box-shadow:0 18px 45px rgba(34,197,94,.12);transform:translateY(-2px)}.plan span{display:inline-block;color:#86efac;font-size:11px;font-weight:1000;text-transform:uppercase;letter-spacing:.1em}.plan strong{display:block;margin-top:14px;font-size:21px;letter-spacing:-.04em}.plan em{display:block;margin-top:4px;color:#94a3b8;font-style:normal;font-weight:800}.plan b{display:block;margin-top:18px;font-size:25px;letter-spacing:-.06em}.toggles{display:grid;gap:10px}.toggle{display:flex;justify-content:space-between;align-items:center;text-align:left;gap:14px;border-radius:22px;background:rgba(255,255,255,.06);color:#f8fafc;padding:16px;border:1px solid rgba(255,255,255,.08)}.toggle.active{border-color:#22c55e;background:rgba(34,197,94,.14)}.toggle strong{display:block;font-size:18px}.toggle p{margin:5px 0 0;color:#94a3b8;font-weight:700}.toggle span{font-weight:1000;color:#86efac;white-space:nowrap}.summary-card{position:sticky;top:18px;align-self:start}.summary-pill{display:inline-flex;border-radius:999px;background:rgba(56,189,248,.12);color:#7dd3fc;padding:9px 12px;font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.12em}.summary-card h2{font-size:64px;letter-spacing:-.09em;margin:20px 0 0;background:linear-gradient(90deg,#22c55e,#38bdf8);-webkit-background-clip:text;background-clip:text;color:transparent}.save-line{font-size:17px;font-weight:1000;margin:0 0 18px}.save-line.good{color:#86efac}.save-line.bad{color:#fca5a5}.comparison{display:grid;gap:9px}.comparison div,.savings-row div{display:flex;justify-content:space-between;gap:10px;border-radius:16px;background:rgba(255,255,255,.06);padding:13px}.comparison span,.savings-row span{color:#94a3b8;font-weight:800}.comparison strong,.savings-row strong{font-weight:1000}.comparison .total{background:#22c55e;color:#04130b}.comparison .total span{color:#064e3b}.savings-row{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}.reset-button{width:100%;margin-top:14px;border-radius:18px;background:#f8fafc;color:#07120f;padding:14px;font-weight:1000}.disclaimer{color:#64748b;font-size:12px;line-height:1.45;font-weight:700}.admin-card{max-width:1180px;margin:18px auto 0}.admin-login{display:flex;gap:10px;align-items:center}.admin-login span{font-weight:1000;color:#94a3b8}.admin-login input{border-radius:14px;background:#050b13;color:#fff;padding:12px;width:110px}.admin-login button,.admin-head button,.mini-add,.plan-admin button{border-radius:14px;background:#22c55e;color:#04130b;padding:12px 14px;font-weight:1000}.admin-head{display:flex;gap:12px;align-items:center;justify-content:space-between}.admin-head h2,.admin-editor h3{margin:0}.admin-form{display:grid;gap:10px;margin:12px 0}.admin-form.two{grid-template-columns:1fr 1fr}.admin-form.three{grid-template-columns:repeat(3,1fr)}.admin-form label,.admin-checks label{color:#94a3b8;font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.08em}.admin-form input,.plan-admin input{display:block;margin-top:6px;width:100%;border-radius:14px;background:#050b13;color:#fff;padding:12px}.plan-admin-list{display:grid;gap:10px;margin:12px 0}.plan-admin{display:grid;grid-template-columns:1.2fr .8fr .6fr .9fr auto auto;gap:8px;align-items:center}.check{display:flex;gap:6px;align-items:center;color:#94a3b8;font-size:12px;font-weight:900}.admin-checks{display:flex;flex-wrap:wrap;gap:14px;margin-top:14px}.admin-checks label{display:flex;gap:8px;align-items:center}
  @media(max-width:920px){.quote-grid{grid-template-columns:1fr}.summary-card{position:relative;top:auto}.hero-grid{grid-template-columns:1fr}.final-number{text-align:left}.plan-grid{grid-template-columns:repeat(2,1fr)}.provider-grid{grid-template-columns:repeat(2,1fr)}.admin-form.two,.admin-form.three,.plan-admin{grid-template-columns:1fr}.money-input input{font-size:52px}.summary-card h2{font-size:52px}}
  @media(max-width:520px){.quote-shell{padding:10px}.hero-card,.card,.summary-card,.admin-card{border-radius:22px;padding:14px}.plan-grid{grid-template-columns:1fr}.provider-grid{grid-template-columns:1fr 1fr}.hero-grid h1{font-size:48px}.money-input input{font-size:44px}.final-number strong{font-size:38px}.admin-login{flex-wrap:wrap}.savings-row{grid-template-columns:1fr}}
`;
