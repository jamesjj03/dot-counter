"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const CLOUD_STATE_ID = "frontier-sales-page";
const ADMIN_PIN = "6969";

const DEFAULT_SETTINGS = {
  title: "Fiber Internet",
  headerLine: "Official quote builder",
  heroEyebrow: "Frontier Fiber",
  heroHeadline: "Internet built for the whole house.",
  heroSubline:
    "A cleaner connection, stronger speed, and a quote you can actually see before switching.",
  legalNote:
    "Quote helper only. Address availability, taxes, fees, installation, and promotions must be confirmed.",
  plans: [
    {
      id: "fiber-500",
      name: "Fiber 500",
      speed: "500 Mbps",
      price: 34.99,
      badge: "Most common switch",
      details:
        "Great for everyday streaming, phones, laptops, school, and work-from-home use.",
    },
    {
      id: "fiber-1-gig",
      name: "Fiber 1 Gig",
      speed: "1 Gig",
      price: 49.99,
      badge: "Best value",
      details:
        "Built for heavier homes with gaming, 4K streaming, smart devices, and multiple people online.",
    },
    {
      id: "fiber-2-gig",
      name: "Fiber 2 Gig",
      speed: "2 Gig",
      price: 64.99,
      badge: "Power home",
      details:
        "For homes that want maximum headroom and the fastest available experience.",
    },
    {
      id: "fiber-5-gig",
      name: "Fiber 5 Gig",
      speed: "5 Gig",
      price: 89.99,
      badge: "Maximum headroom",
      details:
        "Built for heavy gaming, large downloads, big households, creators, and homes that want serious speed overhead.",
    },
    {
      id: "fiber-7-gig",
      name: "Fiber 7 Gig",
      speed: "7 Gig",
      price: 109.99,
      badge: "Top tier",
      details:
        "The biggest available option for power users, connected homes, and people who want the fastest plan on the table.",
    },
  ],
  addons: [
    {
      id: "landline",
      name: "Landline",
      price: 25,
      details: "Keep a home phone option if needed.",
    },
    {
      id: "youtube-tv",
      name: "YouTube TV",
      price: 82.99,
      details: "Live TV option without traditional cable boxes.",
    },
    {
      id: "wifi-extender",
      name: "Wi-Fi Extender",
      price: 10,
      details: "Helps coverage in larger homes or tougher layouts.",
    },
    {
      id: "wifi-security",
      name: "Wi-Fi Security",
      price: 6,
      details: "Extra network protection for safer browsing and connected devices.",
    },
  ],
};

