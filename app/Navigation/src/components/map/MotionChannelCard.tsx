import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import type { MotionStreamStatus } from '@/hooks/useMotionChannels';
import { type MotionSample } from '@/sensors/motionChannels';
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

export function MotionChannelCard({
  status,
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
        ? '…'
        : status === 'denied'
          ? 'off'
          : 'n/a';

  return (
    <View style={[styles.card, { bottom }]}>
      <View style={styles.header}>
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

      {lastSaved ? (
        <Text style={styles.saved} numberOfLines={1}>
          Saved
        </Text>
      ) : null}
      {saveError ? (
        <Text style={styles.error} numberOfLines={1}>
          Err
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 12,
    width: 72,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
    zIndex: 12,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    alignItems: 'center',
    gap: 1,
  },
  title: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  status: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
  },
  recording: {
    color: colors.error,
    fontWeight: '700',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 7,
    alignItems: 'center',
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
