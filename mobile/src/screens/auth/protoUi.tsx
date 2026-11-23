import React, { useState } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';

/**
 * Primitives that reproduce the Clean & Minimal UI Kit (53 Views) `ui-*` classes at their exact px values
 * (41px buttons, 37px inputs, 40px headers ...). The shared AppButton / AppInput / AppHeader use larger, accessibility
 * oriented sizes, so the screens of the onboarding, auth and home flows compose these instead.
 */

/** Prototype `--ink-muted` and `--border-strong`; no theme token carries these two values. */
export const MUTED = '#8E939E';
export const BORDER_STRONG = '#CFCFC8';
export const ACCENT_SOFT = '#EFF4FF';
export const SUBTLE = '#F1F1EE';
export const SUCCESS = '#15803D';
export const SUCCESS_SOFT = '#F0FDF4';
export const WARNING = '#B45309';
export const WARNING_SOFT = '#FFFBEB';
export const WARNING_BORDER = '#FDE68A';

/* ── Icons (paths copied from the prototype's `icons` map) ── */
type IconProps = { size?: number; color?: string };

export const BackIcon: React.FC<IconProps> = ({ size = 15, color = '#141518' }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path d="M10 3.5L5.5 8L10 12.5" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
export const ChevronIcon: React.FC<IconProps> = ({ size = 13 }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path d="M6 3.5L10.5 8L6 12.5" stroke={MUTED} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
export const CheckIcon: React.FC<IconProps> = ({ size = 13, color = '#1D4ED8' }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
export const FlameIcon: React.FC<IconProps> = ({ size = 12 }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path d="M8.5 2C8.5 2 12.5 5 12.5 9.2C12.5 11.85 10.48 14 8 14C5.52 14 3.5 11.85 3.5 9.2C3.5 7.4 4.4 5.8 5.4 4.8C5.4 6.2 6.3 7 7.1 7C6.6 5.3 7.3 3.2 8.5 2Z" fill={WARNING} />
  </Svg>
);
export const CoinIcon: React.FC<IconProps> = ({ size = 12 }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Circle cx={8} cy={8} r={5.5} fill="#FEF3C7" stroke={WARNING} strokeWidth={1.4} />
    <SvgText x={8} y={10.8} textAnchor="middle" fontSize={7.5} fontWeight="700" fill={WARNING}>C</SvgText>
  </Svg>
);
export const BellIcon: React.FC<IconProps> = ({ size = 15, color = '#141518' }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path d="M4 6.5C4 4.29 5.79 2.5 8 2.5C10.21 2.5 12 4.29 12 6.5V10L13.5 11.5H2.5L4 10V6.5Z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    <Path d="M6.7 13.2C7.1 13.7 8.9 13.7 9.3 13.2" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);
export const BotIcon: React.FC<IconProps> = ({ size = 15 }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Rect x={2.5} y={4.5} width={11} height={8.5} rx={2.5} stroke="#1D4ED8" strokeWidth={1.5} />
    <Circle cx={6} cy={8.5} r={1} fill="#1D4ED8" />
    <Circle cx={10} cy={8.5} r={1} fill="#1D4ED8" />
    <Path d="M8 2V4.5" stroke="#1D4ED8" strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);
export const GlobeIcon: React.FC<IconProps> = ({ size = 15 }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Circle cx={8} cy={8} r={5.75} stroke="#1D4ED8" strokeWidth={1.5} />
    <Ellipse cx={8} cy={8} rx={2.6} ry={5.75} stroke="#1D4ED8" strokeWidth={1.4} />
    <Path d="M2.5 8H13.5" stroke="#1D4ED8" strokeWidth={1.4} />
  </Svg>
);
export const UsersIcon: React.FC<IconProps> = ({ size = 15 }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Circle cx={6} cy={5.5} r={2.25} stroke="#141518" strokeWidth={1.5} />
    <Path d="M2.2 13C2.6 10.9 4.1 9.8 6 9.8C7.9 9.8 9.4 10.9 9.8 13" stroke="#141518" strokeWidth={1.5} strokeLinecap="round" />
    <Circle cx={11.2} cy={6} r={1.75} stroke="#5C606A" strokeWidth={1.4} />
    <Path d="M11.2 9.8C12.5 9.8 13.6 10.6 14 12.2" stroke="#5C606A" strokeWidth={1.4} strokeLinecap="round" />
  </Svg>
);

/** The prototype's `markX` (28x28 viewBox). */
export const MarkX: React.FC<{ size?: number; stroke?: number }> = ({ size = 24, stroke = 2.6 }) => (
  <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <Path d="M6.5 6.5L21.5 21.5M21.5 6.5L6.5 21.5" stroke="#1D4ED8" strokeWidth={stroke} strokeLinecap="round" />
  </Svg>
);
/** The prototype's `markO`. */
export const MarkO: React.FC<{ size?: number; stroke?: number }> = ({ size = 24, stroke = 2.6 }) => (
  <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <Circle cx={14} cy={14} r={8} stroke="#141518" strokeWidth={stroke} />
  </Svg>
);

/** The app mark from the splash view: 3x3 hash with two cobalt crosses and a charcoal ring. */
export const BrandMark: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <Path d="M9.5 3.5V24.5M18.5 3.5V24.5M3.5 9.5H24.5M3.5 18.5H24.5" stroke={BORDER_STRONG} strokeWidth={1.6} strokeLinecap="round" />
    <Path d="M5.2 5.2L7.8 7.8M7.8 5.2L5.2 7.8" stroke="#1D4ED8" strokeWidth={2} strokeLinecap="round" />
    <Circle cx={14} cy={14} r={2.1} stroke="#141518" strokeWidth={2} />
    <Path d="M20.2 20.2L22.8 22.8M22.8 20.2L20.2 22.8" stroke="#1D4ED8" strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

export const GoogleIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </Svg>
);
export const AppleIcon: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = '#141518' }) => (
  <Svg width={size} height={size} viewBox="0 0 170 170" fill={color}>
    <Path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.77-11.65-14.19-5.77-9.15-10.34-19.46-13.72-30.93-3.38-11.48-5.07-22.42-5.07-32.81 0-14.04 3.46-25.96 10.37-35.77 6.92-9.8 15.7-14.86 26.35-15.17 4.36 0 9.29 1.15 14.8 3.44 5.51 2.29 9.38 3.51 11.61 3.66 1.83-.24 5.75-1.52 11.75-3.86 6-2.33 11.03-3.32 15.09-2.96 11.54.91 20.89 5.37 28.05 13.38-10.02 6.09-14.91 14.73-14.67 25.93.24 8.79 3.57 16.14 10 22.06 6.43 5.91 13.97 9.26 22.61 10.05-2.17 6.54-4.89 13.3-8.16 20.28zM119.22 33.7c0-7.39 2.6-14.17 7.8-20.35 5.2-6.18 11.65-10.06 19.35-11.65.24 1.48.36 2.89.36 4.23 0 7.39-2.73 14.3-8.2 20.73-5.46 6.42-12.06 10.22-19.8 11.41-.12-1.48-.19-2.94-.19-4.37z" />
  </Svg>
);

/* ── Layout ── */

/**
 * Screen shell for the form-like views: status-bar inset, themed canvas, scrollable body with `flexGrow: 1` so a
 * `marginTop: 'auto'` footer sticks to the bottom, exactly like the prototype's `flex-1 ... mt-auto` columns.
 */
export const ProtoScreen: React.FC<{
  testID?: string;
  children: React.ReactNode;
  scroll?: boolean;
  tabs?: boolean;
  bodyStyle?: StyleProp<ViewStyle>;
}> = ({ testID, children, scroll = true, tabs, bodyStyle }) => (
  <Screen testID={testID} scroll={scroll} tabs={tabs} padded={false} gap={0} contentStyle={{ flexGrow: 1 }}>
    <View style={[{ flexGrow: 1 }, bodyStyle]}>{children}</View>
  </Screen>
);

/** `appHeader(title)`: 40px bar, 28px back button (radius 9), 14px semibold centred title. */
export const ProtoHeader: React.FC<{ title: string; onBack?: () => void; right?: React.ReactNode }> = ({ title, onBack, right }) => {
  const c = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {onBack ? (
          <Pressy
            testID="header-back"
            accessibilityLabel="Go back"
            onPress={onBack}
            hitSlop={8}
            style={[styles.backBtn, { backgroundColor: c.bgCard, borderColor: c.border }]}
          >
            <BackIcon color={c.text} />
          </Pressy>
        ) : null}
      </View>
      <Text accessibilityRole="header" numberOfLines={1} style={[styles.headerTitle, { color: c.text }]}>{title}</Text>
      <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
};

/* ── Buttons ── */

export const ProtoButton: React.FC<{
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  height?: number;
  fontSize?: number;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ title, onPress, variant = 'primary', height, fontSize, loading, disabled, testID, style }) => {
  const c = useTheme();
  const off = disabled || loading;
  const h = height ?? (variant === 'ghost' ? 34 : 41);
  const fs = fontSize ?? (variant === 'ghost' ? 12.5 : 13);
  const palette = {
    primary: { bg: c.accentFill, fg: c.onAccent, border: undefined as string | undefined },
    secondary: { bg: c.bgCard, fg: c.text, border: BORDER_STRONG },
    ghost: { bg: 'transparent', fg: c.textSecondary, border: undefined as string | undefined },
  }[variant];
  return (
    <Pressy
      testID={testID}
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={off ? undefined : onPress}
      hitSlop={h < 44 ? { top: Math.ceil((44 - h) / 2), bottom: Math.ceil((44 - h) / 2) } : undefined}
      style={[
        styles.btn,
        {
          height: h,
          backgroundColor: palette.bg,
          borderWidth: palette.border ? 1 : 0,
          borderColor: palette.border,
          opacity: off ? 0.45 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <Text numberOfLines={1} style={[styles.btnText, { color: palette.fg, fontSize: fs }]}>{title}</Text>
      )}
    </Pressy>
  );
};

/** Google / Apple outline button: 40px, radius 10, 12px semibold label. */
export const SocialButton: React.FC<{
  provider: 'google' | 'apple';
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  testID?: string;
}> = ({ provider, onPress, busy, disabled, testID }) => {
  const c = useTheme();
  const label = provider === 'google' ? 'Google' : 'Apple';
  return (
    <Pressy
      testID={testID}
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      hitSlop={{ top: 2, bottom: 2 }}
      style={[styles.social, { backgroundColor: c.bgCard, borderColor: c.border, opacity: disabled && !busy ? 0.6 : 1 }]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={c.text} />
      ) : (
        <>
          {provider === 'google' ? <GoogleIcon size={14} /> : <AppleIcon size={14} color={c.text} />}
          <Text style={[styles.socialText, { color: c.text }]}>{label}</Text>
        </>
      )}
    </Pressy>
  );
};

