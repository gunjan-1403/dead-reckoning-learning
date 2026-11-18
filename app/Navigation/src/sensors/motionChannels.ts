/**
 * Six phone IMU channels, in model order:
 * accelerometer X/Y/Z (g), gyroscope X/Y/Z (rad/s).
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

/** Rolling window the model can read. 128 samples ≈ 2.6 s at 50 Hz. */
export const MOTION_WINDOW_SIZE = 128;

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
   * Model input shaped [n, 6].
   * Columns: accX, accY, accZ (g), gyroX, gyroY, gyroZ (rad/s).
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
