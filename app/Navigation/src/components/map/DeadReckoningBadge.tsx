import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import type { PositionSource } from '@/hooks/useDeadReckoning';

interface Props {
  source: PositionSource;
  estimatedSpeedKmh: number | null;
  speedSigmaKmh: number | null;
  distanceTravelledM: number;
  error: string | null;
  top: number;
}

export function DeadReckoningBadge({
  source,
  estimatedSpeedKmh,
  speedSigmaKmh,
  distanceTravelledM,
  error,
  top,
}: Props) {
  if (source === 'gps' && !error) return null;

  const isDr = source === 'dead_reckoning';

  const distLabel =
    distanceTravelledM < 1000
      ? `${distanceTravelledM.toFixed(0)} m travelled`
      : `${(distanceTravelledM / 1000).toFixed(2)} km travelled`;

  return (
    <View
      style={[
        styles.badge,
        isDr ? styles.drMode : styles.errorMode,
        { top },
      ]}>
      <Text style={styles.icon}>{isDr ? '📡' : '⚠️'}</Text>
      <View style={styles.textCol}>
        <Text style={styles.title}>
          {isDr ? 'Dead Reckoning' : error ? 'DR Error' : 'Acquiring GPS…'}
        </Text>
        {isDr && estimatedSpeedKmh !== null && (
          <Text style={styles.detail}>
            {estimatedSpeedKmh.toFixed(1)} km/h
            {speedSigmaKmh !== null ? ` ±${speedSigmaKmh.toFixed(1)}` : ''}
          </Text>
        )}
        {isDr && <Text style={styles.detail}>{distLabel}</Text>}
        {error && (
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    zIndex: 15,
    maxWidth: 220,
    backgroundColor: colors.white,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  drMode: {
    borderColor: colors.primary,
  },
  errorMode: {
    borderColor: colors.error,
  },
  icon: {
    fontSize: 16,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  detail: {
    color: colors.textMuted,
    fontSize: 10,
  },
  errorText: {
    color: colors.error,
    fontSize: 10,
  },
});
