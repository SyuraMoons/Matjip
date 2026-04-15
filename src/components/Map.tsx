"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import AddMemoryModal from "./AddMemoryModal";
import type { MemoryData } from "./AddMemoryModal";

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
    caption: "Watched the sun rise over the ancient spires, mist rolling across the moat...",
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
    caption: "Turned down a spice alley and found the most incredible blue-tiled courtyard...",
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
    caption: "Standing in -12°C, jaw dropped. Green and violet ribbons across the whole sky.",
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
    caption: "Pad kra pao at 11pm, the wok still smoking. The best meal of my life.",
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
    caption: "Hiked up in the early morning before the tourists arrived. Pure silence.",
    emoji: "⛪",
    photos: [],
  },
];

function createMemoryIcon(emoji: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 40px;
        height: 40px;
        background: rgba(17, 24, 39, 0.9);
        border: 2px solid rgba(139, 92, 246, 0.8);
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 12px rgba(139, 92, 246, 0.5), 0 0 24px rgba(139, 92, 246, 0.2);
        cursor: pointer;
        transition: all 0.2s;
      ">
        <span style="transform: rotate(45deg); font-size: 18px; line-height: 1;">${emoji}</span>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -44],
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
}: {
  isModalOpen: boolean;
  setIsModalOpen: (value: boolean) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  const [memories, setMemories] = useState<MemoryData[]>(INITIAL_SAMPLE_MEMORIES);
  const [selectedMemory, setSelectedMemory] = useState<MemoryData | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const memoriesRef = useRef<MemoryData[]>(INITIAL_SAMPLE_MEMORIES);

  // Keep memoriesRef in sync with memories state
  useEffect(() => {
    memoriesRef.current = memories;
  }, [memories]);

  const addMemoryMarker = (memory: MemoryData, map: L.Map) => {
    const marker = L.marker([memory.lat, memory.lng], {
      icon: createMemoryIcon(memory.emoji),
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

    // Init map
    const map = L.map(mapRef.current, {
      center: [20, 10],
      zoom: 3,
      zoomControl: false,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // Ocean background
    const container = map.getContainer();
    if (container) {
      container.style.background = "#0a0f1e";
    }

    // Add custom zoom control first
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Ensure the map is ready before adding layers
    map.on("load", () => {
      // Load simplified world countries GeoJSON
      fetch(
        "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson"
      )
        .then((r) => r.json())
        .then((data) => {
          if (mapInstanceRef.current && mapRef.current) {
            L.geoJSON(data, {
              style: {
                fillColor: "#141c2e",
                fillOpacity: 1,
                color: "#1e2d4a",
                weight: 0.8,
              },
            }).addTo(mapInstanceRef.current);
          }
        })
        .catch((err) => {
          console.error("Failed to load GeoJSON:", err);
        });

      // Add initial memory markers
      memories.forEach((memory) => addMemoryMarker(memory, map));
    });

    // Geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          userLocationRef.current = { lat: latitude, lng: longitude };

          // Use map's load event to ensure it's ready
          if (map.isLoading?.()) {
            map.once("load", () => {
              map.setView([latitude, longitude], 6);
            });
          } else {
            map.setView([latitude, longitude], 6);
          }

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
          // Permission denied or unavailable
        }
      );
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

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
  }, [memories]);

  const handleSaveMemory = (memory: MemoryData) => {
    setMemories((prev) => [...prev, memory]);
  };

  return (
    <div className="relative w-full h-screen">
      <div
        ref={mapRef}
        style={{ width: "100%", height: "100%", minHeight: "100vh" }}
      />

      {/* Memory Count */}
      <div className="absolute bottom-8 right-8 bg-slate-900/80 border border-purple-500/30 backdrop-blur-sm rounded-full px-4 py-2 text-sm text-gray-300 z-40">
        <span className="text-purple-400 font-semibold">{memories.length}</span> memories saved
      </div>

      {/* Detail Modal */}
      <MemoryDetailModal
        memory={selectedMemory}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />

      {/* Add Memory Modal */}
      <AddMemoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMemory}
        map={mapInstanceRef.current}
        currentLocation={userLocationRef.current || undefined}
      />
    </div>
  );
}
