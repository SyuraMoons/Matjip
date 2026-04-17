"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import L from "leaflet";
import type { Address } from "viem";
import "leaflet/dist/leaflet.css";
import AddMemoryModal from "./AddMemoryModal";
import type { MemoryData } from "./AddMemoryModal";
import {
  decentralizedMemoryToMapMemory,
  loadDecentralizedMemories,
  loadKarmaProgressMemories,
} from "@/lib/decentralizedMemories";
import {
  calculateKarmaRewardProgress,
  type KarmaRewardProgress,
} from "@/lib/karmaProgress";

// Fix default marker icons broken by webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type RouteCache = Record<string, [number, number][]>;

function getPlaceScaleRadius(memory: MemoryData): number {
  const text = `${memory.title} ${memory.location} ${memory.caption}`.toLowerCase();

  const largeKeywords = [
    "park",
    "mountain",
    "palace",
    "castle",
    "campus",
    "forest",
    "garden",
  ];
  const mediumKeywords = [
    "museum",
    "temple",
    "mall",
    "station",
    "landmark",
    "market",
  ];
  const smallKeywords = [
    "cafe",
    "coffee",
    "restaurant",
    "shop",
    "store",
    "bakery",
    "bar",
  ];

  if (largeKeywords.some((k) => text.includes(k))) return 220;
  if (mediumKeywords.some((k) => text.includes(k))) return 120;
  if (smallKeywords.some((k) => text.includes(k))) return 60;

  return 100;
}

function sortMemoriesChronologically(memories: MemoryData[]): MemoryData[] {
  return [...memories].sort((a, b) => {
    const aTime =
      typeof a.createdAt === "number"
        ? a.createdAt
        : a.date
          ? new Date(a.date).getTime()
          : 0;

    const bTime =
      typeof b.createdAt === "number"
        ? b.createdAt
        : b.date
          ? new Date(b.date).getTime()
          : 0;

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    return a.id - b.id;
  });
}

function buildChronologicalPairs(
  map: L.Map,
  memories: MemoryData[],
  thresholdMeters = 1500
): Array<[MemoryData, MemoryData]> {
  const sorted = sortMemoriesChronologically(memories);
  const pairs: Array<[MemoryData, MemoryData]> = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    const distance = map.distance(
      [current.lat, current.lng],
      [next.lat, next.lng]
    );

    if (distance <= thresholdMeters) {
      pairs.push([current, next]);
    }
  }

  console.log(
    `[Routes] Found ${pairs.length} strict chronological pairs within ${thresholdMeters}m`,
    pairs.map(([a, b]) => ({
      from: { id: a.id, createdAt: a.createdAt, title: a.title },
      to: { id: b.id, createdAt: b.createdAt, title: b.title },
      distance: map.distance([a.lat, a.lng], [b.lat, b.lng]),
    }))
  );

  return pairs;
}

// Union-Find data structure for connected component detection
class UnionFind {
  parent: globalThis.Map<number, number>;

  constructor(ids: number[]) {
    this.parent = new globalThis.Map();
    ids.forEach((id) => this.parent.set(id, id));
  }

  find(x: number): number {
    if (!this.parent.has(x)) return x;
    const parent = this.parent.get(x)!;
    if (parent !== x) {
      this.parent.set(x, this.find(parent));
    }
    return this.parent.get(x)!;
  }

  union(x: number, y: number) {
    const px = this.find(x);
    const py = this.find(y);
    if (px !== py) {
      this.parent.set(px, py);
    }
  }
}

// Build connected groups from route pairs
function buildConnectedGroups(
  memories: MemoryData[],
  pairs: Array<[MemoryData, MemoryData]>
): MemoryData[][] {
  // Deduplicate input memories by id first to prevent duplicate counting
  const uniqueMemoriesMap = new globalThis.Map<number, MemoryData>();
  for (const memory of memories) {
    uniqueMemoriesMap.set(memory.id, memory);
  }
  const uniqueMemories = Array.from(uniqueMemoriesMap.values());

  const uf = new UnionFind(uniqueMemories.map((m) => m.id));

  for (const [a, b] of pairs) {
    uf.union(a.id, b.id);
  }

  const groups = new globalThis.Map<number, MemoryData[]>();
  for (const memory of uniqueMemories) {
    const root = uf.find(memory.id);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(memory);
  }

  return Array.from(groups.values());
}

// Haversine distance: calculate geodetic distance between two lat/lng points
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Compute group span: maximum distance between any two pins in the group
function computeGroupSpan(group: MemoryData[]): number {
  if (group.length < 2) return 0;

  let maxSpan = 0;
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const dist = haversineDistance(group[i].lat, group[i].lng, group[j].lat, group[j].lng);
      maxSpan = Math.max(maxSpan, dist);
    }
  }

  return maxSpan;
}

// Zone level definition
type ZoneLevel = {
  level: number;
  multiplier: number;
};

