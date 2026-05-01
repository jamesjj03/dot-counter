"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const CLOUD_TABLE = "app_state";
const CLOUD_ID = "sales_page_settings_v2";
const LOCAL_KEY = "frontier_sales_page_settings_v2";
const PIN = "6969";

function uid() {
  try {
    if (
      typeof window !== "undefined" &&
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }
  } catch (e) {}
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

function money(value) {
  const n = Number(value || 0);
  return "$" + n.toFixed(2);
}

function cleanNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseMoneyInput(value) {
  const raw = String(value || "").replace(/[^0-9.]/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function safeJsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

const DEFAULT_SETTINGS = {
  title: "Fiber Internet",
  eyebrow: "Quote helper",
  subline: "Built for faster, steadier, cleaner home internet.",
  primaryPlanId: "gig",
  fiberPoints: [
    {
      title: "Faster where it matters",
      metric: "up to multi-gig speeds",
      body:
        "Fiber gives the home more headroom for streaming, gaming, school, work, smart TVs, cameras, and everyone being online at once.",
    },
    {
      title: "More reliable connection",
      metric: "built on fiber lines",
      body:
        "Fiber is designed for a steadier connection than older cable-style internet that can slow down when the neighborhood gets busy.",
    },
    {
      title: "Symmetrical power",
      metric: "fast uploads + downloads",
      body:
        "Fiber can send and receive data fast, which helps video calls, uploads, cloud backups, gaming, work files, and smart-home devices.",
    },
  ],
  contrastCards: [
    {
      oldTitle: "Old cable/coax internet",
      oldBody:
        "Shared neighborhood capacity, slower uploads, and more slowdown when everyone nearby is streaming at the same time.",
      newTitle: "Fiber connection",
      newBody:
        "A direct fiber-based connection with more bandwidth, stronger uploads, and better performance for modern homes.",
    },
  ],
  plans: [
    {
      id: "fivehundred",
      name: "Fiber 500",
      speed: "500 Mbps",
      price: 34.99,
      badge: "Starter option",
      description:
        "A lower-cost option for lighter homes. Good for everyday browsing, phones, laptops, and simple streaming.",
      featured: false,
    },
    {
      id: "gig",
      name: "Fiber 1 Gig",
      speed: "1 Gig",
      price: 49.99,
      badge: "Most common • best value",
      description:
        "The main recommendation for most homes. Built for streaming, gaming, smart devices, work-from-home, and multiple people online without feeling squeezed.",
      featured: true,
    },
    {
      id: "twogig",
      name: "Fiber 2 Gig",
      speed: "2 Gig",
      price: 64.99,
      badge: "Power home",
      description:
        "For heavier homes that want extra headroom for gaming, 4K streaming, smart devices, work, and larger households.",
      featured: false,
    },
    {
      id: "fivegig",
      name: "Fiber 5 Gig",
      speed: "5 Gig",
      price: 89.99,
      badge: "Maximum headroom",
      description:
        "For homes that want serious speed capacity, heavy downloads, high-end gaming, home offices, and lots of devices running at once.",
      featured: false,
    },
    {
      id: "sevengig",
      name: "Fiber 7 Gig",
      speed: "7 Gig",
      price: 109.99,
      badge: "Top-tier option",
      description:
        "The fastest available tier for customers who want the biggest connection, the most headroom, and the strongest future-proof setup.",
      featured: false,
    },
  ],
  addons: [
    {
      id: "landline",
      name: "Landline",
      price: 25,
      description: "Keep a home phone option if needed.",
      category: "Home",
    },
    {
      id: "youtube",
      name: "YouTube TV",
      price: 82.99,
      description: "Live TV option without traditional cable boxes.",
      category: "TV",
    },
    {
      id: "extender",
      name: "Wi-Fi Extender",
      price: 10,
      description: "Helps coverage in larger homes or tougher layouts.",
      category: "Wi-Fi",
    },
    {
      id: "security",
      name: "Wi-Fi Security",
      price: 6,
      description:
        "Extra network security protection for connected devices in the home.",
      category: "Wi-Fi",
    },
  ],
  phone: {
    enabled: true,
    title: "Mobile phone plans",
    lineLabel: "Phone lines",
    basePricePerLine: 29.99,
    verizonDiscountPerLine: 10,
    verizonDiscountLabel: "Verizon customer savings",
    description:
      "Add mobile lines to the quote and show the extra monthly savings if the customer qualifies for the Verizon-linked discount.",
    plans: [
      {
        id: "mobile-basic",
        name: "Mobile Line",
        price: 29.99,
        description:
          "Estimated monthly phone line option. Update this once Sam or Zach confirms the exact mobile pricing.",
      },
    ],
  },
  disclaimer:
    "Quote helper only. Address availability, taxes, fees, installation, autopay, promotions, mobile discounts, and final order details must be confirmed.",
};

async function loadCloudSettings() {
  if (!supabase) return null;
  try {
    const res = await supabase
      .from(CLOUD_TABLE)
      .select("data")
      .eq("id", CLOUD_ID)
      .single();
    if (res.error) return null;
    return res.data && res.data.data ? res.data.data : null;
  } catch (e) {
    return null;
  }
}

async function saveCloudSettings(settings) {
  if (!supabase) {
    return { ok: false, error: "Missing Supabase environment variables." };
  }

  try {
    const res = await supabase.from(CLOUD_TABLE).upsert({
      id: CLOUD_ID,
      data: safeJsonClone(settings),
      updated_at: new Date().toISOString(),
    });

    if (res.error) {
      return { ok: false, error: res.error.message || "Cloud save failed." };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : "Cloud save failed." };
  }
}

function loadLocalSettings() {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveLocalSettings(settings) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(settings));
  } catch (e) {}
}

function mergeSettings(incoming) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(incoming || {}),
    phone: {
      ...DEFAULT_SETTINGS.phone,
      ...((incoming && incoming.phone) || {}),
      plans:
        incoming && incoming.phone && Array.isArray(incoming.phone.plans)
          ? incoming.phone.plans
          : DEFAULT_SETTINGS.phone.plans,
    },
    plans:
      incoming && Array.isArray(incoming.plans)
        ? incoming.plans
        : DEFAULT_SETTINGS.plans,
    addons:
      incoming && Array.isArray(incoming.addons)
        ? incoming.addons
        : DEFAULT_SETTINGS.addons,
    fiberPoints:
      incoming && Array.isArray(incoming.fiberPoints)
        ? incoming.fiberPoints
        : DEFAULT_SETTINGS.fiberPoints,
    contrastCards:
      incoming && Array.isArray(incoming.contrastCards)
        ? incoming.contrastCards
        : DEFAULT_SETTINGS.contrastCards,
  };

  if (!merged.primaryPlanId && merged.plans[0]) {
    merged.primaryPlanId = merged.plans[0].id;
  }

  return merged;
}

