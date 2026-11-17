/* Lightweight Reanimated stand-in for Jest: animations resolve instantly, components render as plain RN views. */
import React from 'react';
import { View, Text, ScrollView, Image } from 'react-native';

const sv = <T,>(v: T) => ({ value: v });
const identity = <T,>(v: T) => v;
const layoutAnim: Record<string, unknown> = {};
const chain = new Proxy(layoutAnim, { get: () => () => chain });

const Animated = {
  View, Text, ScrollView, Image,
  createAnimatedComponent: <C,>(c: C) => c,
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  useSharedValue: sv,
  useAnimatedStyle: () => ({}),
  useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
  useAnimatedProps: () => ({}),
  useAnimatedScrollHandler: () => ({}),
  withTiming: identity,
  withSpring: identity,
  withDelay: (_d: number, v: unknown) => v,
  withRepeat: identity,
  withSequence: (...v: unknown[]) => v[v.length - 1],
  cancelAnimation: () => undefined,
  runOnJS: (fn: unknown) => fn,
  runOnUI: (fn: unknown) => fn,
  interpolate: (v: number) => v,
  Easing: new Proxy({}, { get: () => () => identity }),
  FadeIn: chain, FadeOut: chain, FadeInUp: chain, FadeOutUp: chain, FadeInDown: chain, FadeOutDown: chain, ZoomIn: chain, ZoomOut: chain, SlideInRight: chain, SlideOutLeft: chain, Layout: chain, LinearTransition: chain,
  Extrapolation: { CLAMP: 'clamp' },
  useReducedMotion: () => false,
  createElement: React.createElement,
};
