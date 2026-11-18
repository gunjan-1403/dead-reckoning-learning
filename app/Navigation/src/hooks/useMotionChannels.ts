import { useCallback, useEffect, useState } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';

import {
  MOTION_SAMPLE_INTERVAL_MS,
  combineMotionSample,
  emptyAxisReading,
  motionBuffer,
  motionRecorder,
  type MotionSample,
} from '@/sensors/motionChannels';
import { saveMotionCsv, type SavedMotionCsv } from '@/sensors/saveMotionCsv';

export type MotionStreamStatus = 'starting' | 'live' | 'unavailable' | 'denied';

const UI_REFRESH_MS = 200;

/**
 * Subscribes to the phone accelerometer and gyroscope only.
 * Each accelerometer tick is paired with the latest gyroscope reading
 * into one six-channel sample stored for the model.
 */
export function useMotionChannels() {
  const [status, setStatus] = useState<MotionStreamStatus>('starting');
  const [latest, setLatest] = useState<MotionSample | null>(null);
  const [sampleCount, setSampleCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedCount, setRecordedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<SavedMotionCsv | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let accelSub: { remove: () => void } | null = null;
    let gyroSub: { remove: () => void } | null = null;
    let uiTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const accel = emptyAxisReading();
    const gyro = emptyAxisReading();

    (async () => {
      const [accelAvailable, gyroAvailable] = await Promise.all([
        Accelerometer.isAvailableAsync(),
        Gyroscope.isAvailableAsync(),
      ]);
      if (cancelled) return;

      if (!accelAvailable || !gyroAvailable) {
        setStatus('unavailable');
        return;
      }

      const permission = await Accelerometer.requestPermissionsAsync();
      if (cancelled) return;
      if (!permission.granted) {
        setStatus('denied');
        return;
      }

      Accelerometer.setUpdateInterval(MOTION_SAMPLE_INTERVAL_MS);
      Gyroscope.setUpdateInterval(MOTION_SAMPLE_INTERVAL_MS);

      accelSub = Accelerometer.addListener((measurement) => {
        accel.x = measurement.x;
        accel.y = measurement.y;
        accel.z = measurement.z;
        accel.timestamp = measurement.timestamp;
        accel.ready = true;

        const sample = combineMotionSample(accel, gyro);
        if (sample) {
          motionBuffer.push(sample);
          motionRecorder.push(sample);
        }
      });

      gyroSub = Gyroscope.addListener((measurement) => {
        gyro.x = measurement.x;
        gyro.y = measurement.y;
        gyro.z = measurement.z;
        gyro.timestamp = measurement.timestamp;
        gyro.ready = true;
      });

      setStatus('live');
      uiTimer = setInterval(() => {
        setLatest(motionBuffer.latest());
        setSampleCount(motionBuffer.length);
        setRecordedCount(motionRecorder.length);
      }, UI_REFRESH_MS);
    })();

    return () => {
      cancelled = true;
      accelSub?.remove();
      gyroSub?.remove();
      if (uiTimer) clearInterval(uiTimer);
    };
  }, []);

  const startRecording = useCallback(() => {
    setSaveError(null);
    setLastSaved(null);
    motionRecorder.start();
    setIsRecording(true);
    setRecordedCount(0);
  }, []);

  const stopAndSave = useCallback(async () => {
    const recording = motionRecorder.stop();
    setIsRecording(false);
    setRecordedCount(0);
    if (!recording) {
      setSaveError('No samples captured. Record for a moment, then stop.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveMotionCsv(recording.csv, recording.rowCount);
      setLastSaved(saved);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the CSV.';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    status,
    latest,
    sampleCount,
    isRecording,
    recordedCount,
    saving,
    lastSaved,
    saveError,
    startRecording,
    stopAndSave,
  };
}