export default function SalesPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [saveStatus, setSaveStatus] = useState("loading");
  const [error, setError] = useState("");
  const [step, setStep] = useState("fiber");
  const [currentBill, setCurrentBill] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState(DEFAULT_SETTINGS.primaryPlanId);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [phoneLines, setPhoneLines] = useState(0);
  const [isVerizonCustomer, setIsVerizonCustomer] = useState(false);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const local = loadLocalSettings();
      if (local && !cancelled) {
        const mergedLocal = mergeSettings(local);
        setSettings(mergedLocal);
        setSelectedPlanId(mergedLocal.primaryPlanId || mergedLocal.plans[0]?.id || "");
        setSaveStatus("local loaded");
      }

      const cloud = await loadCloudSettings();
      if (!cancelled && cloud) {
        const mergedCloud = mergeSettings(cloud);
        setSettings(mergedCloud);
        setSelectedPlanId(mergedCloud.primaryPlanId || mergedCloud.plans[0]?.id || "");
        saveLocalSettings(mergedCloud);
        setSaveStatus("cloud live");
      } else if (!cancelled && !cloud) {
        setSaveStatus(supabase ? "cloud empty" : "local only");
      }

      if (!cancelled) setLoaded(true);
    }

    boot();

    const failsafe = setTimeout(() => {
      if (!cancelled) {
        setLoaded(true);
        setSaveStatus((old) => (old === "loading" ? "safe mode" : old));
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearTimeout(failsafe);
    };
  }, []);

  useEffect(() => {
    saveLocalSettings(settings);

    if (!adminUnlocked) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    setSaveStatus("saving...");
    saveTimerRef.current = setTimeout(async () => {
      const result = await saveCloudSettings(settings);
      if (result.ok) {
        setSaveStatus("cloud saved");
        setError("");
      } else {
        setSaveStatus("local saved");
        setError(result.error || "Cloud save failed.");
      }
    }, 700);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [settings, adminUnlocked]);

  const selectedPlan = useMemo(() => {
    return (
      settings.plans.find((plan) => plan.id === selectedPlanId) ||
      settings.plans.find((plan) => plan.id === settings.primaryPlanId) ||
      settings.plans[0] ||
      null
    );
  }, [settings.plans, settings.primaryPlanId, selectedPlanId]);

  const addonTotal = useMemo(() => {
    return settings.addons
      .filter((addon) => selectedAddons.indexOf(addon.id) !== -1)
      .reduce((sum, addon) => sum + cleanNumber(addon.price), 0);
  }, [settings.addons, selectedAddons]);

  const phonePricePerLine =
    settings.phone.plans && settings.phone.plans[0]
      ? cleanNumber(settings.phone.plans[0].price)
      : cleanNumber(settings.phone.basePricePerLine);

  const phoneSubtotal = phoneLines * phonePricePerLine;
  const verizonSavings =
    isVerizonCustomer && phoneLines > 0
      ? phoneLines * cleanNumber(settings.phone.verizonDiscountPerLine)
      : 0;

  const phoneFinal = Math.max(0, phoneSubtotal - verizonSavings);
  const ourMonthly =
    cleanNumber(selectedPlan && selectedPlan.price) + addonTotal + phoneFinal;
  const currentMonthly = parseMoneyInput(currentBill);
  const monthlySavings = currentMonthly > 0 ? currentMonthly - ourMonthly : 0;
  const annualSavings = monthlySavings * 12;
  const threeYearSavings = monthlySavings * 36;

  const unlockAdmin = () => {
    if (pin.trim() === PIN) {
      setAdminUnlocked(true);
      setAdminOpen(true);
      setPin("");
      setError("");
      return;
    }
    setError("Wrong PIN.");
  };

  const resetDefaults = () => {
    const fresh = safeJsonClone(DEFAULT_SETTINGS);
    setSettings(fresh);
    setSelectedPlanId(fresh.primaryPlanId);
    setSelectedAddons([]);
    setPhoneLines(0);
    setIsVerizonCustomer(false);
  };

  if (!loaded) {
    return (
      <main className="sales-shell">
        <GlobalStyles />
        <section className="loader-card">
          <div className="brand-mark">Fiber Internet</div>
          <p>Loading quote helper...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="sales-shell">
      <GlobalStyles />

      <header className="topbar">
        <div>
          <div className="micro">{settings.eyebrow}</div>
          <div className="logo-text">{settings.title}</div>
          <p className="subline">{settings.subline}</p>
        </div>

        <div className="admin-wrap">
          {!adminOpen ? (
            <button className="ghost-admin" onClick={() => setAdminOpen(true)}>
              Settings
            </button>
          ) : !adminUnlocked ? (
            <div className="pin-box">
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && unlockAdmin()}
                placeholder="PIN"
                inputMode="numeric"
              />
              <button onClick={unlockAdmin}>Unlock</button>
              <button className="plain" onClick={() => setAdminOpen(false)}>
                Hide
              </button>
            </div>
          ) : (
            <div className="admin-status">
              <span>Pricing unlocked</span>
              <button onClick={() => setAdminOpen(!adminOpen)}>
                {adminOpen ? "Done" : "Settings"}
              </button>
            </div>
          )}
        </div>
      </header>

      {adminUnlocked && adminOpen ? (
        <AdminEditor
          settings={settings}
          setSettings={(next) => {
            const merged = mergeSettings(next);
            setSettings(merged);
            if (!merged.plans.find((p) => p.id === selectedPlanId)) {
              setSelectedPlanId(merged.primaryPlanId || merged.plans[0]?.id || "");
            }
          }}
          resetDefaults={resetDefaults}
          saveStatus={saveStatus}
          error={error}
        />
      ) : (
        <>
          <nav className="flow-nav">
            <FlowButton step="fiber" active={step} setStep={setStep} label="1. Fiber" />
            <FlowButton step="bill" active={step} setStep={setStep} label="2. Bill" />
            <FlowButton step="plans" active={step} setStep={setStep} label="3. Plans" />
            <FlowButton step="options" active={step} setStep={setStep} label="4. Options" />
            <FlowButton step="savings" active={step} setStep={setStep} label="5. Savings" />
          </nav>

          {step === "fiber" && (
            <FiberStep
              settings={settings}
              setStep={setStep}
            />
          )}

          {step === "bill" && (
            <BillStep
              currentBill={currentBill}
              setCurrentBill={setCurrentBill}
              setStep={setStep}
            />
          )}

          {step === "plans" && (
            <PlansStep
              settings={settings}
              selectedPlanId={selectedPlanId}
              setSelectedPlanId={setSelectedPlanId}
              setStep={setStep}
            />
          )}

          {step === "options" && (
            <OptionsStep
              settings={settings}
              selectedAddons={selectedAddons}
              setSelectedAddons={setSelectedAddons}
              phoneLines={phoneLines}
              setPhoneLines={setPhoneLines}
              isVerizonCustomer={isVerizonCustomer}
              setIsVerizonCustomer={setIsVerizonCustomer}
              phonePricePerLine={phonePricePerLine}
              verizonSavings={verizonSavings}
              phoneFinal={phoneFinal}
              setStep={setStep}
            />
          )}

          {step === "savings" && (
            <SavingsStep
              settings={settings}
              currentMonthly={currentMonthly}
              selectedPlan={selectedPlan}
              addonTotal={addonTotal}
              phoneLines={phoneLines}
              phonePricePerLine={phonePricePerLine}
              phoneSubtotal={phoneSubtotal}
              isVerizonCustomer={isVerizonCustomer}
              verizonSavings={verizonSavings}
              phoneFinal={phoneFinal}
              ourMonthly={ourMonthly}
              monthlySavings={monthlySavings}
              annualSavings={annualSavings}
              threeYearSavings={threeYearSavings}
              setStep={setStep}
            />
          )}

          <footer className="disclaimer">{settings.disclaimer}</footer>
        </>
      )}
    </main>
  );
}

