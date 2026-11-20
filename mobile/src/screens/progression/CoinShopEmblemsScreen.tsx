import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Award, Check, Coins, Crown, Grid, Shield } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Screen } from '../../components/common/Screen';
import { withAlpha } from '../../design-system/colors';
import { fonts, type } from '../../design-system/typography';
import { useMe } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { useSettingsStore } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';

interface EmblemItem {
  id: string;
  name: string;
  source: string;
  cost: number;
  icon: (color: string) => React.ReactNode;
}

const EMBLEMS: EmblemItem[] = [
  { id: 'cobalt', name: 'Cobalt Emblem', source: 'Day 7 Grand Chest', cost: 0, icon: (col) => <Award size={22} color={col} /> },
  { id: 'tactical', name: 'Tactical Grid', source: 'Season Starter', cost: 0, icon: (col) => <Grid size={22} color={col} /> },
  { id: 'crown', name: 'Gold II Crown', source: '450 Coins', cost: 450, icon: (col) => <Crown size={22} color={col} /> },
  { id: 'frame', name: 'Obsidian Crest', source: '800 Coins', cost: 800, icon: (col) => <Shield size={22} color={col} /> },
];

export const CoinShopEmblemsScreen: React.FC<RootScreenProps<'coin_shop'>> = () => {
  const c = useTheme();
  const { back } = useAppNav();
  const me = useMe();
  const coins = me.data?.wallet.coins ?? 0;
  const equipped = useSettingsStore((s) => s.equippedEmblem);
  const unlocked = useSettingsStore((s) => s.unlockedEmblems);
  const setSettings = useSettingsStore((s) => s.set);

  const activeEmblem = EMBLEMS.find((e) => e.id === equipped) ?? EMBLEMS[0]!;

  const onSelect = (item: EmblemItem) => {
    if (unlocked[item.id]) {
      setSettings({ equippedEmblem: item.id });
      toast.success('Emblem equipped', `${item.name} is now active on your profile`);
      return;
    }
    if (coins < item.cost) {
      toast.warning('Not enough coins', `Claim daily rewards to earn ${item.cost - coins} more coins`);
      return;
    }
    setSettings({
      unlockedEmblems: { ...unlocked, [item.id]: true },
      equippedEmblem: item.id,
    });
    toast.success('Emblem unlocked', `${item.name} equipped!`);
  };

  return (
    <Screen
      title="Emblems & Shop"
      onBack={back}
      testID="coin-shop-screen"
      rightAction={
        <View style={[styles.coinPill, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Coins size={14} color={c.warning} />
          <Text style={[type.num, { fontSize: 12, color: c.text }]}>{coins}</Text>
        </View>
      }
    >
      <AppCard selected style={styles.hero}>
        <View style={[styles.badgeBox, { backgroundColor: withAlpha(c.accent, 0.14) }]}>
          {activeEmblem.icon(c.accent)}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.caption, { color: c.accent }]}>EQUIPPED EMBLEM</Text>
          <Text style={[type.heading, { color: c.text }]}>{activeEmblem.name}</Text>
          <Text style={[type.small, { color: c.textSecondary }]}>{activeEmblem.source}</Text>
        </View>
        <Check size={18} color={c.success} />
      </AppCard>

      <View style={styles.grid}>
        {EMBLEMS.map((item) => {
          const isUnlocked = !!unlocked[item.id];
          const isEquipped = equipped === item.id;
          return (
            <View key={item.id} style={styles.cell}>
              <AppCard selected={isEquipped} style={{ alignItems: 'center', gap: 10 }}>
                <View style={[styles.badgeBox, { backgroundColor: isEquipped ? withAlpha(c.accent, 0.14) : c.bgSecondary }]}>
                  {item.icon(isEquipped ? c.accent : c.text)}
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text }]}>{item.name}</Text>
                  <Text style={[type.caption, { color: c.textSecondary, fontFamily: fonts.mono.medium }]}>{item.source}</Text>
                </View>
                <AppButton
                  testID={`emblem-${item.id}`}
                  size="md"
                  fullWidth
                  variant={isEquipped ? 'secondary' : isUnlocked ? 'outline' : 'primary'}
                  title={isEquipped ? 'Equipped' : isUnlocked ? 'Equip' : `${item.cost} Coins`}
                  onPress={() => onSelect(item)}
                />
              </AppCard>
            </View>
          );
        })}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badgeBox: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48%', flexGrow: 1 },
});
