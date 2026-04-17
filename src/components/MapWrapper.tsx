"use client";

import dynamic from "next/dynamic";
import { Dispatch, SetStateAction } from "react";
import type { KarmaRewardProgress } from "@/lib/karmaProgress";

// Leaflet requires the DOM — disable SSR for the map
const Map = dynamic(() => import("./Map"), { ssr: false });

type MapWrapperProps = {
  isModalOpen: boolean;
  setIsModalOpen: Dispatch<SetStateAction<boolean>>;
  onMemoryConfirmed?: () => void;
  onRewardProgressChange?: (progress: KarmaRewardProgress) => void;
};

export default function MapWrapper({
  isModalOpen,
  setIsModalOpen,
  onMemoryConfirmed,
  onRewardProgressChange,
}: MapWrapperProps) {
  return (
    <Map
      isModalOpen={isModalOpen}
      setIsModalOpen={setIsModalOpen}
      onMemoryConfirmed={onMemoryConfirmed}
      onRewardProgressChange={onRewardProgressChange}
    />
  );
}
