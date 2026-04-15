// Enrich memories.json with { scale, radiusMeters } via Nominatim reverse
// geocoding. Run: `node scripts/enrich-memories.mjs` (Node 18+).
//
// Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
// - Max 1 req/sec, must send a descriptive User-Agent.

import { readFile, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_PATH = path.join(__dirname, "..", "memories.json");
const OUTPUT_PATH = path.join(__dirname, "..", "memories_enriched.json");

const RATE_LIMIT_MS = 1100;
const USER_AGENT =
  "matjib-memory-enricher/0.1 (https://github.com/aisha/matjib)";

/**
 * @typedef {Object} Memory
 * @property {number} id
 * @property {string} title
 * @property {string} date
 * @property {string} location
 * @property {number} lat
 * @property {number} lng
 * @property {string} excerpt
 * @property {string} emoji
 * @property {number} [radiusMeters]
 * @property {"spot"|"venue"|"district"|"region"} [scale]
 */

/**
 * @typedef {Object} NominatimResponse
 * @property {string} class
 * @property {string} type
 * @property {[string,string,string,string]} boundingbox - [south, north, west, east]
 * @property {string} display_name
 */

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function clamp(v, lo, hi) {
  return Math.round(Math.max(lo, Math.min(hi, v)));
}

/**
 * Classify a Nominatim response into a scale + radius.
 * Strategy: pick a scale bucket from class/type, then pick a radius by
 * clamping the bbox half-diagonal into the bucket's min/max range. This
 * means the radius tracks the real feature size within sensible bounds.
 *
 * @param {NominatimResponse} n
 * @returns {{ scale: "spot"|"venue"|"district"|"region", radiusMeters: number }}
 */
function classify(n) {
  const [south, north, west, east] = n.boundingbox.map(Number);
  const bboxDiag = haversineMeters(south, west, north, east);
  const bboxRadius = bboxDiag / 2;

  const cls = n.class;
  const typ = n.type;

  // region — cities, towns, admin areas
  if (
    (cls === "place" &&
      ["city", "town", "village", "hamlet", "municipality"].includes(typ)) ||
    (cls === "boundary" && typ === "administrative")
  ) {
    return { scale: "region", radiusMeters: clamp(bboxRadius, 1200, 2500) };
  }

  // district — neighbourhoods, suburbs, quarters
  if (
    cls === "place" &&
    ["suburb", "neighbourhood", "quarter", "city_district", "borough"].includes(
      typ
    )
  ) {
    return { scale: "district", radiusMeters: clamp(bboxRadius, 600, 1200) };
  }

  // venue — anything with a meaningful footprint
  if (
    cls === "historic" ||
    (cls === "tourism" &&
      ["attraction", "museum", "gallery", "zoo", "theme_park"].includes(typ)) ||
    (cls === "leisure" &&
      ["park", "stadium", "garden", "nature_reserve", "golf_course"].includes(
        typ
      )) ||
    cls === "building"
  ) {
    return { scale: "venue", radiusMeters: clamp(bboxRadius, 250, 600) };
  }

  // spot — tight POIs
  if (
    cls === "amenity" ||
    cls === "shop" ||
    (cls === "tourism" &&
      ["viewpoint", "hotel", "hostel", "guest_house"].includes(typ))
  ) {
    return { scale: "spot", radiusMeters: clamp(bboxRadius, 80, 150) };
  }

  // Fallback: decide purely by bbox size.
  if (bboxRadius < 200)
    return { scale: "spot", radiusMeters: clamp(bboxRadius, 80, 150) };
  if (bboxRadius < 800)
    return { scale: "venue", radiusMeters: clamp(bboxRadius, 250, 600) };
  if (bboxRadius < 1600)
    return { scale: "district", radiusMeters: clamp(bboxRadius, 600, 1200) };
  return { scale: "region", radiusMeters: clamp(bboxRadius, 1200, 2500) };
}

async function reverseGeocode(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse` +
    `?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
  });
  if (!res.ok) {
    throw new Error(`Nominatim ${res.status} ${res.statusText} for ${lat},${lng}`);
  }
  return /** @type {Promise<NominatimResponse>} */ (res.json());
}

async function main() {
  /** @type {Memory[]} */
  const memories = JSON.parse(await readFile(INPUT_PATH, "utf-8"));
  /** @type {Memory[]} */
  const enriched = [];

  for (const m of memories) {
    try {
      const n = await reverseGeocode(m.lat, m.lng);
      const { scale, radiusMeters } = classify(n);
      console.log(
        `#${m.id} ${m.title}  →  ${n.class}/${n.type}  →  ${scale} @ ${radiusMeters}m`
      );
      enriched.push({ ...m, scale, radiusMeters });
    } catch (err) {
      console.warn(`#${m.id} ${m.title} — failed:`, err.message ?? err);
      enriched.push(m);
    }
    await sleep(RATE_LIMIT_MS);
  }

  await writeFile(OUTPUT_PATH, JSON.stringify(enriched, null, 2) + "\n");
  console.log(`\nWrote ${enriched.length} memories → ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