// Compute zone level based on group size and span
function computeZoneLevel(group: MemoryData[]): ZoneLevel {
  const size = group.length;
  const span = computeGroupSpan(group);

  console.log(
    `[Zone] Computing level: size=${size}, span=${span.toFixed(0)}m`,
    group.map((m) => ({ id: m.id, title: m.title }))
  );

  // Level 3: ≥7 pins AND span ≥1000m
  if (size >= 7 && span >= 1000) {
    return { level: 3, multiplier: 2.0 };
  }

  // Level 2: ≥5 pins AND span ≥700m
  if (size >= 5 && span >= 700) {
    return { level: 2, multiplier: 1.5 };
  }

  // Level 1: ≥3 pins AND span ≥400m
  if (size >= 3 && span >= 400) {
    return { level: 1, multiplier: 1.3 };
  }

  // No level: multiplier = 1 (no bonus)
  return { level: 0, multiplier: 1.0 };
}

// Fetch real route geometry from OSRM API following actual street network
async function fetchRoutePoints(
  a: MemoryData,
  b: MemoryData
): Promise<[number, number][]> {
  try {
    const params = new URLSearchParams({
      startLat: String(a.lat),
      startLng: String(a.lng),
      endLat: String(b.lat),
      endLng: String(b.lng),
    });

    console.log(`[Route] Fetching from ${a.id} to ${b.id}`, {
      from: [a.lat, a.lng],
      to: [b.lat, b.lng],
    });

    const response = await fetch(`/api/routes/path?${params.toString()}`, {
      cache: "no-store",
    });

    const data = await response.json();

    if (
      !response.ok ||
      !Array.isArray(data?.points) ||
      data.points.length < 2
    ) {
      console.warn(`[Route] Failed to get route from ${a.id} to ${b.id}`, {
        ok: response.ok,
        hasPoints: Array.isArray(data?.points),
        pointsLength: data?.points?.length,
        error: data?.error,
      });
      // Honest fallback if route fails
      return [
        [a.lat, a.lng],
        [b.lat, b.lng],
      ];
    }

    return data.points as [number, number][];
  } catch (error) {
    console.error("fetchRoutePoints failed:", error);
    return [
      [a.lat, a.lng],
      [b.lat, b.lng],
    ];
  }
}

// Create stable cache key for route pair
function getRouteKey(a: MemoryData, b: MemoryData): string {
  return `${a.id}__${b.id}`;
}

function routeCorridorToSubpath(
  map: L.Map,
  points: [number, number][],
  corridorWidthMeters = 35
): string {
  if (points.length < 2) return "";

  const layerPoints = points.map(([lat, lng]) =>
    map.latLngToLayerPoint(L.latLng(lat, lng))
  );

  const corridorLeft: L.Point[] = [];
  const corridorRight: L.Point[] = [];

  for (let i = 0; i < layerPoints.length; i++) {
    const curr = layerPoints[i];
    const prev = i > 0 ? layerPoints[i - 1] : curr;
    const next = i < layerPoints.length - 1 ? layerPoints[i + 1] : curr;

    let dx = 0;
    let dy = 0;

    if (i === 0) {
      dx = next.x - curr.x;
      dy = next.y - curr.y;
    } else if (i === layerPoints.length - 1) {
      dx = curr.x - prev.x;
      dy = curr.y - prev.y;
    } else {
      const v1x = curr.x - prev.x;
      const v1y = curr.y - prev.y;
      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;
      dx = v1x + v2x;
      dy = v1y + v2y;
    }

    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= len;
    dy /= len;

    const lat = points[i][0];
    const metersPerPixel =
      (40075016.686 * Math.abs(Math.cos((lat * Math.PI) / 180))) /
      Math.pow(2, map.getZoom() + 8);
    const pixelWidth = corridorWidthMeters / metersPerPixel;

    corridorLeft.push(L.point(curr.x - dy * pixelWidth, curr.y + dx * pixelWidth));
    corridorRight.push(L.point(curr.x + dy * pixelWidth, curr.y - dx * pixelWidth));
  }

  let pathStr = `M ${corridorLeft[0].x} ${corridorLeft[0].y}`;
  for (let i = 1; i < corridorLeft.length; i++) {
    pathStr += ` L ${corridorLeft[i].x} ${corridorLeft[i].y}`;
  }
  for (let i = corridorRight.length - 1; i >= 0; i--) {
    pathStr += ` L ${corridorRight[i].x} ${corridorRight[i].y}`;
  }
  pathStr += " Z";

  return pathStr;
}

// Circle subpath for a memory pin with place-scale radius
function createCircleSubpath(
  map: L.Map,
  lat: number,
  lng: number,
  radiusMeters: number
): string {
  const pt = map.latLngToLayerPoint(L.latLng(lat, lng));
  const metersPerPixel =
    (40075016.686 * Math.abs(Math.cos((lat * Math.PI) / 180))) /
    Math.pow(2, map.getZoom() + 8);
  const r = radiusMeters / metersPerPixel;
  return `M ${pt.x + r} ${pt.y} a ${r} ${r} 0 1 0 ${-2 * r} 0 a ${r} ${r} 0 1 0 ${2 * r} 0 Z`;
}

