"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Upload,
  Target,
  Scissors,
  Users,
  Flame,
  Eye,
  EyeOff,
  Save,
  Trash2,
  Download,
  Map,
  Crown,
  Filter,
  Crosshair,
  Layers,
  Split,
  FolderPlus,
  Image as ImageIcon,
  Percent,
  Eraser,
  Wand2,
  RotateCcw,
  DollarSign,
  Zap,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const REPS = ["JJ", "Christian", "Zack", "Chris", "Jacob", "Dylan", "Aeden", "Jeremy", "Ayden", "Quad", "Jarvis", "Caleb"];
const DB_NAME = "gff-os-kinetic-v1-cloud-backup";
const STORE = "state";
const KEY = "app";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CLOUD_STATE_ID = "main";
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

function withTimeout(promise, ms, fallback = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

const DEFAULT_APP = {
  areas: [],
  activeAreaId: null,
  activeShotId: null,
  assignments: [
    { rep: "JJ", percent: 25 },
    { rep: "Christian", percent: 25 },
    { rep: "Zack", percent: 25 },
    { rep: "Chris", percent: 25 },
  ],
  sales: {
    currentBill: 100,
    activePlanId: "kinetic-1g",
    selectedAddonIds: [],
    plans: [
      { id: "kinetic-300", name: "Kinetic 300", speed: "300 Mbps", price: 39.99, badge: "Starter", bullets: ["Everyday streaming", "Phones and laptops", "Smaller homes"] },
      { id: "kinetic-500", name: "Kinetic 500", speed: "500 Mbps", price: 49.99, badge: "Solid value", bullets: ["Streaming", "Video calls", "Smart devices"] },
      { id: "kinetic-1g", name: "Kinetic 1 Gig", speed: "1 Gig", price: 69.99, badge: "Most popular", bullets: ["Busy households", "Gaming", "Work from home"] },
      { id: "kinetic-2g", name: "Kinetic 2 Gig", speed: "2 Gig", price: 99.99, badge: "Power home", bullets: ["Heavy usage", "Max headroom", "Future-proof setup"] },
    ],
    addons: [
      { id: "router", name: "Kinetic Gateway", price: 10.99, note: "Router rental / Wi-Fi gateway." },
    ],
    fiberPoints: [
      "Fiber sends data as light through glass, so it is built for speed.",
      "Upload speed matters for cameras, video calls, gaming, and work from home.",
      "Fiber is the upgrade from old cable-style internet, not just another plan."
    ],
  },
  options: {
    sensitivity: 5,
    expectedDotArea: 220,
    maxBlobMultiplier: 4,
    splitOverlaps: false,
    cropLeft: 0,
    cropRight: 1,
    cropTop: 0,
    cropBottom: 1,
  },
};

const DOT_PRESETS = [
  { key: "lead", label: "Lead", color: "#f5c542", hueMin: 22, hueMax: 72, satMin: 28, valMin: 28, minArea: 16, maxArea: 1600 },
  { key: "pink", label: "Sold", color: "#ff4f87", hueMin: 310, hueMax: 360, satMin: 30, valMin: 30, minArea: 16, maxArea: 1600 },
];

function uid() {
  const cryptoObj =
    (typeof window !== "undefined" && window.crypto) ||
    (typeof self !== "undefined" && self.crypto) ||
    null;

  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openDb() {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function loadDb() {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

async function saveDb(value) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
}

async function clearDb() {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
}

async function loadCloudState() {
  if (!supabase || typeof fetch === "undefined") return null;

  const { data, error } = await supabase
    .from("app_state")
    .select("data")
    .eq("id", CLOUD_STATE_ID)
    .single();

  if (error) {
    console.error("Cloud load failed:", error);
    return null;
  }

  return data?.data || null;
}

async function saveCloudState(value) {
  if (!supabase || typeof fetch === "undefined") return { ok: false, error: "Missing Supabase env vars or fetch unavailable" };

  const cleanValue = JSON.parse(JSON.stringify(value));

  const { error } = await supabase
    .from("app_state")
    .upsert({
      id: CLOUD_STATE_ID,
      data: cleanValue,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Cloud save failed:", error);
    return { ok: false, error: error.message || "Cloud save failed" };
  }

  return { ok: true };
}

function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : (d / max) * 100, max * 100];
}

function hueInRange(h, min, max) {
  return min <= max ? h >= min && h <= max : h >= min || h <= max;
}

function flood(mask, width, visited, start) {
  const stack = [start];
  visited[start] = 1;
  let area = 0;
  let sx = 0;
  let sy = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  while (stack.length) {
    const p = stack.pop();
    const x = p % width;
    const y = Math.floor(p / width);
    area++;
    sx += x;
    sy += y;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);

    for (const n of [p - 1, p + 1, p - width, p + width]) {
      if (n < 0 || n >= mask.length || visited[n] || !mask[n]) continue;
      const nx = n % width;
      const ny = Math.floor(n / width);
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
      visited[n] = 1;
      stack.push(n);
    }
  }

  return { id: uid(), area, x: sx / area, y: sy / area, minX, minY, maxX, maxY, radius: Math.sqrt(area / Math.PI) };
}

function detectDotsForPreset(imageData, preset, options) {
  const { width, height, data } = imageData;
  const mask = new Uint8Array(width * height);
  const crop = {
    left: Math.floor(width * options.cropLeft),
    right: Math.floor(width * options.cropRight),
    top: Math.floor(height * options.cropTop),
    bottom: Math.floor(height * options.cropBottom),
  };

  const huePad = options.sensitivity * 2.2;
  const satMin = Math.max(0, preset.satMin - options.sensitivity * 4);
  const valMin = Math.max(0, preset.valMin - options.sensitivity * 4);
  const hueMin = (preset.hueMin - huePad + 360) % 360;
  const hueMax = (preset.hueMax + huePad) % 360;

  for (let y = crop.top; y < crop.bottom; y++) {
    for (let x = crop.left; x < crop.right; x++) {
      const i = (y * width + x) * 4;
      const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
      if (hueInRange(h, hueMin, hueMax) && s >= satMin && v >= valMin) mask[y * width + x] = 1;
    }
  }

  const visited = new Uint8Array(width * height);
  const dots = [];

  for (let y = crop.top; y < crop.bottom; y++) {
    for (let x = crop.left; x < crop.right; x++) {
      const idx = y * width + x;
      if (!mask[idx] || visited[idx]) continue;
      const blob = flood(mask, width, visited, idx);
      const boxW = blob.maxX - blob.minX + 1;
      const boxH = blob.maxY - blob.minY + 1;
      const aspect = boxW / Math.max(boxH, 1);
      if (blob.area < preset.minArea || blob.area > preset.maxArea * options.maxBlobMultiplier) continue;
      if (boxW < 3 || boxH < 3 || aspect < 0.16 || aspect > 6) continue;

      const estimated = Math.max(1, Math.round(blob.area / options.expectedDotArea));
      const looksLikeNormalDot = blob.area < options.expectedDotArea * 1.65;
      if (!options.splitOverlaps || estimated <= 1 || looksLikeNormalDot) {
        dots.push({ ...blob, type: preset.key, confidence: "direct" });
      } else {
        const count = Math.min(estimated, 6);
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        let placed = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (placed >= count) break;
            dots.push({
              ...blob,
              id: uid(),
              type: preset.key,
              x: blob.minX + ((c + 0.5) * boxW) / cols,
              y: blob.minY + ((r + 0.5) * boxH) / rows,
              radius: Math.sqrt(options.expectedDotArea / Math.PI),
              confidence: "estimated",
            });
            placed++;
          }
        }
      }
    }
  }

  return dots;
}

function detectAll(canvas, options) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const out = {};
  for (const preset of DOT_PRESETS) out[preset.key] = detectDotsForPreset(imageData, preset, options);
  return out;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const hit = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function countInside(detections, polygon) {
  const all = [...(detections.lead || []), ...(detections.pink || [])];
  const inside = all.filter((d) => pointInPolygon(d, polygon));
  return {
    yellow: inside.filter((d) => d.type === "lead").length,
    pink: inside.filter((d) => d.type === "pink").length,
    total: inside.length,
  };
}

