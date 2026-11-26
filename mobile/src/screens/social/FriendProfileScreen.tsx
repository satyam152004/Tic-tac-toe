import type { ThemeColors } from '../../design-system/colors';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ConfirmDialog } from '../../components/common/AppModal';
import { Pressy } from '../../components/common/Pressy';
import { ReportPlayerModal } from './ReportPlayerModal';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { fonts, type } from '../../design-system/typography';
import { useFriendActions, useFriends, useHistory, usePublicProfile } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { toApiError } from '../../services/api/errors';
import { toast } from '../../store/toastStore';
import { formatShortDate } from '../../utils/format';
import { isOffline, socialError, useChallenge } from './socialShared';

import { fs, ms } from '../../design-system/responsive';
export const FriendProfileScreen: React.FC<RootScreenProps<'friend_profile'>> = ({ route }) => {
  const { userId } = route.params;
  const c = useTheme();
  const styles = makeStyles(c);
  const { back } = useAppNav();
  const profile = usePublicProfile(userId);
  const accepted = useFriends('accepted');
  const actions = useFriendActions();
  const { challenge } = useChallenge();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const friend = accepted.data?.items.find((f) => f.user.id === userId);
  const history = useHistory({});
  // Shared games come from my own recent history (no head-to-head endpoint exists).
  const shared = (history.data?.items ?? []).filter((g) => g.opponent && 'id' in g.opponent && g.opponent.id === userId && g.result);
  const myWins = shared.filter((g) => g.result === 'WIN').length;
  const theirWins = shared.filter((g) => g.result === 'LOSS').length;
  const typeLabel = (t: string) => (t === 'ONLINE_RANDOM' ? 'Ranked' : t === 'FRIEND' || t === 'PRIVATE_ROOM' ? 'Private' : 'Casual');

  if (profile.isError && !profile.data) {
    const offline = isOffline(profile.error);
    return (
      <Screen title="Player Profile" onBack={back}>
        <ErrorState offline={offline} message={offline ? 'Connect to the internet to see this profile.' : toApiError(profile.error).message} onRetry={() => void profile.refetch()} />
      </Screen>
    );
  }

  if (profile.isLoading) {
    return (
      <Screen title="Player Profile" onBack={back}>
        <AppLoader label="Loading profile..." />
      </Screen>
    );
  }

  const p = profile.data;
  const name = p?.displayName || p?.username || 'Player';
  const elo = p?.stats?.points ?? 0;

  const blockPlayer = async () => {
    setConfirmBlock(false);
    try {
      await actions.block.mutateAsync(userId);
      toast.success(`${name} blocked`);
      back();
    } catch (e) {
      toast.error("Couldn't block this player", socialError(e));
    }
  };

  const removeFriend = async () => {
    setConfirmRemove(false);
    if (!friend) return;
    try {
      await actions.remove.mutateAsync(friend.friendshipId);
      toast.success('Friend removed');
      back();
    } catch (e) {
      toast.error('Something went wrong', socialError(e));
    }
  };

  const addFriend = async () => {
    try {
      await actions.request.mutateAsync({ userId });
      toast.success('Friend request sent', `We sent a request to ${name}`);
    } catch (e) {
      toast.error("Couldn't send the request", socialError(e));
    }
  };

  return (
    <Screen
      title="Player Profile"
      onBack={back}
      footer={
        <View style={styles.footer}>
          {friend ? (
            <>
              <AppButton testID="profile-challenge" title="Challenge" fullWidth onPress={() => challenge(userId, name)} />
              <AppButton testID="profile-remove" title="Remove Friend" variant="secondary" fullWidth onPress={() => setConfirmRemove(true)} />
            </>
          ) : (
            <AppButton
              testID="profile-add-friend"
              title="Add Friend"
              fullWidth
              loading={actions.request.isPending}
              onPress={() => void addFriend()}
            />
          )}
        </View>
      }
    >
      <View style={{ gap: 14 }}>
        {/* Profile Card Header */}
        <View style={styles.head}>
          <View style={[styles.avatar, { backgroundColor: c.text }]}>
            <Text style={styles.avatarText}>{name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={[styles.name, { color: c.text, textAlign: 'center' }]}>
            {name} • <Text style={{ color: friend?.activeGameId ? c.warning : p?.online ? c.success : c.textSecondary }}>{friend?.activeGameId ? 'In Match' : p?.online ? 'Online' : 'Offline'}</Text>
          </Text>
          <Text style={[styles.elo, { color: c.textSecondary }]}>{elo.toLocaleString()} pts</Text>
        </View>

        {/* Head-to-Head Card */}
        <AppCard padding="md" style={styles.h2hCard}>
          <Text style={[styles.h2hTag, { color: c.textSecondary }]}>HEAD-TO-HEAD</Text>
          <View style={styles.h2hRow}>
            <Text style={[styles.scoreYou, { color: c.accent }]}>You {myWins}</Text>
            <Text style={[styles.scoreDash, { color: c.border }]}>—</Text>
            <Text style={[styles.scoreOpp, { color: c.text }]}>{theirWins} {name.split(' ')[0]}</Text>
          </View>
        </AppCard>

        {/* Recent Shared Games */}
        {shared.length > 0 ? (
          <View style={[styles.duelsCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            {shared.slice(0, 5).map((g, i) => (
              <View
                key={g.id}
                style={[styles.duelRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}
              >
                <Text numberOfLines={1} style={[styles.duelTitle, { color: c.text, flex: 1 }]}>
                  {g.boardSize}×{g.boardSize} {typeLabel(g.type)} • {formatShortDate(g.playedAt)}
                </Text>
                <Text style={[styles.duelElo, { color: g.result === 'WIN' ? c.success : c.textSecondary }]}>
                  {g.result === 'WIN' ? 'You Won' : g.result === 'LOSS' ? `${name.split(' ')[0]} Won` : 'Draw'}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text testID="no-shared-games" style={[styles.duelSub, { color: c.textSecondary, textAlign: 'center' }]}>
            No games played together yet.
          </Text>
        )}

        <Pressy
          testID="profile-block"
          accessibilityRole="button"
          accessibilityLabel={`Block ${name}`}
          onPress={() => setConfirmBlock(true)}
          style={{ alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 12 }}
        >
          <Text style={{ fontSize: fs(12.5), color: c.dangerText }}>Block player</Text>
        </Pressy>

        <Pressy testID="profile-report" accessibilityRole="button" accessibilityLabel={`Report ${name}`} onPress={() => setReporting(true)} style={{ alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 12 }}>
          <Text style={{ fontSize: fs(12.5), color: c.textSecondary }}>Report player</Text>
        </Pressy>
      </View>

      <ReportPlayerModal open={reporting} userId={userId} playerName={name} onClose={() => setReporting(false)} />

      <ConfirmDialog
        open={confirmRemove}
        title={`Remove ${name}?`}
        message="They'll be removed from your friends list."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        destructive
        onConfirm={removeFriend}
        onCancel={() => setConfirmRemove(false)}
      />

      <ConfirmDialog
        open={confirmBlock}
        title={`Block ${name}?`}
        message="They'll be removed from your friends, and neither of you can challenge the other."
        confirmLabel="Block"
        cancelLabel="Cancel"
        destructive
        onConfirm={blockPlayer}
        onCancel={() => setConfirmBlock(false)}
      />
    </Screen>
  );
};

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  head: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
  },
  avatar: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { ...type.num, color: c.bgCard,
  },
  name: { ...type.button, },
  elo: { ...type.num, },
  h2hCard: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: ms(14),
  },
  h2hTag: { ...type.overline, letterSpacing: 0.8,
  },
  h2hRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(16),
  },
  scoreYou: { ...type.numLarge, },
  scoreDash: { ...type.bodySmall, },
  scoreOpp: { ...type.numLarge, },
  sectionLabel: { ...type.overline, letterSpacing: 0.8,
  },
  duelsCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  duelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(14),
    paddingVertical: ms(10),
    minHeight: 48,
    gap: 8,
  },
  duelTitle: { ...type.caption, },
  duelSub: {
    fontSize: fs(12),
    marginTop: 1,
  },
  duelElo: { ...type.num, },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 8,
  },
});
