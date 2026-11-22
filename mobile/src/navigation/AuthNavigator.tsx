import React from 'react';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { OtpVerificationScreen } from '../screens/auth/OtpVerificationScreen';
import { RegistrationScreen } from '../screens/auth/RegistrationScreen';
import { Onboarding1Screen, Onboarding2Screen, Onboarding3Screen } from '../screens/onboarding/OnboardingScreens';
import { SplashScreen } from '../screens/onboarding/SplashScreen';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { Stack } from './stack';

/** Splash, onboarding and authentication screens (a group inside the root stack; call as a function). */
export const authScreens = () => (
  <Stack.Group key="auth">
    <Stack.Screen name="splash" component={SplashScreen} options={{ animation: 'fade', gestureEnabled: false }} />
    <Stack.Screen name="onboarding_1" component={Onboarding1Screen} options={{ animation: 'fade', gestureEnabled: false }} />
    <Stack.Screen name="onboarding_2" component={Onboarding2Screen} options={{ animation: 'fade', gestureEnabled: false }} />
    <Stack.Screen name="onboarding_3" component={Onboarding3Screen} options={{ animation: 'fade', gestureEnabled: false }} />
    <Stack.Screen name="welcome" component={WelcomeScreen} options={{ animation: 'fade', gestureEnabled: false }} />
    <Stack.Screen name="login" component={LoginScreen} />
    <Stack.Screen name="registration" component={RegistrationScreen} />
    <Stack.Screen name="otp_verification" component={OtpVerificationScreen} />
    <Stack.Screen name="forgot_password" component={ForgotPasswordScreen} />
  </Stack.Group>
);
