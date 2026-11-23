import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { findAvatar } from '../../constants/avatars';
import { radius } from '../../design-system/radius';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { fs, ms } from '../../design-system/responsive';

export type PresenceStatus = 'online' | 'in_game' | 'offline';

const DIM = { sm: 36, md: 44, lg: 56, xl: 80 } as const;
const FONT = { sm: 12, md: 14, lg: 16, xl: 22 } as const;

/** Initials on a flat preset colour (or the preset's picture). The presence dot sits bottom-right. */
export const AppAvatar: React.FC<{
  avatarId?: string | null;
  name?: string;
  size?: keyof typeof DIM;
  status?: PresenceStatus;
  activeRing?: boolean;
}> = ({ avatarId, name, size = 'md', status, activeRing }) => {
  const c = useTheme();
  const preset = findAvatar(avatarId);
  const d = ms(DIM[size]);
  const fz = fs(FONT[size]);
  const dotD = Math.max(12, ms(14));
  const dot = { online: c.success, in_game: c.warning, offline: c.textSecondary };
  return (
    <View style={{ width: d, height: d }} accessibilityLabel={name ? `${name} avatar` : 'avatar'}>
      <View style={[styles.box, { width: d, height: d, borderRadius: size === 'xl' ? radius.lg : radius.md }, activeRing && { borderWidth: 2, borderColor: c.accent }]}>
        {preset.image ? (
          <Image source={preset.image} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[styles.fill, { backgroundColor: preset.colors[0] }]}>
            <Text style={{ fontFamily: fonts.body.semibold, fontSize: fz, lineHeight: Math.round(fz * 1.3), color: c.onAccent }}>
              {(name ? name.slice(0, 2) : preset.initials).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      {status ? <View style={[styles.dot, { width: dotD, height: dotD, borderRadius: dotD / 2,  backgroundColor: dot[status], borderColor: c.bgPrimary }]} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', right: -2, bottom: -2, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
});
