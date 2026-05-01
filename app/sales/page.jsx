"use client";

import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "frontier-sales-flow-v1";

const DEFAULT_DATA = {
  companyName: "Fiber Internet",
  repLine: "Official quote builder",
  heroTitle: "A faster, cleaner internet connection.",
  heroSubtitle:
    "Fiber sends data as light through glass instead of pushing internet through old copper cable lines.",
  fiberPoints: [
    {
      title: "Fiber is built for speed",
      text: "Fiber has more room for modern internet use: streaming, gaming, work, phones, tablets, cameras, and smart TVs.",
    },
    {
      title: "Better during busy hours",
      text: "Cable neighborhoods can slow down when everyone is online. Fiber is designed to handle heavier usage cleanly.",
    },
    {
      title: "Cleaner upload performance",
      text: "Video calls, cloud backups, security cameras, and gaming all benefit when upload speed is not an afterthought.",
    },
  ],
  plans: [
    {
      id: "fiber-500",
      name: "Fiber 500",
      speed: "500 Mbps",
      price: 59.99,
      badge: "Most common switch",
      details: "Great for everyday streaming, phones, laptops, school, and work-from-home use.",
    },
    {
      id: "fiber-1000",
      name: "Fiber 1 Gig",
      speed: "1 Gig",
      price: 79.99,
      badge: "Best value",
      details: "Built for heavier homes with gaming, 4K streaming, smart devices, and multiple people online.",
    },
    {
      id: "fiber-2000",
      name: "Fiber 2 Gig",
      speed: "2 Gig",
      price: 99.99,
      badge: "Power home",
      details: "For homes that want maximum headroom and the fastest available experience.",
    },
  ],
  addons: [
    { id: "landline", name: "Landline", price: 25, details: "Keep a home phone option if needed." },
    { id: "youtube-tv", name: "YouTube TV", price: 82.99, details: "Live TV option without traditional cable boxes." },
    { id: "wifi-extender", name: "Wi-Fi extender", price: 10, details: "Helps coverage in larger homes or tougher layouts." },
  ],
  installNotes: [
    "Simple install appointment.",
    "The goal is to make the switch easy, not turn it into a project.",
    "Final taxes, fees, availability, and promo terms can vary by address.",
  ],
};