function uid() {
  try {
    if (typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
  } catch (e) {}
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

function money(value) {
  const n = Number(value || 0);
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function loadCloudSettings() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("app_state")
    .select("data")
    .eq("id", CLOUD_STATE_ID)
    .single();
  if (error) return null;
  return data && data.data ? data.data : null;
}

async function saveCloudSettings(settings) {
  if (!supabase) return { ok: false, error: "Missing Supabase environment variables." };
  const clean = JSON.parse(JSON.stringify(settings));
  const { error } = await supabase.from("app_state").upsert({
    id: CLOUD_STATE_ID,
    data: clean,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message || "Cloud save failed." };
  return { ok: true };
}

function mergeSettings(cloud) {
  if (!cloud || typeof cloud !== "object") return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...cloud,
    plans: Array.isArray(cloud.plans) && cloud.plans.length ? cloud.plans : DEFAULT_SETTINGS.plans,
    addons: Array.isArray(cloud.addons) ? cloud.addons : DEFAULT_SETTINGS.addons,
  };
}

export default function FrontierSalesPage() {
  const saveTimer = useRef(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [pin, setPin] = useState("");
  const [step, setStep] = useState("fiber");
  const [currentBill, setCurrentBill] = useState(100);
  const [selectedPlanId, setSelectedPlanId] = useState(DEFAULT_SETTINGS.plans[1].id);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [saveStatus, setSaveStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let dead = false;
    async function boot() {
      setSaveStatus("loading");
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 2800));
      const cloud = await Promise.race([loadCloudSettings().catch(() => null), timeout]);
      if (dead) return;
      const next = mergeSettings(cloud);
      setSettings(next);
      setSelectedPlanId(next.plans[1]?.id || next.plans[0]?.id || "");
      setLoaded(true);
      setSaveStatus(supabase ? (cloud ? "cloud live" : "cloud empty") : "local only");
      if (!supabase) setError("Cloud save is off because Supabase env vars are missing.");
    }
    boot();
    return () => {
      dead = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded || !admin) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      const result = await saveCloudSettings(settings);
      if (result.ok) {
        setSaveStatus("saved to cloud");
        setError("");
      } else {
        setSaveStatus("save failed");
        setError(result.error || "Cloud save failed.");
      }
    }, 700);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [settings, loaded, admin]);

  const selectedPlan = useMemo(
    () => settings.plans.find((p) => p.id === selectedPlanId) || settings.plans[0] || null,
    [settings.plans, selectedPlanId]
  );

  const chosenAddons = useMemo(
    () => settings.addons.filter((a) => selectedAddons.indexOf(a.id) !== -1),
    [settings.addons, selectedAddons]
  );

  const quoteTotal = useMemo(() => {
    const plan = selectedPlan ? safeNumber(selectedPlan.price) : 0;
    const addons = chosenAddons.reduce((s, a) => s + safeNumber(a.price), 0);
    return plan + addons;
  }, [selectedPlan, chosenAddons]);

  const savings = useMemo(() => {
    const monthly = safeNumber(currentBill) - quoteTotal;
    return {
      monthly,
      yearly: monthly * 12,
      threeYear: monthly * 36,
    };
  }, [currentBill, quoteTotal]);

  function updatePlan(id, patch) {
    setSettings((old) => ({
      ...old,
      plans: old.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }

  function updateAddon(id, patch) {
    setSettings((old) => ({
      ...old,
      addons: old.addons.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  }

  function addPlan() {
    const id = uid();
    setSettings((old) => ({
      ...old,
      plans: [
        ...old.plans,
        { id, name: "New Fiber Plan", speed: "Speed", price: 0, badge: "Option", details: "Plan details." },
      ],
    }));
    setSelectedPlanId(id);
  }

  function removePlan(id) {
    setSettings((old) => {
      const plans = old.plans.filter((p) => p.id !== id);
      return { ...old, plans };
    });
    if (selectedPlanId === id) setSelectedPlanId(settings.plans[0]?.id || "");
  }

  function addAddon() {
    setSettings((old) => ({
      ...old,
      addons: [...old.addons, { id: uid(), name: "New Add-on", price: 0, details: "Add-on details." }],
    }));
  }

  function removeAddon(id) {
    setSettings((old) => ({ ...old, addons: old.addons.filter((a) => a.id !== id) }));
    setSelectedAddons((old) => old.filter((x) => x !== id));
  }

  function toggleAddon(id) {
    setSelectedAddons((old) => (old.indexOf(id) === -1 ? [...old, id] : old.filter((x) => x !== id)));
  }

  function unlock() {
    if (pin.trim() === ADMIN_PIN) {
      setAdmin(true);
      setPin("");
      setStep("pricing");
    }
  }

  if (!loaded) {
    return (
      <main className="sales-page">
        <Style />
        <div className="loading-card">Loading quote builder...</div>
      </main>
    );
  }

  return (
    <main className="sales-page">
      <Style />
      <header className="topbar">
        <div>
          <p className="eyebrow">{settings.heroEyebrow}</p>
          <h1>{settings.title}</h1>
          <p>{settings.headerLine}</p>
        </div>
        <div className="admin-box">
          {admin ? (
            <button className="ghost" onClick={() => setStep(step === "pricing" ? "fiber" : "pricing")}>{step === "pricing" ? "Done" : "Pricing"}</button>
          ) : (
            <>
              <input value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && unlock()} placeholder="PIN" />
              <button onClick={unlock}>Unlock</button>
            </>
          )}
        </div>
      </header>

      <nav className="steps">
        {[
          ["fiber", "1. Fiber"],
          ["bill", "2. Bill"],
          ["plans", "3. Plans"],
          ["options", "4. Options"],
          ["savings", "5. Savings"],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setStep(key)} className={step === key ? "active" : ""}>{label}</button>
        ))}
        {admin && <button onClick={() => setStep("pricing")} className={step === "pricing" ? "active admin-step" : "admin-step"}>Pricing</button>}
      </nav>

      {error && <div className="notice bad">{error}</div>}
      {admin && <div className="notice">Pricing unlocked • {saveStatus}</div>}

      {step === "fiber" && (
        <section className="hero-grid">
          <div className="hero-card">
            <p className="eyebrow red">Fiber vs cable</p>
            <h2>{settings.heroHeadline}</h2>
            <p>{settings.heroSubline}</p>
            <div className="visual-row">
              <ConnectionCard title="Fiber" subtitle="Dedicated light-based line" active />
              <div className="versus">VS</div>
              <ConnectionCard title="Coax" subtitle="Shared neighborhood cable" />
            </div>
            <button className="primary" onClick={() => setStep("bill")}>Start quote</button>
          </div>

          <div className="fiber-visual">
            <div className="house big">Home</div>
            <div className="fiber-line"><span /><span /><span /></div>
            <div className="node">Fiber network</div>
            <div className="visual-copy">
              <h3>Upload. Download. Same clean pipe.</h3>
              <p>Fiber is built to move data both ways with less drag, which matters when homes are streaming, gaming, working, uploading, and using smart devices all at once.</p>
            </div>
          </div>
        </section>
      )}

      {step === "bill" && (
        <section className="card wide center-card">
          <p className="eyebrow red">Current bill</p>
          <h2>What are they paying now?</h2>
          <p>Type their monthly internet bill. The quote updates instantly.</p>
          <div className="bill-input">
            <span>$</span>
            <input inputMode="decimal" value={currentBill} onChange={(e) => setCurrentBill(e.target.value)} />
          </div>
          <button className="primary" onClick={() => setStep("plans")}>Compare plans</button>
        </section>
      )}

      {step === "plans" && (
        <section>
          <div className="section-head">
            <div>
              <p className="eyebrow red">Plans</p>
              <h2>Pick the plan that fits the house.</h2>
            </div>
            <button className="ghost" onClick={() => setStep("options")}>Next</button>
          </div>
          <div className="plan-grid">
            {settings.plans.map((plan) => (
              <button key={plan.id} className={selectedPlanId === plan.id ? "plan selected" : "plan"} onClick={() => setSelectedPlanId(plan.id)}>
                <span className="badge">{plan.badge}</span>
                <h3>{plan.name}</h3>
                <p className="speed">{plan.speed}</p>
                <p className="price">{money(plan.price)}<span>/mo</span></p>
                <p>{plan.details}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "options" && (
        <section>
          <div className="section-head">
            <div>
              <p className="eyebrow red">Options</p>
              <h2>Add what they actually need.</h2>
              <p>Keep it clean. Internet first, then add anything they actually use.</p>
            </div>
            <button className="ghost" onClick={() => setStep("savings")}>Show savings</button>
          </div>
          <div className="addon-grid">
            {settings.addons.map((addon) => {
              const picked = selectedAddons.indexOf(addon.id) !== -1;
              return (
                <button key={addon.id} className={picked ? "addon picked" : "addon"} onClick={() => toggleAddon(addon.id)}>
                  <div>
                    <h3>{addon.name}</h3>
                    <p>{addon.details}</p>
                  </div>
                  <strong>{money(addon.price)}/mo</strong>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === "savings" && (
        <section className="results-grid">
          <div className="card summary-card">
            <p className="eyebrow red">Quote</p>
            <h2>{selectedPlan?.name || "Selected plan"}</h2>
            <p className="price massive">{money(quoteTotal)}<span>/mo</span></p>
            <p>{selectedPlan?.speed} internet{chosenAddons.length ? " + selected options" : ""}</p>
            <div className="line-items">
              <div><span>Current bill</span><strong>{money(currentBill)}</strong></div>
              <div><span>Fiber plan</span><strong>{money(selectedPlan?.price)}</strong></div>
              {chosenAddons.map((a) => <div key={a.id}><span>{a.name}</span><strong>{money(a.price)}</strong></div>)}
              <div className="total"><span>New estimate</span><strong>{money(quoteTotal)}</strong></div>
            </div>
          </div>
          <div className="savings-card">
            <p className="eyebrow">Estimated savings</p>
            <SavingsLine label="Per month" value={savings.monthly} />
            <SavingsLine label="1 year" value={savings.yearly} />
            <SavingsLine label="3 years" value={savings.threeYear} />
            <p className="fine-print">{settings.legalNote}</p>
            <div className="button-row">
              <button className="ghost" onClick={() => setStep("plans")}>Change plan</button>
              <button className="primary" onClick={() => setStep("bill")}>New quote</button>
            </div>
          </div>
        </section>
      )}

      {step === "pricing" && admin && (
        <section className="admin-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow red">Pricing/settings</p>
              <h2>Cloud-saved editor</h2>
              <p>Anything changed here saves for everyone using this page.</p>
            </div>
            <button className="ghost" onClick={() => setSettings(DEFAULT_SETTINGS)}>Reset defaults</button>
          </div>

          <div className="edit-grid two">
            <Field label="Page title" value={settings.title} onChange={(v) => setSettings((o) => ({ ...o, title: v }))} />
            <Field label="Header line" value={settings.headerLine} onChange={(v) => setSettings((o) => ({ ...o, headerLine: v }))} />
            <Field label="Hero eyebrow" value={settings.heroEyebrow} onChange={(v) => setSettings((o) => ({ ...o, heroEyebrow: v }))} />
            <Field label="Hero headline" value={settings.heroHeadline} onChange={(v) => setSettings((o) => ({ ...o, heroHeadline: v }))} />
          </div>
          <TextField label="Hero subline" value={settings.heroSubline} onChange={(v) => setSettings((o) => ({ ...o, heroSubline: v }))} />
          <TextField label="Legal note" value={settings.legalNote} onChange={(v) => setSettings((o) => ({ ...o, legalNote: v }))} />

          <h3 className="editor-title">Plans</h3>
          <div className="editor-list">
            {settings.plans.map((plan) => (
              <div className="editor-item" key={plan.id}>
                <Field label="Name" value={plan.name} onChange={(v) => updatePlan(plan.id, { name: v })} />
                <Field label="Speed" value={plan.speed} onChange={(v) => updatePlan(plan.id, { speed: v })} />
                <Field label="Price" type="number" value={plan.price} onChange={(v) => updatePlan(plan.id, { price: safeNumber(v) })} />
                <Field label="Badge" value={plan.badge} onChange={(v) => updatePlan(plan.id, { badge: v })} />
                <TextField label="Plan details" value={plan.details} onChange={(v) => updatePlan(plan.id, { details: v })} />
                <button className="remove" onClick={() => removePlan(plan.id)}>Remove plan</button>
              </div>
            ))}
          </div>
          <button className="primary" onClick={addPlan}>Add plan</button>

          <h3 className="editor-title">Add-ons</h3>
          <div className="editor-list">
            {settings.addons.map((addon) => (
              <div className="editor-item compact" key={addon.id}>
                <Field label="Name" value={addon.name} onChange={(v) => updateAddon(addon.id, { name: v })} />
                <Field label="Price" type="number" value={addon.price} onChange={(v) => updateAddon(addon.id, { price: safeNumber(v) })} />
                <TextField label="Add-on details" value={addon.details} onChange={(v) => updateAddon(addon.id, { details: v })} />
                <button className="remove" onClick={() => removeAddon(addon.id)}>Remove add-on</button>
              </div>
            ))}
          </div>
          <button className="primary" onClick={addAddon}>Add add-on</button>
        </section>
      )}
    </main>
  );
}

function ConnectionCard({ title, subtitle, active }) {
  return (
    <div className={active ? "connection active" : "connection"}>
      <div className="icon-orb">{active ? "光" : "↯"}</div>
      <h3>{title}</h3>
      <p>{subtitle}</p>
      <div className="bars"><span /><span /><span /></div>
    </div>
  );
}

function SavingsLine({ label, value }) {
  const good = value >= 0;
  return (
    <div className={good ? "saving positive" : "saving negative"}>
      <span>{label}</span>
      <strong>{good ? money(value) : "Adds " + money(Math.abs(value))}</strong>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TextField({ label, value, onChange }) {
  return (
    <label className="field full">
      <span>{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Style() {
  return (
    <style jsx global>{`
      html, body { margin: 0; min-height: 100%; background: #f7f7f8; color: #151515; }
      * { box-sizing: border-box; }
      button, input, textarea { font: inherit; }
      button { -webkit-tap-highlight-color: transparent; }
      .sales-page {
        min-height: 100vh;
        padding: 18px;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(210, 0, 0, .16), transparent 34rem),
          linear-gradient(180deg, #ffffff 0%, #f4f4f5 42%, #ececef 100%);
      }
      .loading-card, .card, .hero-card, .fiber-visual, .savings-card, .admin-panel {
        background: rgba(255,255,255,.96);
        border: 1px solid rgba(20,20,20,.08);
        box-shadow: 0 24px 80px rgba(0,0,0,.11);
        border-radius: 28px;
      }
      .loading-card { margin: 20vh auto; max-width: 420px; padding: 34px; text-align: center; font-weight: 900; color: #d71920; }
      .topbar {
        max-width: 1180px; margin: 0 auto 14px; display: flex; justify-content: space-between; gap: 16px; align-items: center;
        background: #fff; border-radius: 24px; padding: 16px 18px; box-shadow: 0 12px 40px rgba(0,0,0,.08); border-top: 5px solid #d71920;
      }
      .topbar h1 { margin: 0; font-size: clamp(30px, 6vw, 58px); letter-spacing: -.06em; line-height: .9; color: #151515; }
      .topbar p { margin: 4px 0 0; color: #666; font-weight: 750; }
      .eyebrow { margin: 0 0 8px; text-transform: uppercase; letter-spacing: .18em; font-size: 12px; font-weight: 950; color: #555; }
      .eyebrow.red { color: #d71920; }
      .admin-box { display: flex; gap: 8px; align-items: center; }
      .admin-box input { width: 88px; border: 1px solid #ddd; border-radius: 14px; padding: 12px; font-size: 16px; }
      .admin-box button, .primary, .ghost, .steps button { border: 0; border-radius: 999px; padding: 13px 18px; font-weight: 950; cursor: pointer; }
      .primary { background: #d71920; color: white; box-shadow: 0 12px 24px rgba(215,25,32,.22); }
      .ghost { background: #151515; color: #fff; }
      .steps { max-width: 1180px; margin: 0 auto 14px; display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
      .steps button { flex: 0 0 auto; background: #fff; color: #555; border: 1px solid #eee; box-shadow: 0 8px 20px rgba(0,0,0,.05); }
      .steps button.active { background: #d71920; color: white; }
      .steps .admin-step { background: #111; color: white; }
      .notice { max-width: 1180px; margin: 0 auto 14px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; padding: 12px 16px; border-radius: 18px; font-weight: 850; }
      .notice.bad { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
      section { max-width: 1180px; margin: 0 auto; }
      .hero-grid, .results-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .hero-card, .fiber-visual, .card, .savings-card, .admin-panel { padding: clamp(18px, 4vw, 34px); }
      h2 { margin: 0 0 12px; font-size: clamp(32px, 5vw, 62px); letter-spacing: -.06em; line-height: .96; }
      h3 { margin: 0 0 6px; }
      p { line-height: 1.45; }
      .visual-row { margin: 26px 0; display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: stretch; }
      .versus { align-self: center; font-weight: 1000; color: #d71920; }
      .connection { border-radius: 24px; background: #f1f1f3; border: 1px solid #e7e7ea; padding: 18px; text-align: center; }
      .connection.active { background: #fff1f2; border-color: rgba(215,25,32,.25); }
      .icon-orb { width: 58px; height: 58px; margin: 0 auto 10px; display: grid; place-items: center; border-radius: 999px; background: #151515; color: #fff; font-weight: 1000; }
      .connection.active .icon-orb { background: #d71920; }
      .bars { display: flex; justify-content: center; gap: 4px; margin-top: 12px; }
      .bars span { width: 8px; border-radius: 8px; background: #d71920; display: block; }
      .bars span:nth-child(1) { height: 18px; opacity: .45; } .bars span:nth-child(2) { height: 30px; opacity: .7; } .bars span:nth-child(3) { height: 42px; }
      .fiber-visual { position: relative; overflow: hidden; min-height: 480px; background: linear-gradient(135deg, #fff, #fafafa 45%, #fee2e2); }
      .house, .node { position: absolute; border-radius: 24px; padding: 18px; font-weight: 1000; box-shadow: 0 16px 40px rgba(0,0,0,.12); }
      .house.big { left: 30px; top: 62px; width: 150px; height: 150px; display: grid; place-items: center; background: #151515; color: white; }
      .node { right: 30px; top: 92px; background: #d71920; color: #fff; }
      .fiber-line { position: absolute; left: 150px; right: 145px; top: 150px; height: 10px; background: #d71920; border-radius: 99px; box-shadow: 0 0 28px rgba(215,25,32,.55); }
      .fiber-line span { position: absolute; top: -14px; width: 38px; height: 38px; border-radius: 999px; background: rgba(215,25,32,.18); animation: pulse 1.8s infinite; }
      .fiber-line span:nth-child(1) { left: 10%; } .fiber-line span:nth-child(2) { left: 45%; animation-delay: .35s; } .fiber-line span:nth-child(3) { left: 78%; animation-delay: .7s; }
      @keyframes pulse { 0%,100%{ transform: scale(.8); opacity:.25;} 50%{ transform: scale(1.2); opacity:1;} }
      .visual-copy { position: absolute; left: 30px; right: 30px; bottom: 30px; background: rgba(255,255,255,.85); border: 1px solid rgba(0,0,0,.06); border-radius: 24px; padding: 20px; backdrop-filter: blur(12px); }
      .center-card { max-width: 760px; text-align: center; }
      .wide { padding: 34px; }
      .bill-input { margin: 24px auto; max-width: 420px; display: flex; align-items: center; gap: 8px; background: #fff; border: 3px solid #d71920; border-radius: 28px; padding: 12px 18px; box-shadow: inset 0 0 0 1px #fff; }
      .bill-input span { font-size: 42px; font-weight: 1000; color: #d71920; }
      .bill-input input { min-width: 0; width: 100%; border: 0; outline: 0; font-size: 54px; font-weight: 1000; letter-spacing: -.06em; }
      .section-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
      .plan-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .plan, .addon { border: 2px solid transparent; border-radius: 26px; background: #fff; padding: 20px; text-align: left; box-shadow: 0 16px 44px rgba(0,0,0,.08); cursor: pointer; }
      .plan.selected, .addon.picked { border-color: #d71920; background: #fff1f2; }
      .badge { display: inline-block; border-radius: 999px; background: #151515; color: #fff; padding: 7px 11px; font-size: 11px; font-weight: 950; margin-bottom: 14px; }
      .speed { color: #d71920; font-weight: 950; }
      .price { margin: 10px 0; font-size: 38px; font-weight: 1000; letter-spacing: -.06em; color: #151515; }
      .price span { font-size: 16px; color: #777; letter-spacing: 0; }
      .addon-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .addon { display: flex; justify-content: space-between; gap: 18px; align-items: center; }
      .addon strong { white-space: nowrap; color: #d71920; }
      .summary-card .massive { font-size: clamp(52px, 7vw, 92px); }
      .line-items { margin-top: 20px; border-top: 1px solid #eee; }
      .line-items div { display: flex; justify-content: space-between; gap: 12px; padding: 13px 0; border-bottom: 1px solid #eee; font-weight: 850; }
      .line-items .total { font-size: 20px; color: #d71920; }
      .savings-card { background: linear-gradient(135deg, #d71920, #8b0006); color: white; }
      .savings-card .eyebrow { color: rgba(255,255,255,.75); }
      .saving { display: flex; justify-content: space-between; gap: 12px; align-items: center; background: rgba(255,255,255,.13); border: 1px solid rgba(255,255,255,.16); border-radius: 22px; padding: 18px; margin-bottom: 12px; font-weight: 950; }
      .saving strong { font-size: clamp(24px, 5vw, 46px); letter-spacing: -.05em; }
      .negative strong { color: #ffe4e6; }
      .fine-print { margin-top: 18px; color: rgba(255,255,255,.76); font-weight: 750; }
      .button-row { margin-top: 18px; display: flex; gap: 10px; flex-wrap: wrap; }
      .admin-panel { margin-bottom: 40px; }
      .edit-grid.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .field { display: block; margin-bottom: 12px; }
      .field span { display: block; margin-bottom: 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .12em; font-weight: 950; color: #777; }
      .field input, .field textarea { width: 100%; border: 1px solid #ddd; border-radius: 16px; padding: 13px 14px; outline: 0; background: #fff; font-size: 16px; }
      .field textarea { min-height: 86px; resize: vertical; }
      .editor-title { margin: 26px 0 12px; font-size: 26px; letter-spacing: -.04em; }
      .editor-list { display: grid; gap: 12px; margin-bottom: 14px; }
      .editor-item { display: grid; grid-template-columns: 1fr 1fr 140px 1fr; gap: 10px; background: #f7f7f8; border: 1px solid #eee; border-radius: 24px; padding: 14px; }
      .editor-item .full { grid-column: 1 / -1; }
      .editor-item.compact { grid-template-columns: 1fr 140px; }
      .remove { grid-column: 1 / -1; border: 0; background: #111; color: #fff; border-radius: 14px; padding: 12px; font-weight: 950; }
      @media (max-width: 850px) {
        .sales-page { padding: 12px; }
        .topbar { align-items: flex-start; flex-direction: column; }
        .hero-grid, .results-grid, .plan-grid, .addon-grid, .edit-grid.two { grid-template-columns: 1fr; }
        .visual-row { grid-template-columns: 1fr; }
        .versus { text-align: center; }
        .fiber-visual { min-height: 430px; }
        .house.big { width: 110px; height: 110px; }
        .node { right: 18px; }
        .fiber-line { left: 110px; right: 95px; }
        .section-head { align-items: stretch; flex-direction: column; }
        .editor-item, .editor-item.compact { grid-template-columns: 1fr; }
        .bill-input input { font-size: 44px; }
      }
    `}</style>
  );
}
