# iOS build and TestFlight (EAS)

**Status: configuration prepared, NOT built.** An iOS binary cannot be produced on Windows; EAS Build compiles it on Apple hardware
in the cloud. Nothing in this guide has been executed from this repository's development machine, so the first EAS iOS build may
surface signing/capability issues that need fixing on your Apple account.

## One-time setup

1. Apple Developer Program membership + an App Store Connect app record with bundle id `com.squillion.tictactoe`
   (change `IOS_BUNDLE_ID` in `.env` / EAS env if you use your own).
2. `npm i -g eas-cli` (or `npx eas-cli@latest`), `eas login`, `eas init` (creates the EAS project id and links `app.config.ts`).
3. Replace the placeholders in `eas.json`: `EXPO_PUBLIC_API_URL` per profile (HTTPS for `production`) and
   `submit.production.ios.ascAppId`.
4. Sign in with Apple: the capability is enabled by `usesAppleSignIn: true` in `app.config.ts`; EAS manages it in your provisioning profile.
5. Google sign-in (optional): create an iOS OAuth client in Google Cloud, set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
   `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `GOOGLE_IOS_URL_SCHEME` (reversed client id) as EAS environment variables, and configure the SAME
   web client id on the backend (`GOOGLE_CLIENT_ID`).
6. Universal links for invitations (optional): host `apple-app-site-association` on `EXPO_PUBLIC_LINK_HOST`; `tictactoe://` links work without it.

## Build and submit

```bash
eas build --platform ios --profile production      # signed App Store build (EAS manages certs/profiles)
eas submit --platform ios --profile production     # uploads to App Store Connect / TestFlight
```

Then in App Store Connect: TestFlight -> add internal testers -> test. For external testers submit the build for Beta App Review.
Use `--profile development` for an internal-distribution dev client (register test devices first with `eas device:create`).

## Known iOS limitations

* **Push notifications**: the backend sends through Firebase Cloud Messaging. On iOS the Expo/native token is an APNs token, which FCM
  cannot use without the Firebase iOS SDK. The app therefore registers push tokens on Android only; iOS users receive realtime
  in-app notifications over the socket while the app is open. To enable iOS push: add `@react-native-firebase/messaging`
  (or upload an APNs key to Firebase and map tokens), then register the FCM token with `POST /devices/register`.
* **Not tested on any iOS simulator or device** (no macOS available during development): layout, safe areas, keyboard behaviour,
  Sign in with Apple and haptics are unverified on iOS.
