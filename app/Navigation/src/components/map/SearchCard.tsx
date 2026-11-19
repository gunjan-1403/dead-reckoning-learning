import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import { useNavContext } from '@/context/NavigationContext';

interface Props {
  hasCurrentLocation: boolean;
}

export function SearchCard({ hasCurrentLocation }: Props) {
  const insets = useSafeAreaInsets();
  const {
    origin,
    destination,
    route,
    clearRoute,
    setOrigin,
    setDestination,
    setRoute,
  } = useNavContext();

  const handleSwap = () => {
    if (origin || destination) {
      const prevOrigin = origin;
      const prevDest = destination;
      setOrigin(prevDest);
      setDestination(prevOrigin);
      setRoute(null);
    }
  };

  const showHero = !route;

  return (
    <View
      style={[
        styles.container,
        !showHero && styles.containerCompact,
        { paddingTop: insets.top + (showHero ? 8 : 6) },
      ]}>
      {showHero ? (
        <View style={styles.titleBlock}>
          <Text style={styles.heading}>
            Explore the World.{'\n'}Find Yourself.
          </Text>
        </View>
      ) : null}

      <View style={[styles.card, !showHero && styles.cardCompact]}>
        <View style={styles.timelineCol}>
          <View style={[styles.node, styles.nodeStart]} />
          <View style={styles.timelineLine} />
          <View style={[styles.node, styles.nodeEnd]} />
        </View>

        <View style={styles.fields}>
          <Pressable
            style={[styles.pill, !showHero && styles.pillCompact]}
            onPress={() => router.push('/search?field=origin')}>
            <Text style={styles.pillLabel}>From</Text>
            <Text
              style={[styles.pillValue, !origin && styles.placeholder]}
              numberOfLines={1}>
              {origin?.address ??
                (hasCurrentLocation ? 'Your location' : 'Choose starting point')}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.pill, !showHero && styles.pillCompact]}
            onPress={() => router.push('/search?field=destination')}>
            <Text style={styles.pillLabel}>To</Text>
            <Text
              style={[styles.pillValue, !destination && styles.placeholder]}
              numberOfLines={1}>
              {destination?.address ?? 'Where to?'}
            </Text>
          </Pressable>
        </View>

        <Pressable style={styles.swapBtn} onPress={handleSwap}>
          <Text style={styles.swapIcon}>⇅</Text>
        </Pressable>
      </View>

      {route ? (
        <Pressable style={styles.clearBtn} onPress={clearRoute}>
          <Text style={styles.clearText}>Clear route</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 10,
    backgroundColor: '#E8F6F4',
  },
  containerCompact: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  titleBlock: {
    marginBottom: 18,
  },
  heading: {
    color: '#1A2E35',
    fontFamily: 'GreatVibes_400Regular',
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 22,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardCompact: {
    borderRadius: 18,
    paddingVertical: 8,
  },
  timelineCol: {
    width: 14,
    alignItems: 'center',
    marginRight: 8,
    paddingVertical: 6,
  },
  node: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.white,
  },
  nodeStart: {
    backgroundColor: colors.originDot,
  },
  nodeEnd: {
    backgroundColor: colors.destDot,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 18,
    backgroundColor: colors.primary,
    marginVertical: 3,
    borderRadius: 1,
  },
  fields: {
    flex: 1,
    gap: 6,
  },
  pill: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillCompact: {
    paddingVertical: 6,
  },
  pillLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 1,
    textTransform: 'uppercase',
  },
  pillValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  placeholder: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMint,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  swapIcon: {
    color: colors.teal,
    fontSize: 15,
    fontWeight: '700',
  },
  clearBtn: {
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
