import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Expo configuration
 */
const IOS_BUNDLE_ID = process.env.IOS_BUNDLE_ID ?? "com.tictactoe.game";
const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE ?? "com.tictactoe.game";
const LINK_HOST = process.env.EXPO_PUBLIC_LINK_HOST ?? "";
const GOOGLE_IOS_URL_SCHEME = process.env.GOOGLE_IOS_URL_SCHEME ?? "";

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins: NonNullable<ExpoConfig["plugins"]> = [
    "expo-secure-store",
    "expo-sqlite",
    "expo-font",
    "expo-audio",
    "expo-image",
    "expo-localization",
    "expo-apple-authentication",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#0B0718",
        image: "./assets/splash-icon.png",
        imageWidth: 200,
      },
    ],
    ["expo-notifications", { color: "#8B5CF6" }],
  ];

  if (GOOGLE_IOS_URL_SCHEME) {
    plugins.push([
      "@react-native-google-signin/google-signin",
      { iosUrlScheme: GOOGLE_IOS_URL_SCHEME },
    ]);
  }

  return {
    ...config,
    name: "Tic Tac Toe",
    slug: "tic-tac-toe",
    scheme: "tictactoe",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    backgroundColor: "#0B0718",

    extra: {
      ...config.extra,
      eas: {
        ...config.extra?.eas,
        projectId: "ca4d891f-a1ea-4f29-aa6a-a1759b1f5816",
      },
    },

    ios: {
      bundleIdentifier: IOS_BUNDLE_ID,
      supportsTablet: false,
      usesAppleSignIn: true,
      buildNumber: "1",
      infoPlist: { ITSAppUsesNonExemptEncryption: false },
      associatedDomains: LINK_HOST ? [`applinks:${LINK_HOST}`] : undefined,
    },

    android: {
      package: ANDROID_PACKAGE,
      versionCode: 1,
      adaptiveIcon: {
        backgroundColor: "#0B0718",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: true,
      permissions: ["VIBRATE", "POST_NOTIFICATIONS"],
      intentFilters: LINK_HOST
        ? [
            {
              action: "VIEW",
              autoVerify: true,
              data: [
                { scheme: "https", host: LINK_HOST, pathPrefix: "/join" },
                { scheme: "https", host: LINK_HOST, pathPrefix: "/invite" },
              ],
              category: ["BROWSABLE", "DEFAULT"],
            },
          ]
        : undefined,
    },

    plugins,
    experiments: { typedRoutes: false },
  };
};
