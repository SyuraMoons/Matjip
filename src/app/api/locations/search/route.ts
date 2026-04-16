import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json([]);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10`;
    
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "en",
      },
    });

    if (!response.ok) {
      console.error(`Nominatim API error: ${response.status} ${response.statusText}`);
      return NextResponse.json([]);
    }

    const data = await response.json();

    // Ensure data is an array
    if (!Array.isArray(data)) {
      console.error("Nominatim response is not an array:", data);
      return NextResponse.json([]);
    }

    const results = data.map((item: Record<string, unknown>) => {
      try {
        return {
          name: String(item.name || ""),
          lat: parseFloat(String(item.lat || 0)),
          lng: parseFloat(String(item.lon || 0)),
          displayName: String(item.display_name || ""),
          type: String(item.type || "location"),
        };
      } catch (err) {
        console.error("Error parsing location item:", item, err);
        return null;
      }
    }).filter(Boolean);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Location search error:", error);
    // Return empty array on error instead of 500
    return NextResponse.json([]);
  }
}
