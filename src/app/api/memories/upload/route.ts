import {
  isValidLatitude,
  isValidLongitude,
  metadataHash,
  normalizeText,
  parseCoordinate,
  roundCoordinate,
  toE6Coordinate,
  type MemoryMetadata,
} from "@/lib/memory";
import { cleanImageForUpload, pinFile, pinJson } from "@/lib/pinata";

export const runtime = "nodejs";

const MAX_PHOTOS = 6;

function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const title = normalizeText(formData.get("title"));
    const description = normalizeText(formData.get("description"));
    const locationName = normalizeText(formData.get("locationName"));
    const lat = parseCoordinate(formData.get("lat"));
    const lng = parseCoordinate(formData.get("lng"));
    const photos = formData
      .getAll("photos")
      .filter((entry): entry is File => entry instanceof File);

    if (!title) {
      return errorResponse("Title is required");
    }

    if (lat === null || !isValidLatitude(lat)) {
      return errorResponse("Latitude must be between -90 and 90");
    }

    if (lng === null || !isValidLongitude(lng)) {
      return errorResponse("Longitude must be between -180 and 180");
    }

    if (photos.length === 0) {
      return errorResponse("At least one photo is required");
    }

    if (photos.length > MAX_PHOTOS) {
      return errorResponse(`Upload at most ${MAX_PHOTOS} photos`);
    }

    const cleanedImages = await Promise.all(photos.map(cleanImageForUpload));
    const imageCids = await Promise.all(cleanedImages.map(pinFile));
    const latRounded = roundCoordinate(lat);
    const lngRounded = roundCoordinate(lng);

    const metadata: MemoryMetadata = {
      version: 1,
      app: "matjip",
      title,
      description,
      locationName,
      coordinates: {
        lat: latRounded,
        lng: lngRounded,
        precision: "rounded",
      },
      images: imageCids,
      createdAt: new Date().toISOString(),
    };

    const metadataJson = JSON.stringify(metadata);
    const hash = metadataHash(metadataJson);
    const metadataCid = await pinJson(metadata, `matjip-${Date.now()}.json`);
    const latE6 = toE6Coordinate(lat);
    const lngE6 = toE6Coordinate(lng);

    return Response.json({
      imageCids,
      metadataCid,
      metadataHash: hash,
      latE6,
      lngE6,
      contractArgs: {
        metadataCid,
        metadataHash: hash,
        latE6,
        lngE6,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status =
      message.includes("PINATA_JWT") || message.includes("Pinata") ? 502 : 400;

    return errorResponse(message, status);
  }
}
