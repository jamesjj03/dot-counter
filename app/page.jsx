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