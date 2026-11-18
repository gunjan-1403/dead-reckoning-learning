/**
 * Six phone IMU channels, in model order:
 * accelerometer X/Y/Z (m/s²), gyroscope yaw/pitch/roll (rad/s).
 *
 * Storage note: the ring buffer keeps values in their raw Expo units
 * (accelerometer in g, gyroscope in rad/s). The g→m/s² conversion and
 * gyro axis remap are applied at inference time in speedModel.ts so the
 * CSV recordings stay in the original sensor units.
 */
export const MOTION_CHANNEL_NAMES = [
  'accX',
  'accY',
  'accZ',
  'gyroX',
  'gyroY',
  'gyroZ',
] as const;

export const MOTION_CHANNEL_COUNT = 6;

/** ~50 Hz. Stays under Android's 200 Hz sensor cap. */
export const MOTION_SAMPLE_INTERVAL_MS = 20;

/**
 * Ring buffer size. Must hold enough samples to cover the model's 2.6 s
 * window at 50 Hz with margin:  26 model samples × (50/10) = 130 raw samples.
 * 150 gives a comfortable margin for irregular sensor delivery.
 */
export const MOTION_WINDOW_SIZE = 150;

export type MotionChannels = [number, number, number, number, number, number];

export type MotionSample = {
  /** Sensor timestamp in seconds. */
  timestamp: number;
  channels: MotionChannels;
};

type AxisReading = {
  x: number;
  y: number;
  z: number;
  timestamp: number;
  ready: boolean;
};

export function emptyAxisReading(): AxisReading {
  return { x: 0, y: 0, z: 0, timestamp: 0, ready: false };
}

export function combineMotionSample(
  accel: AxisReading,
  gyro: AxisReading
): MotionSample | null {
  if (!accel.ready || !gyro.ready) return null;
  return {
    timestamp: Math.max(accel.timestamp, gyro.timestamp),
    channels: [accel.x, accel.y, accel.z, gyro.x, gyro.y, gyro.z],
  };
}

/**
 * Fixed-length ring of the latest IMU samples.
 * Sensor callbacks write here; the model reads a copy without touching React.
 */
class MotionRingBuffer {
  private samples: MotionSample[] = [];

  push(sample: MotionSample) {
    this.samples.push(sample);
    if (this.samples.length > MOTION_WINDOW_SIZE) {
      this.samples.splice(0, this.samples.length - MOTION_WINDOW_SIZE);
    }
  }

  latest(): MotionSample | null {
    return this.samples[this.samples.length - 1] ?? null;
  }

  get length() {
    return this.samples.length;
  }

  /**
   * Timestamp (seconds) of the sample at position i in the current window.
   * Used by the timestamp-based resampler in useDeadReckoning.
   */
  timestampAt(i: number): number {
    return this.samples[i]?.timestamp ?? 0;
  }

  /**
   * Channel values shaped [n, 6].
   * Columns: accX, accY, accZ (g), gyroX, gyroY, gyroZ (rad/s).
   * Values are in raw Expo sensor units — convert to m/s² at inference time.
   */
  window(): number[][] {
    return this.samples.map((sample) => [...sample.channels]);
  }
}

export const motionBuffer = new MotionRingBuffer();

/** Latest window for the model. Empty until both sensors have reported. */
export function getMotionModelInput(): number[][] {
  return motionBuffer.window();
}

export const MOTION_CSV_HEADER = 'timestamp,accX,accY,accZ,gyroX,gyroY,gyroZ';

function formatCsvNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(8);
}

/**
 * Full recording for the model. Unlike the 128-sample live window,
 * this keeps every sample from Record until Stop.
 */
class MotionCsvRecorder {
  private recording = false;
  private lines: string[] = [];

  get isRecording() {
    return this.recording;
  }

  /** Data rows only. The header is not included. */
  get length() {
    return this.recording ? Math.max(0, this.lines.length - 1) : 0;
  }

  start() {
    this.recording = true;
    this.lines = [MOTION_CSV_HEADER];
  }

  push(sample: MotionSample) {
    if (!this.recording) return;
    const [accX, accY, accZ, gyroX, gyroY, gyroZ] = sample.channels;
    this.lines.push(
      [
        formatCsvNumber(sample.timestamp),
        formatCsvNumber(accX),
        formatCsvNumber(accY),
        formatCsvNumber(accZ),
        formatCsvNumber(gyroX),
        formatCsvNumber(gyroY),
        formatCsvNumber(gyroZ),
      ].join(',')
    );
  }

  /** Stops recording and returns the CSV text. Null when nothing was captured. */
  stop(): { csv: string; rowCount: number } | null {
    if (!this.recording) return null;
    this.recording = false;
    const rowCount = Math.max(0, this.lines.length - 1);
    const csv = `${this.lines.join('\n')}\n`;
    this.lines = [];
    if (rowCount === 0) return null;
    return { csv, rowCount };
  }
}

export const motionRecorder = new MotionCsvRecorder();
