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

function formatChannel(value: number) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(3)}`;
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
        ? 'Starting sensors…'
        : status === 'denied'
          ? 'Motion permission denied'
          : 'Sensors unavailable';

  return (
    <View style={[styles.card, { bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>IMU</Text>
        <Text style={[styles.status, isRecording && styles.recording]}>{statusLabel}</Text>
      </View>
      <View style={styles.grid}>
        {MOTION_CHANNEL_NAMES.map((name, index) => (
          <Text key={name} style={styles.channel}>
            {name} {latest ? formatChannel(latest.channels[index]) : '—'}
          </Text>
        ))}
      </View>
      <Pressable
        style={[styles.button, isRecording && styles.buttonStop, (!sensorsLive || saving) && styles.buttonDisabled]}
        disabled={!sensorsLive || saving}
        onPress={isRecording ? onStop : onStart}>
        {saving ? (
          <ActivityIndicator size="small" color={colors.black} />
        ) : (
          <Text style={[styles.buttonText, isRecording && styles.buttonStopText]}>
            {isRecording ? 'Stop & save CSV' : 'Record CSV'}
          </Text>
        )}
      </Pressable>
      {lastSaved ? (
        <Text style={styles.saved} numberOfLines={2}>
          Saved {lastSaved.filename} ({lastSaved.rowCount} rows)
        </Text>
      ) : null}
      {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    width: 188,
    backgroundColor: 'rgba(13,13,13,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    zIndex: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  status: {
    color: colors.textMuted,
    fontSize: 10,
  },
  recording: {
    color: colors.error,
    fontWeight: '700',
  },
  grid: {
    gap: 2,
  },
  channel: {
    color: colors.text,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  buttonStop: {
    backgroundColor: colors.error,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: colors.black,
    fontSize: 12,
    fontWeight: '700',
  },
  buttonStopText: {
    color: colors.white,
  },
  saved: {
    color: colors.primaryLight,
    fontSize: 10,
  },
  error: {
    color: colors.error,
    fontSize: 10,
  },
});
