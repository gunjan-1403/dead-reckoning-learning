import * as Location from 'expo-location';
import { decodePolyline } from './polyline';
import { haversineMeters } from './routeProgress';
import type {
  LocationPoint,
  RouteInfo,
  RouteStep,
} from '../context/NavigationContext';

const getApiKey = () => process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins >= 60) {
    return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
  }
  return `${mins} min`;
}

function ensurePolyline(
  coords: { latitude: number; longitude: number }[],
  origin: LocationPoint,
  destination: LocationPoint
): { latitude: number; longitude: number }[] {
  if (coords.length >= 2) return coords;
  return [
    { latitude: origin.latitude, longitude: origin.longitude },
    { latitude: destination.latitude, longitude: destination.longitude },
  ];
}

function buildRouteInfo(
  origin: LocationPoint,
  destination: LocationPoint,
  distanceMeters: number,
  durationSeconds: number,
  encodedOrCoords: string | { latitude: number; longitude: number }[],
  steps: RouteStep[] = []
): RouteInfo {
  const decoded =
    typeof encodedOrCoords === 'string'
      ? decodePolyline(encodedOrCoords)
      : encodedOrCoords;
  const polylineCoords = ensurePolyline(decoded, origin, destination);
  const distKm = distanceMeters / 1000;

  return {
    distance:
      distKm >= 1
        ? `${distKm.toFixed(1)} km`
        : `${Math.round(distanceMeters)} m`,
    duration: formatDuration(durationSeconds),
    distanceMeters,
    durationSeconds,
    polylineCoords,
    steps,
  };
}

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
              'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction,routes.legs.steps.localizedValues,routes.legs.steps.endLocation',
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
          const durSeconds =
            parseInt(String(r.duration ?? '0').replace('s', ''), 10) || 0;
          const steps: RouteStep[] = [];
          for (const leg of r.legs ?? []) {
            for (const step of leg.steps ?? []) {
              const instruction =
                step.navigationInstruction?.instructions ||
                step.navigationInstruction?.text ||
                'Continue';
              const lat =
                step.endLocation?.latLng?.latitude ??
                step.endLocation?.latitude;
              const lng =
                step.endLocation?.latLng?.longitude ??
                step.endLocation?.longitude;
              if (lat == null || lng == null) continue;
              steps.push({
                instruction,
                distanceMeters:
                  parseInt(
                    String(
                      step.localizedValues?.distance?.meters ??
                        step.distanceMeters ??
                        0
                    ),
                    10
                  ) || 0,
                location: { latitude: lat, longitude: lng },
              });
            }
          }

          return buildRouteInfo(
            origin,
            destination,
            r.distanceMeters || 0,
            durSeconds,
            r.polyline?.encodedPolyline || '',
            steps
          );
        }
      } else {
        const errBody = await res.text();
        console.warn('[Directions - Routes API] HTTP', res.status, errBody);
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
        `&mode=driving&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK' && data.routes?.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        const steps: RouteStep[] = (leg.steps ?? []).map((step: any) => ({
          instruction: String(step.html_instructions ?? 'Continue').replace(
            /<[^>]+>/g,
            ' '
          ),
          distanceMeters: step.distance?.value ?? 0,
          location: {
            latitude: step.end_location.lat,
            longitude: step.end_location.lng,
          },
        }));

        return buildRouteInfo(
          origin,
          destination,
          leg.distance?.value ?? 0,
          leg.duration?.value ?? 0,
          route.overview_polyline.points,
          steps
        );
      }

      console.warn('[Directions - Legacy] status:', data.status, data.error_message);
    } catch (err) {
      console.warn('[Directions - Legacy] Fetch failed:', err);
    }
  }

  // 3. OSRM fallback (road geometry + steps, no API key)
  try {
    const osrmUrl =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin.longitude},${origin.latitude};` +
      `${destination.longitude},${destination.latitude}` +
      `?overview=full&geometries=polyline&steps=true`;
    console.log('[Directions - OSRM] Fetching route...');
    const res = await fetch(osrmUrl);
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const steps: RouteStep[] = [];
      for (const leg of route.legs ?? []) {
        for (const step of leg.steps ?? []) {
          const [lng, lat] = step.maneuver?.location ?? [];
          if (lat == null || lng == null) continue;
          const type = step.maneuver?.modifier
            ? `${step.maneuver.type} ${step.maneuver.modifier}`
            : step.maneuver?.type || 'continue';
          const road = step.name ? ` onto ${step.name}` : '';
          steps.push({
            instruction: `${type.replace(/_/g, ' ')}${road}`.trim(),
            distanceMeters: step.distance ?? 0,
            location: { latitude: lat, longitude: lng },
          });
        }
      }

      return buildRouteInfo(
        origin,
        destination,
        route.distance || 0,
        route.duration || 0,
        route.geometry || '',
        steps
      );
    }
  } catch (err) {
    console.warn('[Directions - OSRM] Fetch failed:', err);
  }

  // Last resort: straight line so the map still shows a path
  const meters = haversineMeters(origin, destination);
  const seconds = meters / 13.9; // ~50 km/h estimate
  return buildRouteInfo(origin, destination, meters, seconds, []);
}
