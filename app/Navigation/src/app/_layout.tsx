import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NavigationProvider } from '@/context/NavigationContext';
import { colors } from '@/constants/colors';

export default function RootLayout() {
  return (
    <NavigationProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_bottom',
        }}>
        <Stack.Screen name="index" />
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
