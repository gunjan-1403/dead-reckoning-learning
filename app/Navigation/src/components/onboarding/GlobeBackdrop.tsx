import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
} from 'react-native-svg';
import { onboarding } from '@/constants/onboardingTheme';

/** Clean orange wireframe globe (circle + lat/long only — no extra strokes). */
export function GlobeBackdrop({ size = 300 }: { size?: number }) {
  const c = size / 2;
  const r = size * 0.44;
  const stroke = onboarding.orange;
  const sw = 6.5;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      pointerEvents="none">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <ClipPath id="globeClip">
            <Circle cx={c} cy={c} r={r} />
          </ClipPath>
        </Defs>

        {/* Outer sphere */}
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={stroke}
          strokeWidth={sw}
          fill="none"
        />

        <G clipPath="url(#globeClip)">
          {/* Longitude meridians */}
          <Ellipse
            cx={c}
            cy={c}
            rx={r * 0.28}
            ry={r}
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
          <Ellipse
            cx={c}
            cy={c}
            rx={r * 0.58}
            ry={r}
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
          <Ellipse
            cx={c}
            cy={c}
            rx={r * 0.86}
            ry={r}
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />

          {/* Latitude parallels */}
          <Ellipse
            cx={c}
            cy={c - r * 0.52}
            rx={r * 0.72}
            ry={r * 0.18}
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
          <Ellipse
            cx={c}
            cy={c - r * 0.22}
            rx={r * 0.94}
            ry={r * 0.24}
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
          <Ellipse
            cx={c}
            cy={c}
            rx={r}
            ry={r * 0.26}
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
          <Ellipse
            cx={c}
            cy={c + r * 0.22}
            rx={r * 0.94}
            ry={r * 0.24}
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
          <Ellipse
            cx={c}
            cy={c + r * 0.52}
            rx={r * 0.72}
            ry={r * 0.18}
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignSelf: 'center',
  },
});
