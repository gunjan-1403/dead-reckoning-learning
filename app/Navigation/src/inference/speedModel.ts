/**
 * On-device speed inference using the dead reckoning CNN.
 *
 * The model takes a [1, 26, 6] window of IMU samples (normalized) and returns
 * two scalars: mu_z (normalized speed mean) and var_z (positive variance).
 *
 * Speed in km/h: Y_MEAN + Y_STD * mu_z
 * Uncertainty (1-sigma, km/h): Y_STD * sqrt(var_z)
 *
 * IMPORTANT: never import onnxruntime-react-native at module top-level, and
 * never require() it unless NativeModules.Onnxruntime is present. Its binding
 * calls Module.install() on load; that crashes when the native module is null
 * (Expo Go).
 */
import type { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { NativeModules } from 'react-native';
import { Asset } from 'expo-asset';
import { MODEL_META } from './modelMeta';

type OrtModule = typeof import('onnxruntime-react-native');

const ORT_UNAVAILABLE_MESSAGE =
  'ONNX Runtime native module missing. Use a development build (npx expo run:android / run:ios); Expo Go cannot run dead reckoning inference.';

let ort: OrtModule | null = null;
let session: InferenceSession | null = null;
let loadPromise: Promise<void> | null = null;

/** True only when the native Onnxruntime module is linked into this binary. */
export function isOnnxRuntimeAvailable(): boolean {
  return NativeModules.Onnxruntime != null;
}

function getOrt(): OrtModule {
  if (ort) return ort;
  if (!isOnnxRuntimeAvailable()) {
    throw new Error(ORT_UNAVAILABLE_MESSAGE);
  }
  // Safe to require only after the native module check above.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ort = require('onnxruntime-react-native') as OrtModule;
  if (!ort) {
    throw new Error('Failed to load onnxruntime-react-native.');
  }
  return ort;
}

/** Load the ONNX model once; subsequent calls return the same session. */
export async function loadSpeedModel(): Promise<void> {
  if (session) return;
  if (!isOnnxRuntimeAvailable()) {
    throw new Error(ORT_UNAVAILABLE_MESSAGE);
  }
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { InferenceSession } = getOrt();

    // expo-asset resolves the bundled path so Metro can include it.
    const [asset] = await Asset.loadAsync(
      require('../../assets/model/speed_model.onnx')
    );
    if (!asset.localUri) {
      throw new Error('Dead reckoning model asset could not be resolved.');
    }
    session = await InferenceSession.create(asset.localUri);
  })().catch((err) => {
    // Allow a later retry after fixing the native build / module.
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

export interface SpeedPrediction {
  speedKmh: number;
  sigmaKmh: number;
}

/**
 * Run one inference pass.
 *
 * @param rawWindow  Array of 26 IMU samples, each [accX, accY, accZ, gyroX, gyroY, gyroZ].
 *                   Values must be in raw sensor units (m/s² and rad/s), not pre-normalized.
 * @returns Predicted speed and 1-sigma uncertainty, both in km/h.
 */
export async function predictSpeed(
  rawWindow: number[][]
): Promise<SpeedPrediction> {
  if (!session) {
    await loadSpeedModel();
  }
  if (!session) throw new Error('Model session failed to load.');

  const { Tensor } = getOrt();
  const { windowSamples, xMean, xStd, yMeanKmh, yStdKmh } = MODEL_META;
  const CHANNELS = 6;

  if (rawWindow.length !== windowSamples) {
    throw new Error(
      `Expected ${windowSamples} samples, got ${rawWindow.length}.`
    );
  }

  // Flatten [26, 6] → Float32Array of length 156, applying per-channel normalization.
  const data = new Float32Array(windowSamples * CHANNELS);
  for (let t = 0; t < windowSamples; t++) {
    for (let c = 0; c < CHANNELS; c++) {
      data[t * CHANNELS + c] =
        (rawWindow[t][c] - xMean[c]) / xStd[c];
    }
  }

  const inputTensor = new Tensor('float32', data, [1, windowSamples, CHANNELS]);
  const feeds = { imu_window: inputTensor };
  const results = await session.run(feeds);

  const mu_z = (results['mu_z'] as Tensor).data[0] as number;
  const var_z = (results['var_z'] as Tensor).data[0] as number;

  const speedKmh = yMeanKmh + yStdKmh * mu_z;
  const sigmaKmh = yStdKmh * Math.sqrt(Math.max(var_z, 1e-6));

  return { speedKmh, sigmaKmh };
}
