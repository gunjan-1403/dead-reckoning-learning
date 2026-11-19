# NavGo

NavGo is the Expo / React Native app in this repository. The ONNX speed model is already bundled; you don't need Python or any of the notebooks to run it. **Expo Go cannot run this app** because it doesn't include `onnxruntime-react-native`.

## Run on your phone

Install Node.js 22 LTS (22.13 or later). From the repository root on your computer:

```sh
cd app/Navigation
npm ci
```

Keep npm install scripts enabled: `postinstall` patches ONNX Runtime for Android's Gradle build and native autolinking.

### Android: build an APK on GitHub

Push your app changes, then open **Actions → Build Android APK** in the GitHub repository. Open the latest successful run for your branch and download the **NavGo-Android-APK** artifact. Unzip it and install `NavGo-arm64.apk` on a 64-bit ARM Android phone. The app includes its JavaScript bundle and does not need Metro. No Expo account is required for this build.

Once the workflow is on the default branch, you can also use **Run workflow** to build on demand. The APK uses Expo's generated test signing key, not the Expo Build key. If you already installed a differently signed APK with the same package name, Android won't let this APK replace it. Use the original signing key for an in-place update, or back up any local data before uninstalling the old test app.

### Android: install an APK from Expo Build

If you prefer an Expo-signed build, sign in to a free Expo account and run:

```sh
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

On the first build, follow the prompts to link or create an Expo project and generate an Android keystore. When the build finishes, open the build link on your phone and install the APK. Allow installs from that source if Android asks. Open **NavGo** and grant location access. The installed app does not need your computer or a Metro server.

### Android: build locally over USB

If you already have the [Android build tools](https://docs.expo.dev/get-started/set-up-your-environment/?platform=android&device=physical&mode=development-build&buildEnv=local), enable **USB debugging**, connect and authorize your phone, then run:

```sh
npx expo run:android --device
```

This builds and installs NavGo and starts the Metro server for the debug build.

### iPhone

On a Mac with Xcode and CocoaPods, connect and trust the iPhone, enable [Developer Mode](https://docs.expo.dev/guides/ios-developer-mode/), and run:

```sh
npx expo run:ios --device
```

If prompted, choose a unique bundle identifier and configure signing with your team in Xcode. Without a Mac, an [Expo internal iOS build](https://docs.expo.dev/build/internal-distribution/) is an option with a paid Apple Developer membership: register the iPhone with `npx eas-cli@latest device:create`, then build with `npx eas-cli@latest build --platform ios --profile preview`.

## Maps and search

- If the Android basemap is blank, make sure the key under `expo.android.config.googleMaps.apiKey` in `app.json` has **Maps SDK for Android** enabled and authorizes this app's package name and signing certificate SHA-1. Rebuild after changing the key. Cloud and local debug builds can use different signing certificates.
- For Google Places and Directions, copy `.env.example` to `.env` and set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` for local builds, or set the same variable in your Expo project's `preview` environment for cloud builds. Without it, the app tries its public search and routing fallbacks. This client-side value is bundled with the app; don't put secrets in it.
