import React, { createContext, useContext, useState, useCallback } from 'react';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  address: string;
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  location: { latitude: number; longitude: number };
}

export interface RouteInfo {
  distance: string;
  duration: string;
  distanceMeters: number;
  durationSeconds: number;
  polylineCoords: { latitude: number; longitude: number }[];
  steps: RouteStep[];
}

interface NavigationState {
  origin: LocationPoint | null;
  destination: LocationPoint | null;
  route: RouteInfo | null;
  isLoading: boolean;
  isNavigating: boolean;
  setOrigin: (location: LocationPoint | null) => void;
  setDestination: (location: LocationPoint | null) => void;
  setRoute: (route: RouteInfo | null) => void;
  setIsLoading: (loading: boolean) => void;
  startNavigation: () => void;
  stopNavigation: () => void;
  clearRoute: () => void;
}

const NavigationContext = createContext<NavigationState | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [origin, setOrigin] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const startNavigation = useCallback(() => {
    if (!route || route.polylineCoords.length < 2) return;
    setIsNavigating(true);
  }, [route]);

  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
  }, []);

  const clearRoute = useCallback(() => {
    setIsNavigating(false);
    setRoute(null);
    setOrigin(null);
    setDestination(null);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        origin,
        destination,
        route,
        isLoading,
        isNavigating,
        setOrigin,
        setDestination,
        setRoute,
        setIsLoading,
        startNavigation,
        stopNavigation,
        clearRoute,
      }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavContext() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavContext must be used within NavigationProvider');
  }
  return context;
}
