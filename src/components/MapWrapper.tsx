"use client";

import dynamic from "next/dynamic";

// Leaflet requires the DOM — disable SSR for the map
const Map = dynamic(() => import("./Map"), { ssr: false });

export default function MapWrapper() {
  return <Map />;
}
