"use client";

import dynamic from "next/dynamic";
import { Dispatch, SetStateAction } from "react";

// Leaflet requires the DOM — disable SSR for the map
const Map = dynamic(() => import("./Map"), { ssr: false });

type MapWrapperProps = {
  isModalOpen: boolean;
  setIsModalOpen: Dispatch<SetStateAction<boolean>>;
};

export default function MapWrapper({ isModalOpen, setIsModalOpen }: MapWrapperProps) {
  return <Map isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} />;
}
