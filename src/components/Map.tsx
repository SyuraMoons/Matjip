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
    excerpt:
      "Watched the sun rise over the ancient spires, mist rolling across the moat...",
    emoji: "🌅",
  },
  {
    id: 2,
    title: "Lost in the Medina",
    date: "October 3, 2023",
    location: "Fez, Morocco",
    lat: 34.0583,
    lng: -4.9998,
    excerpt:
      "Turned down a spice alley and found the most incredible blue-tiled courtyard...",
    emoji: "🧭",
  },
  {
    id: 3,
    title: "Northern Lights",
    date: "January 19, 2024",
    location: "Tromsø, Norway",
    lat: 69.6496,
    lng: 18.9553,
    excerpt:
      "Standing in -12°C, jaw dropped. Green and violet ribbons across the whole sky.",
    emoji: "🌌",
  },
  {
    id: 4,
    title: "Street Food Night Market",
    date: "August 7, 2023",
    location: "Bangkok, Thailand",
    lat: 13.7563,
    lng: 100.5018,
    excerpt:
      "Pad kra pao at 11pm, the wok still smoking. The best meal of my life.",
    emoji: "🍜",
  },
  {
    id: 5,
    title: "Cliffside Monastery",
    date: "May 22, 2024",
    location: "Meteora, Greece",
    lat: 39.7217,
    lng: 21.6307,
    excerpt:
      "Hiked up in the early morning before the tourists arrived. Pure silence.",
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

  const streetsPaneRef = useRef<HTMLElement | null>(null);
  const userLocationRef = useRef<L.LatLng | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [20, 10],
      zoom: 20,
      zoomControl: false,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

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

    const VISITED_RADIUS_METERS = 100;

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
      SAMPLE_MEMORIES.forEach((m) =>
        subpaths.push(circleSubpath(m.lat, m.lng))
      );
      if (subpaths.length === 0) {
        pane.style.clipPath = "circle(0px at 0px 0px)";
        return;
      }
      pane.style.clipPath = `path('${subpaths.join(" ")}')`;
    }
    map.on("move zoom viewreset zoomend moveend", updateStreetsMask);
    updateStreetsMask();

    function addVisitedArea(lat: number, lng: number) {
      L.circle([lat, lng], {
        pane: "visitedPane",
        radius: VISITED_RADIUS_METERS,
        stroke: false,
        fillColor: "rgba(234, 179, 8, 0.2)", // golden wash
        fillOpacity: 0.2,
      }).addTo(map);
    }

    // Geolocation: center + visited circle + marker
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;

          userLocationRef.current = L.latLng(latitude, longitude);
          map.setView([latitude, longitude], 32, { animate: true });
          addVisitedArea(latitude, longitude);
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
          // ignore errors
        }
      );
    }

    // Memory markers
    SAMPLE_MEMORIES.forEach((memory) => {
      addVisitedArea(memory.lat, memory.lng);

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
    </div>
  );
}