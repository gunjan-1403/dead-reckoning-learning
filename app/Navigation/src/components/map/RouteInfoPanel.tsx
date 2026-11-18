import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { useNavContext } from '@/context/NavigationContext';

export function RouteInfoPanel() {
  const { route, origin, destination, clearRoute } = useNavContext();
  if (!route) return null;

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        {/* Handle bar */}
        <View style={styles.handleBar} />

        {/* Route summary */}
        <View style={styles.summaryRow}>
          <View style={styles.timeContainer}>
            <Text style={styles.duration}>{route.duration}</Text>
            <Text style={styles.distance}>{route.distance}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Best route</Text>
          </View>
        </View>

        {/* Route endpoints */}
        <View style={styles.endpointsRow}>
          <View style={styles.endpoint}>
            <View style={[styles.epDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.epText} numberOfLines={1}>
              {origin?.address ?? 'Origin'}
            </Text>
          </View>
          <Text style={styles.arrow}>→</Text>
          <View style={styles.endpoint}>
            <View style={[styles.epDot, { backgroundColor: colors.error }]} />
            <Text style={styles.epText} numberOfLines={1}>
              {destination?.address ?? 'Destination'}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <Pressable style={styles.startBtn}>
            <Text style={styles.startBtnText}>Start Navigation</Text>
          </Pressable>
          <Pressable style={styles.closeBtn} onPress={clearRoute}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    alignSelf: 'center',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeContainer: {
    gap: 2,
  },
  duration: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  distance: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: colors.primaryGlow,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  endpointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  endpoint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  epDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  epText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
  },
  arrow: {
    color: colors.textMuted,
    fontSize: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  startBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  startBtnText: {
    color: colors.black,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 52,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: '600',
  },
});
