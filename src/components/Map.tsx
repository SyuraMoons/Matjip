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
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function createMemoryIcon() {
  return L.divIcon({
    className: "",
    html: `
      <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(139, 92, 246, 0.4)) drop-shadow(0 0 8px rgba(139, 92, 246, 0.3));">
        <path d="M 20 2 C 28.8 2 36 9.2 36 18 C 36 28 20 48 20 48 C 20 48 4 28 4 18 C 4 9.2 11.2 2 20 2 Z" fill="rgba(139, 92, 246, 0.95)" stroke="rgba(249, 250, 251, 0.9)" stroke-width="1.5"/>
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
          border: 1px solid rgba(139, 92, 246, 0.3);
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
      border: 1px solid rgba(139, 92, 246, 0.4);
      border-radius: 12px;
      padding: 12px 14px;
      font-family: inherit;
      box-shadow: 0 0 20px rgba(139, 92, 246, 0.15);
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
          <div style="font-size: 10px; color: rgba(139, 92, 246, 0.85); margin-bottom: 6px; letter-spacing: 0.04em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
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
        background: rgba(139, 92, 246, 0.3);
        border: 1px solid rgba(139, 92, 246, 0.5);
        color: rgba(139, 92, 246, 1);
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      " onmouseover="this.style.background = 'rgba(139, 92, 246, 0.5)'" onmouseout="this.style.background = 'rgba(139, 92, 246, 0.3)'">
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
          border: "1px solid rgba(139, 92, 246, 0.4)",
          borderRadius: "16px",
          boxShadow: "0 0 40px rgba(139, 92, 246, 0.2)",
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
            background: "rgba(139, 92, 246, 0.2)",
            border: "1px solid rgba(139, 92, 246, 0.4)",
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
            e.currentTarget.style.backgroundColor = "rgba(139, 92, 246, 0.4)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(139, 92, 246, 0.2)";
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
            borderRight: "1px solid rgba(139, 92, 246, 0.2)",
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
                  border: "1px solid rgba(139, 92, 246, 0.3)",
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
                color: "rgba(139, 92, 246, 0.85)",
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
              backgroundColor: "rgba(139, 92, 246, 0.05)",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid rgba(139, 92, 246, 0.2)",
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
    const VISITED_RADIUS_METERS = 100;
    let updateFrameId: number | null = null;

    // Clip the streets pane to circles at the user's location and every
    // memory, so the labelled Voyager tiles are only visible inside
    // each visited radius. Uses an SVG path() so multiple circles can be
    // combined in a single clip-path.
    function circleSubpath(lat: number, lng: number): string {
      const pt = map.latLngToLayerPoint(L.latLng(lat, lng));
      const metersPerPixel =
        (40075016.686 * Math.abs(Math.cos((lat * Math.PI) / 180))) /
        Math.pow(2, map.getZoom() + 8);
      const r = VISITED_RADIUS_METERS / metersPerPixel;
      return `M ${pt.x + r} ${pt.y} a ${r} ${r} 0 1 0 ${-2 * r} 0 a ${r} ${r} 0 1 0 ${2 * r} 0 Z`;
    }

    function updateStreetsMask() {
      const pane = streetsPaneRef.current;
      if (!pane) return;
      const subpaths: string[] = [];
      const loc = userLocationRef.current;
      if (loc) subpaths.push(circleSubpath(loc.lat, loc.lng));
      // Use current memories from ref, not hardcoded INITIAL_SAMPLE_MEMORIES
      memoriesRef.current.forEach((m) =>
        subpaths.push(circleSubpath(m.lat, m.lng))
      );
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
                  background: #818cf8;
                  border-radius: 50%;
                  border: 2px solid #fff;
                  box-shadow: 0 0 0 4px rgba(129,140,248,0.25);
                "></div>
                <div style="
                  position: absolute; inset: -8px;
                  border-radius: 50%;
                  background: rgba(129,140,248,0.12);
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
                border: 1px solid rgba(129,140,248,0.4);
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
    const progressMemories = await loadKarmaProgressMemories();
    publishRewardProgress(calculateKarmaRewardProgress(progressMemories));
  }, [publishRewardProgress]);

  const reloadMemories = async (poster: Address) => {
    setIsLoadingMemories(true);
    setMemoryLoadError("");

    try {
      const [loaded] = await Promise.all([
        loadDecentralizedMemories({ poster }),
        reloadRewardProgress(),
      ]);
      setMemories(loaded.map(decentralizedMemoryToMapMemory));
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
      publishRewardProgress({ count: 0, target: 5 });
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
          loadKarmaProgressMemories(),
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

  // Update markers when memories change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Remove all existing markers except the user location marker
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
    setMemories((prev) => [...prev, memory]);

    if (!address) return;
    await reloadMemories(address as Address);
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

      {/* Locating overlay — shown while geolocation resolves */}
      <div
        className="locating-overlay"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: showLoadingOverlay ? 1 : 0,
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
          {(isLoadingMemories ? "SYNCING" : "LOADING")
            .split("")
            .map((ch, i) => (
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
