"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons broken by webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Memory = {
  id: number;
  title: string;
  date: string;
  location: string;
  lat: number;
  lng: number;
  excerpt: string;
  emoji: string;
};

const SAMPLE_MEMORIES: Memory[] = [
  {
    id: 1,
    title: "Sunrise at Angkor Wat",
    date: "March 12, 2024",
    location: "Siem Reap, Cambodia",
    lat: 13.4125,
    lng: 103.867,
    excerpt: "Watched the sun rise over the ancient spires, mist rolling across the moat...",
    emoji: "🌅",
  },
  {
    id: 2,
    title: "Lost in the Medina",
    date: "October 3, 2023",
    location: "Fez, Morocco",
    lat: 34.0583,
    lng: -4.9998,
    excerpt: "Turned down a spice alley and found the most incredible blue-tiled courtyard...",
    emoji: "🧭",
  },
  {
    id: 3,
    title: "Northern Lights",
    date: "January 19, 2024",
    location: "Tromsø, Norway",
    lat: 69.6496,
    lng: 18.9553,
    excerpt: "Standing in -12°C, jaw dropped. Green and violet ribbons across the whole sky.",
    emoji: "🌌",
  },
  {
    id: 4,
    title: "Street Food Night Market",
    date: "August 7, 2023",
    location: "Bangkok, Thailand",
    lat: 13.7563,
    lng: 100.5018,
    excerpt: "Pad kra pao at 11pm, the wok still smoking. The best meal of my life.",
    emoji: "🍜",
  },
  {
    id: 5,
    title: "Cliffside Monastery",
    date: "May 22, 2024",
    location: "Meteora, Greece",
    lat: 39.7217,
    lng: 21.6307,
    excerpt: "Hiked up in the early morning before the tourists arrived. Pure silence.",
    emoji: "⛪",
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

export default function Map() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

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

    // Ocean background — no tile layer needed
    const container = map.getContainer();
    container.style.background = "#0a0f1e";

    // Load simplified world countries GeoJSON (Natural Earth 110m — shapes only, zero detail)
    fetch(
      "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson"
    )
      .then((r) => r.json())
      .then((data) => {
        L.geoJSON(data, {
          style: {
            fillColor: "#141c2e",
            fillOpacity: 1,
            color: "#1e2d4a",
            weight: 0.8,
          },
        }).addTo(map);
      });

    // Custom zoom control — bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Geolocation — zoom in and place a "you are here" marker
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;

          map.setView([latitude, longitude], 6, { animate: true });

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

          L.marker([latitude, longitude], { icon: youAreHereIcon })
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
        },
        () => {
          // Permission denied or unavailable — stay on world view, no error thrown
        }
      );
    }

    // Add memory markers
    SAMPLE_MEMORIES.forEach((memory) => {
      const marker = L.marker([memory.lat, memory.lng], {
        icon: createMemoryIcon(memory.emoji),
      }).addTo(map);

      marker.bindPopup(
        `<div style="
          background: rgba(17, 24, 39, 0.97);
          border: 1px solid rgba(139, 92, 246, 0.4);
          border-radius: 12px;
          padding: 14px 16px;
          min-width: 220px;
          font-family: inherit;
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.15);
        ">
          <div style="font-size: 22px; margin-bottom: 6px;">${memory.emoji}</div>
          <div style="font-size: 15px; font-weight: 700; color: #f9fafb; margin-bottom: 2px;">${memory.title}</div>
          <div style="font-size: 11px; color: rgba(139, 92, 246, 0.9); margin-bottom: 8px; letter-spacing: 0.05em;">
            📍 ${memory.location} &nbsp;·&nbsp; ${memory.date}
          </div>
          <div style="font-size: 12px; color: #9ca3af; line-height: 1.5;">${memory.excerpt}</div>
        </div>`,
        {
          className: "memory-popup",
          maxWidth: 280,
        }
      );
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  return (
    <div
      ref={mapRef}
      style={{ width: "100%", height: "100%", minHeight: "100vh" }}
    />
  );
}
