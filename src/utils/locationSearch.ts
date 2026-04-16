// Location search and geocoding utility using OpenStreetMap Nominatim API
export interface LocationResult {
  name: string;
  lat: number;
  lng: number;
  displayName: string;
  type: string;
}

// Search for locations via Next.js API route
export async function searchLocations(
  query: string
): Promise<LocationResult[]> {
  if (!query.trim()) return [];

  try {
    const response = await fetch(
      `/api/locations/search?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      console.error(`Location search failed with status ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    // Ensure response is an array
    if (!Array.isArray(data)) {
      console.error("Location search returned non-array data:", data);
      return [];
    }

    return data;
  } catch (error) {
    console.error("Error searching locations:", error);
    return [];
  }
}
