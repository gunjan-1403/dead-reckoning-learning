/**
 * useDeadReckoning
 *
 * Watches GPS continuously. When a valid fix is available the hook forwards
 * the GPS position. When the fix is lost it switches to dead reckoning: the
 * speed CNN estimates current vehicle speed from the IMU window, and that
 * speed is integrated with the last-known heading to propagate position.
 *
 * GPS loss is declared after GPS_TIMEOUT_MS of no fresh fix.
 * Recovery is instant: the first valid GPS fix snaps position back.
 *
 * Unit and axis conventions
 * ─────────────────────────
 * The ring buffer stores raw Expo sensor values:
 *   accelerometer: g  (Expo default)
 *   gyroscope:     rad/s
 *
 * The model was trained on IO-VNBD data where:
 *   accelerometer: m/s²  → multiply g × 9.81 before inference
 *   gyroscope channels: yaw (Z), pitch (X), roll (Y) — phone lying flat
 *     IO-VNBD col 0: yaw   → Expo gyro.z
 *     IO-VNBD col 1: pitch → Expo gyro.x
 *     IO-VNBD col 2: roll  → Expo gyro.y
 *
 * Resampling
 * ──────────
 * App captures at ~50 Hz; model expects ~10 Hz (100 ms bins).
 * We resample by timestamp: bin the last 2.6 s of raw samples into
 * 26 non-overlapping 100 ms windows, taking the median of each bin.
 * This avoids the phase errors introduced by picking every Nth sample.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

import { motionBuffer } from '@/sensors/motionChannels';
import {
  isOnnxRuntimeAvailable,
  loadSpeedModel,
  predictSpeed,
} from '@/inference/speedModel';

// ── Constants ────────────────────────────────────────────────────────────────

/** Declare GPS lost after this many ms without a fresh GPS fix. */
const GPS_TIMEOUT_MS = 10_000;

/** Minimum GPS horizontal accuracy (m) for a fix to be accepted. */
const GPS_MIN_ACCURACY_M = 50;

/** How often the DR engine ticks when GPS is lost (ms). */
const DR_TICK_MS = 1_000;

/** Model window: 26 bins of 100 ms = 2.6 s. */
const MODEL_BINS    = 26;
const BIN_WIDTH_MS  = 100;
const WINDOW_MS     = MODEL_BINS * BIN_WIDTH_MS; // 2600 ms

/** g → m/s² */
const G_TO_MS2 = 9.80665;

// ── Resampling ────────────────────────────────────────────────────────────────

/**
 * Resample the raw 50 Hz ring-buffer into 26 bins of 100 ms each.
 *
 * Returns null when there is insufficient data (< 2.6 s of history).
 *
 * Channel layout coming in (raw Expo units):
 *   [accX_g, accY_g, accZ_g, gyroX_rads, gyroY_rads, gyroZ_rads]
 *
 * Channel layout going out (model units):
 *   [accX_ms2, accY_ms2, accZ_ms2, gyroYaw_rads, gyroPitch_rads, gyroRoll_rads]
 *
 * Gyro remap (phone lying flat, screen up):
 *   model yaw   ← expo gyro.z  (index 5)
 *   model pitch ← expo gyro.x  (index 3)
 *   model roll  ← expo gyro.y  (index 4)
 */
