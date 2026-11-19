import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NavigationProvider } from '@/context/NavigationContext';
import { colors } from '@/constants/colors';
import { onboarding } from '@/constants/onboardingTheme';
import { hasCompletedOnboarding } from '@/utils/onboardingStorage';
import { preloadOnboardingImages } from '@/constants/onboardingImages';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(true);

  // Kick off image warm-up immediately so onboarding cards paint instantly.
  useEffect(() => {
    void preloadOnboardingImages();
  }, []);

  // Re-check whenever the route changes so "Get Started" can leave onboarding.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [done] = await Promise.all([
        hasCompletedOnboarding(),
        preloadOnboardingImages(),
      ]);
      if (!alive) return;
      setNeedsOnboarding(!done);
      setReady(true);
      if (!done && segments[0] !== 'onboarding') {
        router.replace('/onboarding');
      } else if (done && segments[0] === 'onboarding') {
        router.replace('/');
      }
    })();
    return () => {
      alive = false;
    };
  }, [segments, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: onboarding.gradientTop }} />
    );
  }

  return (
    <NavigationProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: needsOnboarding
              ? onboarding.gradientBottom
              : colors.backgroundSoft,
          },
          animation: 'fade',
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen
          name="onboarding"
          options={{ gestureEnabled: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="search"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </NavigationProvider>
  );
}
