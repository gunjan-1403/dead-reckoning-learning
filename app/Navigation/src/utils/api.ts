import * as Location from 'expo-location';
import { decodePolyline } from './polyline';
import type { LocationPoint, RouteInfo } from '../context/NavigationContext';

const getApiKey = () => process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/* ── Place Autocomplete ── */

export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

// In-memory cache for fallback places coordinates
const fallbackCoordsCache = new Map<
  string,
  { latitude: number; longitude: number; address: string }
>();

export async function searchPlaces(
  query: string,
  userLocation?: { latitude: number; longitude: number } | null
): Promise<{ predictions: PlacePrediction[]; error?: string }> {
  if (!query.trim()) return { predictions: [] };

  const apiKey = getApiKey();

  // 1. Try Google Places API (New)
  if (apiKey) {
    try {
      console.log('[Places API New] Searching:', query);
      const body: any = {
        input: query,
      };

      if (userLocation) {
        body.locationBias = {
          circle: {
            center: {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            },
            radius: 50000.0,
          },
        };
      }

      const res = await fetch(
        'https://places.googleapis.com/v1/places:autocomplete',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
          },
          body: JSON.stringify(body),
        }
      );

      const data = await res.json();

      if (res.ok && data.suggestions && data.suggestions.length > 0) {
        console.log(
          '[Places API New] Found',
          data.suggestions.length,
          'suggestions'
        );
        const predictions: PlacePrediction[] = data.suggestions
          .filter((s: any) => s.placePrediction)
          .map((s: any) => {
            const p = s.placePrediction;
            return {
              place_id: p.placeId || p.place?.replace('places/', '') || '',
              description: p.text?.text || '',
              structured_formatting: {
                main_text:
                  p.structuredFormat?.mainText?.text ||
                  p.text?.text ||
                  '',
                secondary_text:
                  p.structuredFormat?.secondaryText?.text || '',
              },
            };
          });

        return { predictions };
      }

      if (data.error) {
        console.warn(
          '[Places API New] Error from Google:',
          data.error.message || data.error.status
        );
      }
    } catch (err) {
      console.warn('[Places API New] Fetch failed:', err);
    }
  }

  // 2. Try Google Legacy Places API (if project has it enabled)
  if (apiKey) {
    try {
      let url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(query)}` +
        `&key=${apiKey}`;

      if (userLocation) {
        url += `&location=${userLocation.latitude},${userLocation.longitude}&radius=50000`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK' && data.predictions?.length > 0) {
        return { predictions: data.predictions };
      }
    } catch (err) {
      console.warn('[Places API Legacy] Fetch failed:', err);
    }
  }

  // 3. Fallback: Photon / OSM Search (Free, zero API key needed, ensures instant results)
  try {
    console.log('[Places Search] Trying Photon/OSM fallback for:', query);
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      query
    )}&limit=8`;
    const res = await fetch(photonUrl);
    const data = await res.json();

    if (data.features && data.features.length > 0) {
      const predictions: PlacePrediction[] = data.features.map(
        (f: any, idx: number) => {
          const id = `osm_${f.properties.osm_id || idx}_${Date.now()}`;
          const mainText =
            f.properties.name || f.properties.street || query;
          const secondaryParts = [
            f.properties.street !== mainText ? f.properties.street : null,
            f.properties.city ||
              f.properties.county ||
              f.properties.district,
            f.properties.state,
            f.properties.country,
          ].filter(Boolean);
          const secondaryText = secondaryParts.join(', ');
          const fullAddress = secondaryText
            ? `${mainText}, ${secondaryText}`
            : mainText;

          // Cache coordinates for details retrieval
          fallbackCoordsCache.set(id, {
            latitude: f.geometry.coordinates[1],
            longitude: f.geometry.coordinates[0],
            address: fullAddress,
          });

          return {
            place_id: id,
            description: fullAddress,
            structured_formatting: {
              main_text: mainText,
              secondary_text: secondaryText,
            },
          };
        }
      );

      return { predictions };
    }
  } catch (err) {
    console.warn('[Places Search Fallback] Failed:', err);
  }

  return { predictions: [] };
}

/* ── Place Details (lat/lng from place_id) ── */