function FlowButton({ step, active, setStep, label }) {
  return (
    <button
      className={active === step ? "flow-btn active" : "flow-btn"}
      onClick={() => setStep(step)}
    >
      {label}
    </button>
  );
}

function FiberStep({ settings, setStep }) {
  return (
    <section className="hero-grid">
      <div className="hero-card">
        <div className="label-red">Why fiber feels different</div>
        <h1>Built for the way homes actually use internet now.</h1>
        <p>
          More devices. More streaming. More video calls. More gaming. More smart
          home stuff running all day. Fiber gives the house room to breathe.
        </p>

        <div className="signal-visual">
          <div className="old-side">
            <span>coax/cable</span>
            <div className="traffic-lines">
              <i></i>
              <i></i>
              <i></i>
            </div>
            <p>Shared capacity. Slower uploads. More bottlenecks.</p>
          </div>
          <div className="vs-pill">VS</div>
          <div className="new-side">
            <span>fiber</span>
            <div className="fiber-beam">
              <i></i>
              <i></i>
              <i></i>
            </div>
            <p>More speed. Better reliability. Strong upload power.</p>
          </div>
        </div>

        <button className="primary-action" onClick={() => setStep("bill")}>
          Compare their bill
        </button>
      </div>

      <div className="impact-stack">
        {settings.fiberPoints.map((point, index) => (
          <div className="impact-card" key={index}>
            <div className="impact-number">0{index + 1}</div>
            <h3>{point.title}</h3>
            <strong>{point.metric}</strong>
            <p>{point.body}</p>
          </div>
        ))}
      </div>

      <div className="contrast-card">
        {settings.contrastCards.map((card, index) => (
          <div className="contrast-row" key={index}>
            <div className="contrast-bad">
              <h3>{card.oldTitle}</h3>
              <p>{card.oldBody}</p>
            </div>
            <div className="contrast-good">
              <h3>{card.newTitle}</h3>
              <p>{card.newBody}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BillStep({ currentBill, setCurrentBill, setStep }) {
  const current = parseMoneyInput(currentBill);
  return (
    <section className="center-stage">
      <div className="big-card">
        <div className="label-red">Current bill</div>
        <h1>What are they paying now?</h1>
        <p>
          Start with their number. Then the rest of the page turns it into a clean
          monthly, yearly, and three-year comparison.
        </p>

        <div className="bill-input-wrap">
          <span>$</span>
          <input
            value={currentBill}
            onChange={(e) => setCurrentBill(e.target.value)}
            inputMode="decimal"
            placeholder="100"
          />
        </div>

        <div className="quick-bills">
          {[70, 85, 100, 120, 150, 180].map((value) => (
            <button key={value} onClick={() => setCurrentBill(String(value))}>
              ${value}
            </button>
          ))}
        </div>

        <div className="preview-strip">
          <span>Current monthly:</span>
          <strong>{money(current)}</strong>
        </div>

        <button className="primary-action" onClick={() => setStep("plans")}>
          Pick fiber plan
        </button>
      </div>
    </section>
  );
}

function PlansStep({ settings, selectedPlanId, setSelectedPlanId, setStep }) {
  return (
    <section className="plans-stage">
      <div className="section-heading">
        <div className="label-red">Plans</div>
        <h1>Lead with the plan that makes the most sense.</h1>
        <p>
          1 Gig is marked as the main recommendation because that is the common
          switch and best value.
        </p>
      </div>

      <div className="plan-grid">
        {settings.plans.map((plan) => {
          const active = selectedPlanId === plan.id;
          return (
            <button
              key={plan.id}
              className={active ? "plan-card active" : plan.featured ? "plan-card featured" : "plan-card"}
              onClick={() => setSelectedPlanId(plan.id)}
            >
              {plan.featured && <div className="featured-ribbon">Main pick</div>}
              <div className="plan-topline">
                <span>{plan.badge}</span>
                <strong>{plan.speed}</strong>
              </div>
              <h2>{plan.name}</h2>
              <div className="price-line">
                <span>{money(plan.price)}</span>
                <small>/mo</small>
              </div>
              <p>{plan.description}</p>
            </button>
          );
        })}
      </div>

      <button className="primary-action wide" onClick={() => setStep("options")}>
        Add options
      </button>
    </section>
  );
}

function OptionsStep({
  settings,
  selectedAddons,
  setSelectedAddons,
  phoneLines,
  setPhoneLines,
  isVerizonCustomer,
  setIsVerizonCustomer,
  phonePricePerLine,
  verizonSavings,
  phoneFinal,
  setStep,
}) {
  const toggleAddon = (id) => {
    if (selectedAddons.indexOf(id) !== -1) {
      setSelectedAddons(selectedAddons.filter((x) => x !== id));
    } else {
      setSelectedAddons([...selectedAddons, id]);
    }
  };

  return (
    <section className="options-stage">
      <div className="section-heading">
        <div className="label-red">Options</div>
        <h1>Add only what they actually need.</h1>
        <p>
          Internet first. Then add phone, TV, landline, or Wi-Fi help only if it
          fits the house.
        </p>
      </div>

      <div className="option-grid">
        {settings.addons.map((addon) => {
          const active = selectedAddons.indexOf(addon.id) !== -1;
          return (
            <button
              key={addon.id}
              className={active ? "option-card active" : "option-card"}
              onClick={() => toggleAddon(addon.id)}
            >
              <span>{addon.category || "Option"}</span>
              <h2>{addon.name}</h2>
              <strong>{money(addon.price)}/mo</strong>
              <p>{addon.description}</p>
            </button>
          );
        })}
      </div>

      {settings.phone.enabled && (
        <div className="phone-module">
          <div>
            <div className="label-red">Mobile</div>
            <h2>{settings.phone.title}</h2>
            <p>{settings.phone.description}</p>
          </div>

          <div className="phone-controls">
            <div className="line-stepper">
              <button onClick={() => setPhoneLines(Math.max(0, phoneLines - 1))}>
                −
              </button>
              <div>
                <strong>{phoneLines}</strong>
                <span>{settings.phone.lineLabel}</span>
              </div>
              <button onClick={() => setPhoneLines(phoneLines + 1)}>+</button>
            </div>

            <button
              className={isVerizonCustomer ? "verizon-toggle active" : "verizon-toggle"}
              onClick={() => setIsVerizonCustomer(!isVerizonCustomer)}
            >
              Verizon customer discount
            </button>
          </div>

          <div className="phone-math">
            <div>
              <span>Phone estimate</span>
              <strong>
                {phoneLines} × {money(phonePricePerLine)}
              </strong>
            </div>
            <div>
              <span>{settings.phone.verizonDiscountLabel}</span>
              <strong>-{money(verizonSavings)}/mo</strong>
            </div>
            <div className="total-row">
              <span>Phone monthly</span>
              <strong>{money(phoneFinal)}/mo</strong>
            </div>
          </div>
        </div>
      )}

      <button className="primary-action wide" onClick={() => setStep("savings")}>
        Show savings
      </button>
    </section>
  );
}

function SavingsStep({
  settings,
  currentMonthly,
  selectedPlan,
  addonTotal,
  phoneLines,
  phonePricePerLine,
  phoneSubtotal,
  isVerizonCustomer,
  verizonSavings,
  phoneFinal,
  ourMonthly,
  monthlySavings,
  annualSavings,
  threeYearSavings,
  setStep,
}) {
  const saving = monthlySavings > 0;
  return (
    <section className="savings-stage">
      <div className="savings-main">
        <div className="label-red">Savings</div>
        <h1>{saving ? "That is the money difference." : "Here is the clean comparison."}</h1>

        <div className="comparison-bars">
          <div className="bar old">
            <span>Current bill</span>
            <strong>{money(currentMonthly)}</strong>
          </div>
          <div className="bar new">
            <span>New quote</span>
            <strong>{money(ourMonthly)}</strong>
          </div>
        </div>

        <div className={saving ? "mega-save positive" : "mega-save"}>
          <span>Monthly difference</span>
          <strong>{money(monthlySavings)}</strong>
        </div>

        <div className="savings-grid">
          <div>
            <span>1 year</span>
            <strong>{money(annualSavings)}</strong>
          </div>
          <div>
            <span>3 years</span>
            <strong>{money(threeYearSavings)}</strong>
          </div>
        </div>

        <button className="secondary-action" onClick={() => setStep("bill")}>
          Change bill
        </button>
      </div>

      <div className="quote-breakdown">
        <h2>Quote breakdown</h2>
        <Line label={selectedPlan ? selectedPlan.name : "Internet"} value={money(selectedPlan ? selectedPlan.price : 0)} />
        <Line label="Selected add-ons" value={money(addonTotal)} />
        <Line
          label={
            phoneLines > 0
              ? "Mobile lines (" + phoneLines + " × " + money(phonePricePerLine) + ")"
              : "Mobile lines"
          }
          value={money(phoneSubtotal)}
        />
        <Line
          label={isVerizonCustomer ? settings.phone.verizonDiscountLabel : "Mobile discount"}
          value={"-" + money(verizonSavings)}
        />
        <Line label="Mobile final" value={money(phoneFinal)} />
        <div className="quote-total">
          <span>Total monthly quote</span>
          <strong>{money(ourMonthly)}</strong>
        </div>
      </div>
    </section>
  );
}

function Line({ label, value }) {
  return (
    <div className="line-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AdminEditor({ settings, setSettings, resetDefaults, saveStatus, error }) {
  const update = (patch) => setSettings({ ...settings, ...patch });

  const updatePlan = (id, patch) => {
    const nextPlans = settings.plans.map((plan) =>
      plan.id === id ? { ...plan, ...patch } : plan
    );

    setSettings({
      ...settings,
      plans: nextPlans,
      primaryPlanId:
        patch.featured === true ? id : settings.primaryPlanId,
    });
  };

  const markPrimary = (id) => {
    setSettings({
      ...settings,
      primaryPlanId: id,
      plans: settings.plans.map((plan) => ({
        ...plan,
        featured: plan.id === id,
        badge: plan.id === id ? "Most common • best value" : plan.badge,
      })),
    });
  };

  const addPlan = () => {
    const id = uid();
    setSettings({
      ...settings,
      plans: [
        ...settings.plans,
        {
          id,
          name: "New Plan",
          speed: "Speed",
          price: 0,
          badge: "Option",
          description: "Plan details.",
          featured: false,
        },
      ],
    });
  };

  const removePlan = (id) => {
    const plans = settings.plans.filter((plan) => plan.id !== id);
    setSettings({
      ...settings,
      plans,
      primaryPlanId:
        settings.primaryPlanId === id ? plans[0]?.id || "" : settings.primaryPlanId,
    });
  };

  const updateAddon = (id, patch) => {
    setSettings({
      ...settings,
      addons: settings.addons.map((addon) =>
        addon.id === id ? { ...addon, ...patch } : addon
      ),
    });
  };

  const addAddon = () => {
    setSettings({
      ...settings,
      addons: [
        ...settings.addons,
        {
          id: uid(),
          name: "New Add-on",
          price: 0,
          description: "Add-on details.",
          category: "Option",
        },
      ],
    });
  };

  const removeAddon = (id) => {
    setSettings({
      ...settings,
      addons: settings.addons.filter((addon) => addon.id !== id),
    });
  };

  const updateFiberPoint = (index, patch) => {
    setSettings({
      ...settings,
      fiberPoints: settings.fiberPoints.map((point, i) =>
        i === index ? { ...point, ...patch } : point
      ),
    });
  };

  const updateContrast = (index, patch) => {
    setSettings({
      ...settings,
      contrastCards: settings.contrastCards.map((card, i) =>
        i === index ? { ...card, ...patch } : card
      ),
    });
  };

  const updatePhone = (patch) => {
    setSettings({
      ...settings,
      phone: { ...settings.phone, ...patch },
    });
  };

  const updatePhonePlan = (index, patch) => {
    updatePhone({
      plans: settings.phone.plans.map((plan, i) =>
        i === index ? { ...plan, ...patch } : plan
      ),
    });
  };

  return (
    <section className="admin-panel">
      <div className="admin-head">
        <div>
          <h1>Pricing/settings</h1>
          <p>
            Changes save locally instantly and cloud-save when Supabase is connected.
          </p>
        </div>
        <div className="save-pill">
          {saveStatus}
          {error ? <small>{error}</small> : null}
        </div>
      </div>

      <AdminSection title="Header">
        <Field
          label="Page title"
          value={settings.title}
          onChange={(v) => update({ title: v })}
        />
        <Field
          label="Small label"
          value={settings.eyebrow}
          onChange={(v) => update({ eyebrow: v })}
        />
        <TextField
          label="Header line"
          value={settings.subline}
          onChange={(v) => update({ subline: v })}
        />
      </AdminSection>

      <AdminSection title="Fiber visuals">
        {settings.fiberPoints.map((point, index) => (
          <div className="admin-card" key={index}>
            <Field
              label="Title"
              value={point.title}
              onChange={(v) => updateFiberPoint(index, { title: v })}
            />
            <Field
              label="Metric"
              value={point.metric}
              onChange={(v) => updateFiberPoint(index, { metric: v })}
            />
            <TextField
              label="Body"
              value={point.body}
              onChange={(v) => updateFiberPoint(index, { body: v })}
            />
          </div>
        ))}

        {settings.contrastCards.map((card, index) => (
          <div className="admin-card" key={"contrast-" + index}>
            <Field
              label="Old connection title"
              value={card.oldTitle}
              onChange={(v) => updateContrast(index, { oldTitle: v })}
            />
            <TextField
              label="Old connection body"
              value={card.oldBody}
              onChange={(v) => updateContrast(index, { oldBody: v })}
            />
            <Field
              label="Fiber title"
              value={card.newTitle}
              onChange={(v) => updateContrast(index, { newTitle: v })}
            />
            <TextField
              label="Fiber body"
              value={card.newBody}
              onChange={(v) => updateContrast(index, { newBody: v })}
            />
          </div>
        ))}
      </AdminSection>

      <AdminSection title="Plans">
        {settings.plans.map((plan) => (
          <div className={plan.featured ? "admin-card primary-plan-admin" : "admin-card"} key={plan.id}>
            <div className="admin-row">
              <Field
                label="Plan name"
                value={plan.name}
                onChange={(v) => updatePlan(plan.id, { name: v })}
              />
              <Field
                label="Speed"
                value={plan.speed}
                onChange={(v) => updatePlan(plan.id, { speed: v })}
              />
              <MoneyField
                label="Price"
                value={plan.price}
                onChange={(v) => updatePlan(plan.id, { price: v })}
              />
            </div>
            <Field
              label="Badge"
              value={plan.badge}
              onChange={(v) => updatePlan(plan.id, { badge: v })}
            />
            <TextField
              label="Plan details"
              value={plan.description}
              onChange={(v) => updatePlan(plan.id, { description: v })}
            />
            <div className="admin-actions-row">
              <button onClick={() => markPrimary(plan.id)}>
                {plan.featured ? "Main plan selected" : "Make main plan"}
              </button>
              <button className="danger" onClick={() => removePlan(plan.id)}>
                Remove plan
              </button>
            </div>
          </div>
        ))}
        <button className="admin-add" onClick={addPlan}>
          Add plan
        </button>
      </AdminSection>

      <AdminSection title="Add-ons">
        {settings.addons.map((addon) => (
          <div className="admin-card" key={addon.id}>
            <div className="admin-row">
              <Field
                label="Name"
                value={addon.name}
                onChange={(v) => updateAddon(addon.id, { name: v })}
              />
              <Field
                label="Category"
                value={addon.category || ""}
                onChange={(v) => updateAddon(addon.id, { category: v })}
              />
              <MoneyField
                label="Price"
                value={addon.price}
                onChange={(v) => updateAddon(addon.id, { price: v })}
              />
            </div>
            <TextField
              label="Details"
              value={addon.description}
              onChange={(v) => updateAddon(addon.id, { description: v })}
            />
            <button className="danger" onClick={() => removeAddon(addon.id)}>
              Remove add-on
            </button>
          </div>
        ))}
        <button className="admin-add" onClick={addAddon}>
          Add add-on
        </button>
      </AdminSection>

      <AdminSection title="Phone plans / Verizon savings">
        <div className="admin-card">
          <label className="check-row">
            <input
              type="checkbox"
              checked={!!settings.phone.enabled}
              onChange={(e) => updatePhone({ enabled: e.target.checked })}
            />
            Enable phone module
          </label>
          <Field
            label="Phone section title"
            value={settings.phone.title}
            onChange={(v) => updatePhone({ title: v })}
          />
          <TextField
            label="Phone description"
            value={settings.phone.description}
            onChange={(v) => updatePhone({ description: v })}
          />
          <Field
            label="Line label"
            value={settings.phone.lineLabel}
            onChange={(v) => updatePhone({ lineLabel: v })}
          />
          <MoneyField
            label="Verizon discount per line"
            value={settings.phone.verizonDiscountPerLine}
            onChange={(v) => updatePhone({ verizonDiscountPerLine: v })}
          />
          <Field
            label="Discount label"
            value={settings.phone.verizonDiscountLabel}
            onChange={(v) => updatePhone({ verizonDiscountLabel: v })}
          />
        </div>

        {settings.phone.plans.map((plan, index) => (
          <div className="admin-card" key={plan.id || index}>
            <Field
              label="Phone plan name"
              value={plan.name}
              onChange={(v) => updatePhonePlan(index, { name: v })}
            />
            <MoneyField
              label="Phone price per line"
              value={plan.price}
              onChange={(v) => updatePhonePlan(index, { price: v })}
            />
            <TextField
              label="Phone plan details"
              value={plan.description}
              onChange={(v) => updatePhonePlan(index, { description: v })}
            />
          </div>
        ))}
      </AdminSection>

      <AdminSection title="Legal/footer">
        <TextField
          label="Disclaimer"
          value={settings.disclaimer}
          onChange={(v) => update({ disclaimer: v })}
        />
      </AdminSection>

      <button className="reset-btn" onClick={resetDefaults}>
        Reset defaults
      </button>
    </section>
  );
}

function AdminSection({ title, children }) {
  return (
    <div className="admin-section">
      <h2>{title}</h2>
      <div className="admin-section-body">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function MoneyField({ label, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={value}
        inputMode="decimal"
        onChange={(e) => onChange(parseMoneyInput(e.target.value))}
      />
    </label>
  );
}

function TextField({ label, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
    </label>
  );
}

function GlobalStyles() {
  return (
    <style jsx global>{`
      html,
      body {
        margin: 0;
        background: #f7f7f7;
      }

      * {
        box-sizing: border-box;
      }

      button,
      input,
      textarea,
      select {
        font: inherit;
      }

      button {
        cursor: pointer;
      }

      .sales-shell {
        min-height: 100vh;
        background:
          radial-gradient(circle at 20% 0%, rgba(212, 0, 0, 0.12), transparent 32rem),
          linear-gradient(180deg, #ffffff 0%, #f5f5f5 45%, #ededed 100%);
        color: #161616;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        padding: 18px;
      }

      .loader-card {
        width: min(520px, 92vw);
        margin: 15vh auto;
        border-radius: 28px;
        background: white;
        padding: 36px;
        text-align: center;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.16);
      }

      .brand-mark,
      .logo-text {
        color: #d71920;
        font-weight: 1000;
        letter-spacing: -0.07em;
        line-height: 0.9;
        text-transform: uppercase;
      }

      .logo-text {
        font-size: clamp(2.4rem, 7vw, 5.7rem);
        text-shadow: 0 5px 0 rgba(215, 25, 32, 0.09);
      }

      .brand-mark {
        font-size: 3rem;
      }

      .topbar {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: flex-start;
        max-width: 1260px;
        margin: 0 auto 18px;
        border: 1px solid rgba(215, 25, 32, 0.12);
        background: rgba(255, 255, 255, 0.92);
        border-radius: 30px;
        padding: 22px;
        box-shadow: 0 18px 60px rgba(0, 0, 0, 0.08);
      }

      .micro,
      .label-red {
        color: #d71920;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-weight: 950;
        font-size: 0.78rem;
      }

      .subline {
        margin: 8px 0 0;
        color: #4c4c4c;
        font-weight: 750;
        font-size: 1rem;
      }

      .admin-wrap {
        min-width: 190px;
        display: flex;
        justify-content: flex-end;
      }

      .ghost-admin {
        border: 0;
        background: transparent;
        color: rgba(0, 0, 0, 0.35);
        font-size: 0.78rem;
        font-weight: 850;
        padding: 8px 10px;
      }

      .pin-box {
        display: grid;
        gap: 7px;
        grid-template-columns: 1fr auto auto;
        background: #f4f4f4;
        border-radius: 16px;
        padding: 6px;
      }

      .pin-box input {
        min-width: 70px;
        border: 1px solid #ddd;
        background: white;
        border-radius: 12px;
        padding: 9px 10px;
      }

      .pin-box button,
      .admin-status button {
        border: 0;
        border-radius: 12px;
        background: #d71920;
        color: white;
        font-weight: 950;
        padding: 9px 12px;
      }

      .pin-box .plain {
        background: #e8e8e8;
        color: #333;
      }

      .admin-status {
        display: flex;
        align-items: center;
        gap: 9px;
        background: #fff1f1;
        color: #8b0000;
        border: 1px solid rgba(215, 25, 32, 0.16);
        border-radius: 16px;
        padding: 8px;
        font-weight: 900;
        font-size: 0.85rem;
      }

      .flow-nav {
        max-width: 1260px;
        margin: 0 auto 18px;
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 8px;
        background: #171717;
        border-radius: 22px;
        padding: 8px;
        box-shadow: 0 14px 45px rgba(0, 0, 0, 0.16);
      }

      .flow-btn {
        border: 0;
        border-radius: 16px;
        background: transparent;
        color: rgba(255, 255, 255, 0.72);
        font-weight: 950;
        padding: 14px 8px;
      }

      .flow-btn.active {
        background: #d71920;
        color: white;
      }

      .hero-grid,
      .plans-stage,
      .options-stage,
      .savings-stage,
      .center-stage,
      .admin-panel {
        max-width: 1260px;
        margin: 0 auto;
      }

      .hero-grid {
        display: grid;
        grid-template-columns: 1.25fr 0.85fr;
        gap: 18px;
      }

      .hero-card,
      .big-card,
      .impact-card,
      .contrast-card,
      .plan-card,
      .option-card,
      .phone-module,
      .savings-main,
      .quote-breakdown,
      .admin-panel,
      .admin-section {
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(0, 0, 0, 0.07);
        border-radius: 30px;
        box-shadow: 0 18px 55px rgba(0, 0, 0, 0.1);
      }

      .hero-card {
        padding: clamp(22px, 4vw, 42px);
      }

      .hero-card h1,
      .big-card h1,
      .section-heading h1,
      .savings-main h1 {
        margin: 7px 0 10px;
        font-size: clamp(2.15rem, 5vw, 4.6rem);
        letter-spacing: -0.075em;
        line-height: 0.9;
      }

      .hero-card p,
      .big-card p,
      .section-heading p {
        color: #545454;
        font-size: 1.08rem;
        line-height: 1.5;
        font-weight: 700;
      }

      .signal-visual {
        position: relative;
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 12px;
        margin: 26px 0;
        align-items: stretch;
      }

      .old-side,
      .new-side {
        border-radius: 26px;
        padding: 18px;
        min-height: 215px;
        overflow: hidden;
      }

      .old-side {
        background: linear-gradient(135deg, #efefef, #d9d9d9);
        color: #444;
      }

      .new-side {
        background: radial-gradient(circle at 20% 20%, #ffebeb, transparent 40%), linear-gradient(135deg, #d71920, #8b0000);
        color: white;
      }

      .old-side span,
      .new-side span {
        display: inline-block;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-weight: 1000;
        font-size: 0.72rem;
        margin-bottom: 18px;
      }

      .old-side p,
      .new-side p {
        margin-top: 22px;
        font-size: 0.95rem;
        color: inherit;
      }

      .traffic-lines,
      .fiber-beam {
        display: grid;
        gap: 12px;
      }

      .traffic-lines i,
      .fiber-beam i {
        display: block;
        height: 13px;
        border-radius: 999px;
      }

      .traffic-lines i {
        background: #9d9d9d;
        width: 60%;
      }

      .traffic-lines i:nth-child(2) {
        width: 82%;
        opacity: 0.6;
      }

      .traffic-lines i:nth-child(3) {
        width: 45%;
        opacity: 0.35;
      }

      .fiber-beam i {
        background: white;
        box-shadow: 0 0 22px rgba(255, 255, 255, 0.65);
      }

      .fiber-beam i:nth-child(2) {
        background: #ffd0d0;
      }

      .fiber-beam i:nth-child(3) {
        background: #fff;
      }

      .vs-pill {
        align-self: center;
        background: #171717;
        color: white;
        border-radius: 999px;
        padding: 12px 10px;
        font-weight: 1000;
        z-index: 2;
      }

      .primary-action,
      .secondary-action,
      .admin-add,
      .reset-btn {
        border: 0;
        border-radius: 18px;
        background: #d71920;
        color: white;
        padding: 16px 22px;
        font-weight: 1000;
        font-size: 1rem;
        box-shadow: 0 14px 30px rgba(215, 25, 32, 0.28);
      }

      .primary-action.wide {
        width: 100%;
        margin-top: 18px;
      }

      .secondary-action {
        background: #171717;
        box-shadow: none;
      }

      .impact-stack {
        display: grid;
        gap: 18px;
      }

      .impact-card {
        padding: 22px;
        position: relative;
        overflow: hidden;
      }

      .impact-number {
        position: absolute;
        right: 18px;
        top: 8px;
        font-size: 3.6rem;
        font-weight: 1000;
        color: rgba(215, 25, 32, 0.08);
        letter-spacing: -0.08em;
      }

      .impact-card h3 {
        margin: 0 0 6px;
        font-size: 1.45rem;
        letter-spacing: -0.04em;
      }

      .impact-card strong {
        color: #d71920;
        font-size: 1rem;
      }

      .impact-card p {
        color: #555;
        font-weight: 700;
        line-height: 1.45;
      }

      .contrast-card {
        grid-column: 1 / -1;
        padding: 18px;
      }

      .contrast-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }

      .contrast-bad,
      .contrast-good {
        border-radius: 22px;
        padding: 20px;
      }

      .contrast-bad {
        background: #eeeeee;
        color: #454545;
      }

      .contrast-good {
        background: #fff0f0;
        color: #740000;
        border: 1px solid rgba(215, 25, 32, 0.14);
      }

      .center-stage {
        display: grid;
        place-items: center;
      }

      .big-card {
        width: min(780px, 100%);
        padding: clamp(24px, 4vw, 46px);
      }

      .bill-input-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
        border: 3px solid #d71920;
        background: white;
        border-radius: 28px;
        padding: 12px 18px;
        margin: 24px 0 14px;
      }

      .bill-input-wrap span {
        color: #d71920;
        font-size: 3rem;
        font-weight: 1000;
      }

      .bill-input-wrap input {
        width: 100%;
        border: 0;
        outline: 0;
        font-size: clamp(3rem, 10vw, 6.5rem);
        font-weight: 1000;
        letter-spacing: -0.08em;
      }

      .quick-bills {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 8px;
        margin-bottom: 16px;
      }

      .quick-bills button {
        border: 0;
        border-radius: 14px;
        padding: 12px 8px;
        font-weight: 950;
        background: #f0f0f0;
      }

      .preview-strip {
        display: flex;
        justify-content: space-between;
        background: #171717;
        color: white;
        border-radius: 18px;
        padding: 15px 18px;
        margin-bottom: 16px;
        font-weight: 900;
      }

      .section-heading {
        margin: 6px 0 18px;
      }

      .plan-grid,
      .option-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
      }

      .plan-card,
      .option-card {
        border: 2px solid transparent;
        text-align: left;
        padding: 22px;
        position: relative;
        overflow: hidden;
      }

      .plan-card.active,
      .plan-card.featured.active,
      .option-card.active {
        border-color: #d71920;
        box-shadow: 0 18px 55px rgba(215, 25, 32, 0.18);
      }

      .plan-card.featured {
        border-color: rgba(215, 25, 32, 0.32);
        background: #fff8f8;
      }

      .featured-ribbon {
        position: absolute;
        right: -36px;
        top: 20px;
        rotate: 35deg;
        background: #d71920;
        color: white;
        padding: 8px 42px;
        font-size: 0.72rem;
        font-weight: 1000;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .plan-topline {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        color: #d71920;
        font-weight: 1000;
        font-size: 0.83rem;
      }

      .plan-card h2,
      .option-card h2 {
        margin: 14px 0 4px;
        font-size: 1.65rem;
        letter-spacing: -0.05em;
      }

      .price-line span {
        color: #d71920;
        font-size: 2.4rem;
        font-weight: 1000;
        letter-spacing: -0.07em;
      }

      .price-line small {
        font-weight: 900;
        color: #777;
      }

      .plan-card p,
      .option-card p {
        color: #555;
        font-weight: 700;
        line-height: 1.45;
      }

      .option-card span {
        color: #d71920;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-weight: 1000;
        font-size: 0.75rem;
      }

      .option-card strong {
        display: block;
        color: #d71920;
        font-size: 1.3rem;
        margin: 6px 0;
      }

      .phone-module {
        margin-top: 18px;
        padding: 24px;
        display: grid;
        grid-template-columns: 1fr 1.1fr 1fr;
        gap: 18px;
        align-items: center;
      }

      .phone-module h2 {
        margin: 6px 0;
        font-size: 2rem;
        letter-spacing: -0.06em;
      }

      .phone-module p {
        color: #555;
        font-weight: 700;
        line-height: 1.45;
      }

      .phone-controls {
        display: grid;
        gap: 12px;
      }

      .line-stepper {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 10px;
        align-items: center;
        background: #f2f2f2;
        border-radius: 22px;
        padding: 10px;
      }

      .line-stepper button {
        border: 0;
        border-radius: 16px;
        width: 54px;
        height: 54px;
        background: #171717;
        color: white;
        font-size: 2rem;
        font-weight: 900;
      }

      .line-stepper div {
        text-align: center;
      }

      .line-stepper strong {
        display: block;
        font-size: 2.3rem;
        line-height: 1;
      }

      .line-stepper span {
        color: #555;
        font-weight: 900;
      }

      .verizon-toggle {
        border: 2px solid #ddd;
        border-radius: 18px;
        background: white;
        padding: 14px;
        font-weight: 1000;
      }

      .verizon-toggle.active {
        background: #d71920;
        color: white;
        border-color: #d71920;
      }

      .phone-math {
        background: #171717;
        color: white;
        border-radius: 22px;
        padding: 16px;
        display: grid;
        gap: 11px;
      }

      .phone-math div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .phone-math span {
        color: rgba(255, 255, 255, 0.67);
        font-weight: 800;
      }

      .phone-math strong {
        font-weight: 1000;
      }

      .phone-math .total-row {
        border-top: 1px solid rgba(255, 255, 255, 0.15);
        padding-top: 10px;
        color: #fff;
      }

      .savings-stage {
        display: grid;
        grid-template-columns: 1.25fr 0.75fr;
        gap: 18px;
      }

      .savings-main,
      .quote-breakdown {
        padding: clamp(22px, 4vw, 42px);
      }

      .comparison-bars {
        display: grid;
        gap: 12px;
        margin: 18px 0;
      }

      .bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 22px;
        padding: 18px;
        font-weight: 900;
      }

      .bar.old {
        background: #ececec;
      }

      .bar.new {
        background: #fff0f0;
        border: 1px solid rgba(215, 25, 32, 0.18);
      }

      .bar strong {
        font-size: 2rem;
        letter-spacing: -0.06em;
      }

      .mega-save {
        border-radius: 28px;
        padding: 24px;
        background: #171717;
        color: white;
      }

      .mega-save.positive {
        background: linear-gradient(135deg, #d71920, #8b0000);
      }

      .mega-save span {
        display: block;
        font-weight: 900;
        opacity: 0.8;
      }

      .mega-save strong {
        display: block;
        font-size: clamp(3.5rem, 10vw, 7rem);
        letter-spacing: -0.09em;
        line-height: 0.95;
      }

      .savings-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin: 14px 0;
      }

      .savings-grid div {
        background: #f2f2f2;
        border-radius: 20px;
        padding: 18px;
      }

      .savings-grid span {
        display: block;
        color: #666;
        font-weight: 900;
      }

      .savings-grid strong {
        display: block;
        color: #d71920;
        font-size: 2rem;
        letter-spacing: -0.07em;
      }

      .quote-breakdown h2 {
        margin-top: 0;
        font-size: 2rem;
        letter-spacing: -0.06em;
      }

      .line-item,
      .quote-total {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid #eee;
        padding: 13px 0;
        font-weight: 850;
      }

      .line-item span {
        color: #666;
      }

      .quote-total {
        margin-top: 8px;
        border: 0;
        background: #171717;
        color: white;
        border-radius: 18px;
        padding: 18px;
      }

      .quote-total strong {
        color: #fff;
        font-size: 1.6rem;
        letter-spacing: -0.05em;
      }

      .disclaimer {
        max-width: 1260px;
        margin: 18px auto 0;
        color: #666;
        font-size: 0.88rem;
        font-weight: 700;
        line-height: 1.45;
        text-align: center;
      }

      .admin-panel {
        padding: 22px;
      }

      .admin-head {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 18px;
      }

      .admin-head h1 {
        margin: 0;
        font-size: 2.4rem;
        letter-spacing: -0.06em;
      }

      .admin-head p {
        margin: 6px 0 0;
        color: #555;
        font-weight: 750;
      }

      .save-pill {
        align-self: flex-start;
        background: #171717;
        color: white;
        border-radius: 18px;
        padding: 12px 14px;
        font-weight: 900;
      }

      .save-pill small {
        display: block;
        color: #ffb3b3;
        margin-top: 4px;
      }

      .admin-section {
        padding: 18px;
        margin-bottom: 16px;
        box-shadow: none;
        background: #fafafa;
      }

      .admin-section h2 {
        margin: 0 0 14px;
        color: #d71920;
        letter-spacing: -0.04em;
      }

      .admin-section-body {
        display: grid;
        gap: 12px;
      }

      .admin-card {
        background: white;
        border: 1px solid #e8e8e8;
        border-radius: 20px;
        padding: 14px;
        display: grid;
        gap: 10px;
      }

      .primary-plan-admin {
        border-color: rgba(215, 25, 32, 0.35);
        background: #fff7f7;
      }

      .admin-row {
        display: grid;
        grid-template-columns: 1fr 1fr 120px;
        gap: 10px;
      }

      .field {
        display: grid;
        gap: 5px;
      }

      .field span {
        color: #555;
        font-size: 0.82rem;
        font-weight: 900;
      }

      .field input,
      .field textarea {
        width: 100%;
        border: 1px solid #ddd;
        border-radius: 14px;
        background: white;
        padding: 12px;
        outline: none;
      }

      .field input:focus,
      .field textarea:focus {
        border-color: #d71920;
      }

      .admin-actions-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .admin-actions-row button,
      .danger {
        border: 0;
        border-radius: 14px;
        background: #171717;
        color: white;
        padding: 12px 14px;
        font-weight: 950;
      }

      .danger {
        background: #8b0000;
      }

      .admin-add {
        box-shadow: none;
      }

      .reset-btn {
        background: #171717;
        box-shadow: none;
      }

      .check-row {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 950;
      }

      .check-row input {
        width: 20px;
        height: 20px;
      }

      @media (max-width: 880px) {
        .sales-shell {
          padding: 10px;
        }

        .topbar {
          flex-direction: column;
          border-radius: 22px;
          padding: 16px;
        }

        .logo-text {
          font-size: 2.8rem;
        }

        .flow-nav {
          grid-template-columns: repeat(5, minmax(92px, 1fr));
          overflow-x: auto;
          border-radius: 18px;
        }

        .flow-btn {
          white-space: nowrap;
        }

        .hero-grid,
        .savings-stage,
        .phone-module {
          grid-template-columns: 1fr;
        }

        .signal-visual,
        .contrast-row {
          grid-template-columns: 1fr;
        }

        .vs-pill {
          justify-self: center;
          margin: -4px 0;
        }

        .plan-grid,
        .option-grid {
          grid-template-columns: 1fr;
        }

        .quick-bills {
          grid-template-columns: repeat(3, 1fr);
        }

        .admin-row {
          grid-template-columns: 1fr;
        }

        .pin-box {
          grid-template-columns: 1fr;
          width: 100%;
        }
      }
    `}</style>
  );
}
