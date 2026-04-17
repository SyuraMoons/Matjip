import { NextRequest, NextResponse } from "next/server";

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

type KakaoKeywordDoc = {
  place_name: string;
  address_name: string;
  road_address_name: string;
  category_group_name: string;
  category_name: string;
  x: string;
  y: string;
};

type KakaoAddressDoc = {
  address_name: string;
  address_type: string;
  x: string;
  y: string;
  road_address?: { address_name: string };
};

type SearchResult = {
  name: string;
  lat: number;
  lng: number;
  displayName: string;
  type: string;
};

function formatResult(name: string, lat: number, lng: number, displayName: string, type: string): SearchResult {
  return { name, lat, lng, displayName, type };
}

async function searchKakao(query: string): Promise<SearchResult[]> {
  if (!KAKAO_REST_API_KEY) return [];

  // Try keyword search first (place names, restaurants, landmarks)
  const keywordRes = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`,
    {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
      cache: "no-store",
    }
  );

  if (keywordRes.ok) {
    const data = await keywordRes.json();
    const docs: KakaoKeywordDoc[] = data.documents || [];
    if (docs.length > 0) {
      return docs.map((item) =>
        formatResult(
          item.place_name || "Unknown location",
          Number(item.y),
          Number(item.x),
          item.road_address_name || item.address_name || "",
          item.category_group_name || item.category_name || "place"
        )
      );
    }
  }

  // Fall back to address search (Korean lot-number / road addresses)
  const addressRes = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=5`,
    {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
      cache: "no-store",
    }
  );

  if (addressRes.ok) {
    const data = await addressRes.json();
    const docs: KakaoAddressDoc[] = data.documents || [];
    return docs.map((item) =>
      formatResult(
        item.address_name,
        Number(item.y),
        Number(item.x),
        item.road_address?.address_name || item.address_name,
        item.address_type === "ROAD_ADDR" ? "road address" : "address"
      )
    );
  }

  return [];
}

async function searchNominatim(query: string): Promise<SearchResult[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": "Matjip/1.0 (Contact: info@matjip.app)",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) return [];

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  // Block broad area types
  const excludedTypes = new Set([
    "administrative", "city", "town", "county", "state",
    "province", "region", "country", "continent",
    "municipality", "state_district",
  ]);

  return data
    .filter((item: Record<string, unknown>) => {
      const type = String(item.type || "").toLowerCase();
      const category = String(item.category || "").toLowerCase();
      return !excludedTypes.has(type) && category !== "boundary";
    })
    .map((item: Record<string, unknown>) => formatResult(
      String(item.display_name || "").split(",")[0].trim() || "Unknown location",
      Number(item.lat),
      Number(item.lon),
      String(item.display_name || ""),
      String(item.type || "location")
    ))
    .filter(
      (item) => Number.isFinite(item.lat) && Number.isFinite(item.lng) && item.name.length > 0
    );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json([]);
  }

  try {
    // Try Kakao first (best for Korean addresses and places)
    const kakaoResults = await searchKakao(query);
    if (kakaoResults.length > 0) {
      return NextResponse.json(kakaoResults);
    }

    // Fall back to Nominatim (for English / international queries)
    const nominatimResults = await searchNominatim(query);
    return NextResponse.json(nominatimResults);
  } catch (error) {
    console.error("Location search error:", error);

    return NextResponse.json(
      { error: "Location search failed" },
      { status: 500 }
    );
  }
}
