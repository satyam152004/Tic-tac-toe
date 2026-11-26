import React, { useEffect, useState } from 'react';
import { Popup } from '../../components/common/Popup';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppButton } from '../../components/common/AppButton';
import { Pressy } from '../../components/common/Pressy';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { withAlpha } from '../../design-system/colors';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { shopApi, type EmblemShop, type EmblemView } from '../../services/api/shopApi';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

import { fs, ms } from '../../design-system/responsive';

type Filter = 'all' | 'owned' | 'locked';
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'owned', label: 'Owned' },
  { key: 'locked', label: 'Locked' },
];

/**
 * Popup sheet for emblems and the shop. Opened from the Daily Rewards page.
 * Tap an emblem to select it, then use the bottom button to equip or buy it.
 */
export const EmblemShopSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const c = useTheme();
  const qc = useQueryClient();
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const q = useQuery({ queryKey: ['shop', 'emblems'], queryFn: shopApi.emblems, enabled: signedIn && open });

  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Start fresh each time the sheet opens.
  useEffect(() => {
    if (open) {
      setFilter('all');
      setSelectedId(null);
    }
  }, [open]);

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
  const equipped = shop?.emblems.find((e) => e.equipped);
  const selected: EmblemView | undefined = shop?.emblems.find((e) => e.id === selectedId) ?? equipped ?? shop?.emblems[0];
  const visible = (shop?.emblems ?? []).filter((e) =>
    filter === 'all' ? true : filter === 'owned' ? e.unlocked : !e.unlocked,
  );

  const actionLabel = !selected
    ? 'Loading...'
    : selected.equipped
      ? 'Equipped'
      : selected.unlocked
        ? `Equip ${selected.name}`
        : `Buy ${selected.name} for ${selected.cost} coins`;

  const onAction = async () => {
    if (!selected || busy || selected.equipped) return;
    try {
      if (selected.unlocked) {
        await equip.mutateAsync(selected.id);
        toast.success('Emblem equipped', `${selected.name} is now on your profile`);
      } else {
        if (coins < selected.cost) {
          toast.warning('Not enough coins', `You need ${selected.cost - coins} more coins. Claim daily rewards to earn them.`);
          return;
        }
        await unlock.mutateAsync(selected.id);
        toast.success('Emblem unlocked', `${selected.name} is equipped`);
      }
    } catch (e) {
      const code = toApiError(e).code;
      if (code === 'INSUFFICIENT_COINS' || code === 'EMBLEM_ALREADY_OWNED') void q.refetch();
      toast.error("Couldn't buy that", friendlyMessage(e));
    }
  };

  return (
    <Popup open={open} layout="sheet" title="Emblems and shop" onDismiss={onClose} testID="emblem-shop-sheet">
      <View style={styles.headerRight}>
        <View style={[styles.coinPill, { backgroundColor: withAlpha(c.warning, 0.15), borderColor: withAlpha(c.warning, 0.4) }]}>
          <Text style={[styles.coinPillText, { color: c.warning }]} numberOfLines={1}>{shop ? coins.toLocaleString() : '-'} Coins</Text>
        </View>
      </View>

        {q.isError && !shop ? (
          <ErrorState offline={toApiError(q.error).code === 'NETWORK_ERROR'} message={friendlyMessage(q.error)} onRetry={() => void q.refetch()} />
        ) : !shop || !selected ? (
          <AppLoader label="Loading shop..." />
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              {/* Equipped emblem */}
              {equipped ? (
                <View style={[styles.equippedCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
                  <View style={[styles.badgeBox, { backgroundColor: equipped.bg }]}>
                    <Text style={[styles.badgeSymbol, { color: equipped.fg }]}>{equipped.badge}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.equippedLabel, { color: c.textSecondary }]}>Equipped</Text>
                    <Text style={[styles.equippedName, { color: c.text }]}>{equipped.name}</Text>
                  </View>
                  <View style={[styles.inUse, { backgroundColor: withAlpha(c.success, 0.15) }]}>
                    <Text style={[styles.inUseText, { color: c.success }]}>In use</Text>
                  </View>
                </View>
              ) : null}

              {/* Filters */}
              <View style={styles.filters}>
                {FILTERS.map((f) => {
                  const on = filter === f.key;
                  return (
                    <Pressy
                      key={f.key}
                      accessibilityLabel={`Show ${f.label}`}
                      onPress={() => setFilter(f.key)}
                      style={[
                        styles.chip,
                        on ? { backgroundColor: c.accent, borderColor: c.accent } : { backgroundColor: c.bgCard, borderColor: c.border },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: on ? c.onAccent : c.text }]}>{f.label}</Text>
                    </Pressy>
                  );
                })}
              </View>

              {/* Emblem grid */}
              <View style={styles.grid}>
                {visible.map((it) => {
                  const isSelected = selected.id === it.id;
                  const status = it.equipped ? 'Equipped' : it.unlocked ? 'Owned' : `${it.cost} coins`;
                  const statusColor = it.equipped || it.unlocked ? c.success : c.warning;
                  return (
                    <Pressy
                      key={it.id}
                      testID={`emblem-${it.id}`}
                      accessibilityLabel={`${it.name}, ${status}`}
                      onPress={() => setSelectedId(it.id)}
                      style={[
                        styles.item,
                        {
                          backgroundColor: c.bgCard,
                          borderColor: isSelected ? c.accent : c.border,
                          borderWidth: isSelected ? 1.5 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.itemBadge, { color: it.fg }]}>{it.badge}</Text>
                      <Text numberOfLines={1} style={[styles.itemName, { color: c.text }]}>{it.name}</Text>
                      <Text numberOfLines={1} style={[styles.itemStatus, { color: statusColor }]}>{status}</Text>
                    </Pressy>
                  );
                })}
                {visible.length === 0 ? (
                  <Text style={[styles.empty, { color: c.textSecondary }]}>Nothing here yet.</Text>
                ) : null}
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <AppButton
                testID="emblem-shop-action"
                fullWidth
                title={actionLabel}
                disabled={!selected || selected.equipped || busy}
                loading={busy}
                onPress={() => void onAction()}
              />
            </View>
          </>
        )}
    </Popup>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: ms(10),
    paddingHorizontal: 20,
    paddingBottom: ms(16),
  },
  handle: { alignSelf: 'center', width: ms(40), height: ms(4), borderRadius: 2, marginBottom: ms(12) },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: fs(18), fontFamily: fonts.body.semibold, flexShrink: 1 },
  coinPill: {
    paddingHorizontal: ms(10),
    paddingVertical: ms(5),
    borderRadius: 999,
    borderWidth: 1,
  },
  coinPillText: { fontSize: fs(10.5), fontFamily: fonts.mono.semibold },
  closeBtn: {
    width: ms(36),
    height: ms(36),
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { gap: 12, paddingBottom: 8 },
  equippedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: ms(12),
    borderRadius: 14,
    borderWidth: 1,
  },
  badgeBox: { width: ms(44), height: ms(44), borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeSymbol: { fontSize: fs(15), fontFamily: fonts.mono.semibold },
  equippedLabel: { fontSize: fs(11), fontFamily: fonts.body.regular },
  equippedName: { fontSize: fs(14), fontFamily: fonts.body.semibold, marginTop: 1 },
  inUse: { paddingHorizontal: ms(10), paddingVertical: ms(4), borderRadius: 8 },
  inUseText: { fontSize: fs(11), fontFamily: fonts.body.semibold },
  filters: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: ms(14), paddingVertical: ms(7), borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: fs(12.5), fontFamily: fonts.body.semibold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  item: {
    width: '31%',
    minHeight: ms(96),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: ms(8),
    borderRadius: 14,
  },
  itemBadge: { fontSize: fs(22), fontFamily: fonts.mono.semibold },
  itemName: { fontSize: fs(11.5), fontFamily: fonts.body.semibold },
  itemStatus: { fontSize: fs(10.5), fontFamily: fonts.body.regular },
  empty: { width: '100%', textAlign: 'center', paddingVertical: 16, fontSize: fs(12) },
  footer: { paddingTop: 12 },
});
