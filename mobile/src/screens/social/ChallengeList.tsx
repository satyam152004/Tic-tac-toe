import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressy } from '../../components/common/Pressy';
import { fs, ms } from '../../design-system/responsive';
import { fonts, type } from '../../design-system/typography';
import { useInvites } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import { gameApi } from '../../services/api/gameApi';
import type { GameInvite, PlayerCard } from '../../services/api/types';
import { joinGame } from '../../services/onlineActions';
import { toast } from '../../store/toastStore';
import { socialError } from './socialShared';

const nameOf = (p: PlayerCard | null): string => (p ? p.displayName || p.username : 'a friend');

const timeOf = (iso: string): string => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Friend challenges waiting for an answer. Incoming ones can be accepted or declined; outgoing ones can be cancelled.
 * Shows nothing when there are no waiting challenges.
 */
export const ChallengeList: React.FC = () => {
  const c = useTheme();
  const { nav } = useAppNav();
  const invites = useInvites();
  const [busy, setBusy] = useState<string | null>(null);

  const incoming = invites.data?.incoming ?? [];
  const outgoing = invites.data?.outgoing ?? [];
  if (incoming.length === 0 && outgoing.length === 0) return null;

  const refresh = () => void invites.refetch();

  const accept = async (i: GameInvite) => {
    setBusy(i.game.id);
    try {
      await joinGame(i.game.id);
      nav.replace('match_found', { gameId: i.game.id, source: 'FRIEND', opponentName: nameOf(i.from) });
    } catch (e) {
      setBusy(null);
      toast.error("Couldn't accept the challenge", socialError(e));
      refresh();
    }
  };

  const decline = async (i: GameInvite) => {
    setBusy(i.game.id);
    try {
      await gameApi.decline(i.game.id);
      toast.info('Challenge declined');
    } catch (e) {
      toast.error("Couldn't decline the challenge", socialError(e));
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const cancel = async (i: GameInvite) => {
    setBusy(i.game.id);
    try {
      await gameApi.cancelInvite(i.game.id);
      toast.info('Challenge cancelled');
    } catch (e) {
      toast.error("Couldn't cancel the challenge", socialError(e));
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const details = (i: GameInvite) =>
    `${i.game.boardSize}×${i.game.boardSize} • ${i.game.entryAmount ? `${i.game.entryAmount} coins` : 'Free'} • expires ${timeOf(i.expiresAt)}`;

  return (
    <View testID="challenge-list" style={styles.wrap}>
      <Text style={[type.caption, { color: c.textSecondary }]}>GAME CHALLENGES</Text>

      {incoming.map((i) => (
        <View key={`in-${i.game.id}`} testID={`challenge-in-${i.game.id}`} style={[styles.row, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={styles.info}>
            <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text }]}>{`${nameOf(i.from)} challenged you`}</Text>
            <Text numberOfLines={1} style={[type.small, { color: c.textSecondary }]}>{details(i)}</Text>
          </View>
          <View style={styles.actions}>
            <Pressy
              testID={`challenge-decline-${i.game.id}`}
              accessibilityLabel={`Decline challenge from ${nameOf(i.from)}`}
              disabled={busy === i.game.id}
              onPress={() => void decline(i)}
              style={[styles.pill, { backgroundColor: c.bgElevated }]}
            >
              <Text style={[styles.pillText, { color: c.text }]}>Decline</Text>
            </Pressy>
            <Pressy
              testID={`challenge-accept-${i.game.id}`}
              accessibilityLabel={`Accept challenge from ${nameOf(i.from)}`}
              disabled={busy === i.game.id}
              onPress={() => void accept(i)}
              style={[styles.pill, { backgroundColor: c.accent }]}
            >
              <Text style={[styles.pillText, { color: c.onAccent }]}>Accept</Text>
            </Pressy>
          </View>
        </View>
      ))}

      {outgoing.map((o) => (
        <View key={`out-${o.game.id}`} testID={`challenge-out-${o.game.id}`} style={[styles.row, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={styles.info}>
            <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text }]}>{`Waiting for ${nameOf(o.to)}`}</Text>
            <Text numberOfLines={1} style={[type.small, { color: c.textSecondary }]}>{details(o)}</Text>
          </View>
          <View style={styles.actions}>
            <Pressy
              testID={`challenge-cancel-${o.game.id}`}
              accessibilityLabel={`Cancel challenge to ${nameOf(o.to)}`}
              disabled={busy === o.game.id}
              onPress={() => void cancel(o)}
              style={[styles.pill, { backgroundColor: c.bgElevated }]}
            >
              <Text style={[styles.pillText, { color: c.text }]}>Cancel</Text>
            </Pressy>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: ms(8), paddingBottom: ms(8) },
  row: { flexDirection: 'row', alignItems: 'center', gap: ms(8), padding: ms(12), borderRadius: 14, borderWidth: 1 },
  info: { flex: 1, minWidth: 0, gap: ms(2) },
  actions: { flexDirection: 'row', gap: ms(6), flexShrink: 0 },
  pill: { paddingHorizontal: ms(12), minHeight: ms(36), justifyContent: 'center', borderRadius: 10 },
  pillText: { ...type.overline, },
});
