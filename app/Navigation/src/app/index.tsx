import { useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Platform } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';

import { useNavContext } from '@/context/NavigationContext';
import { getDirections } from '@/utils/api';
import { SearchCard } from '@/components/map/SearchCard';
import { RouteInfoPanel } from '@/components/map/RouteInfoPanel';
import { CurrentLocationButton } from '@/components/map/CurrentLocationButton';
import { MotionChannelCard } from '@/components/map/MotionChannelCard';
import { DeadReckoningBadge } from '@/components/map/DeadReckoningBadge';
import { useMotionChannels } from '@/hooks/useMotionChannels';
import { useDeadReckoning } from '@/hooks/useDeadReckoning';
import { darkMapStyle } from '@/constants/mapStyle';
import { colors } from '@/constants/colors';

const DEFAULT_REGION: Region = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const motion = useMotionChannels();

  // Dead reckoning provides a continuously updated position: GPS when
  // available, model-estimated coordinates when the GPS signal is lost.
  const dr = useDeadReckoning();
  const currentCoords = dr.coords;
  const permDenied = dr.source === 'none' && !!dr.error?.includes('permission');

  const {
    origin,
    destination,
    route,
    isLoading,
    setOrigin,
    setRoute,
    setIsLoading,
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

      // Fit map to the route
      if (info && mapRef.current) {
        mapRef.current.fitToCoordinates(
          [
            { latitude: origin.latitude, longitude: origin.longitude },
            { latitude: destination.latitude, longitude: destination.longitude },
            ...info.polylineCoords,
          ],
          {
            edgePadding: { top: 220, right: 60, bottom: 280, left: 60 },
            animated: true,
          }
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [origin, destination, setIsLoading, setRoute]);

  /* ── Auto-set origin once we have coordinates and a destination ── */
  useEffect(() => {
    if (currentCoords && !origin && destination) {
      setOrigin({
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        address: 'Your location',
      });
    }
  }, [currentCoords, destination, origin, setOrigin]);

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

  /* ── Loading state: show spinner until we have any position (GPS or DR) ── */
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
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={!permDenied && dr.source === 'gps'}
        showsMyLocationButton={false}
        showsCompass={false}
        customMapStyle={Platform.OS === 'android' ? darkMapStyle : undefined}
        userInterfaceStyle="dark">
        {/* Origin marker */}
        {origin && (
          <Marker
            coordinate={{
              latitude: origin.latitude,
              longitude: origin.longitude,
            }}
            title="Start"
            description={origin.address}>
            <View style={styles.originMarkerOuter}>
              <View style={styles.originMarkerInner} />
            </View>
          </Marker>
        )}

        {/* Destination marker */}
        {destination && (
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            title="Destination"
            description={destination.address}>
            <View style={styles.destMarkerContainer}>
              <View style={styles.destMarkerPin}>
                <Text style={styles.destMarkerText}>B</Text>
              </View>
              <View style={styles.destMarkerStem} />
              <View style={styles.destMarkerShadow} />
            </View>
          </Marker>
        )}

        {/* Route polyline */}
        {route && (
          <>
            <Polyline
              coordinates={route.polylineCoords}
              strokeColor="rgba(0,230,118,0.3)"
              strokeWidth={8}
            />
            <Polyline
              coordinates={route.polylineCoords}
              strokeColor={colors.primary}
              strokeWidth={5}
            />
          </>
        )}

        {/* Dead reckoning position marker — shown instead of the native blue dot
            when GPS is lost so the user can see the estimated position. */}
        {dr.source === 'dead_reckoning' && currentCoords && (
          <Marker
            coordinate={currentCoords}
            title="Estimated position"
            description={`${dr.distanceTravelledM.toFixed(0)} m travelled since last fix`}
            anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.drMarkerOuter}>
              <View style={styles.drMarkerInner} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Dead reckoning status badge */}
      <DeadReckoningBadge
        source={dr.source}
        estimatedSpeedKmh={dr.estimatedSpeedKmh}
        speedSigmaKmh={dr.speedSigmaKmh}
        distanceTravelledM={dr.distanceTravelledM}
        error={dr.error}
        top={60}
      />

      {/* Search overlay */}
      <SearchCard hasCurrentLocation={!!currentCoords} />

      {/* Current location FAB */}
      {!route && <CurrentLocationButton onPress={goToCurrentLocation} />}

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingRouteText}>Finding best route…</Text>
          </View>
        </View>
      )}

      {/* Live 6-channel accelerometer + gyroscope stream */}
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
        bottom={route ? 310 : 28}
      />

      {/* Route info bottom panel */}
      <RouteInfoPanel />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },

  /* Loading screen */
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingTitle: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 20,
  },
  loadingSubtitle: {
    color: colors.textMuted,
    fontSize: 15,
  },

  /* Loading overlay */
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingRouteText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },

  /* Dead reckoning marker (orange pulsing dot — shown when GPS is lost) */
  drMarkerOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,149,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drMarkerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF9500',
    borderWidth: 2.5,
    borderColor: colors.white,
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
  },

  /* Origin marker (green pulsing dot) */
  originMarkerOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,230,118,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  originMarkerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    borderWidth: 2.5,
    borderColor: colors.white,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
  },

  /* Destination marker (pin) */
  destMarkerContainer: {
    alignItems: 'center',
  },
  destMarkerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: colors.white,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
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
