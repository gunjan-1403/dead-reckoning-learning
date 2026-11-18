/**
 * DeadReckoningBadge
 *
 * A small overlay badge that shows the current positioning mode.
 * Visible only when in dead reckoning mode or when there is a model error.
 */
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import type { PositionSource } from '@/hooks/useDeadReckoning';

interface Props {
  source: PositionSource;
  estimatedSpeedKmh: number | null;
  speedSigmaKmh: number | null;
  drDriftMeters: number;
  error: string | null;
  top: number;
}

export function DeadReckoningBadge({
  source,
  estimatedSpeedKmh,
  speedSigmaKmh,
  drDriftMeters,
  error,
  top,
}: Props) {
  if (source === 'gps' && !error) return null;

  const isDr = source === 'dead_reckoning';

  return (
    <View style={[styles.badge, isDr ? styles.drMode : styles.errorMode, { top }]}>
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
        {isDr && (
          <Text style={styles.detail}>
            Drift {drDriftMeters < 1000
              ? `${drDriftMeters.toFixed(0)} m`
              : `${(drDriftMeters / 1000).toFixed(2)} km`}
          </Text>
        )}
        {error && <Text style={styles.errorText} numberOfLines={2}>{error}</Text>}
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
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 15,
    maxWidth: 220,
  },
  drMode: {
    backgroundColor: 'rgba(13,13,13,0.92)',
    borderColor: '#FF9500',
  },
  errorMode: {
    backgroundColor: 'rgba(13,13,13,0.92)',
    borderColor: colors.error,
  },
  icon: {
    fontSize: 18,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#FF9500',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
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
