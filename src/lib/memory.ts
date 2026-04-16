import { createHash } from "crypto";

export const COORDINATE_PRECISION_DECIMALS = 3;

export type MemoryMetadata = {
  version: 1;
  app: "matjip";
  title: string;
  description: string;
  locationName: string;
  coordinates: {
    lat: number;
    lng: number;
    precision: "rounded";
  };
  images: string[];
  createdAt: string;
};

export function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseCoordinate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

export function roundCoordinate(value: number) {
  return Number(value.toFixed(COORDINATE_PRECISION_DECIMALS));
}

export function toE6Coordinate(value: number) {
  return Math.round(roundCoordinate(value) * 1_000_000);
}

export function isValidLatitude(value: number) {
  return value >= -90 && value <= 90;
}

export function isValidLongitude(value: number) {
  return value >= -180 && value <= 180;
}

export function metadataHash(metadataJson: string): `0x${string}` {
  return `0x${createHash("sha256").update(metadataJson).digest("hex")}`;
}