function createMemoryIcon() {
  return L.divIcon({
    className: "",
    html: `
      <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(232, 135, 136, 0.4)) drop-shadow(0 0 8px rgba(232, 135, 136, 0.3));">
        <path d="M 20 2 C 28.8 2 36 9.2 36 18 C 36 28 20 48 20 48 C 20 48 4 28 4 18 C 4 9.2 11.2 2 20 2 Z" fill="rgba(232, 135, 136, 0.95)" stroke="rgba(249, 250, 251, 0.9)" stroke-width="1.5"/>
        <circle cx="20" cy="18" r="6" fill="rgba(249, 250, 251, 0.95)"/>
      </svg>
    `,
    iconSize: [40, 50],
    iconAnchor: [20, 50],
    popupAnchor: [0, -50],
  });
}

function createMemoryPopupContent(
  memory: MemoryData,
  onReadMore: (memory: MemoryData) => void
) {
  // Truncate title to 25 characters
  const titleText = memory.title || "Untitled";
  const isTitleLong = titleText.length > 25;
  const truncatedTitle = isTitleLong ? titleText.substring(0, 25) + "..." : titleText;

  // Truncate caption to 80 characters
  const captionText = memory.caption || "No caption added";
  const isCaptionLong = captionText.length > 80;
  const truncatedCaption = isCaptionLong
    ? captionText.substring(0, 80) + "..."
    : captionText;

  const photosHtml =
    memory.photos.length > 0
      ? `
    <div style="display: flex; flex-direction: column; gap: 6px;">
      ${memory.photos
        .slice(0, 2)
        .map(
          (photo) => `
        <img src="${photo}" style="
          width: 70px;
          height: 70px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid rgba(232, 135, 136, 0.3);
        " />
      `
        )
        .join("")}
    </div>
  `
      : "";

  return `
    <div style="
      background: rgba(17, 24, 39, 0.97);
      border: 1px solid rgba(232, 135, 136, 0.4);
      border-radius: 12px;
      padding: 12px 14px;
      font-family: inherit;
      box-shadow: 0 0 20px rgba(232, 135, 136, 0.15);
      display: flex;
      gap: 10px;
      width: 300px;
      box-sizing: border-box;
    ">
      ${photosHtml ? `<div style="flex-shrink: 0;">${photosHtml}</div>` : ""}
      <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="font-size: 20px; line-height: 1; margin-bottom: 5px;">${memory.emoji}</div>
          <div style="font-size: 13px; font-weight: 700; color: #f9fafb; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${titleText}">${truncatedTitle}</div>
          <div style="font-size: 10px; color: rgba(232, 135, 136, 0.85); margin-bottom: 6px; letter-spacing: 0.04em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            📍 ${memory.location.substring(0, 20)}${memory.location.length > 20 ? "..." : ""} · ${memory.date}
          </div>
        </div>
        <div style="font-size: 11px; color: #9ca3af; line-height: 1.4; word-break: break-word;">
          ${truncatedCaption}
        </div>
      </div>
    </div>
    <div style="margin-top: 10px;">
      <button class="read-more-btn" data-memory-id="${memory.id}" style="
        background: rgba(232, 135, 136, 0.3);
        border: 1px solid rgba(232, 135, 136, 0.5);
        color: rgba(232, 135, 136, 1);
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      " onmouseover="this.style.background = 'rgba(232, 135, 136, 0.5)'" onmouseout="this.style.background = 'rgba(232, 135, 136, 0.3)'">
        Read more →
      </button>
    </div>
  `;
}