function safeUid(prefix) {
  return prefix + "-" + String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

function money(value) {
  const n = Number(value || 0);
  return "$" + n.toFixed(2);
}

function loadStored() {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveStored(value) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (e) {}
}

function parsePrice(value) {
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export default function SalesFlowPage() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState("fiber");
  const [currentBill, setCurrentBill] = useState("100");
  const [selectedPlanId, setSelectedPlanId] = useState("fiber-500");
  const [selectedAddons, setSelectedAddons] = useState({});
  const [adminOpen, setAdminOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [admin, setAdmin] = useState(false);

  useEffect(function () {
    const stored = loadStored();
    if (stored && stored.plans && stored.addons) setData(stored);
    setReady(true);
  }, []);

  useEffect(function () {
    if (ready) saveStored(data);
  }, [data, ready]);

  const selectedPlan = useMemo(
    function () {
      for (let i = 0; i < data.plans.length; i++) {
        if (data.plans[i].id === selectedPlanId) return data.plans[i];
      }
      return data.plans[0];
    },
    [data.plans, selectedPlanId]
  );

  const chosenAddons = useMemo(
    function () {
      return data.addons.filter(function (a) {
        return !!selectedAddons[a.id];
      });
    },
    [data.addons, selectedAddons]
  );

  const addonTotal = chosenAddons.reduce(function (sum, a) {
    return sum + Number(a.price || 0);
  }, 0);

  const planPrice = selectedPlan ? Number(selectedPlan.price || 0) : 0;
  const ourTotal = planPrice + addonTotal;
  const theirBill = parsePrice(currentBill);
  const monthlySavings = theirBill - ourTotal;
  const yearlySavings = monthlySavings * 12;
  const threeYearSavings = monthlySavings * 36;

  function unlock() {
    if (pin.trim() === "6969") {
      setAdmin(true);
      setPin("");
    }
  }

  function updateData(next) {
    setData(next);
  }

  function toggleAddon(id) {
    setSelectedAddons(function (old) {
      const next = {};
      for (const k in old) next[k] = old[k];
      next[id] = !next[id];
      return next;
    });
  }

  if (!ready) {
    return (
      <main className="sf-page">
        <style>{css}</style>
        <div className="sf-loading">Loading quote builder...</div>
      </main>
    );
  }

  return (
    <main className="sf-page">
      <style>{css}</style>

      <section className="sf-shell">
        <header className="sf-header">
          <div>
            <div className="sf-kicker">Frontier-style fiber quote</div>
            <h1>{data.companyName}</h1>
            <p>{data.repLine}</p>
          </div>
          <button className="sf-admin-pill" onClick={function () { setAdminOpen(!adminOpen); }}>
            {admin ? "Pricing unlocked" : "Rep settings"}
          </button>
        </header>

        {adminOpen && (
          <section className="sf-admin-box">
            {!admin ? (
              <div className="sf-admin-login">
                <input
                  value={pin}
                  onChange={function (e) { setPin(e.target.value); }}
                  onKeyDown={function (e) { if (e.key === "Enter") unlock(); }}
                  placeholder="PIN"
                />
                <button onClick={unlock}>Unlock</button>
              </div>
            ) : (
              <AdminEditor data={data} setData={updateData} close={function () { setAdminOpen(false); }} />
            )}
          </section>
        )}

        <nav className="sf-steps">
          <button className={step === "fiber" ? "active" : ""} onClick={function () { setStep("fiber"); }}>1. Fiber</button>
          <button className={step === "bill" ? "active" : ""} onClick={function () { setStep("bill"); }}>2. Bill</button>
          <button className={step === "plans" ? "active" : ""} onClick={function () { setStep("plans"); }}>3. Plans</button>
          <button className={step === "addons" ? "active" : ""} onClick={function () { setStep("addons"); }}>4. Options</button>
          <button className={step === "summary" ? "active" : ""} onClick={function () { setStep("summary"); }}>5. Savings</button>
        </nav>

        <section className="sf-card">
          {step === "fiber" && (
            <FiberStep data={data} next={function () { setStep("bill"); }} />
          )}

          {step === "bill" && (
            <BillStep
              currentBill={currentBill}
              setCurrentBill={setCurrentBill}
              next={function () { setStep("plans"); }}
            />
          )}

          {step === "plans" && (
            <PlansStep
              plans={data.plans}
              selectedPlanId={selectedPlanId}
              setSelectedPlanId={setSelectedPlanId}
              next={function () { setStep("addons"); }}
            />
          )}

          {step === "addons" && (
            <AddonsStep
              addons={data.addons}
              selectedAddons={selectedAddons}
              toggleAddon={toggleAddon}
              next={function () { setStep("summary"); }}
            />
          )}

          {step === "summary" && (
            <SummaryStep
              data={data}
              currentBill={currentBill}
              setCurrentBill={setCurrentBill}
              selectedPlan={selectedPlan}
              chosenAddons={chosenAddons}
              ourTotal={ourTotal}
              monthlySavings={monthlySavings}
              yearlySavings={yearlySavings}
              threeYearSavings={threeYearSavings}
              setStep={setStep}
            />
          )}
        </section>

        <footer className="sf-footer">
          <span>Quote helper only.</span>
          <span>Address availability, taxes, fees, installation, and promotions must be confirmed.</span>
        </footer>
      </section>
    </main>
  );
}

function FiberStep({ data, next }) {
  return (
    <div>
      <div className="sf-hero-grid">
        <div>
          <div className="sf-red-label">Why fiber?</div>
          <h2>{data.heroTitle}</h2>
          <p className="sf-big-copy">{data.heroSubtitle}</p>
        </div>
        <div className="sf-fiber-visual">
          <div className="sf-light-beam" />
          <div className="sf-glass-line" />
          <div className="sf-dot d1" />
          <div className="sf-dot d2" />
          <div className="sf-dot d3" />
          <p>Light through fiber</p>
        </div>
      </div>

      <div className="sf-point-grid">
        {data.fiberPoints.map(function (p, i) {
          return (
            <div className="sf-point" key={i}>
              <strong>{p.title}</strong>
              <span>{p.text}</span>
            </div>
          );
        })}
      </div>

      <button className="sf-primary" onClick={next}>Compare the bill</button>
    </div>
  );
}

function BillStep({ currentBill, setCurrentBill, next }) {
  return (
    <div>
      <div className="sf-red-label">Current bill</div>
      <h2>What are you paying right now?</h2>
      <p className="sf-big-copy">
        Put their internet bill here. This makes the rest of the conversation simple and visual.
      </p>

      <div className="sf-bill-input-wrap">
        <span>$</span>
        <input
          value={currentBill}
          onChange={function (e) { setCurrentBill(e.target.value); }}
          inputMode="decimal"
          placeholder="100"
        />
        <small>/ month</small>
      </div>

      <div className="sf-quick-bills">
        {[70, 80, 90, 100, 120, 150].map(function (n) {
          return <button key={n} onClick={function () { setCurrentBill(String(n)); }}>{money(n)}</button>;
        })}
      </div>

      <button className="sf-primary" onClick={next}>Show plans</button>
    </div>
  );
}

function PlansStep({ plans, selectedPlanId, setSelectedPlanId, next }) {
  return (
    <div>
      <div className="sf-red-label">Pick the fit</div>
      <h2>Choose the fiber plan.</h2>
      <div className="sf-plan-grid">
        {plans.map(function (p) {
          const active = selectedPlanId === p.id;
          return (
            <button
              key={p.id}
              className={active ? "sf-plan active" : "sf-plan"}
              onClick={function () { setSelectedPlanId(p.id); }}
            >
              <span className="sf-badge">{p.badge}</span>
              <strong>{p.name}</strong>
              <em>{p.speed}</em>
              <b>{money(p.price)}<small>/mo</small></b>
              <p>{p.details}</p>
            </button>
          );
        })}
      </div>

      <button className="sf-primary" onClick={next}>Add options</button>
    </div>
  );
}

function AddonsStep({ addons, selectedAddons, toggleAddon, next }) {
  return (
    <div>
      <div className="sf-red-label">Options</div>
      <h2>Add what they actually need.</h2>
      <p className="sf-big-copy">
        Keep it clean. Internet first, then add anything they actually use.
      </p>

      <div className="sf-addon-grid">
        {addons.map(function (a) {
          const active = !!selectedAddons[a.id];
          return (
            <button key={a.id} className={active ? "sf-addon active" : "sf-addon"} onClick={function () { toggleAddon(a.id); }}>
              <strong>{a.name}</strong>
              <b>{money(a.price)}<small>/mo</small></b>
              <span>{a.details}</span>
            </button>
          );
        })}
      </div>

      <button className="sf-primary" onClick={next}>Show savings</button>
    </div>
  );
}

function SummaryStep({
  data,
  currentBill,
  setCurrentBill,
  selectedPlan,
  chosenAddons,
  ourTotal,
  monthlySavings,
  yearlySavings,
  threeYearSavings,
  setStep,
}) {
  const saving = monthlySavings >= 0;

  return (
    <div>
      <div className="sf-red-label">Side-by-side</div>
      <h2>Here is the actual monthly comparison.</h2>

      <div className="sf-summary-grid">
        <div className="sf-price-card old">
          <span>Current bill</span>
          <div className="sf-mini-input">
            <b>$</b>
            <input value={currentBill} onChange={function (e) { setCurrentBill(e.target.value); }} inputMode="decimal" />
          </div>
          <small>per month</small>
        </div>

        <div className="sf-price-card new">
          <span>Fiber package</span>
          <strong>{money(ourTotal)}</strong>
          <small>per month</small>
        </div>

        <div className={saving ? "sf-price-card save" : "sf-price-card higher"}>
          <span>{saving ? "Monthly savings" : "Monthly difference"}</span>
          <strong>{money(Math.abs(monthlySavings))}</strong>
          <small>{saving ? "less per month" : "more per month"}</small>
        </div>
      </div>

      <div className="sf-savings-strip">
        <div>
          <span>1 year</span>
          <strong>{money(Math.abs(yearlySavings))}</strong>
          <small>{saving ? "saved" : "difference"}</small>
        </div>
        <div>
          <span>3 years</span>
          <strong>{money(Math.abs(threeYearSavings))}</strong>
          <small>{saving ? "saved" : "difference"}</small>
        </div>
      </div>

      <div className="sf-package">
        <h3>Selected package</h3>
        <p><b>{selectedPlan ? selectedPlan.name : "Plan"}</b> — {selectedPlan ? selectedPlan.speed : ""} — {money(selectedPlan ? selectedPlan.price : 0)}/mo</p>
        {chosenAddons.length ? (
          chosenAddons.map(function (a) {
            return <p key={a.id}><b>{a.name}</b> — {money(a.price)}/mo</p>;
          })
        ) : (
          <p>No add-ons selected.</p>
        )}
      </div>

      <div className="sf-notes">
        {data.installNotes.map(function (n, i) {
          return <p key={i}>{n}</p>;
        })}
      </div>

      <div className="sf-bottom-actions">
        <button onClick={function () { setStep("plans"); }}>Change plan</button>
        <button onClick={function () { setStep("addons"); }}>Change options</button>
        <button className="sf-primary small" onClick={function () { setStep("fiber"); }}>Start over</button>
      </div>
    </div>
  );
}

function AdminEditor({ data, setData, close }) {
  function updateField(field, value) {
    const next = {};
    for (const k in data) next[k] = data[k];
    next[field] = value;
    setData(next);
  }

  function updatePlan(index, field, value) {
    const plans = data.plans.map(function (p, i) {
      if (i !== index) return p;
      const next = {};
      for (const k in p) next[k] = p[k];
      next[field] = field === "price" ? parsePrice(value) : value;
      return next;
    });
    updateField("plans", plans);
  }

  function updateAddon(index, field, value) {
    const addons = data.addons.map(function (a, i) {
      if (i !== index) return a;
      const next = {};
      for (const k in a) next[k] = a[k];
      next[field] = field === "price" ? parsePrice(value) : value;
      return next;
    });
    updateField("addons", addons);
  }

  function addPlan() {
    updateField("plans", data.plans.concat([{ id: safeUid("plan"), name: "New Plan", speed: "Speed", price: 59.99, badge: "Option", details: "Plan details." }]));
  }

  function addAddon() {
    updateField("addons", data.addons.concat([{ id: safeUid("addon"), name: "New Add-on", price: 10, details: "Add-on details." }]));
  }

  function removePlan(index) {
    updateField("plans", data.plans.filter(function (_, i) { return i !== index; }));
  }

  function removeAddon(index) {
    updateField("addons", data.addons.filter(function (_, i) { return i !== index; }));
  }

  function reset() {
    setData(DEFAULT_DATA);
  }

  return (
    <div>
      <div className="sf-admin-top">
        <h3>Pricing/settings</h3>
        <button onClick={close}>Done</button>
      </div>

      <label className="sf-admin-field">
        Page title
        <input value={data.companyName} onChange={function (e) { updateField("companyName", e.target.value); }} />
      </label>

      <label className="sf-admin-field">
        Header line
        <input value={data.repLine} onChange={function (e) { updateField("repLine", e.target.value); }} />
      </label>

      <h4>Plans</h4>
      {data.plans.map(function (p, i) {
        return (
          <div className="sf-admin-item" key={p.id}>
            <input value={p.name} onChange={function (e) { updatePlan(i, "name", e.target.value); }} placeholder="Plan name" />
            <input value={p.speed} onChange={function (e) { updatePlan(i, "speed", e.target.value); }} placeholder="Speed" />
            <input value={String(p.price)} onChange={function (e) { updatePlan(i, "price", e.target.value); }} placeholder="Price" inputMode="decimal" />
            <input value={p.badge} onChange={function (e) { updatePlan(i, "badge", e.target.value); }} placeholder="Badge" />
            <textarea value={p.details} onChange={function (e) { updatePlan(i, "details", e.target.value); }} placeholder="Details" />
            <button className="sf-danger" onClick={function () { removePlan(i); }}>Remove plan</button>
          </div>
        );
      })}
      <button className="sf-admin-add" onClick={addPlan}>Add plan</button>

      <h4>Add-ons</h4>
      {data.addons.map(function (a, i) {
        return (
          <div className="sf-admin-item" key={a.id}>
            <input value={a.name} onChange={function (e) { updateAddon(i, "name", e.target.value); }} placeholder="Add-on name" />
            <input value={String(a.price)} onChange={function (e) { updateAddon(i, "price", e.target.value); }} placeholder="Price" inputMode="decimal" />
            <textarea value={a.details} onChange={function (e) { updateAddon(i, "details", e.target.value); }} placeholder="Details" />
            <button className="sf-danger" onClick={function () { removeAddon(i); }}>Remove add-on</button>
          </div>
        );
      })}
      <button className="sf-admin-add" onClick={addAddon}>Add add-on</button>

      <button className="sf-reset" onClick={reset}>Reset defaults</button>
    </div>
  );
}

const css = `
html, body {
  margin: 0;
  background: #f7f7f7;
}

* {
  box-sizing: border-box;
}

.sf-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(210, 0, 0, 0.10), transparent 28rem),
    linear-gradient(180deg, #ffffff 0%, #f6f6f6 48%, #eeeeee 100%);
  color: #1f1f1f;
  font-family: Arial, Helvetica, sans-serif;
  -webkit-text-size-adjust: 100%;
}

.sf-shell {
  width: min(1120px, calc(100% - 24px));
  margin: 0 auto;
  padding: 18px 0 26px;
}

.sf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
  border-radius: 24px;
  background: #ffffff;
  border: 1px solid #e7e7e7;
  box-shadow: 0 18px 45px rgba(0,0,0,.08);
}

.sf-kicker,
.sf-red-label {
  display: inline-flex;
  align-items: center;
  width: max-content;
  max-width: 100%;
  border-radius: 999px;
  background: #d71920;
  color: white;
  padding: 7px 11px;
  font-size: 11px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.sf-header h1 {
  margin: 9px 0 3px;
  font-size: clamp(30px, 5vw, 54px);
  line-height: .95;
  letter-spacing: -0.06em;
  color: #111;
}

.sf-header p {
  margin: 0;
  color: #626262;
  font-weight: 700;
}

.sf-admin-pill {
  appearance: none;
  border: 1px solid #d71920;
  color: #d71920;
  background: white;
  border-radius: 999px;
  padding: 12px 15px;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
  font-size: 14px;
}

.sf-admin-box {
  margin-top: 12px;
  border-radius: 22px;
  border: 1px solid #ffd5d7;
  background: #fff5f5;
  padding: 14px;
}

.sf-admin-login {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

input, textarea, select, button {
  font: inherit;
}

.sf-admin-login input,
.sf-admin-field input,
.sf-admin-item input,
.sf-admin-item textarea,
.sf-bill-input-wrap input,
.sf-mini-input input {
  border: 1px solid #d8d8d8;
  background: #fff;
  color: #111;
  border-radius: 14px;
  padding: 12px 13px;
  min-height: 46px;
  outline: none;
  font-size: 16px;
}

.sf-admin-login button,
.sf-admin-top button,
.sf-admin-add,
.sf-reset {
  border: 0;
  border-radius: 14px;
  background: #d71920;
  color: white;
  font-weight: 900;
  padding: 12px 16px;
  cursor: pointer;
}

.sf-admin-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sf-admin-top h3,
.sf-admin-box h4 {
  margin: 8px 0 10px;
}

.sf-admin-field {
  display: grid;
  gap: 5px;
  margin: 10px 0;
  font-size: 12px;
  font-weight: 900;
  color: #555;
  text-transform: uppercase;
  letter-spacing: .08em;
}

.sf-admin-item {
  display: grid;
  gap: 8px;
  border: 1px solid #e5e5e5;
  background: white;
  border-radius: 18px;
  padding: 12px;
  margin-bottom: 10px;
}

.sf-admin-item textarea {
  min-height: 72px;
  resize: vertical;
}

.sf-danger {
  border: 0;
  border-radius: 12px;
  padding: 10px;
  background: #3b0000;
  color: white;
  font-weight: 900;
}

.sf-admin-add {
  width: 100%;
  margin-bottom: 14px;
}

.sf-reset {
  background: #333;
  width: 100%;
  margin-top: 8px;
}

.sf-steps {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin: 14px 0;
}

.sf-steps button {
  border: 1px solid #e3e3e3;
  background: white;
  color: #4d4d4d;
  border-radius: 16px;
  padding: 12px 8px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.sf-steps button.active {
  background: #d71920;
  border-color: #d71920;
  color: white;
  box-shadow: 0 14px 28px rgba(215,25,32,.22);
}

.sf-card {
  background: white;
  border: 1px solid #e7e7e7;
  border-radius: 30px;
  padding: clamp(18px, 4vw, 34px);
  box-shadow: 0 24px 70px rgba(0,0,0,.10);
  overflow: hidden;
}

.sf-card h2 {
  margin: 14px 0 8px;
  font-size: clamp(34px, 6vw, 68px);
  line-height: .95;
  letter-spacing: -0.075em;
  color: #111;
}

.sf-big-copy {
  margin: 0;
  font-size: clamp(18px, 2.4vw, 25px);
  line-height: 1.28;
  color: #4d4d4d;
  font-weight: 700;
}

.sf-hero-grid {
  display: grid;
  grid-template-columns: 1.2fr .8fr;
  gap: 22px;
  align-items: stretch;
}

.sf-fiber-visual {
  position: relative;
  min-height: 280px;
  border-radius: 28px;
  overflow: hidden;
  background:
    linear-gradient(135deg, #d71920 0%, #a60000 52%, #2a0000 100%);
  color: white;
  display: grid;
  place-items: center;
}

.sf-fiber-visual p {
  position: relative;
  z-index: 4;
  margin-top: 130px;
  font-size: 18px;
  font-weight: 900;
}

.sf-light-beam {
  position: absolute;
  width: 84%;
  height: 16px;
  border-radius: 999px;
  background: rgba(255,255,255,.92);
  box-shadow: 0 0 30px white, 0 0 80px rgba(255,255,255,.7);
  transform: rotate(-18deg);
}

.sf-glass-line {
  position: absolute;
  width: 82%;
  height: 58px;
  border-radius: 999px;
  border: 2px solid rgba(255,255,255,.45);
  transform: rotate(-18deg);
}

.sf-dot {
  position: absolute;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: white;
  box-shadow: 0 0 35px white;
}

.sf-dot.d1 { left: 18%; top: 34%; }
.sf-dot.d2 { left: 49%; top: 43%; }
.sf-dot.d3 { right: 18%; top: 54%; }

.sf-point-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 20px 0;
}

.sf-point {
  border-radius: 22px;
  background: #f5f5f5;
  border: 1px solid #e7e7e7;
  padding: 16px;
  display: grid;
  gap: 7px;
}

.sf-point strong {
  color: #d71920;
  font-size: 18px;
}

.sf-point span {
  color: #555;
  font-weight: 700;
  line-height: 1.35;
}

.sf-primary {
  appearance: none;
  border: 0;
  width: 100%;
  min-height: 58px;
  border-radius: 18px;
  background: #d71920;
  color: white;
  font-size: 18px;
  font-weight: 950;
  cursor: pointer;
  box-shadow: 0 18px 35px rgba(215,25,32,.24);
}

.sf-primary.small {
  width: auto;
  min-height: 48px;
  padding: 0 18px;
}

.sf-bill-input-wrap {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  margin: 24px 0 14px;
  padding: 12px 16px;
  border-radius: 24px;
  border: 2px solid #d71920;
  background: #fff7f7;
}

.sf-bill-input-wrap span {
  font-size: clamp(35px, 7vw, 72px);
  font-weight: 950;
  color: #d71920;
}

.sf-bill-input-wrap input {
  border: 0;
  background: transparent;
  font-size: clamp(45px, 9vw, 92px);
  font-weight: 950;
  letter-spacing: -.08em;
  padding: 0;
  min-height: 90px;
}

.sf-bill-input-wrap small {
  color: #555;
  font-weight: 900;
}

.sf-quick-bills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

.sf-quick-bills button {
  border: 1px solid #e3e3e3;
  border-radius: 999px;
  background: #fff;
  padding: 10px 14px;
  font-weight: 900;
  color: #333;
}

.sf-plan-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin: 18px 0;
}

.sf-plan,
.sf-addon {
  text-align: left;
  border: 2px solid #e7e7e7;
  background: white;
  color: #111;
  border-radius: 24px;
  padding: 18px;
  cursor: pointer;
  min-height: 220px;
}

.sf-plan.active,
.sf-addon.active {
  border-color: #d71920;
  background: #fff5f5;
  box-shadow: 0 18px 40px rgba(215,25,32,.14);
}

.sf-badge {
  display: inline-flex;
  border-radius: 999px;
  background: #111;
  color: white;
  padding: 6px 9px;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: .08em;
}

.sf-plan strong,
.sf-addon strong {
  display: block;
  margin-top: 13px;
  font-size: 24px;
  letter-spacing: -.04em;
}

.sf-plan em {
  display: block;
  margin-top: 4px;
  color: #d71920;
  font-style: normal;
  font-weight: 950;
}

.sf-plan b,
.sf-addon b {
  display: block;
  margin-top: 12px;
  font-size: 36px;
  letter-spacing: -.06em;
}

.sf-plan small,
.sf-addon small {
  font-size: 14px;
  color: #777;
}

.sf-plan p,
.sf-addon span {
  display: block;
  margin-top: 10px;
  color: #5d5d5d;
  font-weight: 700;
  line-height: 1.35;
}

.sf-addon-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin: 18px 0;
}

.sf-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin: 18px 0;
}

.sf-price-card {
  border-radius: 26px;
  padding: 18px;
  border: 1px solid #e7e7e7;
  background: #f7f7f7;
}

.sf-price-card span {
  display: block;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: #6b6b6b;
}

.sf-price-card strong {
  display: block;
  margin-top: 10px;
  font-size: clamp(34px, 5vw, 58px);
  letter-spacing: -.08em;
}

.sf-price-card small {
  color: #686868;
  font-weight: 900;
}

.sf-price-card.new {
  background: #111;
  color: white;
}

.sf-price-card.new span,
.sf-price-card.new small {
  color: rgba(255,255,255,.7);
}

.sf-price-card.save {
  background: #d71920;
  color: white;
}

.sf-price-card.higher {
  background: #f5c542;
  color: #111;
}

.sf-price-card.save span,
.sf-price-card.save small {
  color: rgba(255,255,255,.78);
}

.sf-mini-input {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: end;
  gap: 2px;
  margin-top: 10px;
}

.sf-mini-input b {
  font-size: 35px;
  color: #d71920;
}

.sf-mini-input input {
  min-width: 0;
  border: 0;
  background: transparent;
  font-size: clamp(34px, 5vw, 58px);
  font-weight: 950;
  letter-spacing: -.08em;
  padding: 0;
}

.sf-savings-strip {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin: 14px 0;
}

.sf-savings-strip div {
  border-radius: 26px;
  background: #fff5f5;
  border: 1px solid #ffd6d8;
  padding: 20px;
}

.sf-savings-strip span,
.sf-savings-strip small {
  display: block;
  color: #666;
  font-weight: 900;
}

.sf-savings-strip strong {
  display: block;
  margin: 6px 0;
  font-size: clamp(42px, 7vw, 82px);
  color: #d71920;
  letter-spacing: -.09em;
}

.sf-package,
.sf-notes {
  border-radius: 24px;
  background: #f7f7f7;
  border: 1px solid #e7e7e7;
  padding: 16px;
  margin-top: 14px;
}

.sf-package h3 {
  margin: 0 0 8px;
  font-size: 22px;
}

.sf-package p,
.sf-notes p {
  margin: 7px 0;
  color: #4d4d4d;
  font-weight: 700;
}

.sf-bottom-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.sf-bottom-actions button {
  border: 1px solid #d9d9d9;
  background: white;
  color: #333;
  border-radius: 16px;
  padding: 13px 16px;
  font-weight: 900;
}

.sf-bottom-actions .sf-primary {
  background: #d71920;
  color: white;
  border: 0;
}

.sf-footer {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  color: #777;
  font-size: 12px;
  font-weight: 700;
  padding: 14px 4px 0;
}

.sf-loading {
  min-height: 100vh;
  display: grid;
  place-items: center;
  color: #d71920;
  font-size: 28px;
  font-weight: 950;
}

@media (max-width: 820px) {
  .sf-shell {
    width: min(100% - 16px, 1120px);
    padding-top: 8px;
  }

  .sf-header {
    align-items: flex-start;
    flex-direction: column;
    border-radius: 20px;
  }

  .sf-admin-pill {
    width: 100%;
  }

  .sf-steps {
    grid-template-columns: repeat(5, minmax(118px, 1fr));
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .sf-steps button {
    white-space: nowrap;
  }

  .sf-hero-grid,
  .sf-point-grid,
  .sf-plan-grid,
  .sf-addon-grid,
  .sf-summary-grid,
  .sf-savings-strip {
    grid-template-columns: 1fr;
  }

  .sf-fiber-visual {
    min-height: 210px;
  }

  .sf-plan,
  .sf-addon {
    min-height: 0;
  }

  .sf-footer {
    flex-direction: column;
  }
}
`;