function polygonBounds(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

const REP_COLORS = {
  JJ: "#f5c542",
  Sam: "#ef4444",
  Zack: "#3b82f6",
  Dylan: "#22c55e",
  Julian: "#a855f7",
  Chris: "#f97316",
  Christian: "#06b6d4",
  Jacob: "#ec4899",
};

function repColor(rep) {
  return REP_COLORS[rep] || "#ffffff";
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearestPath(points) {
  if (points.length <= 2) return [...points];
  const remaining = [...points];
  const startIndex = remaining.reduce((best, p, i) => (p.y < remaining[best].y || (p.y === remaining[best].y && p.x < remaining[best].x) ? i : best), 0);
  const path = [remaining.splice(startIndex, 1)[0]];

  while (remaining.length) {
    const last = path[path.length - 1];
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = distance(last, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    path.push(remaining.splice(best, 1)[0]);
  }
  return path;
}

function normalizeAssignments(assignments) {
  const active = assignments.filter((a) => Number(a.percent) > 0);
  const total = active.reduce((s, a) => s + Number(a.percent), 0);
  return total ? active.map((a) => ({ ...a, share: Number(a.percent) / total })) : [];
}

function clipPolygonAgainstHalfPlane(poly, keep) {
  if (!poly.length) return [];
  const output = [];
  for (let i = 0; i < poly.length; i++) {
    const current = poly[i];
    const previous = poly[(i + poly.length - 1) % poly.length];
    const currentValue = keep(current);
    const previousValue = keep(previous);
    const currentInside = currentValue <= 0;
    const previousInside = previousValue <= 0;

    if (currentInside !== previousInside) {
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      const denom = currentValue - previousValue;
      const t = denom === 0 ? 0 : -previousValue / denom;
      output.push({ x: previous.x + dx * t, y: previous.y + dy * t });
    }
    if (currentInside) output.push(current);
  }
  return output;
}

function voronoiCell(seed, allSeeds, width, height) {
  let poly = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];

  for (const other of allSeeds) {
    if (other.id === seed.id) continue;
    const midX = (seed.x + other.x) / 2;
    const midY = (seed.y + other.y) / 2;
    const nx = other.x - seed.x;
    const ny = other.y - seed.y;
    poly = clipPolygonAgainstHalfPlane(poly, (p) => (p.x - midX) * nx + (p.y - midY) * ny);
  }
  return poly;
}

function centroid(points) {
  if (!points.length) return { x: 0, y: 0 };
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
}

function autoSplitScreenshot(screenshot, assignments, areaId) {
  const leads = screenshot.detections?.lead || [];
  const active = normalizeAssignments(assignments);
  if (!leads.length || !active.length) return [];

  const path = nearestPath(leads);
  let start = 0;
  const chunks = [];

  for (let i = 0; i < active.length; i++) {
    const remaining = path.length - start;
    const target = i === active.length - 1 ? remaining : Math.max(1, Math.round(path.length * active[i].share));
    const chunk = path.slice(start, Math.min(path.length, start + target));
    start += target;
    if (!chunk.length) continue;
    const c = centroid(chunk);
    chunks.push({ id: uid(), rep: active[i].rep, dots: chunk, x: c.x, y: c.y });
  }

  return chunks
    .map((chunk) => {
      const points = voronoiCell(chunk, chunks, screenshot.width, screenshot.height);
      return {
        id: uid(),
        areaId,
        screenshotId: screenshot.id,
        rep: chunk.rep,
        points,
        counts: countInside(screenshot.detections, points),
        auto: true,
        imageName: screenshot.name,
        createdAt: new Date().toISOString(),
      };
    })
    .filter((zone) => zone.points.length >= 3);
}

function OldIpadStyleFix() {
  const css = `
    html, body, #__next { min-height:100%; margin:0; background:#16110d !important; color:#f7f3ea !important; }
    body { font-family: Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif !important; -webkit-text-size-adjust:100%; }
    * { box-sizing:border-box; }
    main { min-height:100vh !important; background:#16110d !important; color:#f7f3ea !important; }
    button,input,select,textarea { font:inherit; font-size:16px !important; }
    button { cursor:pointer; border:0; -webkit-appearance:none; appearance:none; }
    input,select,textarea { border-radius:12px; -webkit-appearance:none; appearance:none; }
    canvas,img { max-width:100% !important; height:auto !important; }
    .min-h-screen{min-height:100vh!important}.grid{display:grid!important}.flex{display:flex!important}.inline-flex{display:inline-flex!important}.block{display:block!important}.hidden{display:none!important}
    .items-center{align-items:center!important}.justify-center{justify-content:center!important}.justify-between{justify-content:space-between!important}.text-center{text-align:center!important}.text-left{text-align:left!important}
    .relative{position:relative!important}.fixed{position:fixed!important}.absolute{position:absolute!important}.inset-0{top:0;right:0;bottom:0;left:0}.pointer-events-none{pointer-events:none!important}
    .mx-auto{margin-left:auto!important;margin-right:auto!important}.w-full{width:100%!important}.min-w-0{min-width:0!important}.flex-1{flex:1 1 0%!important}.shrink-0{flex-shrink:0!important}
    .overflow-hidden{overflow:hidden!important}.overflow-x-auto{overflow-x:auto!important;-webkit-overflow-scrolling:touch}.truncate{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    .p-2{padding:.5rem!important}.p-3{padding:.75rem!important}.p-4{padding:1rem!important}.p-5{padding:1.25rem!important}.px-2{padding-left:.5rem!important;padding-right:.5rem!important}.px-3{padding-left:.75rem!important;padding-right:.75rem!important}.px-4{padding-left:1rem!important;padding-right:1rem!important}.py-1{padding-top:.25rem!important;padding-bottom:.25rem!important}.py-2{padding-top:.5rem!important;padding-bottom:.5rem!important}.py-3{padding-top:.75rem!important;padding-bottom:.75rem!important}.py-4{padding-top:1rem!important;padding-bottom:1rem!important}
    .mb-2{margin-bottom:.5rem!important}.mb-3{margin-bottom:.75rem!important}.mb-4{margin-bottom:1rem!important}.mt-1{margin-top:.25rem!important}.mt-2{margin-top:.5rem!important}.mt-3{margin-top:.75rem!important}.mt-4{margin-top:1rem!important}.mr-1{margin-right:.25rem!important}.mr-2{margin-right:.5rem!important}
    .gap-2{gap:.5rem!important}.gap-3{gap:.75rem!important}.gap-4{gap:1rem!important}.space-y-2>*+*{margin-top:.5rem!important}.space-y-3>*+*{margin-top:.75rem!important}.space-y-4>*+*{margin-top:1rem!important}
    .grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))!important}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))!important}.grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))!important}.grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))!important}
    .rounded-lg{border-radius:.5rem!important}.rounded-xl{border-radius:.75rem!important}.rounded-2xl{border-radius:1rem!important}.rounded-3xl{border-radius:1.5rem!important}.rounded-full{border-radius:9999px!important}.border{border-width:1px!important;border-style:solid!important}.border-2{border-width:2px!important;border-style:solid!important}
    .font-bold{font-weight:700!important}.font-black{font-weight:900!important}.uppercase{text-transform:uppercase!important}.text-xs{font-size:.75rem!important;line-height:1rem!important}.text-sm{font-size:.875rem!important;line-height:1.25rem!important}.text-base{font-size:1rem!important;line-height:1.5rem!important}.text-lg{font-size:1.125rem!important;line-height:1.75rem!important}.text-xl{font-size:1.25rem!important;line-height:1.75rem!important}.text-2xl{font-size:1.5rem!important;line-height:2rem!important}.text-3xl{font-size:1.875rem!important;line-height:2.25rem!important}.text-4xl{font-size:2.25rem!important;line-height:2.5rem!important}
    .text-white{color:#f7f3ea!important}.text-black{color:#050505!important}.bg-black{background:#050505!important}.bg-white{background:#fff!important}.bg-red-700{background:#b91c1c!important}.text-red-300,.text-red-200{color:#fca5a5!important}.text-emerald-300{color:#6ee7b7!important}
    [class*="bg-[#16110d"]{background:#16110d!important}[class*="bg-[#1b1410"],[class*="bg-[#241a13"],[class*="bg-[#2b2118"],[class*="bg-[#3a2a14"]{background:#241a13!important}[class*="bg-[#f5c542"]{background:#f5c542!important}[class*="text-[#f5c542"]{color:#f5c542!important}[class*="text-[#f7f3ea"]{color:#f7f3ea!important}
    [class*="bg-white/"],[class*="bg-black/"]{background:rgba(0,0,0,.35)!important}[class*="border-[#f5c542"]{border-color:rgba(245,197,66,.35)!important}.shadow-xl,.shadow-2xl,.shadow-lg{box-shadow:0 12px 30px rgba(0,0,0,.35)!important}.outline-none{outline:none!important}
    @media(min-width:640px){.sm\\:grid-cols-5{grid-template-columns:repeat(5,minmax(0,1fr))!important}.sm\\:grid-cols-7{grid-template-columns:repeat(7,minmax(0,1fr))!important}.sm\\:p-4{padding:1rem!important}.sm\\:p-5{padding:1.25rem!important}.sm\\:px-6{padding-left:1.5rem!important;padding-right:1.5rem!important}.sm\\:text-5xl{font-size:3rem!important;line-height:1!important}}
    @media(min-width:1024px){.lg\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))!important}.lg\\:px-8{padding-left:2rem!important;padding-right:2rem!important}.lg\\:text-6xl{font-size:3.75rem!important;line-height:1!important}}
    @media(min-width:1280px){.xl\\:sticky{position:sticky!important}.xl\\:top-4{top:1rem!important}.xl\\:self-start{align-self:start!important}}
  `;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

export default function GFFOSOps() {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const fileRef = useRef(null);
  const saveTimerRef = useRef(null);
  const cloudVersionRef = useRef(0);

  const [loaded, setLoaded] = useState(false);
  const [app, setApp] = useState(DEFAULT_APP);
  const [mode, setMode] = useState("areas");
  const [admin, setAdmin] = useState(false);
  const [pin, setPin] = useState("");
  const [newAreaName, setNewAreaName] = useState("");
  const [selectedRep, setSelectedRep] = useState("All");
  const [teamRep, setTeamRep] = useState("Christian");
  const [showDots, setShowDots] = useState(true);
  const [showTurf, setShowTurf] = useState(true);
  const [showSold, setShowSold] = useState(false);
  const [polygon, setPolygon] = useState([]);
  const [manualRep, setManualRep] = useState("JJ");
  const [editMode, setEditMode] = useState(false);
  const [selectedTurfId, setSelectedTurfId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [swipeStart, setSwipeStart] = useState(null);
  const [saveStatus, setSaveStatus] = useState("booting");
  const [cloudError, setCloudError] = useState("");
  const [lastCloudLoad, setLastCloudLoad] = useState(null);
  const [lastCloudSave, setLastCloudSave] = useState(null);
  const [localCandidate, setLocalCandidate] = useState(null);

  const applyCloudState = useCallback((cloud, preserveSelection = true) => {
    if (!cloud || !Object.keys(cloud).length) return;

    setApp((current) => {
      const next = { ...DEFAULT_APP, ...cloud };

      if (!preserveSelection) return {
        ...next,
        activeAreaId: next.activeAreaId || next.areas[0]?.id || null,
        activeShotId: next.activeShotId || next.areas[0]?.screenshots?.[0]?.id || null,
      };

      const currentAreaStillExists = next.areas.some((a) => a.id === current.activeAreaId);
      const activeAreaId = currentAreaStillExists ? current.activeAreaId : next.areas[0]?.id || null;
      const areaForShot = next.areas.find((a) => a.id === activeAreaId);
      const currentShotStillExists = areaForShot?.screenshots?.some((shot) => shot.id === current.activeShotId);

      return {
        ...next,
        activeAreaId,
        activeShotId: currentShotStillExists ? current.activeShotId : areaForShot?.screenshots?.[0]?.id || null,
      };
    });
  }, []);

  const cloudSafeApp = useCallback((value) => ({
    ...value,
    activeAreaId: null,
    activeShotId: null,
  }), []);

  useEffect(() => {
    let cancelled = false;

    // 2014 iPad failsafe: never let cloud/IndexedDB boot trap the app on the loading screen.
    const ipadBootFailsafe = setTimeout(() => {
      if (cancelled) return;
      setApp((current) => ({ ...DEFAULT_APP, ...(current || {}) }));
      setSaveStatus("ipad-safe-mode");
      setCloudError("iPad safe mode: cloud/local boot took too long, so the app opened anyway.");
      setLoaded(true);
    }, 2200);

    async function boot() {
      try {
        setSaveStatus("loading-cloud");

        const local = await withTimeout(loadDb().catch(() => null), 1200, null);
        const cloud = await withTimeout(loadCloudState().catch(() => null), 2200, null);

        if (cancelled) return;

        if (local && local.areas && local.areas.length) setLocalCandidate({ ...DEFAULT_APP, ...local });

        if (supabase && cloud && Object.keys(cloud).length) {
          applyCloudState(cloud, false);
          setSaveStatus("cloud-live");
          setCloudError("");
          setLastCloudLoad(new Date());
        } else if (local && local.areas && local.areas.length) {
          setApp({ ...DEFAULT_APP, ...local });
          setSaveStatus(supabase ? "cloud-empty-local-backup" : "local-only");
          setCloudError(supabase ? "Cloud did not answer, so this device opened its local backup." : "Missing Supabase environment variables.");
        } else {
          setApp(DEFAULT_APP);
          setSaveStatus(supabase ? "cloud-empty" : "local-empty");
          setCloudError(supabase ? "Cloud did not return shared map data yet." : "Missing Supabase environment variables.");
        }
      } catch (err) {
        console.error("Boot failed:", err);
        if (!cancelled) {
          setApp(DEFAULT_APP);
          setSaveStatus("ipad-safe-mode");
          setCloudError((err && err.message) || "App boot failed, but the screen was unlocked.");
        }
      } finally {
        clearTimeout(ipadBootFailsafe);
        if (!cancelled) setLoaded(true);
      }
    }

    boot();
    return () => {
      cancelled = true;
      clearTimeout(ipadBootFailsafe);
    };
  }, [applyCloudState]);

  useEffect(() => {
    if (!loaded) return;

    // Local backup only. When Supabase exists, boot always trusts cloud first.
    saveDb(app);

    if (!admin || !supabase) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving-cloud");
    saveTimerRef.current = setTimeout(async () => {
      const version = ++cloudVersionRef.current;
      const result = await saveCloudState(cloudSafeApp(app));
      if (version !== cloudVersionRef.current) return;

      if (result.ok) {
        setSaveStatus("cloud-saved");
        setCloudError("");
        setLastCloudSave(new Date());
      } else {
        setSaveStatus("cloud-error");
        setCloudError(result.error || "Cloud save failed.");
      }
    }, 650);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [app, loaded, admin, cloudSafeApp]);

  useEffect(() => {
    if (!loaded || admin || !supabase) return;

    const pullCloud = async () => {
      const cloud = await loadCloudState();
      if (cloud && Object.keys(cloud).length) {
        applyCloudState(cloud, true);
        setSaveStatus("cloud-live");
        setCloudError("");
        setLastCloudLoad(new Date());
      }
    };

    pullCloud();
    const interval = setInterval(pullCloud, 2000);

    return () => clearInterval(interval);
  }, [loaded, admin, applyCloudState]);

  useEffect(() => {
    if (!admin && !["manual", "team"].includes(mode)) setMode("manual");
  }, [admin, mode]);

  const activeArea = useMemo(() => app.areas.find((a) => a.id === app.activeAreaId) || app.areas[0] || null, [app]);
  const activeShot = useMemo(() => activeArea?.screenshots?.find((s) => s.id === app.activeShotId) || activeArea?.screenshots?.[0] || null, [activeArea, app.activeShotId]);
  const detections = activeShot?.detections || { lead: [], pink: [] };

  const visibleTurfs = useMemo(() => {
    const byShot = (activeArea?.turfs || []).filter((t) => activeShot && t.screenshotId === activeShot.id);
    return selectedRep === "All" ? byShot : byShot.filter((t) => t.rep === selectedRep);
  }, [activeArea, activeShot, selectedRep]);

  const selectedTurf = useMemo(() => visibleTurfs.find((t) => t.id === selectedTurfId) || null, [visibleTurfs, selectedTurfId]);

  const allTurfs = useMemo(() => (app.areas || []).reduce((list, area) => {
    const turfs = (area.turfs || []).map((t) => ({ ...t, areaName: area.name, screenshot: (area.screenshots || []).find((s) => s.id === t.screenshotId) }));
    return list.concat(turfs);
  }, []), [app.areas]);
  const teamTurfs = useMemo(() => allTurfs.filter((t) => t.rep === teamRep), [allTurfs, teamRep]);
  const totals = useMemo(() => ({ leads: detections.lead?.length || 0, sold: detections.pink?.length || 0, total: detections.lead?.length || 0 }), [detections]);
  const teamStats = useMemo(() => REPS.map((rep) => {
    const mine = allTurfs.filter((t) => t.rep === rep);
    return { rep, zones: mine.length, leads: mine.reduce((s, t) => s + (t.counts?.yellow || 0), 0), sold: mine.reduce((s, t) => s + (t.counts?.pink || 0), 0), total: mine.reduce((s, t) => s + (t.counts?.yellow || 0), 0) };
  }), [allTurfs]);

  const updateActiveArea = useCallback((fn) => {
    if (!activeArea) return;
    setApp((prev) => ({ ...prev, areas: prev.areas.map((a) => a.id === activeArea.id ? fn(a) : a) }));
  }, [activeArea]);

  const switchArea = (areaId) => {
    const area = app.areas.find((a) => a.id === areaId);
    const firstShot = area?.screenshots?.[0]?.id || null;
    setPolygon([]);
    setSelectedTurfId(null);
    setDragState(null);
    setApp((prev) => ({ ...prev, activeAreaId: areaId, activeShotId: firstShot }));
  };

  const switchShot = (shotId) => {
    setPolygon([]);
    setSelectedTurfId(null);
    setDragState(null);
    setApp((prev) => ({ ...prev, activeShotId: shotId }));
  };

  const stepArea = (direction) => {
    const areas = app.areas || [];
    if (!areas.length) return;
    const currentIndex = Math.max(0, areas.findIndex((a) => a.id === activeArea?.id));
    const nextIndex = (currentIndex + direction + areas.length) % areas.length;
    switchArea(areas[nextIndex].id);
    setMode("manual");
  };

  const stepShot = (direction) => {
    const shots = activeArea?.screenshots || [];
    if (!shots.length) return;
    const currentIndex = Math.max(0, shots.findIndex((ss) => ss.id === activeShot?.id));
    const nextIndex = (currentIndex + direction + shots.length) % shots.length;
    switchShot(shots[nextIndex].id);
    setMode("manual");
  };

  const createArea = () => {
    const name = newAreaName.trim();
    if (!admin) {
      setCloudError("Admin is locked. Tap Admin and enter the PIN first.");
      return;
    }
    if (!name) {
      setCloudError("Type an area name first.");
      return;
    }

    const area = { id: uid(), name, screenshots: [], turfs: [], createdAt: new Date().toISOString() };
    setApp((prev) => ({ ...prev, areas: [area, ...(prev.areas || [])], activeAreaId: area.id, activeShotId: null }));
    setCloudError("");
    setNewAreaName("");
    setMode("upload");
  };

  const deleteArea = (areaId) => {
    if (!admin) return;
    setApp((prev) => {
      const areas = prev.areas.filter((a) => a.id !== areaId);
      const first = areas[0] || null;
      return { ...prev, areas, activeAreaId: first?.id || null, activeShotId: first?.screenshots?.[0]?.id || null };
    });
  };

  const fileToShot = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1700;
        const scale = Math.min(1, maxWidth / img.width);
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve({ id: uid(), name: file.name, dataUrl: canvas.toDataURL("image/jpeg", 0.92), width, height, detections: detectAll(canvas, app.options), createdAt: new Date().toISOString() });
      };
      img.onerror = () => {
        console.error("Image load failed for upload:", file.name);
        resolve(null);
      };
      img.src = reader.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

  const upload = (files) => {
    if (!admin) {
      setCloudError("Admin is locked. Tap Admin and enter the PIN before uploading.");
      return;
    }
    const picked = Array.from(files || []);
    if (!picked.length) {
      setCloudError("No file selected.");
      return;
    }

    setCloudError("Uploading image...");

    Promise.all(picked.map(fileToShot)).then((rawShots) => {
      const shots = rawShots.filter(Boolean);
      if (!shots.length) {
        setCloudError("Upload failed. On iPad, use a normal screenshot/photo saved as PNG or JPG.");
        return;
      }

      setApp((prev) => {
        const areas = prev.areas || [];
        let targetAreaId = prev.activeAreaId || areas[0]?.id || null;
        let nextAreas = areas;

        if (!targetAreaId) {
          const newUploadArea = {
            id: uid(),
            name: "Uploaded Area",
            screenshots: [],
            turfs: [],
            createdAt: new Date().toISOString(),
          };
          targetAreaId = newUploadArea.id;
          nextAreas = [newUploadArea, ...areas];
        }

        return {
          ...prev,
          activeAreaId: targetAreaId,
          activeShotId: shots[0]?.id || prev.activeShotId,
          areas: nextAreas.map((a) =>
            a.id === targetAreaId
              ? { ...a, screenshots: [...(a.screenshots || []), ...shots] }
              : a
          ),
        };
      });

      setCloudError("");
      setMode("count");
    });
  };

  const reCount = () => {
    const canvas = canvasRef.current;
    if (!canvas || !activeShot) return;
    const nextDetections = detectAll(canvas, app.options);
    updateActiveArea((area) => ({ ...area, screenshots: area.screenshots.map((s) => s.id === activeShot.id ? { ...s, detections: nextDetections } : s) }));
  };

  const deleteDot = (x, y) => {
    if (!admin || !activeShot) return;
    const all = [...(detections.lead || []), ...(detections.pink || [])];
    let nearest = null;
    let best = Infinity;
    for (const d of all) {
      const dist = Math.hypot(d.x - x, d.y - y);
      if (dist < best) {
        best = dist;
        nearest = d;
      }
    }
    if (!nearest || best > 30) return;
    updateActiveArea((area) => ({ ...area, screenshots: area.screenshots.map((s) => s.id === activeShot.id ? { ...s, detections: { lead: (s.detections.lead || []).filter((d) => d.id !== nearest.id), pink: (s.detections.pink || []).filter((d) => d.id !== nearest.id) } } : s) }));
  };

  const saveManual = () => {
    if (!admin || !activeArea || !activeShot || polygon.length < 3) return;
    const turf = { id: uid(), areaId: activeArea.id, screenshotId: activeShot.id, rep: manualRep, points: polygon, counts: countInside(detections, polygon), auto: false, imageName: activeShot.name, createdAt: new Date().toISOString() };
    updateActiveArea((area) => ({ ...area, turfs: [turf, ...(area.turfs || [])] }));
    setSelectedTurfId(turf.id);
    setPolygon([]);
  };

  const autoThis = () => {
    if (!admin || !activeArea || !activeShot) return;
    const zones = autoSplitScreenshot(activeShot, app.assignments, activeArea.id);
    updateActiveArea((area) => ({ ...area, turfs: [...zones, ...(area.turfs || [])] }));
  };

  const autoArea = () => {
    if (!admin || !activeArea) return;
    const zones = (activeArea.screenshots || []).reduce((list, s) => list.concat(autoSplitScreenshot(s, app.assignments, activeArea.id)), []);
    updateActiveArea((area) => ({ ...area, turfs: [...zones, ...(area.turfs || [])] }));
    setMode("team");
  };

  const deleteTurf = useCallback((turfId) => {
    if (!admin) return;
    updateActiveArea((area) => ({ ...area, turfs: (area.turfs || []).filter((t) => t.id !== turfId) }));
    if (selectedTurfId === turfId) setSelectedTurfId(null);
  }, [admin, updateActiveArea, selectedTurfId]);


  useEffect(() => {
    function handleKey(e) {
      if (!editMode || !selectedTurfId || mode !== "manual") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteTurf(selectedTurfId);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [editMode, selectedTurfId, mode, deleteTurf]);

  const updateAssignments = (assignments) => setApp((prev) => ({ ...prev, assignments }));
  const updateOptions = (options) => setApp((prev) => ({ ...prev, options }));
  const updateSales = (sales) => setApp((prev) => ({ ...prev, sales: { ...(prev.sales || DEFAULT_APP.sales), ...sales } }));
  const patchSales = (patch) => setApp((prev) => ({ ...prev, sales: { ...(prev.sales || DEFAULT_APP.sales), ...patch } }));

  const exportData = () => {
    const blob = new Blob([JSON.stringify(app, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ddm-sharks-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetData = async () => {
    await clearDb();
    setApp(DEFAULT_APP);
    setPolygon([]);
    setSelectedTurfId(null);
    setDragState(null);
    setMode("areas");
  };

  const publishLocalBackupToCloud = async () => {
    if (!admin || !localCandidate) return;

    setApp(localCandidate);
    setSaveStatus("saving-cloud");
    const result = await saveCloudState(cloudSafeApp(localCandidate));

    if (result.ok) {
      setSaveStatus("cloud-saved");
      setCloudError("");
      setLastCloudSave(new Date());
    } else {
      setSaveStatus("cloud-error");
      setCloudError(result.error || "Cloud save failed.");
    }
  };

  const refreshFromCloudNow = async () => {
    const cloud = await loadCloudState();
    if (cloud && Object.keys(cloud).length) {
      applyCloudState(cloud, true);
      setSaveStatus("cloud-live");
      setCloudError("");
      setLastCloudLoad(new Date());
    }
  };

  const getCanvasPoint = (e) => {
    const canvas = overlayRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const source =
      e?.touches?.[0] ||
      e?.changedTouches?.[0] ||
      e?.nativeEvent?.touches?.[0] ||
      e?.nativeEvent?.changedTouches?.[0] ||
      e;

    const rect = canvas.getBoundingClientRect();
    return {
      x: (source.clientX - rect.left) * (canvas.width / rect.width),
      y: (source.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const handleMapTap = (e) => {
    if (e?.type?.startsWith("touch")) e.preventDefault();
    canvasClick(e);
  };

  const handlePointerOrMouseDown = (e) => {
    startSwipe(e);
    startDrag(e);
  };

  const handleTouchStart = (e) => {
    startSwipe(e.touches?.[0] || e);
    startDrag(e);
  };

  const handleTouchMove = (e) => {
    if (dragState || editMode) e.preventDefault();
    moveDrag(e);
  };

  const handleTouchEnd = (e) => {
    stopDrag(e);
    endSwipe(e.changedTouches?.[0] || e);
  };

  const canvasClick = (e) => {
    if (!activeShot || dragState?.moved) return;
    const { x, y } = getCanvasPoint(e);

    if (mode === "manual" && editMode) {
      const hit = [...visibleTurfs].reverse().find((t) => pointInPolygon({ x, y }, t.points));
      setSelectedTurfId(hit?.id || null);
      return;
    }

    if (mode === "erase") return deleteDot(x, y);
    if (mode !== "manual" || !admin) return;
    setPolygon((old) => [...old, { x, y }]);
  };

  const startDrag = (e) => {
    if (!admin || mode !== "manual" || !editMode || !activeShot) return;

    const point = getCanvasPoint(e);
    const hit = [...visibleTurfs].reverse().find((t) => pointInPolygon(point, t.points));
    const turf = selectedTurf || hit;

    if (!turf) {
      setSelectedTurfId(null);
      return;
    }

    setSelectedTurfId(turf.id);
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const vertexIndex = turf.points.findIndex((p) => Math.hypot(p.x - point.x, p.y - point.y) <= 22);

    if (vertexIndex !== -1) {
      setDragState({ type: "vertex", turfId: turf.id, vertexIndex, moved: false });
      return;
    }

    setDragState({
      type: "polygon",
      turfId: turf.id,
      start: point,
      originalPoints: turf.points,
      moved: false,
    });
  };

  const moveDrag = (e) => {
    if (!dragState || !admin || mode !== "manual" || !editMode || !activeShot) return;

    const point = getCanvasPoint(e);
    e.preventDefault();

    setDragState((old) => old ? { ...old, moved: true } : old);

    updateActiveArea((area) => ({
      ...area,
      turfs: (area.turfs || []).map((t) => {
        if (t.id !== dragState.turfId) return t;

        let points = t.points;

        if (dragState.type === "vertex") {
          points = t.points.map((p, i) => i === dragState.vertexIndex ? { x: point.x, y: point.y } : p);
        }

        if (dragState.type === "polygon") {
          const dx = point.x - dragState.start.x;
          const dy = point.y - dragState.start.y;
          points = dragState.originalPoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        }

        return {
          ...t,
          points,
          counts: countInside(detections, points),
        };
      }),
    }));
  };

  const stopDrag = (e) => {
    e?.currentTarget?.releasePointerCapture?.(e.pointerId);
    setDragState(null);
  };

  const startSwipe = (e) => {
    if (dragState || editMode) return;
    setSwipeStart({ x: e.clientX, y: e.clientY, time: Date.now() });
  };

  const endSwipe = (e) => {
    if (!swipeStart || dragState || editMode) return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    const fastEnough = Date.now() - swipeStart.time < 850;
    setSwipeStart(null);

    if (!fastEnough || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    stepShot(dx < 0 ? 1 : -1);
  };

  const drawOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (showTurf) visibleTurfs.forEach((t) => drawTurf(ctx, t, editMode && t.id === selectedTurfId));
    if (polygon.length) drawWorkingPolygon(ctx, polygon);
    if (showDots) DOT_PRESETS.filter((preset) => preset.key === "lead" || showSold).forEach((preset) => (detections[preset.key] || []).forEach((dot) => drawDot(ctx, dot, preset.color)));
  }, [showTurf, visibleTurfs, polygon, showDots, showSold, detections, editMode, selectedTurfId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay || !activeShot?.dataUrl) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = activeShot.width;
      canvas.height = activeShot.height;
      overlay.width = activeShot.width;
      overlay.height = activeShot.height;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      requestAnimationFrame(drawOverlay);
    };
    img.src = activeShot.dataUrl;
  }, [activeShot?.id, activeShot?.dataUrl, drawOverlay]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay, mode, selectedRep]);

  if (!loaded) return <main className="grid min-h-screen place-items-center bg-[#0a0a0a] text-[#22c55e]"><div className="text-4xl font-black">Loading GFF OS...</div></main>;

  return (
    <main className="min-h-screen bg-[#0b0f14] text-[#f8fafc]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif" }}>
      <OldIpadStyleFix />
      <SharkBg />
      <section className="relative mx-auto max-w-[1540px] px-3 py-4 sm:px-6 lg:px-8">
        <Header mode={mode} setMode={setMode} admin={admin} />
        <ViewerNav
          areas={app.areas}
          activeArea={activeArea}
          activeShot={activeShot}
          selectedRep={selectedRep}
          setSelectedRep={setSelectedRep}
          switchArea={switchArea}
          switchShot={switchShot}
          stepArea={stepArea}
          stepShot={stepShot}
          teamStats={teamStats}
        />
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
            <Board totals={totals} activeArea={activeArea} activeShot={activeShot} saveStatus={saveStatus} cloudError={cloudError} lastCloudLoad={lastCloudLoad} lastCloudSave={lastCloudSave} refreshFromCloudNow={refreshFromCloudNow} />
            <Admin admin={admin} pin={pin} setPin={setPin} unlock={() => { if (pin.trim() === "6969") { setAdmin(true); setPin(""); } }} exportData={exportData} resetData={resetData} compact={!admin} localCandidate={localCandidate} publishLocalBackupToCloud={publishLocalBackupToCloud} />
            {admin && <Areas areas={app.areas} activeArea={activeArea} activeShot={activeShot} switchArea={switchArea} switchShot={switchShot} newAreaName={newAreaName} setNewAreaName={setNewAreaName} createArea={createArea} deleteArea={deleteArea} admin={admin} />}
            {mode === "upload" && admin && <UploadBox fileRef={fileRef} upload={upload} admin={admin} />}
            {mode === "auto" && admin && <AutoBox assignments={app.assignments} setAssignments={updateAssignments} totals={totals} autoThis={autoThis} autoArea={autoArea} admin={admin} />}
            {mode === "manual" && admin && <ManualBox manualRep={manualRep} setManualRep={setManualRep} polygon={polygon} clear={() => setPolygon([])} saveManual={saveManual} admin={admin} editMode={editMode} setEditMode={setEditMode} selectedTurf={selectedTurf} deleteSelected={() => selectedTurfId && deleteTurf(selectedTurfId)} />}
            {admin && <RepFilter selectedRep={selectedRep} setSelectedRep={setSelectedRep} />}
            {mode === "count" && admin && <Tuning options={app.options} setOptions={updateOptions} reCount={reCount} />}
          </aside>

          <section className="space-y-4">
            {mode === "team" ? (
              <TeamView teamStats={teamStats} teamRep={teamRep} setTeamRep={setTeamRep} teamTurfs={teamTurfs} admin={admin} deleteTurf={deleteTurf} setSelectedRep={setSelectedRep} setMode={setMode} />
            ) : mode === "areas" && admin ? (
              <AreaDeck areas={app.areas} switchArea={switchArea} setMode={setMode} admin={admin} />
            ) : (
              <>
                <MapPanel fileRef={fileRef} upload={upload} activeShot={activeShot} canvasRef={canvasRef} overlayRef={overlayRef} canvasClick={handleMapTap} mode={mode} showDots={showDots} setShowDots={setShowDots} showTurf={showTurf} setShowTurf={setShowTurf} showSold={showSold} setShowSold={setShowSold} uploadEnabled={admin} startDrag={handlePointerOrMouseDown} moveDrag={moveDrag} stopDrag={stopDrag} editMode={editMode} startSwipe={startSwipe} endSwipe={endSwipe} handleTouchStart={handleTouchStart} handleTouchMove={handleTouchMove} handleTouchEnd={handleTouchEnd} />
                <TurfLegend turfs={visibleTurfs} />
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function drawDot(ctx, dot, color) {
  ctx.beginPath();
  ctx.arc(dot.x, dot.y, Math.max(8, dot.radius + 4), 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(dot.x, dot.y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawTurf(ctx, turf, selected = false) {
  if (!turf.points?.length) return;
  ctx.beginPath();
  turf.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath();
  const color = repColor(turf.rep);
  ctx.fillStyle = `${color}24`;
  ctx.strokeStyle = color;
  ctx.lineWidth = selected ? 10 : turf.auto ? 5 : 7;
  ctx.setLineDash(turf.auto ? [13, 9] : []);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  if (selected) {
    ctx.save();
    ctx.beginPath();
    turf.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.stroke();

    turf.points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#111111";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#f5c542";
      ctx.fill();
    });
    ctx.restore();
  }
}

function drawWorkingPolygon(ctx, points) {
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  if (points.length > 2) ctx.closePath();
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 7;
  ctx.setLineDash([13, 9]);
  ctx.stroke();
  ctx.setLineDash([]);
  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#f5c542";
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#111111";
    ctx.stroke();
  });
}


function money(value) {
  const n = Number(value || 0);
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getSalesMath(sales) {
  const plans = sales.plans || [];
  const addons = sales.addons || [];
  const activePlan = plans.find((p) => p.id === sales.activePlanId) || plans[0] || { price: 0, name: "No plan", speed: "" };
  const selectedAddons = addons.filter((a) => (sales.selectedAddonIds || []).includes(a.id));
  const addonTotal = selectedAddons.reduce((sum, a) => sum + Number(a.price || 0), 0);
  const ourTotal = Number(activePlan.price || 0) + addonTotal;
  const current = Number(sales.currentBill || 0);
  const monthlySave = current - ourTotal;
  return { activePlan, selectedAddons, addonTotal, ourTotal, current, monthlySave, yearlySave: monthlySave * 12, threeYearSave: monthlySave * 36 };
}

function SalesDoorControls({ sales, patchSales }) {
  const math = getSalesMath(sales);
  const toggleAddon = (id) => {
    const current = sales.selectedAddonIds || [];
    patchSales({ selectedAddonIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] });
  };

  return (
    <Panel>
      <h2 className="mb-3 flex items-center text-xl font-black"><DollarSign className="mr-2 h-5 w-5 text-[#22c55e]" /> Sales Flow</h2>
      <label className="text-xs font-black uppercase tracking-widest text-[#22c55e]/70">Customer pays now</label>
      <input value={sales.currentBill || ""} onChange={(e) => patchSales({ currentBill: e.target.value })} inputMode="decimal" placeholder="100" className="mt-2 w-full rounded-xl border-2 border-[#22c55e]/25 bg-black/45 px-4 py-4 text-2xl font-black text-white outline-none focus:border-[#22c55e]" />

      <div className="mt-4 space-y-2">
        <p className="text-xs font-black uppercase tracking-widest text-[#22c55e]/70">Pick our plan</p>
        {(sales.plans || []).map((plan) => (
          <button key={plan.id} onClick={() => patchSales({ activePlanId: plan.id })} className={`w-full rounded-xl px-3 py-3 text-left text-sm font-black ring-1 ${math.activePlan.id === plan.id ? "bg-[#22c55e] text-black ring-[#22c55e]" : "bg-black/35 text-white/75 ring-white/10"}`}>
            <span className="block">{plan.name} • {money(plan.price)}</span>
            <span className="text-xs opacity-70">{plan.speed}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-black uppercase tracking-widest text-[#22c55e]/70">Add-ons</p>
        {(sales.addons || []).map((addon) => {
          const active = (sales.selectedAddonIds || []).includes(addon.id);
          return <button key={addon.id} onClick={() => toggleAddon(addon.id)} className={`w-full rounded-xl px-3 py-3 text-left text-sm font-black ring-1 ${active ? "bg-red-700 text-white ring-red-400" : "bg-black/35 text-white/75 ring-white/10"}`}>{active ? "✓ " : "+ "}{addon.name} • {money(addon.price)}</button>;
        })}
      </div>
    </Panel>
  );
}

function SalesFlow({ sales, patchSales }) {
  const [step, setStep] = useState("fiber");
  const math = getSalesMath(sales);
  const steps = [["fiber", "1. Fiber"], ["bill", "2. Bill"], ["plans", "3. Options"], ["total", "4. Savings"]];

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.25em] text-[#22c55e]/70">Digital laminated paper</p>
            <h2 className="text-3xl font-black tracking-[-0.05em] sm:text-5xl">Fiber Sales Card</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {steps.map(([key, label]) => <button key={key} onClick={() => setStep(key)} className={`rounded-xl px-3 py-3 text-sm font-black ${step === key ? "bg-[#22c55e] text-black" : "bg-black/45 text-white/70"}`}>{label}</button>)}
          </div>
        </div>
      </Panel>

      {step === "fiber" && <FiberExplainer sales={sales} goNext={() => setStep("bill")} />}
      {step === "bill" && <BillCompare sales={sales} patchSales={patchSales} math={math} goNext={() => setStep("plans")} />}
      {step === "plans" && <PlanChooser sales={sales} patchSales={patchSales} math={math} goNext={() => setStep("total")} />}
      {step === "total" && <SavingsSummary math={math} goBack={() => setStep("plans")} />}
    </div>
  );
}

function FiberExplainer({ sales, goNext }) {
  return (
    <Panel>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <div className="mb-4 inline-flex rounded-full bg-[#22c55e] px-4 py-2 text-xs font-black uppercase tracking-widest text-black">Start here</div>
          <h3 className="mb-3 text-4xl font-black tracking-[-0.06em] sm:text-6xl">Fiber is internet built on light.</h3>
          <p className="text-lg font-bold text-white/65 sm:text-xl">Simple version: old internet is like a crowded road. Fiber is a cleaner, faster lane that can move way more data without choking.</p>
          <button onClick={goNext} className="mt-5 inline-flex items-center rounded-2xl bg-[#22c55e] px-5 py-4 text-base font-black text-black">Compare their bill <ArrowRight className="ml-2 h-5 w-5" /></button>
        </div>
        <div className="grid gap-3">
          {(sales.fiberPoints || []).map((point, i) => (
            <div key={i} className="rounded-3xl border border-[#22c55e]/15 bg-black/30 p-4">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#22c55e] text-black"><Zap className="h-5 w-5" /></div>
              <p className="text-lg font-black text-white">{point}</p>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function BillCompare({ sales, patchSales, math, goNext }) {
  return (
    <Panel>
      <h3 className="mb-4 text-4xl font-black tracking-[-0.06em]">What are they paying now?</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-black/35 p-5 ring-1 ring-white/10">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-white/45">Their current bill</p>
          <div className="flex items-center gap-2"><span className="text-4xl font-black text-[#22c55e]">$</span><input value={sales.currentBill || ""} onChange={(e) => patchSales({ currentBill: e.target.value })} inputMode="decimal" className="w-full rounded-2xl border-2 border-[#22c55e]/25 bg-black/55 px-4 py-4 text-5xl font-black text-white outline-none focus:border-[#22c55e]" /></div>
        </div>
        <div className="rounded-3xl bg-[#22c55e] p-5 text-black">
          <p className="mb-2 text-xs font-black uppercase tracking-widest opacity-60">Our current setup</p>
          <p className="text-4xl font-black tracking-[-0.05em]">{math.activePlan.name}</p>
          <p className="text-xl font-black opacity-70">{math.activePlan.speed} • {money(math.ourTotal)}/mo</p>
        </div>
      </div>
      <button onClick={goNext} className="mt-5 rounded-2xl bg-red-700 px-5 py-4 text-base font-black text-white">Show the options</button>
    </Panel>
  );
}

function PlanChooser({ sales, patchSales, math, goNext }) {
  const toggleAddon = (id) => {
    const current = sales.selectedAddonIds || [];
    patchSales({ selectedAddonIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] });
  };

  return (
    <Panel>
      <h3 className="mb-4 text-4xl font-black tracking-[-0.06em]">Pick the cleanest option.</h3>
      <div className="grid gap-3 lg:grid-cols-3">
        {(sales.plans || []).map((plan) => {
          const active = math.activePlan.id === plan.id;
          return <button key={plan.id} onClick={() => patchSales({ activePlanId: plan.id })} className={`rounded-3xl p-5 text-left ring-2 ${active ? "bg-[#22c55e] text-black ring-[#22c55e]" : "bg-black/30 text-white ring-white/10"}`}>
            <p className="mb-2 inline-flex rounded-full bg-black/20 px-3 py-1 text-xs font-black uppercase tracking-widest">{plan.badge}</p>
            <h4 className="text-3xl font-black tracking-[-0.05em]">{plan.name}</h4>
            <p className="text-xl font-black opacity-75">{plan.speed}</p>
            <p className="my-3 text-4xl font-black">{money(plan.price)}<span className="text-base">/mo</span></p>
            {(plan.bullets || []).map((b, i) => <p key={i} className="mt-1 flex items-center text-sm font-black opacity-80"><CheckCircle2 className="mr-2 h-4 w-4" />{b}</p>)}
          </button>;
        })}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {(sales.addons || []).map((addon) => {
          const active = (sales.selectedAddonIds || []).includes(addon.id);
          return <button key={addon.id} onClick={() => toggleAddon(addon.id)} className={`rounded-2xl px-4 py-4 text-left font-black ring-1 ${active ? "bg-red-700 text-white ring-red-400" : "bg-black/30 text-white/75 ring-white/10"}`}>{active ? "✓ " : "+ "}{addon.name}<span className="block text-sm opacity-70">{money(addon.price)}/mo</span></button>;
        })}
      </div>
      <button onClick={goNext} className="mt-5 rounded-2xl bg-[#22c55e] px-5 py-4 text-base font-black text-black">Show savings</button>
    </Panel>
  );
}

function SavingsSummary({ math, goBack }) {
  const saving = math.monthlySave >= 0;
  return (
    <Panel>
      <div className="rounded-[2rem] bg-black/35 p-5 ring-1 ring-white/10">
        <p className="text-xs font-black uppercase tracking-[.25em] text-[#22c55e]/70">Final comparison</p>
        <h3 className="mt-2 text-4xl font-black tracking-[-0.06em] sm:text-6xl">{saving ? "They save money." : "This option costs more."}</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Stat label="Now" value={`${money(math.current)}/mo`} />
          <Stat label="With us" value={`${money(math.ourTotal)}/mo`} gold />
          <Stat label={saving ? "Monthly savings" : "Monthly difference"} value={money(Math.abs(math.monthlySave))} pink={!saving} gold={saving} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-3xl bg-[#22c55e] p-5 text-black"><p className="text-sm font-black uppercase opacity-60">1 year</p><p className="text-5xl font-black tracking-[-0.06em]">{money(Math.abs(math.yearlySave))}</p></div>
          <div className="rounded-3xl bg-red-700 p-5 text-white"><p className="text-sm font-black uppercase opacity-70">3 years</p><p className="text-5xl font-black tracking-[-0.06em]">{money(Math.abs(math.threeYearSave))}</p></div>
        </div>
        <p className="mt-4 text-lg font-bold text-white/60">Selected: {math.activePlan.name} at {money(math.activePlan.price)}/mo{math.selectedAddons.length ? ` + ${math.selectedAddons.map((a) => a.name).join(" + ")}` : ""}</p>
        <button onClick={goBack} className="mt-4 rounded-2xl bg-white/10 px-5 py-4 text-base font-black text-white/80">Adjust package</button>
      </div>
    </Panel>
  );
}

function PricingAdmin({ sales, updateSales }) {
  const updatePlan = (id, field, value) => updateSales({ ...sales, plans: (sales.plans || []).map((p) => p.id === id ? { ...p, [field]: field === "price" ? Number(value || 0) : value } : p) });
  const updateAddon = (id, field, value) => updateSales({ ...sales, addons: (sales.addons || []).map((a) => a.id === id ? { ...a, [field]: field === "price" ? Number(value || 0) : value } : a) });
  const addPlan = () => updateSales({ ...sales, plans: [...(sales.plans || []), { id: uid(), name: "New Plan", speed: "", price: 0, badge: "", bullets: [] }] });
  const addAddon = () => updateSales({ ...sales, addons: [...(sales.addons || []), { id: uid(), name: "New Add-on", price: 0, note: "" }] });

  return (
    <div className="space-y-4">
      <Panel>
        <h2 className="text-3xl font-black tracking-[-0.05em]">Pricing Admin</h2>
        <p className="mt-1 text-sm font-bold text-white/50">Edit plans and add-ons here. It saves with the rest of the app cloud state.</p>
      </Panel>
      <Panel>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-xl font-black">Plans</h3><button onClick={addPlan} className="rounded-xl bg-[#22c55e] px-4 py-2 text-sm font-black text-black">Add plan</button></div>
        <div className="space-y-3">
          {(sales.plans || []).map((plan) => <div key={plan.id} className="grid gap-2 rounded-2xl bg-black/30 p-3 md:grid-cols-4">
            <input value={plan.name} onChange={(e) => updatePlan(plan.id, "name", e.target.value)} className="rounded-xl bg-white px-3 py-3 font-black text-black" />
            <input value={plan.speed} onChange={(e) => updatePlan(plan.id, "speed", e.target.value)} className="rounded-xl bg-white px-3 py-3 font-black text-black" />
            <input value={plan.price} onChange={(e) => updatePlan(plan.id, "price", e.target.value)} inputMode="decimal" className="rounded-xl bg-white px-3 py-3 font-black text-black" />
            <input value={plan.badge || ""} onChange={(e) => updatePlan(plan.id, "badge", e.target.value)} className="rounded-xl bg-white px-3 py-3 font-black text-black" />
          </div>)}
        </div>
      </Panel>
      <Panel>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-xl font-black">Add-ons</h3><button onClick={addAddon} className="rounded-xl bg-[#22c55e] px-4 py-2 text-sm font-black text-black">Add add-on</button></div>
        <div className="space-y-3">
          {(sales.addons || []).map((addon) => <div key={addon.id} className="grid gap-2 rounded-2xl bg-black/30 p-3 md:grid-cols-3">
            <input value={addon.name} onChange={(e) => updateAddon(addon.id, "name", e.target.value)} className="rounded-xl bg-white px-3 py-3 font-black text-black" />
            <input value={addon.price} onChange={(e) => updateAddon(addon.id, "price", e.target.value)} inputMode="decimal" className="rounded-xl bg-white px-3 py-3 font-black text-black" />
            <input value={addon.note || ""} onChange={(e) => updateAddon(addon.id, "note", e.target.value)} className="rounded-xl bg-white px-3 py-3 font-black text-black" />
          </div>)}
        </div>
      </Panel>
    </div>
  );
}

function SharkBg() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -left-28 -top-28 h-[34rem] w-[34rem] rounded-full bg-[#22c55e]/30 blur-3xl" />
      <div className="absolute right-[-10rem] top-24 h-[32rem] w-[32rem] rounded-full bg-white/10 blur-3xl" />
      <div className="absolute bottom-[-12rem] left-1/3 h-[36rem] w-[36rem] rounded-full bg-[#172033]/70 blur-3xl" />
      <div className="absolute left-[12%] top-[22%] rotate-12 text-[15rem] font-black leading-none text-black/[0.035]">GFF</div>
      <div className="absolute right-[7%] top-[18%] -rotate-12 text-[13rem] font-black leading-none text-[#22c55e]/[0.09]">SHARKS</div>
      <div className="absolute bottom-[8%] left-[8%] h-24 w-24 rotate-45 rounded-tl-[100%] bg-black/[0.06]" />
      <div className="absolute bottom-[18%] right-[12%] h-32 w-32 rotate-45 rounded-tl-[100%] bg-[#22c55e]/[0.16]" />
    </div>
  );
}

function Header({ mode, setMode, admin }) {
  const tabs = admin
    ? [["areas", <Layers />, "Areas"], ["upload", <Upload />, "Upload"], ["count", <Target />, "Count"], ["erase", <Eraser />, "Erase"], ["auto", <Split />, "Auto"], ["manual", <Scissors />, "Map"], ["team", <Users />, "Team"]]
    : [["manual", <Map />, "Map"], ["team", <Users />, "Team"]];

  const openSalesPage = () => {
    if (typeof window !== "undefined") window.location.href = "/sales";
  };

  return (
    <header className="mb-3 rounded-[1.25rem] border border-[#22c55e]/15 bg-[#101827]/90 p-3 text-center shadow-xl shadow-black/30 backdrop-blur-xl sm:p-4">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3">
        <div>
          <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full bg-[#0f253f] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#38bdf8] ring-1 ring-red-500/30 sm:text-xs">
            <Flame className="h-3.5 w-3.5" /> IPAD FIX v4 LIVE • CLOUD SYNC
          </div>
          <h1 className="text-3xl font-black tracking-[-0.07em] sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-[#f8fafc] via-[#22c55e] to-[#38bdf8] bg-clip-text text-transparent">GFF OS</span>
          </h1>
        </div>
        <div className={`grid w-full max-w-4xl gap-1.5 rounded-2xl bg-black/70 p-1.5 ${admin ? "grid-cols-4 sm:grid-cols-4 lg:grid-cols-8" : "grid-cols-3 sm:max-w-xl"}`}>
          {tabs.map(([key, icon, label]) => (
            <button key={key} type="button" onClick={() => setMode(key)} className={`flex min-h-9 items-center justify-center rounded-xl px-2 text-xs font-black transition sm:min-h-10 ${mode === key ? "bg-[#22c55e] text-black shadow-lg shadow-[#22c55e]/20" : "text-white/70 hover:bg-white/10"}`}>
              {React.cloneElement(icon, { className: "mr-1 h-3.5 w-3.5" })}{label}
            </button>
          ))}
          <button type="button" onClick={openSalesPage} className="flex min-h-9 items-center justify-center rounded-xl bg-white px-2 text-xs font-black text-red-700 transition hover:bg-red-50 sm:min-h-10">
            <DollarSign className="mr-1 h-3.5 w-3.5" /> Quote
          </button>
        </div>
      </div>
    </header>
  );
}

function Panel({ children }) {
  return <div className="rounded-[1.5rem] border border-[#22c55e]/15 bg-[#111827]/90 p-4 text-[#f8fafc] shadow-xl shadow-black/25 backdrop-blur-xl sm:p-5">{children}</div>;
}

function Board({ totals, activeArea, activeShot, saveStatus, cloudError, lastCloudLoad, lastCloudSave, refreshFromCloudNow }) {
  const statusText = (saveStatus || "loading").replace(/-/g, " ");
  const timeText = lastCloudSave ? `saved ${lastCloudSave.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : lastCloudLoad ? `loaded ${lastCloudLoad.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "waiting";

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#22c55e]/70">Active</p>
          <p className="truncate text-sm font-black text-white/80">{activeArea?.name || "No area"}</p>
          <p className="truncate text-xs font-bold text-white/40">{activeShot?.name || "No screenshot"}</p>
        </div>
        <button onClick={refreshFromCloudNow} className="shrink-0 rounded-xl bg-[#0f253f] px-3 py-2 text-xs font-black text-[#38bdf8] ring-1 ring-red-500/25">
          Sync
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <MiniStat label="Leads on this screenshot" value={totals.leads} className="bg-[#22c55e] text-black" />
      </div>

      <div className="mt-3 rounded-xl border border-[#22c55e]/10 bg-black/25 px-3 py-2 text-xs font-bold text-white/45">
        <span className={saveStatus === "cloud-error" ? "text-red-300" : "text-emerald-300"}>Sync: {statusText}</span>
        <span className="mx-2">•</span>{timeText}
        {cloudError && <p className="mt-1 text-red-300">{cloudError}</p>}
      </div>
    </Panel>
  );
}

function MiniStat({ label, value, className }) {
  return <div className={`${className} rounded-xl p-2 text-center shadow-lg`}><p className="text-[10px] font-black uppercase opacity-70">{label}</p><p className="text-2xl font-black tracking-[-0.05em]">{value}</p></div>;
}

function Stat({ label, value, gold, pink }) {
  return <div className={`${gold ? "bg-[#22c55e] text-black" : pink ? "bg-gradient-to-br from-[#ff4f87] to-[#d71920] text-white" : "bg-black text-white"} rounded-2xl p-3 shadow-lg sm:p-4`}><p className="text-sm font-black sm:text-base">{label}</p><p className="text-3xl font-black tracking-[-0.05em] sm:text-4xl">{value}</p></div>;
}

function Admin({ admin, pin, setPin, unlock, exportData, resetData, compact, localCandidate, publishLocalBackupToCloud }) {
  const [open, setOpen] = useState(false);

  if (!admin && !open) {
    return (
      <div className="text-center">
        <button onClick={() => setOpen(true)} className="rounded-full border border-[#22c55e]/30 bg-black/45 px-4 py-2 text-xs font-black uppercase tracking-widest text-[#22c55e]/70 hover:text-[#22c55e]">
          Admin
        </button>
      </div>
    );
  }

  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center text-lg font-black"><Crown className="mr-2 h-5 w-5 text-[#22c55e]" /> Admin</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${admin ? "bg-[#22c55e] text-black" : "bg-black/40 text-white/60"}`}>{admin ? "Unlocked" : "Locked"}</span>
      </div>
      {!admin ? (
        <div className="space-y-2">
          <input value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && unlock()} placeholder="PIN" className="w-full rounded-xl border border-[#22c55e]/15 bg-black/30 px-4 py-3 text-base font-black text-white outline-none focus:border-[#22c55e]" />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={unlock} className="rounded-xl bg-[#22c55e] px-4 py-3 text-sm font-black text-black">Unlock</button>
            <button onClick={() => setOpen(false)} className="rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white/70">Hide</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={exportData} className="flex items-center justify-center rounded-xl bg-black px-3 py-3 text-sm font-black text-[#22c55e]"><Download className="mr-1.5 h-4 w-4" /> Export</button>
          <button onClick={resetData} className="flex items-center justify-center rounded-xl bg-red-700 px-3 py-3 text-sm font-black text-white"><RotateCcw className="mr-1.5 h-4 w-4" /> Reset</button>
          {localCandidate?.areas?.length ? <button onClick={publishLocalBackupToCloud} className="col-span-2 rounded-xl bg-[#22c55e] px-3 py-3 text-sm font-black text-black">Publish local backup</button> : null}
        </div>
      )}
    </Panel>
  );
}

function ViewerNav({ areas, activeArea, activeShot, selectedRep, setSelectedRep, switchArea, switchShot, stepArea, stepShot, teamStats }) {
  const shots = activeArea?.screenshots || [];
  const repStats = teamStats.find((r) => r.rep === selectedRep) || null;

  return (
    <div className="mb-4">
      <Panel>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-widest text-[#22c55e]/70">Area</p>
              <div className="flex gap-1.5">
                <button onClick={() => stepArea(-1)} className="rounded-lg bg-black px-3 py-1.5 text-xs font-black text-[#22c55e]">‹</button>
                <button onClick={() => stepArea(1)} className="rounded-lg bg-black px-3 py-1.5 text-xs font-black text-[#22c55e]">›</button>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(areas || []).map((a) => (
                <button key={a.id} onClick={() => switchArea(a.id)} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-black ${activeArea?.id === a.id ? "bg-[#22c55e] text-black" : "bg-white/[0.08] text-white/75"}`}>
                  {a.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-widest text-[#22c55e]/70">Screenshots</p>
              <div className="flex gap-1.5">
                <button onClick={() => stepShot(-1)} className="rounded-lg bg-black px-3 py-1.5 text-xs font-black text-[#22c55e]">‹</button>
                <button onClick={() => stepShot(1)} className="rounded-lg bg-black px-3 py-1.5 text-xs font-black text-[#22c55e]">›</button>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {shots.map((ss, i) => (
                <button key={ss.id} onClick={() => switchShot(ss.id)} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-black ${activeShot?.id === ss.id ? "bg-[#38bdf8] text-white" : "bg-white/[0.08] text-white/75"}`}>
                  SS {i + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-[220px]">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-[#22c55e]/70">See Leads</p>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-3">
              {["All", ...REPS].map((r) => {
                const active = selectedRep === r;
                const stat = teamStats.find((x) => x.rep === r);
                return (
                  <button key={r} onClick={() => setSelectedRep(r)} className={`rounded-xl px-2 py-2 text-xs font-black ring-1 ${active ? "bg-[#22c55e] text-black ring-[#22c55e]" : "bg-black/40 text-white/70 ring-white/10"}`}>
                    {r === "All" ? "All" : <><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: repColor(r) }} />{r}</>}
                    {stat && r !== "All" && <span className="ml-1 text-[10px] opacity-70">{stat.leads}</span>}
                  </button>
                );
              })}
            </div>
            {selectedRep !== "All" && repStats && <p className="mt-2 text-xs font-bold text-white/45">{selectedRep}: {repStats.leads} leads • {repStats.zones} zones</p>}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Areas({ areas, activeArea, activeShot, switchArea, switchShot, newAreaName, setNewAreaName, createArea, deleteArea, admin }) {
  const submitArea = (e) => {
    e.preventDefault();
    e.stopPropagation();
    createArea();
  };

  return (
    <Panel>
      <h2 className="mb-3 flex items-center text-xl font-black"><Map className="mr-2 h-5 w-5 text-[#22c55e]" /> Areas</h2>

      <form onSubmit={submitArea} className="mb-4 rounded-2xl border border-[#22c55e]/20 bg-black/25 p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-widest text-[#22c55e]/70">Create Area</p>
        <input
          value={newAreaName}
          onChange={(e) => setNewAreaName(e.target.value)}
          placeholder="New area name"
          autoComplete="off"
          className="mb-2 w-full rounded-xl border-2 border-[#22c55e]/30 bg-black/50 px-4 py-4 text-base font-black text-white outline-none placeholder:text-white/35 focus:border-[#22c55e]"
        />
        <button
          type="submit"
          className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#22c55e] to-[#d4af37] px-4 py-4 text-base font-black text-black shadow-lg shadow-[#22c55e]/20 active:scale-[.99]"
        >
          <FolderPlus className="mr-2 h-5 w-5" /> {admin ? "Create Area" : "Unlock Admin to Create"}
        </button>
      </form>

      <div className="space-y-2">
        {areas.map((a) => (
          <div key={a.id} className={`rounded-2xl border p-3 ${activeArea?.id === a.id ? "border-[#22c55e] bg-[#173321]" : "border-[#22c55e]/15 bg-[#172033]"}`}>
            <div className="flex justify-between gap-2">
              <button type="button" onClick={() => switchArea(a.id)} className="min-w-0 flex-1 text-left text-base font-black">
                <span className="block truncate">{a.name}</span>
              </button>
              {admin && <button type="button" onClick={() => deleteArea(a.id)} className="rounded-xl bg-red-950/70 px-3 py-2 text-red-300"><Trash2 className="h-4 w-4" /></button>}
            </div>
            <p className="mt-1 text-sm font-bold text-white/50">{a.screenshots?.length || 0} screenshots • {a.turfs?.length || 0} zones</p>
          </div>
        ))}
      </div>

      {activeArea?.screenshots?.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-black uppercase tracking-widest text-white/35">Screenshots</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {activeArea.screenshots.map((s, i) => (
              <button key={s.id} type="button" onClick={() => switchShot(s.id)} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-black ${activeShot?.id === s.id ? "bg-[#38bdf8] text-white" : "bg-white/[0.08] text-white/75"}`}>SS {i + 1}</button>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}


function IpadFileInput({ children, multiple = true, capture = undefined, onFiles, disabled = false, className = "" }) {
  const inputId = useMemo(() => `file-${uid()}`, []);

  return (
    <div className={`w-full rounded-2xl border-2 border-[#22c55e]/30 bg-black/55 p-4 shadow-lg ${disabled ? "opacity-50" : ""}`}>
      <label htmlFor={inputId} className={`mb-3 flex w-full cursor-pointer items-center justify-center rounded-xl px-4 py-4 text-base font-black shadow-lg ${className}`}>
        {children}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*,.png,.jpg,.jpeg,.heic,.heif"
        multiple={multiple}
        capture={capture}
        disabled={disabled}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
        className="block w-full cursor-pointer rounded-xl border-2 border-white/30 bg-white px-3 py-4 text-sm font-black text-black file:mr-3 file:rounded-lg file:border-0 file:bg-black file:px-4 file:py-3 file:text-sm file:font-black file:text-[#22c55e]"
      />
      <p className="mt-2 text-center text-xs font-black text-[#22c55e]/80">Old iPad fallback: tap the white Choose File box above.</p>
    </div>
  );
}

function NativeUploadStack({ upload, disabled = false }) {
  return (
    <div className="mx-auto grid w-full max-w-md gap-3 rounded-3xl border-2 border-red-500/35 bg-red-950/20 p-4 shadow-2xl shadow-red-950/30">
      <div className="rounded-2xl bg-black/60 p-3 text-center text-xs font-black uppercase tracking-widest text-[#38bdf8] ring-1 ring-red-500/25">
        IPAD FIX v4 LIVE
      </div>
      <IpadFileInput disabled={disabled} onFiles={upload} className="bg-[#22c55e] text-black">
        <ImageIcon className="mr-2 h-5 w-5" /> Choose Screenshot / Camera Roll
      </IpadFileInput>
      <IpadFileInput disabled={disabled} multiple={false} capture="environment" onFiles={upload} className="bg-gradient-to-r from-red-700 to-red-500 text-white">
        <ImageIcon className="mr-2 h-5 w-5" /> Take Photo
      </IpadFileInput>
      <p className="text-center text-xs font-bold text-white/45">PNG/JPG screenshots work best. HEIC may fail on older iPads.</p>
    </div>
  );
}

function UploadBox({ upload, admin }) {
  return (
    <Panel>
      <h2 className="mb-3 flex items-center text-xl font-black"><Upload className="mr-2 h-5 w-5" /> Upload</h2>
      <p className="mb-3 rounded-xl bg-white/[0.08] p-3 text-sm font-bold text-white/60">
        iPad-safe upload. This uses real native file inputs, not hidden button tricks.
      </p>
      {!admin && <p className="mb-3 rounded-xl bg-red-950/50 p-3 text-sm font-black text-red-200">Admin is locked. Unlock first, then upload.</p>}
      <NativeUploadStack upload={upload} disabled={!admin} />
    </Panel>
  );
}

function AutoBox({ assignments, setAssignments, totals, autoThis, autoArea, admin }) { const total = assignments.reduce((s, a) => s + Number(a.percent || 0), 0); const update = (i, field, value) => setAssignments(assignments.map((a, idx) => idx === i ? { ...a, [field]: value } : a)); return <Panel><h2 className="mb-4 flex items-center text-2xl font-black"><Percent className="mr-2 text-[#22c55e]" /> Auto Split</h2><p className="mb-4 rounded-2xl bg-[#22c55e] p-4 text-lg font-black">{totals.leads} leads • {total}% assigned</p><div className="space-y-4">{assignments.map((a, i) => <div key={i} className="rounded-3xl bg-white/[0.08] p-4"><div className="mb-3 grid grid-cols-[1fr_auto_auto] gap-2"><select value={a.rep} onChange={(e) => update(i, "rep", e.target.value)} className="rounded-2xl px-4 py-3 text-lg font-black">{REPS.map((r) => <option key={r}>{r}</option>)}</select><span className="rounded-2xl bg-[#172033] px-4 py-3 text-lg font-black">{a.percent}%</span><button onClick={() => setAssignments(assignments.filter((_, idx) => idx !== i))} className="rounded-2xl bg-red-950/70 px-4 text-red-300"><Trash2 /></button></div><input type="range" min="0" max="100" step="5" value={a.percent} onChange={(e) => update(i, "percent", Number(e.target.value))} className="w-full accent-[#22c55e]" /></div>)}</div><div className="mt-4 grid grid-cols-3 gap-2"><button onClick={() => setAssignments([...assignments, { rep: REPS[0], percent: 0 }])} className="rounded-2xl bg-white/10 py-4 text-lg font-black">Add</button><button disabled={!admin} onClick={autoThis} className="rounded-2xl bg-black py-4 text-lg font-black text-[#22c55e] disabled:opacity-40">This SS</button><button disabled={!admin} onClick={autoArea} className="rounded-2xl bg-[#22c55e] py-4 text-lg font-black disabled:opacity-40">Whole Area</button></div></Panel>; }
function ManualBox({ manualRep, setManualRep, polygon, clear, saveManual, admin, editMode, setEditMode, selectedTurf, deleteSelected }) {
  return (
    <Panel>
      <h2 className="mb-4 flex items-center text-xl font-black"><Scissors className="mr-2 text-[#22c55e]" /> Manual Cut</h2>
      <select value={manualRep} onChange={(e) => setManualRep(e.target.value)} className="mb-3 w-full rounded-xl border-2 border-[#22c55e]/15 px-4 py-3 text-base font-black">{REPS.map((r) => <option key={r}>{r}</option>)}</select>
      <p className="mb-3 rounded-xl bg-white/[0.08] p-3 text-sm font-bold">{editMode ? "Editor ON: tap a saved zone, drag the whole zone, or drag a corner." : "Tap the map to draw. No turf names, just the dude."}</p>
      <button disabled={!admin} onClick={() => setEditMode(!editMode)} className={`mb-3 w-full rounded-xl py-3 text-base font-black disabled:opacity-40 ${editMode ? "bg-[#22c55e] text-black" : "bg-black text-[#22c55e]"}`}>Polygon Editor: {editMode ? "ON" : "OFF"}</button>
      {editMode && selectedTurf && (
        <button onClick={deleteSelected} className="mb-3 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-red-700 to-red-500 py-3 text-base font-black text-white"><Trash2 className="mr-2 h-4 w-4" /> Delete Selected Zone</button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button disabled={!admin || polygon.length < 3 || editMode} onClick={saveManual} className="rounded-xl bg-black py-3 text-base font-black text-[#22c55e] disabled:opacity-40"><Save className="mr-2 inline h-4 w-4" />Save</button>
        <button onClick={clear} className="rounded-xl bg-white/10 py-3 text-base font-black">Clear</button>
      </div>
      <p className="mt-2 text-sm font-bold text-white/50">{editMode ? selectedTurf ? `Selected: ${selectedTurf.rep} • ${selectedTurf.counts?.yellow || 0} leads` : "No zone selected." : `Points: ${polygon.length}`}</p>
    </Panel>
  );
}

function RepFilter({ selectedRep, setSelectedRep }) { return <Panel><h2 className="mb-4 flex items-center text-2xl font-black"><Filter className="mr-2" /> Map Filter</h2><div className="grid grid-cols-2 gap-2">{["All", ...REPS].map((r) => <button key={r} onClick={() => setSelectedRep(r)} className={`rounded-2xl px-4 py-3 text-lg font-black ${selectedRep === r ? "bg-black text-[#22c55e]" : "bg-white/[0.08]"}`}>{r}</button>)}</div></Panel>; }
function Tuning({ options, setOptions, reCount }) { return <Panel><h2 className="mb-4 flex items-center text-2xl font-black"><Wand2 className="mr-2" /> Tuning</h2><Slider label="Sensitivity" value={options.sensitivity} min={0} max={10} step={1} onChange={(v) => setOptions({ ...options, sensitivity: Number(v) })} /><Slider label="Dot Size" value={options.expectedDotArea} min={60} max={420} step={10} onChange={(v) => setOptions({ ...options, expectedDotArea: Number(v) })} /><button onClick={reCount} className="mt-4 w-full rounded-2xl bg-black py-4 text-xl font-black text-[#22c55e]">Recount</button></Panel>; }
function Slider({ label, value, min, max, step, onChange }) { return <label className="mb-4 block"><div className="mb-2 flex justify-between text-lg font-black"><span>{label}</span><span>{value}</span></div><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value)} className="w-full accent-[#22c55e]" /></label>; }
function MapPanel({ fileRef, upload, activeShot, canvasRef, overlayRef, canvasClick, mode, showDots, setShowDots, showTurf, setShowTurf, showSold, setShowSold, uploadEnabled, startDrag, moveDrag, stopDrag, editMode, startSwipe, endSwipe, handleTouchStart, handleTouchMove, handleTouchEnd }) {
  return (
    <div className="rounded-[1.5rem] border border-[#22c55e]/15 bg-[#111827]/90 p-3 text-[#f8fafc] shadow-xl shadow-black/30 backdrop-blur-xl sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xl font-black">{activeShot?.name || "No screenshot selected"}</p>
          <p className="text-sm font-bold text-white/50">{mode === "erase" ? "Click a false dot to delete it." : mode === "manual" && editMode ? "Editor is on. Tap zones, drag zones, or drag corners." : mode === "manual" ? "Click to draw a polygon." : "Saved turf stays visible."}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowDots(!showDots)} className="rounded-xl bg-black px-3 py-2 text-sm font-black text-[#22c55e]">{showDots ? <EyeOff className="mr-1 inline h-4 w-4" /> : <Eye className="mr-1 inline h-4 w-4" />}Dots</button>
          <button onClick={() => setShowTurf(!showTurf)} className="rounded-xl bg-black px-3 py-2 text-sm font-black text-[#22c55e]">{showTurf ? <EyeOff className="mr-1 inline h-4 w-4" /> : <Eye className="mr-1 inline h-4 w-4" />}Turf</button>
          <button onClick={() => setShowSold(!showSold)} className={`rounded-xl px-3 py-2 text-xs font-black ${showSold ? "bg-[#7f1d1d] text-white" : "bg-black/60 text-white/35"}`}>Sold {showSold ? "ON" : "OFF"}</button>
          <span className="rounded-xl bg-red-950/50 px-3 py-2 text-xs font-black text-red-200 ring-1 ring-red-500/25">IPAD v4</span>
        </div>
      </div>
      <div
        onClick={canvasClick}
        onMouseDown={startDrag}
        onMouseMove={moveDrag}
        onMouseUp={(e) => { stopDrag(e); endSwipe(e); }}
        onMouseLeave={stopDrag}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={(e) => { stopDrag(e); endSwipe(e); }}
        onPointerCancel={stopDrag}
        onPointerLeave={stopDrag}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={stopDrag}
        onDrop={(e) => { e.preventDefault(); if (uploadEnabled) upload(e.dataTransfer.files); }}
        onDragOver={(e) => e.preventDefault()}
        className={`relative grid min-h-[560px] touch-none place-items-center overflow-auto rounded-[1.25rem] border-2 border-dashed border-[#22c55e]/20 bg-black/35 sm:min-h-[650px] ${mode === "manual" || mode === "erase" ? "cursor-crosshair" : ""}`}
        style={{ touchAction: "none" }}
      >
        {!activeShot && (
          <div className="p-8 text-center">
            <Upload className="mx-auto mb-4 h-14 w-14" />
            <h2 className="text-3xl font-black">Upload screenshots for this area</h2>
            <div className="mt-5">
              <NativeUploadStack upload={upload} disabled={!uploadEnabled} />
            </div>
          </div>
        )}
        <div className={activeShot ? "relative max-w-full" : "hidden"}>
          <canvas ref={canvasRef} className="block max-w-full rounded-2xl" />
          <canvas ref={overlayRef} onPointerDown={startDrag} className="absolute left-0 top-0 block max-w-full touch-none rounded-2xl" style={{ touchAction: "none" }} />
        </div>
      </div>
    </div>
  );
}

function TurfLegend({ turfs }) {
  if (!turfs?.length) return null;
  const grouped = turfs.reduce((acc, turf) => {
    if (!acc[turf.rep]) acc[turf.rep] = { rep: turf.rep, zones: 0, leads: 0, sold: 0, total: 0 };
    acc[turf.rep].zones += 1;
    acc[turf.rep].leads += turf.counts?.yellow || 0;
    acc[turf.rep].sold += turf.counts?.pink || 0;
    acc[turf.rep].total += turf.counts?.total || 0;
    return acc;
  }, {});
  const rows = Object.values(grouped);
  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-3xl font-black">Turf Legend</h2>
        <span className="rounded-full bg-black px-4 py-2 text-sm font-black text-[#22c55e]">{turfs.length} zones</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.rep} className="rounded-3xl border border-[#22c55e]/15 bg-[#172033] p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-5 w-5 rounded-full border-2 border-black" style={{ backgroundColor: repColor(row.rep) }} />
              <h3 className="text-2xl font-black">{row.rep}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-[#22c55e] p-3 text-center font-black text-black">
                <p className="text-xs uppercase opacity-70">Leads</p>
                <p className="text-2xl">{row.leads}</p>
              </div>
              <div className="rounded-2xl bg-black p-3 text-center font-black text-white">
                <p className="text-xs uppercase opacity-70">Zones</p>
                <p className="text-2xl">{row.zones}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AreaDeck({ areas, switchArea, setMode, admin }) { return <Panel><h2 className="mb-5 flex items-center text-4xl font-black"><Layers className="mr-3 h-9 w-9" /> Areas Command Deck</h2>{areas.length === 0 ? <div className="rounded-3xl bg-white/[0.08] p-10 text-center"><h3 className="text-4xl font-black">No areas yet</h3><p className="mt-2 text-xl font-bold text-white/50">Unlock Sam Admin, create an area, upload screenshots.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{areas.map((a) => { const leads = (a.screenshots || []).reduce((s, shot) => s + (shot.detections?.lead?.length || 0), 0); return <button key={a.id} onClick={() => { switchArea(a.id); setMode("count"); }} className="rounded-[2rem] bg-black p-6 text-left text-white shadow-xl transition hover:-translate-y-1"><h3 className="text-3xl font-black">{a.name}</h3><p className="mt-1 text-lg font-bold text-white/60">{a.screenshots?.length || 0} screenshots • {a.turfs?.length || 0} zones</p><p className="mt-5 text-7xl font-black text-[#22c55e]">{leads}</p><p className="text-sm font-black uppercase tracking-widest text-white/50">leads</p></button>; })}</div>}</Panel>; }
function TeamView({ teamStats, teamRep, setTeamRep, teamTurfs, admin, deleteTurf, setSelectedRep, setMode }) {
  const activeStats = teamStats.find((s) => s.rep === teamRep) || { leads: 0, sold: 0, zones: 0 };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center text-2xl font-black sm:text-3xl"><Users className="mr-2 h-7 w-7" /> Team Tool</h2>
            <p className="text-sm font-bold text-white/45">Pick a rep, open their turf, or jump to the separate quote builder.</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
            <button type="button" onClick={() => { setSelectedRep(teamRep); setMode("manual"); }} className="rounded-xl bg-[#22c55e] px-4 py-3 text-sm font-black text-black">Open {teamRep}'s Map</button>
            <button type="button" onClick={() => { if (typeof window !== "undefined") window.location.href = "/sales"; }} className="rounded-xl bg-white px-4 py-3 text-sm font-black text-red-700">Open Quote Builder</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {REPS.map((r) => {
            const stat = teamStats.find((s) => s.rep === r) || { leads: 0, sold: 0, zones: 0 };
            return (
              <button key={r} onClick={() => setTeamRep(r)} className={`rounded-2xl border p-3 text-left transition ${teamRep === r ? "border-[#22c55e] bg-black shadow-lg shadow-[#22c55e]/10" : "border-white/10 bg-white/[0.06]"}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full ring-2 ring-black" style={{ backgroundColor: repColor(r) }} />
                  <span className="text-base font-black">{r}</span>
                </div>
                <p className="text-3xl font-black text-[#22c55e]">{stat.leads}</p>
                <p className="text-xs font-bold text-white/45">leads • {stat.zones} zones</p>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black" style={{ color: repColor(teamRep) }}>{teamRep}'s Turf</h3>
            <p className="text-sm font-bold text-white/45">{activeStats.leads} leads • {activeStats.zones} zones</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setSelectedRep(teamRep); setMode("manual"); }} className="rounded-xl bg-black px-4 py-2 text-sm font-black text-[#22c55e]">Map</button>
            <button type="button" onClick={() => { if (typeof window !== "undefined") window.location.href = "/sales"; }} className="rounded-xl bg-white px-4 py-2 text-sm font-black text-red-700">Quote</button>
          </div>
        </div>
        {teamTurfs.length === 0 ? (
          <p className="rounded-2xl bg-white/[0.08] p-6 text-center text-base font-bold text-white/50">No turf assigned yet.</p>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {teamTurfs.map((t) => (
              <div key={t.id} className="rounded-2xl border border-white/10 bg-black/60 p-4 text-white shadow-xl">
                <div className="mb-3 flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black">{t.areaName}</p>
                    <p className="truncate text-xs font-bold text-white/45">{t.imageName}</p>
                  </div>
                  {admin && <button onClick={() => deleteTurf(t.id)} className="text-red-300"><Trash2 /></button>}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <MiniStat label="Leads" value={t.counts?.yellow || 0} className="bg-[#22c55e] text-black" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