export async function getPlaceDetails(
  placeId: string
): Promise<LocationPoint | null> {
  // Check fallback cache first
  if (fallbackCoordsCache.has(placeId)) {
    return fallbackCoordsCache.get(placeId)!;
  }

  const apiKey = getApiKey();

  // 1. Try Google Places API (New) details
  if (apiKey) {
    try {
      const cleanId = placeId.startsWith('places/')
        ? placeId.replace('places/', '')
        : placeId;
      const url = `https://places.googleapis.com/v1/places/${cleanId}`;
      console.log('[Place Details New] Fetching for:', cleanId);

      const res = await fetch(url, {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'id,displayName,formattedAddress,location',
        },
      });

      const data = await res.json();

      if (res.ok && data.location) {
        const name = data.displayName?.text;
        const address = name
          ? `${name}, ${data.formattedAddress || ''}`
          : data.formattedAddress || '';

        return {
          latitude: data.location.latitude,
          longitude: data.location.longitude,
          address: address.trim(),
        };
      }
    } catch (err) {
      console.warn('[Place Details New] Fetch failed:', err);
    }
  }

  // 2. Try Google Legacy Place Details
  if (apiKey) {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${placeId}&fields=geometry,formatted_address,name&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK' && data.result?.geometry?.location) {
        return {
          latitude: data.result.geometry.location.lat,
          longitude: data.result.geometry.location.lng,
          address: data.result.name
            ? `${data.result.name}, ${data.result.formatted_address}`
            : data.result.formatted_address,
        };
      }
    } catch (err) {
      console.warn('[Place Details Legacy] Fetch failed:', err);
    }
  }

  return null;
}

/* ── Reverse Geocode (address from lat/lng) ── */

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string> {
  // 1. Expo native reverse geocoding (fast, accurate, no API key needed)
  try {
    const results = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lng,
    });
    if (results && results.length > 0) {
      const a = results[0];
      const parts = [
        a.name || a.street,
        a.district || a.subregion || a.city,
        a.region,
      ].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
  } catch {
    // Continue
  }

  // 2. Google Reverse Geocode
  const apiKey = getApiKey();
  if (apiKey) {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?latlng=${lat},${lng}&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.results?.[0]?.formatted_address) {
        return data.results[0].formatted_address;
      }
    } catch {
      // Continue
    }
  }

  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/* ── Directions ── */

export async function getDirections(
  origin: LocationPoint,
  destination: LocationPoint
): Promise<RouteInfo | null> {
  const apiKey = getApiKey();

  // 1. Google Routes API (New)
  if (apiKey) {
    try {
      console.log('[Directions - Routes API] Requesting route...');
      const res = await fetch(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask':
              'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
          },
          body: JSON.stringify({
            origin: {
              location: {
                latLng: {
                  latitude: origin.latitude,
                  longitude: origin.longitude,
                },
              },
            },
            destination: {
              location: {
                latLng: {
                  latitude: destination.latitude,
                  longitude: destination.longitude,
                },
              },
            },
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE',
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const r = data.routes[0];
          const distKm = (r.distanceMeters / 1000).toFixed(1);
          const durSeconds =
            parseInt(r.duration?.replace('s', '') || '0', 10) || 0;
          const durMins = Math.round(durSeconds / 60);
          const durText =
            durMins >= 60
              ? `${Math.floor(durMins / 60)} hr ${durMins % 60} min`
              : `${durMins} min`;

          return {
            distance: `${distKm} km`,
            duration: durText,
            polylineCoords: decodePolyline(
              r.polyline?.encodedPolyline || ''
            ),
          };
        }
      }
    } catch (err) {
      console.warn('[Directions - Routes API] Fetch failed:', err);
    }
  }

  // 2. Google Directions (Legacy)
  if (apiKey) {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${origin.latitude},${origin.longitude}` +
        `&destination=${destination.latitude},${destination.longitude}` +
        `&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK' && data.routes?.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        return {
          distance: leg.distance.text,
          duration: leg.duration.text,
          polylineCoords: decodePolyline(
            route.overview_polyline.points
          ),
        };
      }
    } catch (err) {
      console.warn('[Directions - Legacy] Fetch failed:', err);
    }
  }

  // 3. Robust High-Performance Fallback: OSRM (Turn-by-turn routing with encoded polyline)
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline`;
    console.log('[Directions - OSRM] Fetching fallback route...');
    const res = await fetch(osrmUrl);
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distKm = (route.distance / 1000).toFixed(1);
      const durMins = Math.round(route.duration / 60);
      const durText =
        durMins >= 60
          ? `${Math.floor(durMins / 60)} hr ${durMins % 60} min`
          : `${durMins} min`;

      return {
        distance: `${distKm} km`,
        duration: durText,
        polylineCoords: decodePolyline(route.geometry),
      };
    }
  } catch (err) {
    console.warn('[Directions - OSRM] Fetch failed:', err);
  }

  return null;
}
