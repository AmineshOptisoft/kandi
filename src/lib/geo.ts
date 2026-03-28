const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Simple in-memory cache for coordinates to areas to save API costs
const areaCache: Record<string, string> = {};

export async function getAreaFromLatLng(lat: number, lng: number): Promise<string> {
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`; // Use 3 decimal precision (~100m) for caching
  if (areaCache[cacheKey]) return areaCache[cacheKey];

  if (!GOOGLE_API_KEY) return "Unknown Area";

  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`);
    const data = await res.json();
    
    if (data.results && data.results[0]) {
      // Find 'sublocality' or 'neighborhood' as it represents the 'Area'
      const areaComponent = data.results[0].address_components.find((c: any) => 
        c.types.includes("sublocality_level_1") || 
        c.types.includes("neighborhood") || 
        c.types.includes("locality")
      );
      
      const area = areaComponent ? areaComponent.long_name : "General Area";
      areaCache[cacheKey] = area;
      return area;
    }
    return "Unknown Area";
  } catch (err) {
    console.error("Geocoding Error:", err);
    return "Unknown Area";
  }
}
