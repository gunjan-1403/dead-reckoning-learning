/**
 * useDeadReckoning
 *
 * Watches GPS continuously. When a valid fix is available the hook simply
 * forwards the GPS position. When the fix is lost (or degrades below the
 * accuracy threshold) it switches to dead reckoning: the speed CNN estimates
 * the vehicle's current speed from the IMU window, and that speed is
 * integrated with the last-known heading to propagate the position forward.
 *
 * GPS loss is declared after GPS_TIMEOUT_MS of no fresh GPS update.
 * Recovery is instant: the first valid GPS fix snaps the position back.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

import { motionBuffer, MOTION_WINDOW_SIZE } from '@/sensors/motionChannels';
import { loadSpeedModel, predictSpeed } from '@/inference/speedModel';

// ── Tuneable constants ───────────────────────────────────────────────────────

/** Declare GPS lost after this many ms without a fresh GPS fix. */
const GPS_TIMEOUT_MS = 5_000;

/** Minimum GPS horizontal accuracy (m) for a fix to be considered valid. */
const GPS_MIN_ACCURACY_M = 50;

/** How often the DR engine ticks when GPS is lost (ms). */
const DR_TICK_MS = 1_000;

/**
 * The model was trained at 10 Hz; the app captures at 50 Hz.
 * We sub-sample every Nth sample to get ~10 Hz windows.
 * 50 / 10 = 5 → take every 5th sample.
 */
const SUBSAMPLE_STEP = 5;

/** How many raw samples correspond to the model's 26-sample window at 10 Hz. */
const RAW_WINDOW_NEEDED = 26 * SUBSAMPLE_STEP; // 130 raw samples

// ── Coordinate math helpers ──────────────────────────────────────────────────

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_M = 6_371_000;

/**
 * Move a coordinate by `distanceMeters` in direction `headingDeg` (0 = north).
 * Uses the flat-earth approximation which is accurate to <1 m over 1 km.
 */
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
  /** Cumulative dead reckoning drift in meters since last GPS fix. */
  drDriftMeters: number;
  /** Whether the speed model is loaded and ready. */
  modelReady: boolean;
  /** True when sensors/model have an error message. */
  error: string | null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDeadReckoning(): DeadReckoningState {
  const [state, setState] = useState<DeadReckoningState>({
    coords: null,
    source: 'none',
    estimatedSpeedKmh: null,
    speedSigmaKmh: null,
    drDriftMeters: 0,
    modelReady: false,
    error: null,
  });

  // Mutable refs — updated from both GPS callbacks and the DR timer.
  const lastGpsTimeRef = useRef<number>(0);
  const lastGpsCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastHeadingRef = useRef<number>(0); // degrees, 0 = north
  const drCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const drDriftRef = useRef<number>(0);
  const drActiveRef = useRef<boolean>(false);
  const drTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modelReadyRef = useRef<boolean>(false);

  // ── Load model on mount ──────────────────────────────────────────────────
  useEffect(() => {
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

  // ── Dead reckoning tick ──────────────────────────────────────────────────
  const runDrTick = useCallback(async () => {
    if (!modelReadyRef.current) return;

    // We need at least RAW_WINDOW_NEEDED samples in the buffer.
    if (motionBuffer.length < RAW_WINDOW_NEEDED) return;

    // Sub-sample the ring buffer to ~10 Hz.
    const rawAll = motionBuffer.window();
    const subsampled: number[][] = [];
    // Take the last RAW_WINDOW_NEEDED samples then pick every SUBSAMPLE_STEP-th.
    const slice = rawAll.slice(rawAll.length - RAW_WINDOW_NEEDED);
    for (let i = 0; i < slice.length; i += SUBSAMPLE_STEP) {
      subsampled.push(slice[i]);
    }

    // Should give exactly 26, but guard anyway.
    if (subsampled.length < 26) return;
    const window26 = subsampled.slice(0, 26);

    let speedKmh: number;
    let sigmaKmh: number;
    try {
      const pred = await predictSpeed(window26);
      speedKmh = Math.max(0, pred.speedKmh); // speed can't be negative
      sigmaKmh = pred.sigmaKmh;
    } catch {
      return; // inference error — skip this tick, keep last position
    }

    // Integrate: distance = speed (m/s) × Δt (s)
    const speedMs = (speedKmh * 1000) / 3600;
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
    drDriftRef.current += distMeters;

    setState(s => ({
      ...s,
      coords: newCoords,
      source: 'dead_reckoning',
      estimatedSpeedKmh: speedKmh,
      speedSigmaKmh: sigmaKmh,
      drDriftMeters: drDriftRef.current,
    }));
  }, []);

  // ── Start / stop DR timer ────────────────────────────────────────────────
  const startDr = useCallback(() => {
    if (drActiveRef.current) return;
    drActiveRef.current = true;
    drCoordsRef.current = lastGpsCoordsRef.current;
    drDriftRef.current = 0;
    drTimerRef.current = setInterval(() => {
      void runDrTick();
    }, DR_TICK_MS);
  }, [runDrTick]);

  const stopDr = useCallback(() => {
    if (!drActiveRef.current) return;
    drActiveRef.current = false;
    if (drTimerRef.current) {
      clearInterval(drTimerRef.current);
      drTimerRef.current = null;
    }
    drCoordsRef.current = null;
    drDriftRef.current = 0;
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

      // Continuous location watch at highest available accuracy.
      locationSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1_000,
          distanceInterval: 1,
        },
        (loc) => {
          if (cancelled) return;
          const { latitude, longitude, accuracy, heading } = loc.coords;

          // Reject low-accuracy fixes.
          if (accuracy !== null && accuracy > GPS_MIN_ACCURACY_M) return;

          lastGpsTimeRef.current = Date.now();
          lastGpsCoordsRef.current = { latitude, longitude };
          if (heading !== null && heading >= 0) {
            lastHeadingRef.current = heading;
          }

          // GPS fix is valid — snap back and stop DR if it was running.
          if (drActiveRef.current) {
            stopDr();
          }

          setState(s => ({
            ...s,
            coords: { latitude, longitude },
            source: 'gps',
            estimatedSpeedKmh: null,
            speedSigmaKmh: null,
            drDriftMeters: 0,
            error: null,
          }));
        }
      );

      // Poll for GPS timeout: if no fresh fix for GPS_TIMEOUT_MS, start DR.
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
