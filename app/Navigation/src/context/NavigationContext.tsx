import React, { createContext, useContext, useState, useCallback } from 'react';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  address: string;
}

export interface RouteInfo {
  distance: string;
  duration: string;
  polylineCoords: { latitude: number; longitude: number }[];
}

interface NavigationState {
  origin: LocationPoint | null;
  destination: LocationPoint | null;
  route: RouteInfo | null;
  isLoading: boolean;
  setOrigin: (location: LocationPoint | null) => void;
  setDestination: (location: LocationPoint | null) => void;
  setRoute: (route: RouteInfo | null) => void;
  setIsLoading: (loading: boolean) => void;
  clearRoute: () => void;
}

const NavigationContext = createContext<NavigationState | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [origin, setOrigin] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const clearRoute = useCallback(() => {
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
        setOrigin,
        setDestination,
        setRoute,
        setIsLoading,
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
