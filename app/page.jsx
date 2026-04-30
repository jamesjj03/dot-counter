"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, Sparkles, Target, Eye, EyeOff, RotateCcw, Download, SlidersHorizontal } from "lucide-react";

const STATUS_PRESETS = [
  {
    key: "lead",
    label: "Lead",
    swatch: "#facc15",
    hueMin: 35,
    hueMax: 60,
    satMin: 60,
    valMin: 60,
    minArea: 80,
    maxArea: 900,
    estimatedArea: 220,
  },
  {
    key: "notInterested",
    label: "Not Interested",
    swatch: "#f43f5e",
    hueMin: 330,
    hueMax: 355,
    satMin: 60,
    valMin: 60,
    minArea: 70,
    maxArea: 900,
    estimatedArea: 200,
  }
];

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return [h, s * 100, v * 100];
}

function hueInRange(h, min, max) {
  if (min <= max) return h >= min && h <= max;
  return h >= min || h <= max;
}

function floodFill(mask, width, height, visited, start) {
  const stack = [start];
  visited[start] = 1;
  let area = 0;
  let sumX = 0;
  let sumY = 0;

  while (stack.length) {
    const idx = stack.pop();
    const x = idx % width;
    const y = Math.floor(idx / width);
    area++;
    sumX += x;
    sumY += y;

    const neighbors = [idx - 1, idx + 1, idx - width, idx + width];
    for (const n of neighbors) {
      if (n < 0 || n >= mask.length || visited[n] || !mask[n]) continue;
      visited[n] = 1;
      stack.push(n);
    }
  }

  return {
    area,
    x: sumX / area,
    y: sumY / area,
    radius: Math.sqrt(area / Math.PI),
  };
}

function createMask(imageData, preset, sensitivity, crop) {
  const { width, height, data } = imageData;
  const mask = new Uint8Array(width * height);

  for (let y = crop.top; y < crop.bottom; y++) {
    for (let x = crop.left; x < crop.right; x++) {
      const i = (y * width + x) * 4;
      const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);

      if (
        hueInRange(h, preset.hueMin, preset.hueMax) &&
        s >= preset.satMin &&
        v >= preset.valMin
      ) {
        mask[y * width + x] = 1;
      }
    }
  }
  return mask;
}

function detectBlobs(imageData, preset, options) {
  const { width, height } = imageData;
  const crop = {
    left: Math.floor(width * options.cropLeft),
    right: Math.floor(width * options.cropRight),
    top: Math.floor(height * options.cropTop),
    bottom: Math.floor(height * options.cropBottom),
  };

  const mask = createMask(imageData, preset, options.sensitivity, crop);
  const visited = new Uint8Array(width * height);
  const detections = [];

  for (let y = crop.top; y < crop.bottom; y++) {
    for (let x = crop.left; x < crop.right; x++) {
      const idx = y * width + x;
      if (!mask[idx] || visited[idx]) continue;

      const blob = floodFill(mask, width, height, visited, idx);
      if (blob.area < preset.minArea) continue;

      detections.push(blob);
    }
  }

  return detections;
}

export default function DotCounterApp() {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const fileRef = useRef(null);

  const [imageUrl, setImageUrl] = useState(null);
  const [detections, setDetections] = useState({});
  const [showOverlay, setShowOverlay] = useState(true);

  const [options, setOptions] = useState({
    sensitivity: 3,
    cropLeft: 0,
    cropRight: 0.94,
    cropTop: 0.18,
    cropBottom: 0.88,
  });

  const totals = useMemo(() => {
    return STATUS_PRESETS.map((p) => ({
      ...p,
      count: detections[p.key]?.length || 0,
    }));
  }, [detections]);

  const analyze = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const result = {};
    for (const preset of STATUS_PRESETS) {
      result[preset.key] = detectBlobs(imageData, preset, options);
    }
    setDetections(result);
  };

  const loadFile = (file) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      const overlay = overlayRef.current;

      const scale = Math.min(1, 1200 / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      overlay.width = canvas.width;
      overlay.height = canvas.height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      analyze();
    };
    img.src = url;
  };

  const drawOverlay = () => {
    const canvas = overlayRef.current;
    const base = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const preset of STATUS_PRESETS) {
      const dots = detections[preset.key] || [];
      ctx.strokeStyle = preset.swatch;

      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, 12, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  };

  React.useEffect(() => {
    drawOverlay();
  }, [detections, showOverlay]);

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: 20 }}>
      <h1 style={{ fontSize: 32, fontWeight: "bold", marginBottom: 10 }}>Dot Counter</h1>

      <div style={{ marginBottom: 10 }}>
        <input type="file" ref={fileRef} onChange={(e) => loadFile(e.target.files[0])} />
        <button onClick={analyze} style={{ marginLeft: 10 }}>Analyze</button>
      </div>

      <div style={{ marginBottom: 20 }}>
        {totals.map((t) => (
          <div key={t.key} style={{ fontSize: 20, color: "#111" }}>
            {t.label}: {t.count}
          </div>
        ))}
      </div>

      <div style={{ position: "relative" }}>
        <canvas ref={canvasRef} />
        <canvas ref={overlayRef} style={{ position: "absolute", top: 0, left: 0 }} />
      </div>
    </div>
  );
}