/* ── Inputs ── */

export interface ProtoInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  labelRight?: React.ReactNode;
  /** Small element rendered inside the field on the right (badge, mark tag ...). */
  right?: React.ReactNode;
  error?: string | null;
  hint?: string;
  secureToggle?: boolean;
  mono?: boolean;
}

/** `.ui-input`: 37px, radius 10, strong border, 12.5px text, label above (11px semibold, mb 4). */
export const ProtoInput = React.forwardRef<React.ElementRef<typeof TextInput>, ProtoInputProps>(function ProtoInput(
  { label, labelRight, right, error, hint, secureToggle, mono, onFocus, onBlur, editable = true, ...rest },
  ref,
) {
  const c = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const secure = secureToggle ? hidden : rest.secureTextEntry;
  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>
        {labelRight}
      </View>
      <View
        style={[
          styles.input,
          { backgroundColor: c.bgCard, borderColor: error ? c.danger : focused ? c.accent : BORDER_STRONG, opacity: editable ? 1 : 0.85 },
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={MUTED}
          selectionColor={c.accent}
          editable={editable}
          {...rest}
          secureTextEntry={secure}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.inputText,
            { color: c.text },
            mono ? { fontFamily: fonts.mono.semibold, letterSpacing: 2.4 } : null,
            secure ? { letterSpacing: 2 } : null,
          ]}
        />
        {secureToggle ? (
          <Pressy
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
          >
            <Text style={[styles.toggleText, { color: c.textSecondary }]}>{hidden ? 'Show' : 'Hide'}</Text>
          </Pressy>
        ) : null}
        {right}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.help, { color: c.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.help, { color: MUTED }]}>{hint}</Text>
      ) : null}
    </View>
  );
});

