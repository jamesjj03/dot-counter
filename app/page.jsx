"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";

const REPS = ["JJ", "Sam", "Zack", "Dylan", "Julian", "Chris", "Christian", "Jacob"];
const DB_NAME = "ddm-sharks-black-gold-v1";
const STORE = "state";
const KEY = "app";
const TEAM_DATA_URL = "/team-data.json";

const DEFAULT_APP = {
  areas: [],
  activeAreaId: null,
  activeShotId: null,
  assignments: [
    { rep: "Zack", percent: 35 },
    { rep: "JJ", percent: 30 },
    { rep: "Christian", percent: 35 },
  ],
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
  return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

async function loadTeamData() {
  try {
    const res = await fetch(`${TEAM_DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.areas ? data : null;
  } catch {
    return null;
  }
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

function repColor(rep) {
  const colors = ["#d4af37", "#111827", "#7c3aed", "#c2410c", "#15803d", "#0369a1", "#be185d", "#a16207"];
  return colors[Math.abs(rep.split("").reduce((s, c) => s + c.charCodeAt(0), 0)) % colors.length];
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

export default function DDMSharksOps() {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const fileRef = useRef(null);

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
  const [polygon, setPolygon] = useState([]);
  const [manualRep, setManualRep] = useState("JJ");
  const [editMode, setEditMode] = useState(false);
  const [selectedTurfId, setSelectedTurfId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [sharedLoaded, setSharedLoaded] = useState(false);

  useEffect(() => {
    Promise.all([loadDb(), loadTeamData()]).then(([saved, shared]) => {
      const sharedHasAreas = shared?.areas?.length > 0;
      const savedHasAreas = saved?.areas?.length > 0;

      if (sharedHasAreas) {
        setApp({ ...DEFAULT_APP, ...shared });
        setSharedLoaded(true);
      } else if (savedHasAreas) {
        setApp({ ...DEFAULT_APP, ...saved });
      }

      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded && admin) saveDb(app);
  }, [app, loaded, admin]);

  const activeArea = useMemo(() => app.areas.find((a) => a.id === app.activeAreaId) || app.areas[0] || null, [app]);
  const activeShot = useMemo(() => activeArea?.screenshots?.find((s) => s.id === app.activeShotId) || activeArea?.screenshots?.[0] || null, [activeArea, app.activeShotId]);
  const detections = activeShot?.detections || { lead: [], pink: [] };

  const visibleTurfs = useMemo(() => {
    const byShot = (activeArea?.turfs || []).filter((t) => activeShot && t.screenshotId === activeShot.id);
    return selectedRep === "All" ? byShot : byShot.filter((t) => t.rep === selectedRep);
  }, [activeArea, activeShot, selectedRep]);

  const selectedTurf = useMemo(() => visibleTurfs.find((t) => t.id === selectedTurfId) || null, [visibleTurfs, selectedTurfId]);

  const allTurfs = useMemo(() => app.areas.flatMap((area) => (area.turfs || []).map((t) => ({ ...t, areaName: area.name, screenshot: area.screenshots?.find((s) => s.id === t.screenshotId) }))), [app.areas]);
  const teamTurfs = useMemo(() => allTurfs.filter((t) => t.rep === teamRep), [allTurfs, teamRep]);
  const totals = useMemo(() => ({ leads: detections.lead?.length || 0, sold: detections.pink?.length || 0, total: (detections.lead?.length || 0) + (detections.pink?.length || 0) }), [detections]);
  const teamStats = useMemo(() => REPS.map((rep) => {
    const mine = allTurfs.filter((t) => t.rep === rep);
    return { rep, zones: mine.length, leads: mine.reduce((s, t) => s + (t.counts?.yellow || 0), 0), sold: mine.reduce((s, t) => s + (t.counts?.pink || 0), 0), total: mine.reduce((s, t) => s + (t.counts?.total || 0), 0) };
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

  const createArea = () => {
    if (!admin || !newAreaName.trim()) return;
    const area = { id: uid(), name: newAreaName.trim(), screenshots: [], turfs: [], createdAt: new Date().toISOString() };
    setApp((prev) => ({ ...prev, areas: [area, ...prev.areas], activeAreaId: area.id, activeShotId: null }));
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
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  const upload = (files) => {
    if (!admin || !activeArea || !files?.length) return;
    Promise.all(Array.from(files).map(fileToShot)).then((shots) => {
      setApp((prev) => ({
        ...prev,
        activeShotId: shots[0]?.id || prev.activeShotId,
        areas: prev.areas.map((a) => a.id === activeArea.id ? { ...a, screenshots: [...(a.screenshots || []), ...shots] } : a),
      }));
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
    const zones = (activeArea.screenshots || []).flatMap((s) => autoSplitScreenshot(s, app.assignments, activeArea.id));
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

  const getCanvasPoint = (e) => {
    const canvas = overlayRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
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

  const drawOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (showTurf) visibleTurfs.forEach((t) => drawTurf(ctx, t, editMode && t.id === selectedTurfId));
    if (polygon.length) drawWorkingPolygon(ctx, polygon);
    if (showDots) DOT_PRESETS.forEach((preset) => (detections[preset.key] || []).forEach((dot) => drawDot(ctx, dot, preset.color)));
  }, [showTurf, visibleTurfs, polygon, showDots, detections, editMode, selectedTurfId]);

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

  if (!loaded) return <main className="grid min-h-screen place-items-center bg-[#0a0a0a] text-[#f5c542]"><div className="text-4xl font-black">Loading DDM SHARKS...</div></main>;

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#111111]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif" }}>
      <SharkBg />
      <section className="relative mx-auto max-w-[1540px] px-4 py-5 sm:px-7 lg:px-10">
        <Header mode={mode} setMode={setMode} admin={admin} />
        <div className="grid gap-5 xl:grid-cols-[440px_1fr]">
          <aside className="space-y-5">
            <Board totals={totals} activeArea={activeArea} activeShot={activeShot} sharedLoaded={sharedLoaded} />
            <Admin admin={admin} pin={pin} setPin={setPin} unlock={() => { if (pin.trim() === "6969") { setAdmin(true); setPin(""); } }} exportData={exportData} resetData={resetData} compact={!admin} />
            {admin && <Areas areas={app.areas} activeArea={activeArea} activeShot={activeShot} switchArea={switchArea} switchShot={switchShot} newAreaName={newAreaName} setNewAreaName={setNewAreaName} createArea={createArea} deleteArea={deleteArea} admin={admin} />}
            {mode === "upload" && admin && <UploadBox fileRef={fileRef} upload={upload} admin={admin} />}
            {mode === "auto" && admin && <AutoBox assignments={app.assignments} setAssignments={updateAssignments} totals={totals} autoThis={autoThis} autoArea={autoArea} admin={admin} />}
            {mode === "manual" && admin && <ManualBox manualRep={manualRep} setManualRep={setManualRep} polygon={polygon} clear={() => setPolygon([])} saveManual={saveManual} admin={admin} editMode={editMode} setEditMode={setEditMode} selectedTurf={selectedTurf} deleteSelected={() => selectedTurfId && deleteTurf(selectedTurfId)} />}
            <RepFilter selectedRep={selectedRep} setSelectedRep={setSelectedRep} />
            {mode === "count" && admin && <Tuning options={app.options} setOptions={updateOptions} reCount={reCount} />}
          </aside>

          <section className="space-y-5">
            {mode === "team" ? (
              <TeamView teamStats={teamStats} teamRep={teamRep} setTeamRep={setTeamRep} teamTurfs={teamTurfs} admin={admin} deleteTurf={deleteTurf} />
            ) : mode === "areas" ? (
              <AreaDeck areas={app.areas} switchArea={switchArea} setMode={setMode} admin={admin} />
            ) : (
              <>
                <MapPanel fileRef={fileRef} upload={upload} activeShot={activeShot} canvasRef={canvasRef} overlayRef={overlayRef} canvasClick={canvasClick} mode={mode} showDots={showDots} setShowDots={setShowDots} showTurf={showTurf} setShowTurf={setShowTurf} uploadEnabled={admin} startDrag={startDrag} moveDrag={moveDrag} stopDrag={stopDrag} editMode={editMode} />
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

function SharkBg() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -left-28 -top-28 h-[34rem] w-[34rem] rounded-full bg-[#f5c542]/30 blur-3xl" />
      <div className="absolute right-[-10rem] top-24 h-[32rem] w-[32rem] rounded-full bg-black/10 blur-3xl" />
      <div className="absolute bottom-[-12rem] left-1/3 h-[36rem] w-[36rem] rounded-full bg-white/70 blur-3xl" />
      <div className="absolute left-[12%] top-[22%] rotate-12 text-[15rem] font-black leading-none text-black/[0.035]">DDM</div>
      <div className="absolute right-[7%] top-[18%] -rotate-12 text-[13rem] font-black leading-none text-[#b8860b]/[0.09]">SHARKS</div>
      <div className="absolute bottom-[8%] left-[8%] h-24 w-24 rotate-45 rounded-tl-[100%] bg-black/[0.06]" />
      <div className="absolute bottom-[18%] right-[12%] h-32 w-32 rotate-45 rounded-tl-[100%] bg-[#f5c542]/[0.16]" />
    </div>
  );
}

function Header({ mode, setMode, admin }) {
  const adminTabs = [["areas", <Layers />, "Areas"], ["upload", <Upload />, "Upload"], ["count", <Target />, "Count"], ["erase", <Eraser />, "Erase"], ["auto", <Split />, "Auto"], ["manual", <Scissors />, "Cut"], ["team", <Users />, "Team"]];
  const viewerTabs = [["areas", <Layers />, "Map"], ["team", <Users />, "Team"]];
  const tabs = admin ? adminTabs : viewerTabs;

  return (
    <header className="mb-5 rounded-[2rem] border border-black/10 bg-white/85 p-4 text-center shadow-xl shadow-black/10 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4">
        <div>
          <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-sm font-black text-[#f5c542] shadow-lg">
            <Flame className="h-4 w-4" /> team turf command center
          </div>
          <h1 className="text-4xl font-black tracking-[-0.07em] sm:text-6xl">
            <span className="bg-gradient-to-r from-black via-[#2c2413] to-[#b8860b] bg-clip-text text-transparent">DDM SHARKS</span>
          </h1>
          <p className="mx-auto mt-1 max-w-3xl text-base font-bold text-black/60">Open your map, pick your name, and see your turf.</p>
        </div>
        <div className={`grid w-full gap-2 rounded-[1.5rem] bg-black p-2 ${admin ? "grid-cols-4 sm:grid-cols-7" : "grid-cols-2 max-w-md"}`}>
          {tabs.map(([key, icon, label]) => (
            <button key={key} onClick={() => setMode(key)} className={`flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-black transition ${mode === key ? "bg-[#f5c542] text-black" : "text-white/80 hover:bg-white/10"}`}>
              {React.cloneElement(icon, { className: "mr-2 h-4 w-4" })}{label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

function Panel({ children }) { return <div className="rounded-[2rem] border border-black/10 bg-white/85 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">{children}</div>; }
function Board({ totals, activeArea, activeShot, sharedLoaded }) { return <Panel><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-[.22em] text-[#9b7412]">Active Board</p><p className="text-6xl font-black tracking-[-0.06em]">{totals.total}</p><p className="text-sm font-bold text-black/50">{activeArea?.name || "No area"}{activeShot ? ` • ${activeShot.name}` : ""}</p>{sharedLoaded && <p className="mt-2 inline-flex rounded-full bg-[#f5c542] px-3 py-1 text-xs font-black text-black">Team data loaded</p>}</div><div className="rounded-2xl bg-black p-3 text-[#f5c542]"><Crosshair className="h-8 w-8" /></div></div><div className="mt-4 grid grid-cols-2 gap-3"><Stat label="Leads" value={totals.leads} gold /><Stat label="Sold" value={totals.sold} pink /></div></Panel>; }
function Stat({ label, value, gold, pink }) { return <div className={`${gold ? "bg-[#f5c542] text-black" : pink ? "bg-[#ff4f87] text-white" : "bg-black text-white"} rounded-2xl p-4 shadow-lg`}><p className="text-lg font-black">{label}</p><p className="text-4xl font-black tracking-[-0.05em]">{value}</p></div>; }
function Admin({ admin, pin, setPin, unlock, exportData, resetData, compact }) {
  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center text-xl font-black"><Crown className="mr-2 h-5 w-5 text-[#b8860b]" /> Sam Admin</h2>
        <span className={`rounded-full px-3 py-1.5 text-xs font-black ${admin ? "bg-[#f5c542] text-black" : "bg-black/10"}`}>{admin ? "Unlocked" : "Locked"}</span>
      </div>
      {!admin ? (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && unlock()} placeholder="Admin PIN" className="w-full rounded-xl border-2 border-black/10 px-4 py-3 text-base font-black outline-none focus:border-[#f5c542]" />
          <button onClick={unlock} className="rounded-xl bg-black px-4 py-3 text-base font-black text-[#f5c542]">Unlock</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={exportData} className="flex items-center justify-center rounded-xl bg-black px-4 py-3 text-base font-black text-[#f5c542]"><Download className="mr-2 h-4 w-4" /> Export</button>
          <button onClick={resetData} className="flex items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-base font-black text-white"><RotateCcw className="mr-2 h-4 w-4" /> Reset</button>
        </div>
      )}
      {compact && <p className="mt-3 text-sm font-bold text-black/45">Viewer mode is simple on purpose. Admin unlock shows the tools.</p>}
    </Panel>
  );
}

function Areas({ areas, activeArea, activeShot, switchArea, switchShot, newAreaName, setNewAreaName, createArea, deleteArea, admin }) { return <Panel><h2 className="mb-4 flex items-center text-2xl font-black"><Map className="mr-2 h-6 w-6 text-[#b8860b]" /> Areas</h2>{admin && <div className="mb-4 grid grid-cols-[1fr_auto] gap-2"><input value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} placeholder="New area" className="rounded-2xl border-2 border-black/10 px-5 py-4 text-lg font-black outline-none" /><button onClick={createArea} className="rounded-2xl bg-black px-5 text-[#f5c542]"><FolderPlus className="h-6 w-6" /></button></div>}<div className="space-y-3">{areas.map((a) => <div key={a.id} className={`rounded-3xl border-2 p-4 ${activeArea?.id === a.id ? "border-[#d4af37] bg-[#fff8df]" : "border-black/10 bg-white"}`}><div className="flex justify-between gap-3"><button onClick={() => switchArea(a.id)} className="text-left text-xl font-black">{a.name}</button>{admin && <button onClick={() => deleteArea(a.id)} className="text-red-500"><Trash2 /></button>}</div><p className="font-bold text-black/50">{a.screenshots?.length || 0} screenshots • {a.turfs?.length || 0} zones</p></div>)}</div>{activeArea?.screenshots?.length > 0 && <div className="mt-5 space-y-2"><p className="text-sm font-black uppercase tracking-widest text-black/40">Screenshots</p>{activeArea.screenshots.map((s, i) => <button key={s.id} onClick={() => switchShot(s.id)} className={`w-full rounded-2xl px-4 py-3 text-left text-lg font-black ${activeShot?.id === s.id ? "bg-black text-[#f5c542]" : "bg-black/5"}`}>{i + 1}. {s.name}</button>)}</div>}</Panel>; }
function UploadBox({ fileRef, upload, admin }) { return <Panel><h2 className="mb-4 flex items-center text-2xl font-black"><Upload className="mr-2" /> Upload</h2><input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} /><button disabled={!admin} onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center rounded-2xl bg-black px-5 py-5 text-xl font-black text-[#f5c542] disabled:opacity-40"><ImageIcon className="mr-2" /> Upload Screenshots</button></Panel>; }
function AutoBox({ assignments, setAssignments, totals, autoThis, autoArea, admin }) { const total = assignments.reduce((s, a) => s + Number(a.percent || 0), 0); const update = (i, field, value) => setAssignments(assignments.map((a, idx) => idx === i ? { ...a, [field]: value } : a)); return <Panel><h2 className="mb-4 flex items-center text-2xl font-black"><Percent className="mr-2 text-[#b8860b]" /> Auto Split</h2><p className="mb-4 rounded-2xl bg-[#f5c542] p-4 text-lg font-black">{totals.leads} leads • {total}% assigned</p><div className="space-y-4">{assignments.map((a, i) => <div key={i} className="rounded-3xl bg-black/5 p-4"><div className="mb-3 grid grid-cols-[1fr_auto_auto] gap-2"><select value={a.rep} onChange={(e) => update(i, "rep", e.target.value)} className="rounded-2xl px-4 py-3 text-lg font-black">{REPS.map((r) => <option key={r}>{r}</option>)}</select><span className="rounded-2xl bg-white px-4 py-3 text-lg font-black">{a.percent}%</span><button onClick={() => setAssignments(assignments.filter((_, idx) => idx !== i))} className="rounded-2xl bg-red-100 px-4 text-red-600"><Trash2 /></button></div><input type="range" min="0" max="100" step="5" value={a.percent} onChange={(e) => update(i, "percent", Number(e.target.value))} className="w-full accent-[#b8860b]" /></div>)}</div><div className="mt-4 grid grid-cols-3 gap-2"><button onClick={() => setAssignments([...assignments, { rep: REPS[0], percent: 0 }])} className="rounded-2xl bg-black/10 py-4 text-lg font-black">Add</button><button disabled={!admin} onClick={autoThis} className="rounded-2xl bg-black py-4 text-lg font-black text-[#f5c542] disabled:opacity-40">This SS</button><button disabled={!admin} onClick={autoArea} className="rounded-2xl bg-[#f5c542] py-4 text-lg font-black disabled:opacity-40">Whole Area</button></div></Panel>; }
function ManualBox({ manualRep, setManualRep, polygon, clear, saveManual, admin, editMode, setEditMode, selectedTurf, deleteSelected }) {
  return (
    <Panel>
      <h2 className="mb-4 flex items-center text-xl font-black"><Scissors className="mr-2 text-[#b8860b]" /> Manual Cut</h2>
      <select value={manualRep} onChange={(e) => setManualRep(e.target.value)} className="mb-3 w-full rounded-xl border-2 border-black/10 px-4 py-3 text-base font-black">{REPS.map((r) => <option key={r}>{r}</option>)}</select>
      <p className="mb-3 rounded-xl bg-black/5 p-3 text-sm font-bold">{editMode ? "Editor ON: tap a saved zone, drag the whole zone, or drag a corner." : "Tap the map to draw. No turf names, just the dude."}</p>
      <button disabled={!admin} onClick={() => setEditMode(!editMode)} className={`mb-3 w-full rounded-xl py-3 text-base font-black disabled:opacity-40 ${editMode ? "bg-[#f5c542] text-black" : "bg-black text-[#f5c542]"}`}>Polygon Editor: {editMode ? "ON" : "OFF"}</button>
      {editMode && selectedTurf && (
        <button onClick={deleteSelected} className="mb-3 flex w-full items-center justify-center rounded-xl bg-red-600 py-3 text-base font-black text-white"><Trash2 className="mr-2 h-4 w-4" /> Delete Selected Zone</button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button disabled={!admin || polygon.length < 3 || editMode} onClick={saveManual} className="rounded-xl bg-black py-3 text-base font-black text-[#f5c542] disabled:opacity-40"><Save className="mr-2 inline h-4 w-4" />Save</button>
        <button onClick={clear} className="rounded-xl bg-black/10 py-3 text-base font-black">Clear</button>
      </div>
      <p className="mt-2 text-sm font-bold text-black/50">{editMode ? selectedTurf ? `Selected: ${selectedTurf.rep} • ${selectedTurf.counts?.yellow || 0} leads • ${selectedTurf.counts?.pink || 0} sold` : "No zone selected." : `Points: ${polygon.length}`}</p>
    </Panel>
  );
}

function RepFilter({ selectedRep, setSelectedRep }) { return <Panel><h2 className="mb-4 flex items-center text-2xl font-black"><Filter className="mr-2" /> Map Filter</h2><div className="grid grid-cols-2 gap-2">{["All", ...REPS].map((r) => <button key={r} onClick={() => setSelectedRep(r)} className={`rounded-2xl px-4 py-3 text-lg font-black ${selectedRep === r ? "bg-black text-[#f5c542]" : "bg-black/5"}`}>{r}</button>)}</div></Panel>; }
function Tuning({ options, setOptions, reCount }) { return <Panel><h2 className="mb-4 flex items-center text-2xl font-black"><Wand2 className="mr-2" /> Tuning</h2><Slider label="Sensitivity" value={options.sensitivity} min={0} max={10} step={1} onChange={(v) => setOptions({ ...options, sensitivity: Number(v) })} /><Slider label="Dot Size" value={options.expectedDotArea} min={60} max={420} step={10} onChange={(v) => setOptions({ ...options, expectedDotArea: Number(v) })} /><button onClick={reCount} className="mt-4 w-full rounded-2xl bg-black py-4 text-xl font-black text-[#f5c542]">Recount</button></Panel>; }
function Slider({ label, value, min, max, step, onChange }) { return <label className="mb-4 block"><div className="mb-2 flex justify-between text-lg font-black"><span>{label}</span><span>{value}</span></div><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value)} className="w-full accent-[#b8860b]" /></label>; }
function MapPanel({ fileRef, upload, activeShot, canvasRef, overlayRef, canvasClick, mode, showDots, setShowDots, showTurf, setShowTurf, uploadEnabled, startDrag, moveDrag, stopDrag, editMode }) {
  return (
    <div className="rounded-[2rem] border border-black/10 bg-white/85 p-4 shadow-xl shadow-black/10 backdrop-blur-xl">
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xl font-black">{activeShot?.name || "No screenshot selected"}</p>
          <p className="text-sm font-bold text-black/50">{mode === "erase" ? "Click a false dot to delete it." : mode === "manual" && editMode ? "Editor is on. Tap zones, drag zones, or drag corners." : mode === "manual" ? "Click to draw a polygon." : "Saved turf stays visible."}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowDots(!showDots)} className="rounded-xl bg-black px-3 py-2 text-sm font-black text-[#f5c542]">{showDots ? <EyeOff className="mr-1 inline h-4 w-4" /> : <Eye className="mr-1 inline h-4 w-4" />}Dots</button>
          <button onClick={() => setShowTurf(!showTurf)} className="rounded-xl bg-black px-3 py-2 text-sm font-black text-[#f5c542]">{showTurf ? <EyeOff className="mr-1 inline h-4 w-4" /> : <Eye className="mr-1 inline h-4 w-4" />}Turf</button>
        </div>
      </div>
      <div
        onClick={canvasClick}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onPointerLeave={stopDrag}
        onDrop={(e) => { e.preventDefault(); if (uploadEnabled) upload(e.dataTransfer.files); }}
        onDragOver={(e) => e.preventDefault()}
        className={`relative grid min-h-[620px] touch-none place-items-center overflow-auto rounded-[1.5rem] border-2 border-dashed border-black/15 bg-black/5 ${mode === "manual" || mode === "erase" ? "cursor-crosshair" : ""}`}
        style={{ touchAction: "none" }}
      >
        {!activeShot && <div className="p-10 text-center"><Upload className="mx-auto mb-4 h-14 w-14" /><h2 className="text-3xl font-black">Upload screenshots for this area</h2></div>}
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
        <span className="rounded-full bg-black px-4 py-2 text-sm font-black text-[#f5c542]">{turfs.length} zones</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.rep} className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-5 w-5 rounded-full border-2 border-black" style={{ backgroundColor: repColor(row.rep) }} />
              <h3 className="text-2xl font-black">{row.rep}</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-[#f5c542] p-3 text-center font-black text-black">
                <p className="text-xs uppercase opacity-70">Leads</p>
                <p className="text-2xl">{row.leads}</p>
              </div>
              <div className="rounded-2xl bg-[#ff4f87] p-3 text-center font-black text-white">
                <p className="text-xs uppercase opacity-70">Sold</p>
                <p className="text-2xl">{row.sold}</p>
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

function AreaDeck({ areas, switchArea, setMode, admin }) { return <Panel><h2 className="mb-5 flex items-center text-4xl font-black"><Layers className="mr-3 h-9 w-9" /> Areas Command Deck</h2>{areas.length === 0 ? <div className="rounded-3xl bg-black/5 p-10 text-center"><h3 className="text-4xl font-black">No areas yet</h3><p className="mt-2 text-xl font-bold text-black/50">Unlock Sam Admin, create an area, upload screenshots.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{areas.map((a) => { const leads = (a.screenshots || []).reduce((s, shot) => s + (shot.detections?.lead?.length || 0), 0); return <button key={a.id} onClick={() => { switchArea(a.id); setMode("count"); }} className="rounded-[2rem] bg-black p-6 text-left text-white shadow-xl transition hover:-translate-y-1"><h3 className="text-3xl font-black">{a.name}</h3><p className="mt-1 text-lg font-bold text-white/60">{a.screenshots?.length || 0} screenshots • {a.turfs?.length || 0} zones</p><p className="mt-5 text-7xl font-black text-[#f5c542]">{leads}</p><p className="text-sm font-black uppercase tracking-widest text-white/50">leads</p></button>; })}</div>}</Panel>; }
function TeamView({ teamStats, teamRep, setTeamRep, teamTurfs, admin, deleteTurf }) { return <div className="space-y-5"><Panel><h2 className="mb-5 flex items-center text-4xl font-black"><Users className="mr-3 h-9 w-9" /> Team View</h2><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{REPS.map((r) => <button key={r} onClick={() => setTeamRep(r)} className={`rounded-3xl p-5 text-xl font-black ${teamRep === r ? "bg-black text-[#f5c542]" : "bg-black/5"}`}>{r}</button>)}</div></Panel><Panel><h3 className="mb-4 text-3xl font-black">{teamRep}'s Turf</h3>{teamTurfs.length === 0 ? <p className="rounded-3xl bg-black/5 p-8 text-center text-xl font-bold text-black/50">No turf assigned yet.</p> : <div className="grid gap-4 xl:grid-cols-2">{teamTurfs.map((t) => <div key={t.id} className="rounded-[2rem] bg-black p-5 text-white shadow-xl"><div className="mb-3 flex justify-between"><div><p className="text-2xl font-black">{t.areaName}</p><p className="font-bold text-white/50">{t.imageName}</p></div>{admin && <button onClick={() => deleteTurf(t.id)} className="text-red-300"><Trash2 /></button>}</div><div className="grid grid-cols-3 gap-2"><Stat label="Total" value={t.counts?.total || 0} /><Stat label="Leads" value={t.counts?.yellow || 0} gold /><Stat label="Sold" value={t.counts?.pink || 0} pink /></div></div>)}</div>}</Panel></div>; }
