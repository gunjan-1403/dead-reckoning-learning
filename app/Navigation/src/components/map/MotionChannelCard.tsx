import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import type { MotionStreamStatus } from '@/hooks/useMotionChannels';
import { MOTION_CHANNEL_NAMES, type MotionSample } from '@/sensors/motionChannels';
import type { SavedMotionCsv } from '@/sensors/saveMotionCsv';

interface Props {
  status: MotionStreamStatus;
  latest: MotionSample | null;
  isRecording: boolean;
  recordedCount: number;
  saving: boolean;
  lastSaved: SavedMotionCsv | null;
  saveError: string | null;
  onStart: () => void;
  onStop: () => void;
  bottom: number;
}

function formatChannel(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toFixed(2);
}

export function MotionChannelCard({
  status,
  latest,
  isRecording,
  recordedCount,
  saving,
  lastSaved,
  saveError,
  onStart,
  onStop,
  bottom,
}: Props) {
  const sensorsLive = status === 'live';
  const statusLabel = isRecording
    ? `REC ${recordedCount}`
    : status === 'live'
      ? 'live'
      : status === 'starting'
        ? 'starting…'
        : status === 'denied'
          ? 'permission off'
          : 'unavailable';

  const channels = latest?.channels;

  return (
    <View style={[styles.card, { bottom }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>IMU</Text>
          <Text style={[styles.status, isRecording && styles.recording]}>
            {statusLabel}
          </Text>
        </View>

        <Pressable
          style={[
            styles.button,
            isRecording && styles.buttonStop,
            (!sensorsLive || saving) && styles.buttonDisabled,
          ]}
          disabled={!sensorsLive || saving}
          onPress={isRecording ? onStop : onStart}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text
              style={[styles.buttonText, isRecording && styles.buttonStopText]}>
              {isRecording ? 'Stop' : 'Rec'}
            </Text>
          )}
        </Pressable>
      </View>

      <View style={styles.readings}>
        {MOTION_CHANNEL_NAMES.map((name, index) => (
          <View key={name} style={styles.row}>
            <Text style={styles.label}>{name}</Text>
            <Text style={styles.value}>{formatChannel(channels?.[index])}</Text>
          </View>
        ))}
      </View>

      {lastSaved ? (
        <Text style={styles.saved} numberOfLines={1}>
          Saved
        </Text>
      ) : null}
      {saveError ? (
        <Text style={styles.error} numberOfLines={1}>
          {saveError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 12,
    width: 168,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
    zIndex: 12,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  status: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  recording: {
    color: colors.error,
    fontWeight: '700',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 52,
  },
  buttonStop: {
    backgroundColor: colors.error,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  buttonStopText: {
    color: colors.white,
  },
  readings: {
    gap: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  value: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  saved: {
    color: colors.success,
    fontSize: 9,
    textAlign: 'center',
  },
  error: {
    color: colors.error,
    fontSize: 9,
    textAlign: 'center',
  },
});
