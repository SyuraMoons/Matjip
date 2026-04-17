import { NextRequest, NextResponse } from "next/server";

type LatLngTuple = [number, number];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const startLat = Number(searchParams.get("startLat"));
  const startLng = Number(searchParams.get("startLng"));
  const endLat = Number(searchParams.get("endLat"));
  const endLng = Number(searchParams.get("endLng"));

  if (
    !Number.isFinite(startLat) ||
    !Number.isFinite(startLng) ||
    !Number.isFinite(endLat) ||
    !Number.isFinite(endLng)
  ) {
    return NextResponse.json(
      { error: "Missing or invalid coordinates" },
      { status: 400 }
    );
  }

  try {
    // OSRM public demo server - returns fastest/shortest route following actual street network
    const url =
      `https://router.project-osrm.org/route/v1/foot/` +
      `${startLng},${startLat};${endLng},${endLat}` +
      `?overview=full&geometries=geojson&steps=false`;

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || data?.code !== "Ok" || !data?.routes?.length) {
      return NextResponse.json(
        { error: data?.message || "Route not found" },
        { status: 502 }
      );
    }

    const rawCoords = data.routes[0]?.geometry?.coordinates;

    if (!Array.isArray(rawCoords) || rawCoords.length < 2) {
      return NextResponse.json(
        { error: "Invalid route geometry" },
        { status: 502 }
      );
    }

    // Convert GeoJSON [lng, lat] to [lat, lng] tuples
    const points: LatLngTuple[] = rawCoords
      .map((coord: unknown): LatLngTuple | null => {
        if (!Array.isArray(coord) || coord.length < 2) return null;
        const [lng, lat] = coord;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return [Number(lat), Number(lng)];
      })
      .filter((p: LatLngTuple | null): p is LatLngTuple => p !== null);

    if (points.length < 2) {
      return NextResponse.json(
        { error: "Route geometry too short" },
        { status: 502 }
      );
    }

    return NextResponse.json({ points });
  } catch (error) {
    console.error("Route fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch route" },
      { status: 500 }
    );
  }
}