// Detail Modal Component
function MemoryDetailModal({
  memory,
  isOpen,
  onClose,
}: {
  memory: MemoryData | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen || !memory) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "rgba(17, 24, 39, 0.98)",
          border: "1px solid rgba(232, 135, 136, 0.4)",
          borderRadius: "16px",
          boxShadow: "0 0 40px rgba(232, 135, 136, 0.2)",
          fontFamily: "inherit",
          display: "flex",
          width: "750px",
          height: "500px",
          overflow: "hidden",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "rgba(232, 135, 136, 0.2)",
            border: "1px solid rgba(232, 135, 136, 0.4)",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#f9fafb",
            fontSize: "18px",
            transition: "all 0.2s",
            zIndex: 10,
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(232, 135, 136, 0.4)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(232, 135, 136, 0.2)";
          }}
        >
          ✕
        </button>

        {/* Left Side - Photos */}
        <div
          style={{
            flex: "0 0 350px",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            overflowY: "auto",
            borderRight: "1px solid rgba(232, 135, 136, 0.2)",
          }}
        >
          {memory.photos && memory.photos.length > 0 ? (
            memory.photos.map((photo, idx) => (
              <img
                key={idx}
                src={photo}
                style={{
                  width: "100%",
                  height: "140px",
                  objectFit: "cover",
                  borderRadius: "10px",
                  border: "1px solid rgba(232, 135, 136, 0.3)",
                }}
              />
            ))
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "140px",
                color: "#9ca3af",
                fontSize: "13px",
              }}
            >
              No photos
            </div>
          )}
        </div>

        {/* Right Side - Content */}
        <div
          style={{
            flex: 1,
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: "16px", paddingRight: "24px" }}>
            <div style={{ fontSize: "28px", marginBottom: "10px" }}>
              {memory.emoji}
            </div>
            <h2
              style={{
                fontSize: "22px",
                fontWeight: "700",
                color: "#f9fafb",
                marginBottom: "8px",
                wordBreak: "break-word",
              }}
            >
              {memory.title}
            </h2>
            <div
              style={{
                fontSize: "12px",
                color: "rgba(232, 135, 136, 0.85)",
                letterSpacing: "0.04em",
              }}
            >
              📍 {memory.location} · {memory.date}
            </div>
          </div>

          {/* Caption with scroll */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              backgroundColor: "rgba(232, 135, 136, 0.05)",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid rgba(232, 135, 136, 0.2)",
              fontSize: "14px",
              color: "#d1d5db",
              lineHeight: "1.8",
              wordBreak: "break-word",
            }}
          >
            {memory.caption}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Map({
  isModalOpen,
  setIsModalOpen,
  onMemoryConfirmed,
  onRewardProgressChange,
}: {
  isModalOpen: boolean;
  setIsModalOpen: (value: boolean) => void;
  onMemoryConfirmed?: () => void;
  onRewardProgressChange?: (progress: KarmaRewardProgress) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userLocationRef = useRef<L.LatLng | null>(null);
  const streetsPaneRef = useRef<HTMLElement | null>(null);
  const updateStreetsMaskRef = useRef<(() => void) | null>(null);
  const routePointsRef = useRef<RouteCache>({});
  const routeFetchNonceRef = useRef(0);
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });

  const [memories, setMemories] = useState<MemoryData[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<MemoryData | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(true);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [memoryLoadError, setMemoryLoadError] = useState("");
  const memoriesRef = useRef<MemoryData[]>([]);

  const publishRewardProgress = useCallback(
    (progress: KarmaRewardProgress) => {
      onRewardProgressChange?.(progress);
    },
    [onRewardProgressChange]
  );

  // Keep memoriesRef in sync with memories state
  useEffect(() => {
    memoriesRef.current = memories;
  }, [memories]);

  const addMemoryMarker = (memory: MemoryData, map: L.Map) => {
    const marker = L.marker([memory.lat, memory.lng], {
      icon: createMemoryIcon(),
    }).addTo(map);

    marker.bindPopup(createMemoryPopupContent(memory, (m) => {}), {
      className: "memory-popup",
      maxWidth: 300,
    });
  };

  const upsertMemory = (currentMemories: MemoryData[], memory: MemoryData) => {
    const existingIndex = currentMemories.findIndex((candidate) => {
      if (memory.txHash && candidate.txHash === memory.txHash) return true;
      if (
        memory.metadataCid &&
        candidate.metadataCid &&
        candidate.metadataCid === memory.metadataCid
      ) {
        return true;
      }

      return candidate.id === memory.id;
    });

    if (existingIndex === -1) {
      return [...currentMemories, memory];
    }

    const nextMemories = [...currentMemories];
    const existingMemory = nextMemories[existingIndex];

    nextMemories[existingIndex] = {
      ...memory,
      createdAt:
        typeof memory.createdAt === "number"
          ? memory.createdAt
          : existingMemory.createdAt,
    };

    return nextMemories;
  };

  // Set up event listener for read-more buttons
  useEffect(() => {
    const handleReadMoreClick = (e: Event) => {
      const button = e.target as HTMLElement;
      if (button.classList.contains("read-more-btn")) {
        const memoryId = parseInt(button.getAttribute("data-memory-id") || "0");
        const memory = memoriesRef.current.find((m) => m.id === memoryId);
        if (memory) {
          setSelectedMemory(memory);
          setIsDetailOpen(true);
        }
      }
    };

    document.addEventListener("click", handleReadMoreClick);
    return () => document.removeEventListener("click", handleReadMoreClick);
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const MIN_LAT = -85;
    const MAX_LAT = 85;

    const map = L.map(mapRef.current, {
      center: [20, 10],
      zoom: 2,
      minZoom: 2,
      worldCopyJump: true,
      zoomControl: false,
      attributionControl: false,
      renderer: L.svg(),
      zoomSnap: 0,
      zoomDelta: 0.4,
      scrollWheelZoom: false,
      zoomAnimation: true,
      zoomAnimationThreshold: 8,
      fadeAnimation: true,
      markerZoomAnimation: true,
    });

    mapInstanceRef.current = map;

    // Clamp vertical pan so the viewport's top/bottom edges can't move
    // past the world limits (±85° lat). Horizontal stays free for wrap.
    // At low zooms where the world is shorter than the viewport height,
    // the viewport auto-centers vertically.
    let isClamping = false;
    function clampVerticalPan() {
      if (isClamping) return;

      const zoom = map.getZoom();
      const halfH = map.getSize().y / 2;
      const topEdgeY = map.project([MAX_LAT, 0], zoom).y;
      const bottomEdgeY = map.project([MIN_LAT, 0], zoom).y;
      const worldHeight = bottomEdgeY - topEdgeY;

      const center = map.getCenter();
      const centerPoint = map.project(center, zoom);
      let targetY = centerPoint.y;

      if (worldHeight <= halfH * 2) {
        targetY = (topEdgeY + bottomEdgeY) / 2;
      } else {
        targetY = Math.max(
          topEdgeY + halfH,
          Math.min(bottomEdgeY - halfH, centerPoint.y)
        );
      }

      if (targetY !== centerPoint.y) {
        isClamping = true;
        map.panTo(map.unproject([centerPoint.x, targetY], zoom), {
          animate: false,
        });
        isClamping = false;
      }
    }

    map.on("drag", clampVerticalPan);
    map.on("moveend", clampVerticalPan);
    map.on("zoom", clampVerticalPan);
    map.on("zoomend", clampVerticalPan);
    map.on("resize", clampVerticalPan);

    // Fix initial position
    clampVerticalPan();

    // Fix sizing
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    // Parchment background — shows through on land via multiply blend
    const container = map.getContainer();
    container.style.background = "#efe3c3";

    // --- Base A: no-labels globe — washed-out light tiles over the
    // parchment bg give a uniform parchment look (no blue water).
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
          'contributors &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        minZoom: 2,
        maxZoom: 19,
        opacity: 0.4,
      }
    ).addTo(map);

    // --- Base B: labelled street view — Voyager has blue oceans + neutral
    // land; multiply blend lets the parchment bg tint the land.
    // Lives in its own pane so we can clip it to a circle around the user.
    const streetsPane = map.createPane("streetsPane");
    streetsPane.style.zIndex = "300";
    streetsPane.style.willChange = "clip-path";
    streetsPane.style.backfaceVisibility = "hidden";
    streetsPane.style.perspective = "1000px";
    streetsPaneRef.current = streetsPane;

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
          'contributors &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        minZoom: 2,
        maxZoom: 19,
        opacity: 1,
        className: "globe-tiles",
        pane: "streetsPane",
      }
    ).addTo(map);

    // Zoom control
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // --- Smooth wheel zoom (Google-Maps-style) ---
    // Intercept wheel events and tween zoom toward a goal each frame
    // using map._move() for instant per-frame updates. Settles on
    // wheel-stop via _moveEnd so tile layers re-render cleanly.
    const mapInternals = map as unknown as {
      _stop: () => void;
      _moveStart: (moved: boolean, pinch: boolean) => void;
      _move: (center: L.LatLng, zoom: number) => void;
      _moveEnd: (moved: boolean) => void;
    };

    let swzGoalZoom = map.getZoom();
    let swzPrevCenter = map.getCenter();
    let swzPrevZoom = map.getZoom();
    let swzWheelMousePos = L.point(0, 0);
    let swzCenterPoint = map.getSize().divideBy(2);
    let swzWheelStartLatLng = map.getCenter();
    let swzIsWheeling = false;
    let swzMoved = false;
    let swzRafId = 0;
    let swzTimeoutId: ReturnType<typeof setTimeout> | null = null;

    function smoothZoomUpdate() {
      if (
        !map.getCenter().equals(swzPrevCenter) ||
        map.getZoom() !== swzPrevZoom
      ) {
        return;
      }

      const currentZoom = map.getZoom();
      const nextZoom =
        Math.floor((currentZoom + (swzGoalZoom - currentZoom) * 0.6) * 100) /
        100;

      const delta = swzWheelMousePos.subtract(swzCenterPoint);
      const center = map.unproject(
        map.project(swzWheelStartLatLng, nextZoom).subtract(delta),
        nextZoom
      );

      if (!swzMoved) {
        mapInternals._moveStart(true, false);
        swzMoved = true;
      }
      mapInternals._move(center, nextZoom);
      swzPrevCenter = map.getCenter();
      swzPrevZoom = map.getZoom();

      swzRafId = requestAnimationFrame(smoothZoomUpdate);
    }

    function smoothZoomEnd() {
      swzIsWheeling = false;
      cancelAnimationFrame(swzRafId);
      if (swzMoved) {
        mapInternals._moveEnd(true);
        swzMoved = false;
      }
    }

    function smoothZoomStart(e: WheelEvent) {
      swzIsWheeling = true;
      swzWheelMousePos = map.mouseEventToContainerPoint(e);
      swzCenterPoint = map.getSize().divideBy(2);
      swzWheelStartLatLng = map.containerPointToLatLng(swzWheelMousePos);
      mapInternals._stop();
      swzGoalZoom = map.getZoom();
      swzPrevCenter = map.getCenter();
      swzPrevZoom = map.getZoom();
      swzMoved = false;
      swzRafId = requestAnimationFrame(smoothZoomUpdate);
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      e.stopPropagation();

      if (!swzIsWheeling) smoothZoomStart(e);

      const lineHeight = e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? 60 : 1;
      const wheelDelta = -e.deltaY * lineHeight;
      swzGoalZoom = Math.max(
        map.getMinZoom(),
        Math.min(map.getMaxZoom(), swzGoalZoom + wheelDelta * 0.007)
      );
      swzWheelMousePos = map.mouseEventToContainerPoint(e);

      if (swzTimeoutId !== null) clearTimeout(swzTimeoutId);
      swzTimeoutId = setTimeout(smoothZoomEnd, 180);
    }

    const mapContainer = map.getContainer();
    mapContainer.addEventListener("wheel", onWheel, { passive: false });

    // Locate Me control - custom control to relocate to user geolocation
    const LocateControl = L.Control.extend({
      onAdd: function () {
        const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        const button = L.DomUtil.create("a", "", container);
        
        button.innerHTML = `
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; margin: auto;">
            <circle cx="12" cy="12" r="2.5" fill="currentColor"></circle>
            <circle cx="12" cy="12" r="6"></circle>
            <line x1="12" y1="2" x2="12" y2="4"></line>
            <line x1="12" y1="20" x2="12" y2="22"></line>
            <line x1="20" y1="12" x2="22" y2="12"></line>
            <line x1="2" y1="12" x2="4" y2="12"></line>
          </svg>
        `;
        button.href = "#";
        button.title = "Locate me";
        button.style.display = "flex";
        button.style.alignItems = "center";
        button.style.justifyContent = "center";
        
        L.DomEvent.on(button, "click", (e) => {
          L.DomEvent.preventDefault(e);
          if (userLocationRef.current) {
            map.setView([userLocationRef.current.lat, userLocationRef.current.lng], 17, {
              animate: true,
              duration: 0.5,
            });
          }
        });
        
        return container;
      },
    });

    new LocateControl({ position: "bottomright" }).addTo(map);

    // --- Visited-area system using clipPath masks ---
    let updateFrameId: number | null = null;

    function updateStreetsMask() {
      const pane = streetsPaneRef.current;
      if (!pane || !mapInstanceRef.current) return;

      const map = mapInstanceRef.current;
      const subpaths: string[] = [];

      // Add user location circle (100m base)
      const loc = userLocationRef.current;
      if (loc) {
        subpaths.push(createCircleSubpath(map, loc.lat, loc.lng, 100));
      }

      // Add memory circles with place-scale radii
      memoriesRef.current.forEach((memory) => {
        const radius = getPlaceScaleRadius(memory);
        subpaths.push(createCircleSubpath(map, memory.lat, memory.lng, radius));
      });

      // Add route corridors between chronological nearby pairs using cached route geometry
      const pairs = buildChronologicalPairs(map, memoriesRef.current, 1500);
      pairs.forEach(([a, b]) => {
        const key = getRouteKey(a, b);
        const points = routePointsRef.current[key];

        if (points && points.length >= 2) {
          const corridorPath = routeCorridorToSubpath(map, points, 35);
          if (corridorPath) {
            subpaths.push(corridorPath);
          }
        }
      });

      if (subpaths.length === 0) {
        pane.style.clipPath = "circle(0px at 0px 0px)";
        return;
      }
      pane.style.clipPath = `path('${subpaths.join(" ")}')`;
    }
    updateStreetsMaskRef.current = updateStreetsMask;

    // Smooth continuous update during interactions
    function scheduleUpdate() {
      if (updateFrameId !== null) {
        cancelAnimationFrame(updateFrameId);
      }
      updateFrameId = requestAnimationFrame(() => {
        updateStreetsMask();
        updateFrameId = null;
      });
    }

    // Update on interaction events with smooth frame-based updates
    map.on("move", scheduleUpdate);
    map.on("zoom", scheduleUpdate);
    map.on("viewreset", scheduleUpdate);
    map.on("moveend", updateStreetsMask);
    map.on("zoomend", updateStreetsMask);
    
    // Initial update
    updateStreetsMask();

    // Geolocation: center + visited circle + marker
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          userLocationRef.current = L.latLng(latitude, longitude);

          // Ensure map is ready and has proper dimensions before setView
          if (!mapInstanceRef.current) {
            setIsLocating(false);
            return;
          }

          const map = mapInstanceRef.current;
          const container = map.getContainer();

          // Check if container has dimensions
          if (container.offsetWidth === 0 || container.offsetHeight === 0) {
            // Wait for next frame and try again
            requestAnimationFrame(() => {
              if (mapInstanceRef.current && container.offsetWidth > 0) {
                mapInstanceRef.current.invalidateSize();
                mapInstanceRef.current.setView([latitude, longitude], 17, { animate: true });
                mapInstanceRef.current.whenReady(() => {
                  updateStreetsMask();
                });
              }
              setIsLocating(false);
            });
            return;
          }

          // Container has dimensions, proceed with setView
          map.invalidateSize();
          map.setView([latitude, longitude], 17, { animate: true });
          setIsLocating(false);
          
          // Use map.whenReady to ensure pane renderer is ready
          map.whenReady(() => {
            updateStreetsMask();
          });

          const youAreHereIcon = L.divIcon({
            className: "",
            html: `
              <div style="position: relative; width: 16px; height: 16px;">
                <div style="
                  position: absolute; inset: 0;
                  background: #4285F4;
                  border-radius: 50%;
                  border: 2px solid #fff;
                  box-shadow: 0 0 0 4px rgba(66,133,244,0.25);
                "></div>
                <div style="
                  position: absolute; inset: -8px;
                  border-radius: 50%;
                  background: rgba(66,133,244,0.12);
                  animation: pulse 2s ease-out infinite;
                "></div>
              </div>
            `,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });

          const userMarker = L.marker([latitude, longitude], {
            icon: youAreHereIcon,
          })
            .addTo(map)
            .bindPopup(
              `<div style="
                background: rgba(17,24,39,0.97);
                border: 1px solid rgba(232,135,136,0.4);
                border-radius: 10px;
                padding: 10px 14px;
                font-family: inherit;
                font-size: 13px;
                color: #e5e7eb;
              ">You are here</div>`,
              { className: "memory-popup", maxWidth: 160 }
            );

          userMarkerRef.current = userMarker;
        },
        () => {
          setIsLocating(false);
        },
        { timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setIsLocating(false);
    }

    return () => {
      if (updateFrameId !== null) {
        cancelAnimationFrame(updateFrameId);
      }
      mapContainer.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(swzRafId);
      if (swzTimeoutId !== null) clearTimeout(swzTimeoutId);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      updateStreetsMaskRef.current = null;
    };
  }, []);

  const reloadRewardProgress = useCallback(async () => {
    if (!address) return;
    const progressMemories = await loadKarmaProgressMemories({ poster: address as Address });
    publishRewardProgress(calculateKarmaRewardProgress(progressMemories));
  }, [address, publishRewardProgress]);

  const reloadMemories = async (poster: Address, preserveMemory?: MemoryData) => {
    setIsLoadingMemories(true);
    setMemoryLoadError("");

    try {
      const [loaded] = await Promise.all([
        loadDecentralizedMemories({ poster }),
        reloadRewardProgress(),
      ]);
      const loadedMemories = loaded.map(decentralizedMemoryToMapMemory);
      setMemories(
        preserveMemory
          ? upsertMemory(loadedMemories, preserveMemory)
          : loadedMemories
      );
    } catch (error) {
      setMemoryLoadError(
        error instanceof Error ? error.message : "Unable to load memories"
      );
    } finally {
      setIsLoadingMemories(false);
    }
  };

  useEffect(() => {
    if (!isConnected || !address) {
      setMemories([]);
      setIsLoadingMemories(false);
      setMemoryLoadError("");
      publishRewardProgress({
        count: 0,
        target: 5,
        regionCount: 0,
        bestRegionSize: 0,
      });
      return;
    }

    let isCurrent = true;

    async function loadWalletMemories() {
      setIsLoadingMemories(true);
      setMemoryLoadError("");

      try {
        const [loaded, progressMemories] = await Promise.all([
          loadDecentralizedMemories({
            poster: address as Address,
          }),
          loadKarmaProgressMemories({ poster: address as Address }),
        ]);

        if (!isCurrent) return;
        setMemories(loaded.map(decentralizedMemoryToMapMemory));
        publishRewardProgress(calculateKarmaRewardProgress(progressMemories));
      } catch (error) {
        if (!isCurrent) return;
        setMemoryLoadError(
          error instanceof Error ? error.message : "Unable to load memories"
        );
      } finally {
        if (isCurrent) {
          setIsLoadingMemories(false);
        }
      }
    }

    loadWalletMemories();

    return () => {
      isCurrent = false;
    };
  }, [address, isConnected, publishRewardProgress]);

  // Fetch real route geometry when memories change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    let cancelled = false;
    const nonce = ++routeFetchNonceRef.current;

    // Clear old polylines before drawing new routes
    map.eachLayer((layer) => {
      if (layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    async function loadRoutes() {
      const pairs = buildChronologicalPairs(map, memories, 1500);
      console.log(`[Routes] Found ${pairs.length} chronological-nearest pairs within 1500m`, pairs);
      const nextCache: RouteCache = {};

      for (const [a, b] of pairs) {
        const key = getRouteKey(a, b);
        const existing = routePointsRef.current[key];

        if (existing) {
          console.log(`[Routes] Using cached route for ${key}`);
          nextCache[key] = existing;
          continue;
        }

        const points = await fetchRoutePoints(a, b);
        if (cancelled || routeFetchNonceRef.current !== nonce) return;
        nextCache[key] = points;
        console.log(`[Routes] Cached route for ${key}, points count: ${points.length}`);

        // Draw route pathway as subtle gray
        L.polyline(points, {
          color: "#a0a0a0",
          weight: 3,
          opacity: 0.6,
        }).addTo(map);
      }

      if (cancelled || routeFetchNonceRef.current !== nonce) return;

      routePointsRef.current = nextCache;

      const pane = streetsPaneRef.current;
      const mapNow = mapInstanceRef.current;
      if (!pane || !mapNow) return;

      const subpaths: string[] = [];

      const loc = userLocationRef.current;
      if (loc) {
        subpaths.push(createCircleSubpath(mapNow, loc.lat, loc.lng, 100));
      }

      memoriesRef.current.forEach((memory) => {
        const radius = getPlaceScaleRadius(memory);
        subpaths.push(createCircleSubpath(mapNow, memory.lat, memory.lng, radius));
      });

      const routePairs = buildChronologicalPairs(mapNow, memoriesRef.current, 1500);
      let corridorCount = 0;
      routePairs.forEach(([a, b]) => {
        const key = getRouteKey(a, b);
        const points = routePointsRef.current[key];
        console.log(`[Mask] Checking corridor ${key}: exists=${!!points}, length=${points?.length}`);
        if (points && points.length >= 2) {
          const corridorPath = routeCorridorToSubpath(mapNow, points, 35);
          if (corridorPath) {
            subpaths.push(corridorPath);
            corridorCount++;
          }
        }
      });

      console.log(`[Mask] Total subpaths: ${subpaths.length} (circles + ${corridorCount} corridors)`);
      pane.style.clipPath =
        subpaths.length > 0
          ? `path('${subpaths.join(" ")}')`
          : "circle(0px at 0px 0px)";
    }

    loadRoutes();

    return () => {
      cancelled = true;
    };
  }, [memories]);

  // Update markers when memories change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Remove all existing markers except the user location marker
    // (polylines are managed by the route effect)
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer !== userMarkerRef.current) {
        map.removeLayer(layer);
      }
    });

    // Add all current memories as markers
    memories.forEach((memory) => addMemoryMarker(memory, map));
    updateStreetsMaskRef.current?.();
  }, [memories]);

  const handleSaveMemory = async (memory: MemoryData) => {
    // Add memory to list and compute zone level/multiplier
    const updatedMemories = upsertMemory(memoriesRef.current, memory);

    // Rebuild groups with the new memory included
    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      const pairs = buildChronologicalPairs(map, updatedMemories, 1500);
      const groups = buildConnectedGroups(updatedMemories, pairs);

      // Find the group containing the new memory
      let newMemoryGroup: MemoryData[] | null = null;
      for (const group of groups) {
        if (group.find((m) => m.id === memory.id)) {
          newMemoryGroup = group;
          break;
        }
      }

      // Compute zone level and apply multiplier
      if (newMemoryGroup) {
        const { level, multiplier } = computeZoneLevel(newMemoryGroup);

        // Apply multiplier to this new pin only (baseReward = 1)
        const baseReward = 1;
        memory.reward = baseReward * multiplier;
        memory.multiplier = multiplier;
        memory.zoneLevel = level;

        console.log(
          `[Reward] New memory ${memory.id}: level=${level}, multiplier=${multiplier}, reward=${memory.reward.toFixed(2)}`
        );
      }
    }

    setMemories((prev) => upsertMemory(prev, memory));
    mapInstanceRef.current?.flyTo([memory.lat, memory.lng], 15, {
      animate: true,
      duration: 0.8,
    });

    if (!address) return;
    await reloadMemories(address as Address, memory);
  };

  const showLoadingOverlay = isLocating || isLoadingMemories;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "100vh",
      }}
    >
      <div
        ref={mapRef}
        style={{ width: "100%", height: "100%", minHeight: "100vh" }}
      />

      {/* Loading overlay — opaque parchment background with wavy LOADING text */}
      {showLoadingOverlay && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#efe3c3",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontFamily: "'Architects Daughter', 'Marker Felt', cursive",
              fontSize: "20px",
              fontWeight: 400,
              letterSpacing: "0.25em",
              color: "#2a1a0a",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            {"LOADING".split("").map((ch, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  animation: `letterWave 0.9s ease-in-out ${i * 0.14}s infinite`,
                }}
              >
                {ch}
              </span>
            ))}
          </div>
        </div>
      )}

      {memoryLoadError ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "84px",
            transform: "translateX(-50%)",
            zIndex: 1000,
            maxWidth: "min(520px, calc(100vw - 32px))",
            border: "1px solid rgba(248, 113, 113, 0.45)",
            borderRadius: "8px",
            background: "rgba(17, 24, 39, 0.94)",
            color: "#fecaca",
            fontSize: "12px",
            lineHeight: 1.5,
            padding: "10px 12px",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          Could not sync onchain memories: {memoryLoadError}
        </div>
      ) : null}

      {/* Add Memory Modal */}
      <AddMemoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMemory}
        onMemoryConfirmed={onMemoryConfirmed}
        currentLocation={userLocationRef.current ? { lat: userLocationRef.current.lat, lng: userLocationRef.current.lng } : undefined}
      />

      {/* Memory Detail Modal */}
      <MemoryDetailModal
        memory={selectedMemory}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  );
}
