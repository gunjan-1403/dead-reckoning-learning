import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/constants/colors';
import { useNavContext } from '@/context/NavigationContext';

interface Props {
  hasCurrentLocation: boolean;
}

export function SearchCard({ hasCurrentLocation }: Props) {
  const { origin, destination, route, clearRoute, setOrigin, setDestination, setRoute } =
    useNavContext();

  const handleSwap = () => {
    if (origin || destination) {
      const prevOrigin = origin;
      const prevDest = destination;
      setOrigin(prevDest);
      setDestination(prevOrigin);
      setRoute(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Origin field */}
        <Pressable
          style={styles.inputRow}
          onPress={() => router.push('/search?field=origin')}>
          <View style={[styles.dot, styles.dotGreen]} />
          <Text
            style={[styles.inputText, !origin && styles.placeholderText]}
            numberOfLines={1}>
            {origin?.address ??
              (hasCurrentLocation ? 'Your location' : 'Choose starting point')}
          </Text>
        </Pressable>

        {/* Divider with swap button */}
        <View style={styles.dividerRow}>
          <View style={styles.connectLine}>
            <View style={styles.lineSegment} />
          </View>
          <View style={styles.dividerLine} />
          <Pressable style={styles.swapBtn} onPress={handleSwap}>
            <Text style={styles.swapIcon}>⇅</Text>
          </Pressable>
        </View>

        {/* Destination field */}
        <Pressable
          style={styles.inputRow}
          onPress={() => router.push('/search?field=destination')}>
          <View style={[styles.dot, styles.dotRed]} />
          <Text
            style={[styles.inputText, !destination && styles.placeholderText]}
            numberOfLines={1}>
            {destination?.address ?? 'Where to?'}
          </Text>
        </Pressable>

        {/* Clear button when route is active */}
        {route && (
          <Pressable style={styles.clearBtn} onPress={clearRoute}>
            <Text style={styles.clearText}>✕  Clear route</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 54,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotGreen: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  dotRed: {
    backgroundColor: colors.error,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  inputText: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  placeholderText: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 5,
  },
  connectLine: {
    width: 2,
    height: 1,
  },
  lineSegment: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    left: 0,
    width: 2,
    backgroundColor: colors.border,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 18,
  },
  swapBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    marginLeft: 8,
  },
  swapIcon: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  clearBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
  },
  clearText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
});
