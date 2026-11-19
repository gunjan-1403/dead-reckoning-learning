import { useState } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/constants/colors';
import { useNavContext } from '@/context/NavigationContext';
import { formatDistance, formatDuration } from '@/utils/routeProgress';

const SHEET_MIN = Math.round(Dimensions.get('window').height * 0.48);

interface Props {
  remainingMeters?: number | null;
  remainingSeconds?: number | null;
  nextInstruction?: string | null;
}

const AVATAR_COLORS = ['#7BC6C0', '#F7A15A', '#8BB7E8', '#E8A0BF'];

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20s-7-4.4-7-9.2C5 7.6 7.2 5.5 10 5.5c1.4 0 2.6.7 3 1.7.4-1 1.6-1.7 3-1.7 2.8 0 5 2.1 5 5.3C19 15.6 12 20 12 20Z"
        stroke={filled ? colors.primary : colors.teal}
        strokeWidth={1.8}
        fill={filled ? colors.primary : 'none'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function titleFromAddress(address?: string | null) {
  if (!address) return 'Your destination';
  const main = address.split(',')[0]?.trim();
  return main || address;
}

export function RouteInfoPanel({
  remainingMeters = null,
  remainingSeconds = null,
  nextInstruction = null,
}: Props) {
  const insets = useSafeAreaInsets();
  const [liked, setLiked] = useState(false);
  const {
    route,
    origin,
    destination,
    isNavigating,
    startNavigation,
    stopNavigation,
  } = useNavContext();

  if (!route) return null;

  const durationLabel =
    isNavigating && remainingSeconds != null
      ? formatDuration(remainingSeconds)
      : route.duration;
  const distanceLabel =
    isNavigating && remainingMeters != null
      ? formatDistance(remainingMeters)
      : route.distance;

  const destTitle = titleFromAddress(destination?.address);
  const fromLabel = origin?.address ?? 'Your location';

  if (isNavigating) {
    return (
      <View
        style={[
          styles.navContainer,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}>
        {nextInstruction ? (
          <View style={styles.instructionCard}>
            <View style={styles.instructionDot} />
            <Text style={styles.instructionText} numberOfLines={2}>
              {nextInstruction}
            </Text>
          </View>
        ) : null}
        <View style={styles.navSheet}>
          <Text style={styles.navDuration}>{durationLabel}</Text>
          <Text style={styles.navDistance}>{distanceLabel} remaining</Text>
          <Pressable style={styles.exitBtn} onPress={stopNavigation}>
            <Text style={styles.exitBtnText}>Exit trip</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 18) },
        ]}>
        {/* Social proof */}
        <View style={styles.socialRow}>
          <View style={styles.avatars}>
            {AVATAR_COLORS.map((c, i) => (
              <View
                key={c}
                style={[
                  styles.avatar,
                  { backgroundColor: c, marginLeft: i === 0 ? 0 : -10, zIndex: 4 - i },
                ]}
              />
            ))}
          </View>
          <Text style={styles.socialText}>100+ people have explored</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {destTitle}
        </Text>
        <Text style={styles.address} numberOfLines={2}>
          {destination?.address ?? 'Destination'}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.star}>★</Text>
          <Text style={styles.metaText}>
            {durationLabel} · {distanceLabel}
          </Text>
          <Text style={styles.metaMuted}>best route</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.features}>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>⏱</Text>
            <Text style={styles.featureText}>{durationLabel}</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>📍</Text>
            <Text style={styles.featureText}>{distanceLabel}</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🛣</Text>
            <Text style={styles.featureText}>Drive</Text>
          </View>
        </View>

        <Text style={styles.description} numberOfLines={3}>
          Route from {fromLabel} to {destination?.address ?? 'your destination'}.
          Tap Start Trip to begin live navigation with dead reckoning backup when
          GPS fades.
        </Text>

        <View style={styles.footer}>
          <Pressable
            style={styles.heartBtn}
            onPress={() => setLiked((v) => !v)}>
            <HeartIcon filled={liked} />
          </Pressable>
          <Pressable style={styles.startBtn} onPress={startNavigation}>
            <Text style={styles.startBtnText}>Start Trip</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 22,
    paddingTop: 22,
    minHeight: SHEET_MIN,
    shadowColor: '#1A2E35',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 16,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.white,
  },
  socialText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  title: {
    color: '#1A2E35',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  address: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  star: {
    color: '#F5C518',
    fontSize: 15,
  },
  metaText: {
    color: colors.teal,
    fontSize: 14,
    fontWeight: '700',
  },
  metaMuted: {
    color: colors.textMuted,
    fontSize: 13,
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  feature: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  featureIcon: {
    fontSize: 16,
  },
  featureText: {
    color: colors.tealSoft,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heartBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtn: {
    flex: 1,
    height: 54,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  startBtnText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },

  /* Navigating compact sheet */
  navContainer: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 0,
    zIndex: 20,
  },
  instructionCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  instructionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  instructionText: {
    flex: 1,
    color: colors.teal,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  navSheet: {
    backgroundColor: colors.white,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navDuration: {
    color: colors.teal,
    fontSize: 26,
    fontWeight: '800',
  },
  navDistance: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 14,
  },
  exitBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
