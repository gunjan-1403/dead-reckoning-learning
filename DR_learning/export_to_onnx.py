"""
Export speed_cnn_uncertainty_v1.pt → speed_model.onnx
Saves the ONNX model alongside normalization stats as speed_model_meta.json.
Run from the DR_learning directory with the dr-learning conda env.
"""
from pathlib import Path
import json
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np

# ── Reconstruct the model class (must match training) ──────────────────────
class SpeedCNNUncertaintyV1(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv1d(6, 32, kernel_size=5, padding=2),
            nn.GELU(),
            nn.Conv1d(32, 32, kernel_size=5, padding=2),
            nn.GELU(),
            nn.MaxPool1d(kernel_size=2),
            nn.Conv1d(32, 48, kernel_size=3, padding=1),
            nn.GELU(),
            nn.Conv1d(48, 48, kernel_size=3, padding=1),
            nn.GELU(),
            nn.AdaptiveAvgPool1d(1),
        )
        self.head = nn.Sequential(
            nn.Linear(48, 64),
            nn.GELU(),
            nn.Linear(64, 2),
        )

    def forward(self, x):
        # x: [batch, time, 6]
        z = self.features(x.transpose(1, 2)).squeeze(-1)
        raw = self.head(z)
        mu_z = raw[:, 0]
        var_z = F.softplus(raw[:, 1]) + 1e-4
        return mu_z, var_z


# ── Load checkpoint ─────────────────────────────────────────────────────────
checkpoint_path = Path(__file__).parent / "speed_cnn_uncertainty_v1.pt"
ckpt = torch.load(checkpoint_path, map_location="cpu", weights_only=False)

model = SpeedCNNUncertaintyV1()
model.load_state_dict(ckpt["state_dict"])
model.eval()

WINDOW   = int(ckpt["window_samples"])   # 26
X_MEAN   = np.asarray(ckpt["x_mean"], dtype=np.float32)   # [1, 1, 6]
X_STD    = np.asarray(ckpt["x_std"],  dtype=np.float32)   # [1, 1, 6]
Y_MEAN   = float(ckpt["y_mean_kmh"])
Y_STD    = float(ckpt["y_std_kmh"])
RATE_HZ  = int(ckpt.get("sample_rate_hz", 10))

print(f"Window: {WINDOW} samples @ {RATE_HZ} Hz")
print(f"X_MEAN shape: {X_MEAN.shape},  X_STD shape: {X_STD.shape}")
print(f"Y_MEAN={Y_MEAN:.4f} km/h,  Y_STD={Y_STD:.4f} km/h")

# ── Export ONNX ──────────────────────────────────────────────────────────────
onnx_path = Path(__file__).parent / "speed_model.onnx"
dummy_input = torch.zeros(1, WINDOW, 6)   # [batch=1, time=26, channels=6]

torch.onnx.export(
    model,
    dummy_input,
    str(onnx_path),
    input_names=["imu_window"],
    output_names=["mu_z", "var_z"],
    dynamic_axes={
        "imu_window": {0: "batch"},
        "mu_z":       {0: "batch"},
        "var_z":      {0: "batch"},
    },
    opset_version=17,
)
print(f"Exported: {onnx_path}")

# ── Verify ───────────────────────────────────────────────────────────────────
import onnx
model_proto = onnx.load(str(onnx_path))
onnx.checker.check_model(model_proto)
print("ONNX model check passed.")

# ── Save normalization metadata alongside ────────────────────────────────────
meta = {
    "window_samples": WINDOW,
    "sample_rate_hz": RATE_HZ,
    "channels": ["accX", "accY", "accZ", "gyroX", "gyroY", "gyroZ"],
    "x_mean": X_MEAN.flatten().tolist(),   # 6 values, one per channel
    "x_std":  X_STD.flatten().tolist(),    # 6 values
    "y_mean_kmh": Y_MEAN,
    "y_std_kmh":  Y_STD,
    "note": "Normalize input per channel: (x - x_mean[c]) / x_std[c]. Output: speed_kmh = y_mean + y_std * mu_z",
}
meta_path = Path(__file__).parent / "speed_model_meta.json"
meta_path.write_text(json.dumps(meta, indent=2))
print(f"Metadata: {meta_path}")
print("\nDone. Copy both files to app/Navigation/assets/model/")