function resampleToModelWindow(
  rawSamples: { timestamp: number; channels: number[] }[]
): number[][] | null {
  if (rawSamples.length === 0) return null;

  const now = rawSamples[rawSamples.length - 1].timestamp * 1000; // → ms
  const windowStart = now - WINDOW_MS;

  // Filter to the last 2.6 s.
  const inWindow = rawSamples.filter(s => s.timestamp * 1000 >= windowStart);
  if (inWindow.length < MODEL_BINS) return null; // need at least one per bin

  const bins: number[][][] = Array.from({ length: MODEL_BINS }, () => []);

  for (const s of inWindow) {
    const ageMs = now - s.timestamp * 1000;
    const binIdx = MODEL_BINS - 1 - Math.floor(ageMs / BIN_WIDTH_MS);
    if (binIdx >= 0 && binIdx < MODEL_BINS) {
      bins[binIdx].push(s.channels);
    }
  }

  // Every bin must have at least one sample.
  if (bins.some(b => b.length === 0)) return null;

  // Take the median of each bin, then apply unit and axis conversions.
  return bins.map(bin => {
    const n = bin.length;
    const med = (ch: number) => {
      const sorted = bin.map(row => row[ch]).sort((a, b) => a - b);
      return n % 2 === 1
        ? sorted[Math.floor(n / 2)]
        : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    };

    // Accelerometer: g → m/s²
    const accX = med(0) * G_TO_MS2;
    const accY = med(1) * G_TO_MS2;
    const accZ = med(2) * G_TO_MS2;

    // Gyroscope: remap expo X/Y/Z → model yaw/pitch/roll
    const gyroYaw   = med(5); // expo Z → yaw
    const gyroPitch = med(3); // expo X → pitch
    const gyroRoll  = med(4); // expo Y → roll

    return [accX, accY, accZ, gyroYaw, gyroPitch, gyroRoll];
  });
}

// ── Coordinate math ──────────────────────────────────────────────────────────

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_M = 6_371_000;

function moveCoord(
  lat: number,
  lon: number,
  headingDeg: number,
  distanceMeters: number
): { latitude: number; longitude: number } {
  const headingRad = headingDeg * DEG_TO_RAD;
  const dLat = (distanceMeters * Math.cos(headingRad)) / EARTH_RADIUS_M;
  const dLon =
    (distanceMeters * Math.sin(headingRad)) /
    (EARTH_RADIUS_M * Math.cos(lat * DEG_TO_RAD));
  return {
    latitude:  lat + dLat / DEG_TO_RAD,
    longitude: lon + dLon / DEG_TO_RAD,
  };
}

// ── Types ────────────────────────────────────────────────────────────────────

export type PositionSource = 'gps' | 'dead_reckoning' | 'none';

