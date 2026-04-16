"use client";

import { useEffect, useRef, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import type { Address } from "viem";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import AddMemoryModal from "./AddMemoryModal";
import type { MemoryData } from "./AddMemoryModal";
import {
  decentralizedMemoryToMapMemory,
  loadDecentralizedMemories,
} from "@/lib/decentralizedMemories";

// Fix default marker icons broken by webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const INITIAL_SAMPLE_MEMORIES: MemoryData[] = [
  {
    id: 1,
    title: "Sunrise at Angkor Wat",
    date: "March 12, 2024",
    location: "Siem Reap, Cambodia",
    lat: 13.4125,
    lng: 103.867,
    caption:
      "Watched the sun rise over the ancient spires, mist rolling across the moat...",
    emoji: "🌅",
    photos: [],
  },
  {
    id: 2,
    title: "Lost in the Medina",
    date: "October 3, 2023",
    location: "Fez, Morocco",
    lat: 34.0583,
    lng: -4.9998,
    caption:
      "Turned down a spice alley and found the most incredible blue-tiled courtyard...",
    emoji: "🧭",
    photos: [],
  },
  {
    id: 3,
    title: "Northern Lights",
    date: "January 19, 2024",
    location: "Tromsø, Norway",
    lat: 69.6496,
    lng: 18.9553,
    caption:
      "Standing in -12°C, jaw dropped. Green and violet ribbons across the whole sky.",
    emoji: "🌌",
    photos: [],
  },
  {
    id: 4,
    title: "Street Food Night Market",
    date: "August 7, 2023",
    location: "Bangkok, Thailand",
    lat: 13.7563,
    lng: 100.5018,
    caption:
      "Pad kra pao at 11pm, the wok still smoking. The best meal of my life.",
    emoji: "🍜",
    photos: [],
  },
  {
    id: 5,
    title: "Cliffside Monastery",
    date: "May 22, 2024",
    location: "Meteora, Greece",
    lat: 39.7217,
    lng: 21.6307,
    caption:
      "Hiked up in the early morning before the tourists arrived. Pure silence.",
    emoji: "⛪",
    photos: [],
  },
];

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createMemoryPopupContent(memory: MemoryData) {
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
  const locationText = memory.location || "Unknown Location";

  const photosHtml =
    memory.photos.length > 0
      ? `
    <div style="display: flex; flex-direction: column; gap: 6px;">
      ${memory.photos
        .slice(0, 2)
        .map(
          (photo) => `
        <img src="${escapeHtml(photo)}" style="
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
          <div style="font-size: 20px; line-height: 1; margin-bottom: 5px;">${escapeHtml(memory.emoji)}</div>
          <div style="font-size: 13px; font-weight: 700; color: #f9fafb; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(titleText)}">${escapeHtml(truncatedTitle)}</div>
          <div style="font-size: 10px; color: rgba(139, 92, 246, 0.85); margin-bottom: 6px; letter-spacing: 0.04em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            📍 ${escapeHtml(locationText.substring(0, 20))}${locationText.length > 20 ? "..." : ""} · ${escapeHtml(memory.date)}
          </div>
        </div>
        <div style="font-size: 11px; color: #9ca3af; line-height: 1.4; word-break: break-word;">
          ${escapeHtml(truncatedCaption)}
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
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={idx}
                src={photo}
                alt={`${memory.title} photo ${idx + 1}`}
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
}: {
  isModalOpen: boolean;
  setIsModalOpen: (value: boolean) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userLocationRef = useRef<L.LatLng | null>(null);
  const streetsPaneRef = useRef<HTMLElement | null>(null);
  const updateStreetsMaskRef = useRef<() => void>(() => {});
  const memoryVisitedAreasRef = useRef<L.LayerGroup | null>(null);
  const addVisitedAreaRef = useRef<(lat: number, lng: number) => void>(
    () => {}
  );
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });

  const [memories, setMemories] = useState<MemoryData[]>(INITIAL_SAMPLE_MEMORIES);
  const [selectedMemory, setSelectedMemory] = useState<MemoryData | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [memoryLoadError, setMemoryLoadError] = useState("");
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  }>();
  const memoriesRef = useRef<MemoryData[]>(INITIAL_SAMPLE_MEMORIES);

  // Keep memoriesRef in sync with memories state
  useEffect(() => {
    memoriesRef.current = memories;
  }, [memories]);

  const addMemoryMarker = (memory: MemoryData, map: L.Map) => {
    const marker = L.marker([memory.lat, memory.lng], {
      icon: createMemoryIcon(),
    }).addTo(map);

    marker.bindPopup(createMemoryPopupContent(memory), {
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

    const map = L.map(mapRef.current, {
      center: [20, 10],
      zoom: 2,
      zoomControl: false,
      attributionControl: false,
    });
    mapInstanceRef.current = map;
    
    // Force map to recalculate size after initialization
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
        maxZoom: 19,
        opacity: 1,
        className: "globe-tiles",
        pane: "streetsPane",
      }
    ).addTo(map);

    // Zoom control
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // --- Visited radius pane ---
    const visitedPane = map.createPane("visitedPane");
    visitedPane.style.zIndex = "420";
    visitedPane.style.pointerEvents = "none";
    visitedPane.style.willChange = "transform";
    visitedPane.style.backfaceVisibility = "hidden";
    memoryVisitedAreasRef.current = L.layerGroup().addTo(map);

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
      memoriesRef.current.forEach((m) =>
        subpaths.push(circleSubpath(m.lat, m.lng))
      );
      if (subpaths.length === 0) {
        pane.style.clipPath = "circle(0px at 0px 0px)";
        return;
      }
      pane.style.clipPath = `path('${subpaths.join(" ")}')`;
    }

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

    function addVisitedArea(lat: number, lng: number) {
      const circle = L.circle([lat, lng], {
        pane: "visitedPane",
        radius: VISITED_RADIUS_METERS,
        stroke: true,
        color: "rgba(234, 179, 8, 0.5)",
        weight: 2,
        dashArray: "5, 5",
        fillColor: "rgba(234, 179, 8, 0.25)",
        fillOpacity: 0.25,
      });

      memoryVisitedAreasRef.current?.addLayer(circle);
    }

    updateStreetsMaskRef.current = updateStreetsMask;
    addVisitedAreaRef.current = addVisitedArea;

    // Geolocation: center + visited circle + marker
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          userLocationRef.current = L.latLng(latitude, longitude);
          setCurrentLocation({ lat: latitude, lng: longitude });
          
          // Ensure map is ready and has proper dimensions before setView
          if (!mapInstanceRef.current) return;
          
          const map = mapInstanceRef.current;
          const container = map.getContainer();
          
          // Check if container has dimensions
          if (container.offsetWidth === 0 || container.offsetHeight === 0) {
            // Wait for next frame and try again
            requestAnimationFrame(() => {
              if (mapInstanceRef.current && container.offsetWidth > 0) {
                mapInstanceRef.current.invalidateSize();
                mapInstanceRef.current.setView([latitude, longitude], 13, { animate: true });
                L.circle([latitude, longitude], {
                  pane: "visitedPane",
                  radius: VISITED_RADIUS_METERS,
                  stroke: true,
                  color: "rgba(234, 179, 8, 0.5)",
                  weight: 2,
                  dashArray: "5, 5",
                  fillColor: "rgba(234, 179, 8, 0.25)",
                  fillOpacity: 0.25,
                }).addTo(map);
                updateStreetsMask();
              }
            });
            return;
          }
          
          // Container has dimensions, proceed with setView
          map.invalidateSize();
          map.setView([latitude, longitude], 13, { animate: true });
          
          L.circle([latitude, longitude], {
            pane: "visitedPane",
            radius: VISITED_RADIUS_METERS,
            stroke: true,
            color: "rgba(234, 179, 8, 0.5)",
            weight: 2,
            dashArray: "5, 5",
            fillColor: "rgba(234, 179, 8, 0.25)",
            fillOpacity: 0.25,
          }).addTo(map);
          updateStreetsMask();

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
          // ignore errors
        }
      );
    }

    return () => {
      if (updateFrameId !== null) {
        cancelAnimationFrame(updateFrameId);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadWalletMemories() {
      if (!address || !isConnected) {
        setMemoryLoadError("");
        setIsLoadingMemories(false);
        setMemories(INITIAL_SAMPLE_MEMORIES);
        return;
      }

      setIsLoadingMemories(true);
      setMemoryLoadError("");

      try {
        const decentralizedMemories = await loadDecentralizedMemories({
          poster: address as Address,
        });

        if (!isCancelled) {
          setMemories(decentralizedMemories.map(decentralizedMemoryToMapMemory));
        }
      } catch (error) {
        if (!isCancelled) {
          setMemories([]);
          setMemoryLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load decentralized memories"
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingMemories(false);
        }
      }
    }

    loadWalletMemories();

    return () => {
      isCancelled = true;
    };
  }, [address, isConnected]);

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

    memoryVisitedAreasRef.current?.clearLayers();
    memories.forEach((memory) => {
      addMemoryMarker(memory, map);
      addVisitedAreaRef.current(memory.lat, memory.lng);
    });
    updateStreetsMaskRef.current();
  }, [memories]);

  const handleSaveMemory = (memory: MemoryData) => {
    setMemories((prev) => [...prev, memory]);
    requestAnimationFrame(() => updateStreetsMaskRef.current());
  };

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

      {(isLoadingMemories || memoryLoadError || (isConnected && memories.length === 0)) && (
        <div className="absolute left-6 bottom-8 z-[1000] max-w-xs rounded-lg border border-purple-500/30 bg-gray-950/90 px-4 py-3 text-sm text-gray-200 shadow-lg shadow-purple-950/30">
          {isLoadingMemories && "Loading your onchain memories..."}
          {memoryLoadError && (
            <span className="text-amber-300">
              Unable to load memories: {memoryLoadError}
            </span>
          )}
          {!isLoadingMemories && !memoryLoadError && isConnected && memories.length === 0 && (
            "No memories found for this wallet yet."
          )}
        </div>
      )}

      {/* Add Memory Modal */}
      <AddMemoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMemory}
        currentLocation={currentLocation}
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
