import { Asset } from 'expo-asset';
import { Image } from 'react-native';

export const ONBOARDING_IMAGES = {
  colosseum: require('@/assets/images/onboarding/colosseum.jpg'),
  mountains: require('@/assets/images/onboarding/mountains.jpg'),
  beach: require('@/assets/images/onboarding/beach.jpg'),
  indiaTaj: require('@/assets/images/onboarding/india-taj.jpg'),
  indiaJaipur: require('@/assets/images/onboarding/india-jaipur.jpg'),
  indiaMumbai: require('@/assets/images/onboarding/india-mumbai.jpg'),
} as const;

const ALL = Object.values(ONBOARDING_IMAGES);

let preloadPromise: Promise<void> | null = null;

/** Warm the packager assets + RN image cache so cards paint immediately. */
export function preloadOnboardingImages(): Promise<void> {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    try {
      await Asset.loadAsync(ALL);
    } catch {
      // fall through — RN prefetch still helps
    }

    await Promise.all(
      ALL.map(
        (src) =>
          new Promise<void>((resolve) => {
            const resolved = Image.resolveAssetSource(src);
            if (!resolved?.uri) {
              resolve();
              return;
            }
            Image.prefetch(resolved.uri).finally(() => resolve());
          })
      )
    );
  })();

  return preloadPromise;
}