/** Rounded pill used for password rules ("✓ 8+ chars"): 10.5px semibold on a success/neutral fill. */
export const RulePill: React.FC<{ label: string; ok: boolean; size?: number }> = ({ label, ok, size = 10.5 }) => {
  const c = useTheme();
  return (
    <View
      accessibilityLabel={`${label}: ${ok ? 'met' : 'not met'}`}
      style={[styles.pill, { backgroundColor: ok ? SUCCESS_SOFT : SUBTLE }]}
    >
      <Text style={[styles.pillText, { fontSize: size, color: ok ? SUCCESS : c.textSecondary }]}>{ok ? '✓ ' : ''}{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { height: 40, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSide: { width: 32, justifyContent: 'center', alignItems: 'flex-start' },
  backBtn: { width: 28, height: 28, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.body.semibold, fontSize: 14, lineHeight: 18, letterSpacing: -0.14 },
  btn: { width: '100%', borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnText: { fontFamily: fonts.body.semibold, letterSpacing: -0.13 },
  social: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  socialText: { fontFamily: fonts.body.semibold, fontSize: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontFamily: fonts.body.semibold, fontSize: 11, lineHeight: 15 },
  input: { height: 37, borderRadius: 10, borderWidth: 1, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  inputText: { flex: 1, padding: 0, fontFamily: fonts.body.regular, fontSize: 12.5 },
  toggleText: { fontFamily: fonts.body.semibold, fontSize: 11 },
  help: { fontFamily: fonts.body.regular, fontSize: 11, lineHeight: 15, marginTop: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  pillText: { fontFamily: fonts.body.semibold },
});
