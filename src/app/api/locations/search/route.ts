import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json([]);
  }

  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?format=jsonv2` +
      `&q=${encodeURIComponent(query)}` +
      `&limit=5` +
      `&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": "Matjip/1.0 (Contact: info@matjip.app)",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Nominatim API error:", response.status, text);

      return NextResponse.json(
        { error: `Nominatim failed with status ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      console.error("Nominatim response is not an array:", data);
      return NextResponse.json(
        { error: "Nominatim returned invalid data" },
        { status: 500 }
      );
    }

    const results = data
      .map((item: Record<string, unknown>) => ({
        name:
          String(item.display_name || "")
            .split(",")[0]
            .trim() || "Unknown location",
        lat: Number(item.lat),
        lng: Number(item.lon),
        displayName: String(item.display_name || ""),
        type: String(item.type || "location"),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.lat) &&
          Number.isFinite(item.lng) &&
          item.displayName.length > 0
      );

    return NextResponse.json(results);
  } catch (error) {
    console.error("Location search error:", error);

    return NextResponse.json(
      { error: "Location search failed" },
      { status: 500 }
    );
  }
}
