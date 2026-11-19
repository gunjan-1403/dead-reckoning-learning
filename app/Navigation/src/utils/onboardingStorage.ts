import { File, Paths } from 'expo-file-system';

/**
 * File-based flag — works in Expo Go without AsyncStorage native module.
 */
const flagFile = () => new File(Paths.document, 'navgo-onboarding-done.txt');

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const file = flagFile();
    if (!file.exists) return false;
    const value = await file.text();
    return value.trim() === '1';
  } catch {
    return false;
  }
}

export async function setOnboardingComplete(): Promise<void> {
  try {
    const file = flagFile();
    await file.write('1');
  } catch (err) {
    // Never block leaving onboarding if persistence fails.
    console.warn('[onboarding] could not persist completion flag', err);
  }
}

/** Dev helper — clear the flag to preview onboarding again. */
export async function resetOnboarding(): Promise<void> {
  try {
    const file = flagFile();
    if (file.exists) {
      file.delete();
    }
  } catch {
    // ignore
  }
}
