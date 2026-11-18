/**
 * Normalization constants exported when the model was converted to ONNX.
 * These are the per-channel mean and standard deviation computed from
 * the training data. They must stay in sync with speed_model_meta.json.
 *
 * Channel order: accX, accY, accZ (m/s²), gyroX (yaw), gyroY (pitch), gyroZ (roll) in rad/s
 */
export const MODEL_META = {
  /** Number of IMU samples the model expects — 26 samples ≈ 2.6 s at 10 Hz. */
  windowSamples: 26,

  /** Training data sample rate. The app runs at 50 Hz; we downsample before inference. */
  sampleRateHz: 10,

  /** Per-channel input mean, one value per IMU channel (index matches channel order). */
  xMean: [
    -0.6566005945205688,  // accX
    -0.5539026260375977,  // accY
     9.84641170501709,    // accZ
    -0.009071790613234043, // gyroX
    -0.14602704346179962,  // gyroY
     0.011550821363925934, // gyroZ
  ] as const,

  /** Per-channel input std. */
  xStd: [
    1.927854061126709,
    2.021745443344116,
    0.5641500949859619,
    0.06723304092884064,
    0.3012445271015167,
    0.05447681248188019,
  ] as const,

  /** Output denormalization: speed_kmh = yMeanKmh + yStdKmh * mu_z */
  yMeanKmh: 30.219905853271484,
  yStdKmh:  15.032379150390625,
} as const;
