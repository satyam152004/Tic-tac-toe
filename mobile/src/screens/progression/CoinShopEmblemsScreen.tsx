import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { shopApi, type EmblemShop, type EmblemView } from '../../services/api/shopApi';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

import { fs, ms } from '../../design-system/responsive';
export const CoinShopEmblemsScreen: React.FC<RootScreenProps<'coin_shop'>> = () => {
  const c = useTheme();
  const { back } = useAppNav();
  const qc = useQueryClient();
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const q = useQuery({ queryKey: ['shop', 'emblems'], queryFn: shopApi.emblems, enabled: signedIn });

  const apply = (next: EmblemShop) => {
    qc.setQueryData(['shop', 'emblems'], next);
    void qc.invalidateQueries({ queryKey: ['me'] });
    void qc.invalidateQueries({ queryKey: ['rewards'] });
  };
  const unlock = useMutation({ mutationFn: shopApi.unlock, onSuccess: apply });
  const equip = useMutation({ mutationFn: shopApi.equip, onSuccess: apply });
  const busy = unlock.isPending || equip.isPending;

  const shop = q.data;
  const coins = shop?.coins ?? 0;
  const activeEmblem = shop?.emblems.find((e) => e.equipped) ?? shop?.emblems[0];

  const onSelect = async (item: EmblemView) => {
    if (busy || item.equipped) return;
    try {
      if (item.unlocked) {
        await equip.mutateAsync(item.id);
        toast.success('Emblem equipped', `${item.name} is now on your profile`);
      } else {
        if (coins < item.cost) {
          toast.warning('Not enough coins', `You need ${item.cost - coins} more coins. Claim daily rewards to earn them.`);
          return;
        }
        await unlock.mutateAsync(item.id);
        toast.success('Emblem unlocked', `${item.name} is equipped`);
      }
    } catch (e) {
      const code = toApiError(e).code;
      if (code === 'INSUFFICIENT_COINS' || code === 'EMBLEM_ALREADY_OWNED') void q.refetch();
      toast.error("Couldn't buy that", friendlyMessage(e));
    }
  };

  return (
    <Screen
      title="Emblems & Shop"
      onBack={back}
      testID="coin-shop-screen"
      rightAction={
        <View style={styles.coinPill}>
          <Text style={styles.coinPillText} numberOfLines={1}>{shop ? coins.toLocaleString() : '-'} Coins</Text>
        </View>
      }
    >
      {q.isError && !shop ? (
        <ErrorState offline={toApiError(q.error).code === 'NETWORK_ERROR'} message={friendlyMessage(q.error)} onRetry={() => void q.refetch()} />
      ) : !shop || !activeEmblem ? (
        <AppLoader label="Loading shop..." />
      ) : (
        <View style={{ gap: 12 }}>
          {/* Equipped emblem */}
          <View style={[styles.heroCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <View style={[styles.badgeBox, { backgroundColor: activeEmblem.bg }]}>
                <Text style={[styles.badgeSymbol, { color: activeEmblem.fg }]}>{activeEmblem.badge}</Text>
              </View>
              <View style={{ flexShrink: 1, minWidth: 0 }}>
                <Text style={[styles.heroLabel, { color: c.accent }]}>EQUIPPED EMBLEM</Text>
                <Text style={[styles.heroName, { color: c.text }]}>{activeEmblem.name}</Text>
              </View>
            </View>
            <View style={styles.activeTag}>
              <Text style={styles.activeTagText}>Active</Text>
            </View>
          </View>

          {/* 2-column grid */}
          <View style={styles.grid}>
            {shop.emblems.map((it) => {
              const btnLabel = it.equipped ? 'Equipped' : it.unlocked ? 'Equip' : `${it.cost} Coins`;
              const btnBg = it.equipped ? '#EFF4FF' : it.unlocked ? '#F1F1EE' : c.accent;
              const btnFg = it.equipped ? c.accent : it.unlocked ? c.text : '#FFFFFF';
              return (
                <View key={it.id} style={styles.cell}>
                  <Pressy
                    accessibilityLabel={`${it.name}. ${btnLabel}`}
                    disabled={busy}
                    onPress={() => void onSelect(it)}
                    style={[styles.cardItem, { backgroundColor: c.bgCard, borderColor: it.equipped ? c.accent : c.border }]}
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
                    <View testID={`emblem-${it.id}`} style={[styles.actionBtn, { backgroundColor: btnBg }]}>
                      <Text style={[styles.actionBtnText, { color: btnFg }]}>{btnLabel}</Text>
                    </View>
                  </Pressy>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  coinPill: {
    paddingHorizontal: ms(10),
    paddingVertical: ms(4),
    borderRadius: 999,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  coinPillText: { fontSize: fs(10.5), fontFamily: fonts.mono.semibold, color: '#B45309' },
  heroCard: {
    padding: ms(14),
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badgeBox: { width: ms(44), height: ms(44), borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeSymbol: { fontSize: fs(15), fontFamily: fonts.mono.semibold },
  heroLabel: { fontSize: fs(10), fontFamily: fonts.body.semibold, letterSpacing: 0.8 },
  heroName: { fontSize: fs(12.5), fontFamily: fonts.body.semibold, marginTop: 1 },
  activeTag: { paddingHorizontal: ms(10), paddingVertical: ms(4), borderRadius: 8, backgroundColor: '#F0FDF4' },
  activeTagText: { fontSize: fs(10), fontFamily: fonts.body.semibold, color: '#15803D' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // flexBasis (not a % width) so two columns always fit next to the gap, on any phone width
  cell: { flexBasis: '45%', flexGrow: 1 },
  cardItem: { alignItems: 'center', gap: ms(8), padding: ms(12), borderRadius: 14, borderWidth: 1 },
  cardTitle: { fontSize: fs(11.5), fontFamily: fonts.body.semibold },
  cardSub: { fontSize: fs(11) },
  actionBtn: { width: '100%', paddingVertical: ms(8), borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontSize: fs(10.5), fontFamily: fonts.mono.semibold },
});
