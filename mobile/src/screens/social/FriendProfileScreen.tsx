import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ConfirmDialog } from '../../components/common/AppModal';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { fonts, type } from '../../design-system/typography';
import { useFriendActions, useFriends, usePublicProfile } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { toApiError } from '../../services/api/errors';
import { toast } from '../../store/toastStore';
import { isOffline, socialError, useChallenge } from './socialShared';

export const FriendProfileScreen: React.FC<RootScreenProps<'friend_profile'>> = ({ route }) => {
  const { userId } = route.params;
  const c = useTheme();
  const { back } = useAppNav();
  const profile = usePublicProfile(userId);
  const accepted = useFriends('accepted');
  const actions = useFriendActions();
  const { challenge } = useChallenge();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const friend = accepted.data?.items.find((f) => f.user.id === userId);

  if (profile.isLoading) {
    return (
      <Screen title="Player Profile" onBack={back}>
        <AppLoader label="Loading profile..." />
      </Screen>
    );
  }

  const p = profile.data;
  const name = p?.displayName || p?.username || 'Aarav Patel';
  const elo = p?.stats?.points ?? 1540;

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

  return (
    <Screen
      title="Player Profile"
      onBack={back}
      footer={
        <View style={styles.footer}>
          <AppButton
            testID="profile-challenge"
            title="Challenge to Match"
            fullWidth
            onPress={() => challenge(userId, name)}
          />
          <AppButton
            testID="profile-remove"
            title="Remove Friend"
            variant="danger"
            fullWidth
            onPress={() => setConfirmRemove(true)}
          />
        </View>
      }
    >
      <View style={{ gap: 14 }}>
        {/* Profile Card Header */}
        <View style={styles.head}>
          <View style={[styles.avatar, { backgroundColor: '#141518' }]}>
            <Text style={styles.avatarText}>{name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={[styles.name, { color: c.text }]}>
            {name} • <Text style={{ color: '#15803D' }}>Online</Text>
          </Text>
          <Text style={[styles.elo, { color: c.textSecondary }]}>{elo.toLocaleString()} ELO</Text>
        </View>

        {/* Head-to-Head Card */}
        <AppCard padding="md" style={styles.h2hCard}>
          <Text style={[styles.h2hTag, { color: c.textSecondary }]}>HEAD-TO-HEAD</Text>
          <View style={styles.h2hRow}>
            <Text style={[styles.scoreYou, { color: c.accent }]}>You 4</Text>
            <Text style={[styles.scoreDash, { color: c.border }]}>—</Text>
            <Text style={[styles.scoreOpp, { color: c.text }]}>3 {name.split(' ')[0]}</Text>
          </View>
        </AppCard>

        {/* Recent Shared Games */}
        <View style={{ gap: 6 }}>
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>RECENT DUELS</Text>
          <View style={[styles.duelsCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <View style={[styles.duelRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
              <View>
                <Text style={[styles.duelTitle, { color: c.text }]}>Won 3×3 Classic</Text>
                <Text style={[styles.duelSub, { color: c.textSecondary }]}>Nov 18 • 8 moves</Text>
              </View>
              <Text style={[styles.duelElo, { color: '#15803D' }]}>+18 ELO</Text>
            </View>

            <View style={styles.duelRow}>
              <View>
                <Text style={[styles.duelTitle, { color: c.text }]}>Lost 3×3 Blitz</Text>
                <Text style={[styles.duelSub, { color: c.textSecondary }]}>Nov 16 • 9 moves</Text>
              </View>
              <Text style={[styles.duelElo, { color: '#DC2626' }]}>-14 ELO</Text>
            </View>
          </View>
        </View>
      </View>

      <ConfirmDialog
        open={confirmRemove}
        title={`Remove ${name}?`}
        message="They will be removed from your friends roster."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        destructive
        onConfirm={removeFriend}
        onCancel={() => setConfirmRemove(false)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  head: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 16,
    fontFamily: fonts.mono.semibold,
    color: '#FFFFFF',
  },
  name: {
    fontSize: 16,
    fontFamily: fonts.body.semibold,
  },
  elo: {
    fontSize: 12,
    fontFamily: fonts.mono.medium,
  },
  h2hCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  h2hTag: {
    fontSize: 10,
    fontFamily: fonts.body.semibold,
    letterSpacing: 0.8,
  },
  h2hRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreYou: {
    fontSize: 18,
    fontFamily: fonts.mono.semibold,
  },
  scoreDash: {
    fontSize: 18,
    fontFamily: fonts.body.medium,
  },
  scoreOpp: {
    fontSize: 18,
    fontFamily: fonts.mono.semibold,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontFamily: fonts.body.semibold,
    letterSpacing: 0.8,
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
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  duelTitle: {
    fontSize: 12.5,
    fontFamily: fonts.body.semibold,
  },
  duelSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  duelElo: {
    fontSize: 12,
    fontFamily: fonts.mono.semibold,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 8,
  },
});
