import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import * as Location from 'expo-location';

import { useNavContext } from '@/context/NavigationContext';
import { getDirections } from '@/utils/api';
import { SearchCard } from '@/components/map/SearchCard';
import { RouteInfoPanel } from '@/components/map/RouteInfoPanel';
import { CurrentLocationButton } from '@/components/map/CurrentLocationButton';
import { MotionChannelCard } from '@/components/map/MotionChannelCard';
import { DeadReckoningBadge } from '@/components/map/DeadReckoningBadge';
import { useMotionChannels } from '@/hooks/useMotionChannels';
import { useDeadReckoning } from '@/hooks/useDeadReckoning';
import { lightMapStyle } from '@/constants/mapStyle';
import { colors } from '@/constants/colors';
import {
  formatDistance,
  remainingRoute,
} from '@/utils/routeProgress';

const DEFAULT_REGION: Region = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const ARRIVAL_THRESHOLD_M = 35;

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const motion = useMotionChannels();
  const [heading, setHeading] = useState(0);

  const dr = useDeadReckoning();
  const currentCoords = dr.coords;
  const permDenied =
    dr.source === 'none' && !!dr.error?.includes('permission');

  const {
    origin,
    destination,
    route,
    isLoading,
    isNavigating,
    setOrigin,
    setRoute,
    setIsLoading,
    stopNavigation,
    clearRoute,
  } = useNavContext();

  /* ── Fetch directions when both endpoints are set ── */
  useEffect(() => {
    if (!origin || !destination) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      const info = await getDirections(origin, destination);
      if (cancelled) return;
      setRoute(info);
      setIsLoading(false);

      if (info?.polylineCoords?.length && mapRef.current) {
        // Give the map a tick so Polyline mounts before we zoom.
        requestAnimationFrame(() => {
          mapRef.current?.fitToCoordinates(info.polylineCoords, {
            edgePadding: { top: 56, right: 36, bottom: 420, left: 36 },
            animated: true,
          });
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [origin, destination, setIsLoading, setRoute]);

  /* ── Auto-set origin from GPS when destination is chosen ── */
  useEffect(() => {
    if (currentCoords && !origin && destination) {
      setOrigin({
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        address: 'Your location',
      });
    }
  }, [currentCoords, destination, origin, setOrigin]);

  /* ── Compass heading while navigating ── */
  useEffect(() => {
    if (!isNavigating) return;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        sub = await Location.watchHeadingAsync((h) => {
          const value =
            h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (Number.isFinite(value)) setHeading(value);
        });
      } catch {
        // Heading is optional — camera still follows position.
      }
    })();
    return () => {
      sub?.remove();
    };
  }, [isNavigating]);

  /* ── Live progress along the route ── */
  const progress = useMemo(() => {
    if (!route || !currentCoords || route.polylineCoords.length < 2) {
      return null;
    }
    const rem = remainingRoute(route.polylineCoords, currentCoords);
    const ratio =
      route.distanceMeters > 0
        ? Math.min(1, Math.max(0, rem.meters / route.distanceMeters))
        : 1;
    const remainingSeconds = route.durationSeconds * ratio;
    const nextStep =
      route.steps.find((step) => {
        const idx = remainingRoute(route.polylineCoords, step.location).index;
        return idx >= rem.index;
      }) ?? route.steps[0];

    const traveledMeters = Math.max(0, route.distanceMeters - rem.meters);
    return {
      remainingCoords: rem.coords,
      remainingMeters: rem.meters,
      remainingSeconds,
      nextInstruction: nextStep?.instruction ?? null,
      // Require some progress so we don't "arrive" while still at the start.
      arrived: rem.meters < ARRIVAL_THRESHOLD_M && traveledMeters > 40,
    };
  }, [route, currentCoords]);

  /* ── Camera follow in navigation mode ── */
  useEffect(() => {
    if (!isNavigating || !currentCoords || !mapRef.current) return;
    mapRef.current.animateCamera(
      {
        center: currentCoords,
        heading,
        pitch: 55,
        zoom: 18,
      },
      { duration: 600 }
    );
  }, [
    isNavigating,
    currentCoords?.latitude,
    currentCoords?.longitude,
    heading,
  ]);

  /* ── Arrival ── */
  useEffect(() => {
    if (isNavigating && progress?.arrived) {
      stopNavigation();
    }
  }, [isNavigating, progress?.arrived, stopNavigation]);

  const goToCurrentLocation = () => {
    if (currentCoords && mapRef.current) {
      mapRef.current.animateToRegion(
        { ...currentCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500
      );
    }
  };

  const initialRegion: Region = currentCoords
    ? { ...currentCoords, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : DEFAULT_REGION;

  const previewCoords = route?.polylineCoords ?? [];
  const traveledCoords =
    isNavigating && route && progress
      ? route.polylineCoords.slice(
          0,
          Math.max(
            1,
            route.polylineCoords.length - progress.remainingCoords.length + 1
          )
        )
      : [];
  const activeCoords =
    isNavigating && progress?.remainingCoords?.length
      ? progress.remainingCoords
      : previewCoords;

  if (dr.source === 'none' && !dr.error) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingTitle}>NavGo</Text>
        <Text style={styles.loadingSubtitle}>Getting your location…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={!permDenied && dr.source === 'gps'}
        showsMyLocationButton={false}
        showsCompass={!isNavigating}
        rotateEnabled
        pitchEnabled
        customMapStyle={Platform.OS === 'android' ? lightMapStyle : undefined}
        userInterfaceStyle="light">
        {origin && !isNavigating && (
          <Marker
            coordinate={{
              latitude: origin.latitude,
              longitude: origin.longitude,
            }}
            title="Start"
            description={origin.address}
            tracksViewChanges={false}>
            <View style={styles.originMarkerOuter}>
              <View style={styles.originMarkerInner} />
            </View>
          </Marker>
        )}

        {destination && (
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            title="Destination"
            description={destination.address}
            tracksViewChanges={false}>
            <View style={styles.destMarkerContainer}>
              <View style={styles.destMarkerPin}>
                <Text style={styles.destMarkerText}>B</Text>
              </View>
              <View style={styles.destMarkerStem} />
              <View style={styles.destMarkerShadow} />
            </View>
          </Marker>
        )}

        {/* Dim traveled portion while navigating */}
        {isNavigating && traveledCoords.length >= 2 && (
          <Polyline
            coordinates={traveledCoords}
            strokeColor={colors.routeTraveled}
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Active / preview route */}
        {activeCoords.length >= 2 && (
          <>
            <Polyline
              coordinates={activeCoords}
              strokeColor={colors.routeSoft}
              strokeWidth={10}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline
              coordinates={activeCoords}
              strokeColor={colors.route}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          </>
        )}

        {dr.source === 'dead_reckoning' && currentCoords && (
          <Marker
            coordinate={currentCoords}
            title="Estimated position"
            description={`${dr.distanceTravelledM.toFixed(0)} m travelled since last fix`}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}>
            <View style={styles.drMarkerOuter}>
              <View style={styles.drMarkerInner} />
            </View>
          </Marker>
        )}
      </MapView>

      {!isNavigating && !route && (
        <DeadReckoningBadge
          source={dr.source}
          estimatedSpeedKmh={dr.estimatedSpeedKmh}
          speedSigmaKmh={dr.speedSigmaKmh}
          distanceTravelledM={dr.distanceTravelledM}
          error={dr.error}
          top={238}
        />
      )}

      {/* Hide From/To header on the trip-detail screen */}
      {!isNavigating && !route && (
        <SearchCard hasCurrentLocation={!!currentCoords} />
      )}

      {/* Back to search when viewing the trip detail sheet */}
      {route && !isNavigating && (
        <Pressable
          style={[styles.backFab, { top: insets.top + 10 }]}
          onPress={clearRoute}>
          <Text style={styles.backFabText}>←</Text>
        </Pressable>
      )}

      {!route && !isNavigating && (
        <CurrentLocationButton onPress={goToCurrentLocation} />
      )}

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingRouteText}>Finding best route…</Text>
          </View>
        </View>
      )}

      {/* Compact IMU only on home / before a route is chosen */}
      {!isNavigating && !route && (
        <MotionChannelCard
          status={motion.status}
          latest={motion.latest}
          isRecording={motion.isRecording}
          recordedCount={motion.recordedCount}
          saving={motion.saving}
          lastSaved={motion.lastSaved}
          saveError={motion.saveError}
          onStart={motion.startRecording}
          onStop={() => {
            void motion.stopAndSave();
          }}
          bottom={24}
        />
      )}

      <RouteInfoPanel
        remainingMeters={progress?.remainingMeters ?? null}
        remainingSeconds={progress?.remainingSeconds ?? null}
        nextInstruction={
          isNavigating
            ? progress?.nextInstruction ??
              (destination
                ? `Head to ${destination.address}`
                : 'Follow the route')
            : null
        }
      />

      {isNavigating && progress && (
        <View style={styles.navChip}>
          <Text style={styles.navChipText}>
            {formatDistance(progress.remainingMeters)} left
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingTitle: {
    color: colors.teal,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 20,
  },
  loadingSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
  },

  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingRouteText: {
    color: colors.teal,
    fontSize: 15,
    fontWeight: '600',
  },

  navChip: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 12,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  navChipText: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: '700',
  },
  backFab: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  backFabText: {
    color: colors.teal,
    fontSize: 20,
    fontWeight: '700',
  },

  drMarkerOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drMarkerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    borderWidth: 2.5,
    borderColor: colors.white,
  },

  originMarkerOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(43,182,115,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  originMarkerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.originDot,
    borderWidth: 2.5,
    borderColor: colors.white,
  },

  destMarkerContainer: {
    alignItems: 'center',
  },
  destMarkerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.destDot,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: colors.white,
  },
  destMarkerText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  destMarkerStem: {
    width: 3,
    height: 8,
    backgroundColor: colors.white,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  destMarkerShadow: {
    width: 10,
    height: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginTop: 2,
  },
});