export interface DeadReckoningState {
  /** Best available position estimate. */
  coords: { latitude: number; longitude: number } | null;
  /** Where this estimate came from. */
  source: PositionSource;
  /** Estimated speed from the model (km/h). null when GPS is active. */
  estimatedSpeedKmh: number | null;
  /** Model uncertainty (1-sigma, km/h). null when GPS is active. */
  speedSigmaKmh: number | null;
  /**
   * Distance travelled since last GPS fix (metres).
   * This is path length, not measured position error — actual position
   * error depends on heading accuracy and model error.
   */
  distanceTravelledM: number;
  /** Whether the speed model is loaded and ready. */
  modelReady: boolean;
  /** Error message, or null. */
  error: string | null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDeadReckoning(): DeadReckoningState {
  const [state, setState] = useState<DeadReckoningState>({
    coords: null,
    source: 'none',
    estimatedSpeedKmh: null,
    speedSigmaKmh: null,
    distanceTravelledM: 0,
    modelReady: false,
    error: null,
  });

  const lastGpsTimeRef    = useRef<number>(0);
  const lastGpsCoordsRef  = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastHeadingRef    = useRef<number>(0);
  const drCoordsRef       = useRef<{ latitude: number; longitude: number } | null>(null);
  const distTravelledRef  = useRef<number>(0);
  const drActiveRef       = useRef<boolean>(false);
  const drTimerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const modelReadyRef     = useRef<boolean>(false);

  // ── Load model ───────────────────────────────────────────────────────────
  useEffect(() => {
    // Expo Go has no Onnxruntime native module — skip quietly and stay GPS-only.
    if (!isOnnxRuntimeAvailable()) {
      if (__DEV__) {
        console.warn(
          '[DeadReckoning] onnxruntime-react-native is not linked. GPS-only mode. Use a development build for on-device inference.'
        );
      }
      return;
    }

    loadSpeedModel()
      .then(() => {
        modelReadyRef.current = true;
        setState(s => ({ ...s, modelReady: true }));
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Model load failed';
        setState(s => ({ ...s, error: msg }));
      });
  }, []);

  // ── DR tick ──────────────────────────────────────────────────────────────
  const runDrTick = useCallback(async () => {
    if (!modelReadyRef.current) return;

    // Build a typed snapshot of the ring buffer for resampling.
    const raw = motionBuffer.window().map((channels, i) => ({
      // motionBuffer stores samples; timestamp index mirrors the array position.
      // We use the actual MotionSample timestamps via the internal accessor.
      timestamp: motionBuffer.timestampAt(i),
      channels,
    }));

    const window26 = resampleToModelWindow(raw);
    if (!window26) return; // not enough data yet

    let speedKmh: number;
    let sigmaKmh: number;
    try {
      const pred = await predictSpeed(window26);
      speedKmh = Math.max(0, pred.speedKmh);
      sigmaKmh = pred.sigmaKmh;
    } catch {
      return;
    }

    const speedMs   = (speedKmh * 1000) / 3600;
    const dtSeconds = DR_TICK_MS / 1000;
    const distMeters = speedMs * dtSeconds;

    const base = drCoordsRef.current ?? lastGpsCoordsRef.current;
    if (!base) return;

    const newCoords = moveCoord(
      base.latitude,
      base.longitude,
      lastHeadingRef.current,
      distMeters
    );
    drCoordsRef.current = newCoords;
    distTravelledRef.current += distMeters;

    setState(s => ({
      ...s,
      coords: newCoords,
      source: 'dead_reckoning',
      estimatedSpeedKmh: speedKmh,
      speedSigmaKmh: sigmaKmh,
      distanceTravelledM: distTravelledRef.current,
    }));
  }, []);

  // ── Start / stop DR ──────────────────────────────────────────────────────
  const startDr = useCallback(() => {
    if (drActiveRef.current) return;
    drActiveRef.current = true;
    drCoordsRef.current = lastGpsCoordsRef.current;
    distTravelledRef.current = 0;
    drTimerRef.current = setInterval(() => { void runDrTick(); }, DR_TICK_MS);
  }, [runDrTick]);

  const stopDr = useCallback(() => {
    if (!drActiveRef.current) return;
    drActiveRef.current = false;
    if (drTimerRef.current) {
      clearInterval(drTimerRef.current);
      drTimerRef.current = null;
    }
    drCoordsRef.current = null;
    distTravelledRef.current = 0;
  }, []);

  // ── GPS watcher ──────────────────────────────────────────────────────────
  useEffect(() => {
    let locationSub: { remove: () => void } | null = null;
    let gpsTimeoutTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setState(s => ({ ...s, error: 'Location permission denied.' }));
        return;
      }

      locationSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1_000,
          distanceInterval: 1,
        },
        (loc) => {
          if (cancelled) return;
          const { latitude, longitude, accuracy, heading } = loc.coords;
          if (accuracy !== null && accuracy > GPS_MIN_ACCURACY_M) return;

          lastGpsTimeRef.current = Date.now();
          lastGpsCoordsRef.current = { latitude, longitude };
          if (heading !== null && heading >= 0) {
            lastHeadingRef.current = heading;
          }

          if (drActiveRef.current) stopDr();

          setState(s => ({
            ...s,
            coords: { latitude, longitude },
            source: 'gps',
            estimatedSpeedKmh: null,
            speedSigmaKmh: null,
            distanceTravelledM: 0,
            error: null,
          }));
        }
      );

      gpsTimeoutTimer = setInterval(() => {
        if (cancelled) return;
        const age = Date.now() - lastGpsTimeRef.current;
        if (age > GPS_TIMEOUT_MS && lastGpsCoordsRef.current && !drActiveRef.current) {
          startDr();
        }
      }, 2_000);
    })();

    return () => {
      cancelled = true;
      locationSub?.remove();
      if (gpsTimeoutTimer) clearInterval(gpsTimeoutTimer);
      stopDr();
    };
  }, [startDr, stopDr]);

  return state;
}
