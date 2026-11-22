import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check, Coins } from 'lucide-react-native';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
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
  sub: string;
  cost: number;
  badge: string;
  bg: string;
  fg: string;
}

const EMBLEMS: EmblemItem[] = [
  { id: 'cobalt', name: 'Cobalt Emblem', sub: 'Day 7 Grand Chest', cost: 0, badge: '◈', bg: '#EFF4FF', fg: '#1D4ED8' },
  { id: 'tactical', name: 'Tactical Grid', sub: 'Season 4 Starter', cost: 0, badge: '⊞', bg: '#F0FDF4', fg: '#15803D' },
  { id: 'crown', name: 'Gold II Crown', sub: 'Profile Crest', cost: 450, badge: '♛', bg: '#FFFBEB', fg: '#B45309' },
  { id: 'frame', name: 'Obsidian Frame', sub: 'Avatar Border', cost: 800, badge: '❖', bg: '#141518', fg: '#FFFFFF' },
];

export const CoinShopEmblemsScreen: React.FC<RootScreenProps<'coin_shop'>> = () => {
  const c = useTheme();
  const { back } = useAppNav();
  const me = useMe();
  const coins = me.data?.wallet.coins ?? 1240;
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
        <View style={styles.coinPill}>
          <Coins size={13} color="#B45309" />
          <Text style={styles.coinPillText}>{coins.toLocaleString()} Coins</Text>
        </View>
      }
    >
      <View style={{ gap: 14 }}>
        {/* Equipped Emblem Active Card */}
        <AppCard padding="md" style={styles.heroCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.badgeBox, { backgroundColor: activeEmblem.bg }]}>
              <Text style={[styles.badgeSymbol, { color: activeEmblem.fg }]}>{activeEmblem.badge}</Text>
            </View>
            <View>
              <Text style={[styles.heroLabel, { color: c.accent }]}>EQUIPPED EMBLEM</Text>
              <Text style={[styles.heroName, { color: c.text }]}>{activeEmblem.name}</Text>
            </View>
          </View>
          <View style={styles.activeTag}>
            <Check size={12} color="#15803D" strokeWidth={2.5} />
            <Text style={styles.activeTagText}>Active</Text>
          </View>
        </AppCard>

        {/* 2-Column Grid */}
        <View style={styles.grid}>
          {EMBLEMS.map((it) => {
            const isUnlocked = !!unlocked[it.id];
            const isEquipped = equipped === it.id;
            const btnLabel = isEquipped ? 'Equipped' : isUnlocked ? 'Equip' : `${it.cost} Coins`;
            const btnBg = isEquipped ? '#EFF4FF' : isUnlocked ? '#F1F1EE' : c.accent;
            const btnFg = isEquipped ? c.accent : isUnlocked ? c.text : '#FFFFFF';

            return (
              <View key={it.id} style={styles.cell}>
                <AppCard
                  selected={isEquipped}
                  onPress={() => onSelect(it)}
                  padding="md"
                  style={styles.cardItem}
                >
                  <View style={[styles.badgeBox, { backgroundColor: it.bg }]}>
                    <Text style={[styles.badgeSymbol, { color: it.fg }]}>{it.badge}</Text>
                  </View>

                  <View style={{ alignItems: 'center' }}>
                    <Text numberOfLines={1} style={[styles.cardTitle, { color: c.text }]}>
                      {it.name}
                    </Text>
                    <Text numberOfLines={1} style={[styles.cardSub, { color: c.textSecondary }]}>
                      {it.sub}
                    </Text>
                  </View>

                  <Pressy
                    testID={`emblem-${it.id}`}
                    onPress={() => onSelect(it)}
                    style={[styles.actionBtn, { backgroundColor: btnBg }]}
                  >
                    <Text style={[styles.actionBtnText, { color: btnFg }]}>{btnLabel}</Text>
                  </Pressy>
                </AppCard>
              </View>
            );
          })}
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  coinPillText: {
    fontSize: 11,
    fontFamily: fonts.mono.semibold,
    color: '#B45309',
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSymbol: {
    fontSize: 17,
    fontFamily: fonts.mono.semibold,
  },
  heroLabel: {
    fontSize: 10,
    fontFamily: fonts.body.semibold,
    letterSpacing: 0.8,
  },
  heroName: {
    fontSize: 13,
    fontFamily: fonts.body.semibold,
    marginTop: 1,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F0FDF4',
  },
  activeTagText: {
    fontSize: 10.5,
    fontFamily: fonts.body.semibold,
    color: '#15803D',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: '48.5%',
    flexGrow: 1,
  },
  cardItem: {
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontFamily: fonts.body.semibold,
  },
  cardSub: {
    fontSize: 10,
    marginTop: 2,
  },
  actionBtn: {
    width: '100%',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 11,
    fontFamily: fonts.mono.semibold,
  },
});
