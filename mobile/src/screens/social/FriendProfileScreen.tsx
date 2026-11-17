import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ban, Check, Flag, ShieldOff, Swords, UserMinus, UserPlus, X } from 'lucide-react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppModal, ConfirmDialog } from '../../components/common/AppModal';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { ScoreCard } from '../../components/profile/Cards';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useBlocked, useFriendActions, useFriends, usePublicProfile } from '../../hooks/queries';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { toApiError } from '../../services/api/errors';
import { userApi } from '../../services/api/userApi';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { isOffline, socialError, useChallenge } from './socialShared';

type Reason = 'CHEATING' | 'ABUSE' | 'SPAM' | 'INAPPROPRIATE_NAME' | 'OTHER';
const REASONS: Array<{ id: Reason; label: string }> = [
  { id: 'CHEATING', label: 'Cheating' },
  { id: 'ABUSE', label: 'Abusive behaviour' },
  { id: 'SPAM', label: 'Spam' },
  { id: 'INAPPROPRIATE_NAME', label: 'Inappropriate name' },
  { id: 'OTHER', label: 'Something else' },
];

type Confirm = 'remove' | 'block' | 'unblock' | null;

export const FriendProfileScreen: React.FC<RootScreenProps<'friend_profile'>> = ({ route }) => {
  const { userId } = route.params;
  const c = useTheme();
  const { back, goTab } = useAppNav();
  const me = useAuthStore((s) => s.user);
  const profile = usePublicProfile(userId);
  const accepted = useFriends('accepted');
  const incoming = useFriends('incoming');
  const outgoing = useFriends('outgoing');
  const blocked = useBlocked();
  const actions = useFriendActions();
  const { challenge, sheet } = useChallenge();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const friend = accepted.data?.items.find((f) => f.user.id === userId);
  const inc = incoming.data?.items.find((f) => f.user.id === userId);
  const out = outgoing.data?.items.find((f) => f.user.id === userId);
  const isBlocked = !!blocked.data?.items.some((u) => u.id === userId);

  if (profile.isLoading) {
    return (
      <Screen title="Profile" onBack={back}>
        <AppLoader label="Loading profile..." />
      </Screen>
    );
  }
  if (profile.isError) {
    const err = toApiError(profile.error);
    if (err.status === 404 || err.code === 'USER_NOT_FOUND' || err.code === 'NOT_FOUND') {
      return (
        <Screen title="Profile" onBack={back}>
          <EmptyState title="Player not found" description="This player doesn't exist or is no longer available." actionLabel="Go back" onAction={back} />
        </Screen>
      );
    }
    const off = isOffline(profile.error);
    return (
      <Screen title="Profile" onBack={back}>
        <ErrorState offline={off} message={off ? 'Connect to the internet to view this profile.' : err.message} onRetry={() => void profile.refetch()} />
      </Screen>
    );
  }
  const p = profile.data;
  if (!p) return null;

  const name = p.displayName || p.username;
  const isSelf = p.id === me?.id;
  const s = p.stats;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error('Something went wrong', socialError(e));
    }
  };

  const doConfirm = () => {
    const kind = confirm;
    setConfirm(null);
    if (kind === 'remove' && friend) void run(() => actions.remove.mutateAsync(friend.friendshipId), 'Friend removed');
    if (kind === 'block') void run(() => actions.block.mutateAsync(p.id), `${name} blocked`);
    if (kind === 'unblock') void run(() => actions.unblock.mutateAsync(p.id), `${name} unblocked`);
  };

  const confirmCopy = {
    remove: { title: 'Remove friend?', message: `${name} will be removed from your friends list.`, label: 'Remove', destructive: true },
    block: { title: `Block ${name}?`, message: 'They will no longer be able to challenge you, and any friendship is removed.', label: 'Block', destructive: true },
    unblock: { title: `Unblock ${name}?`, message: 'They will be able to send you friend requests again.', label: 'Unblock', destructive: false },
  };
  const cc = confirm ? confirmCopy[confirm] : null;

  return (
    <Screen title={name} onBack={back} footer={!isSelf && !isBlocked && friend ? <AppButton testID="profile-challenge" title="Challenge to Match" fullWidth icon={<Swords size={16} color="#fff" />} onPress={() => challenge(p.id, name)} /> : undefined}>
      <AppCard style={{ alignItems: 'center', gap: 12 }}>
        <AppAvatar avatarId={p.avatar} name={name} size="xl" status={p.online ? 'online' : 'offline'} activeRing />
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text style={[type.headline, { color: c.text }]}>{name}</Text>
          <Text style={[type.small, { color: c.textSecondary }]}>@{p.username} · {p.online ? 'Online' : 'Offline'}</Text>
          <Text style={[type.num, { color: c.textSecondary, fontSize: 12 }]}>Level {s.level} · {s.points} Rating</Text>
        </View>
        {p.bio ? <Text style={[type.body, { color: c.textSecondary, textAlign: 'center' }]}>{p.bio}</Text> : null}
      </AppCard>

      <View style={styles.grid}>
        <View style={styles.cell}><ScoreCard label="Wins" value={s.wins} tone="success" /></View>
        <View style={styles.cell}><ScoreCard label="Losses" value={s.losses} /></View>
        <View style={styles.cell}><ScoreCard label="Draws" value={s.draws} /></View>
      </View>
      <View style={styles.grid}>
        <View style={styles.cell}><ScoreCard label="Win Rate" value={`${Math.round(s.winPercentage)}%`} tone="accent" /></View>
        <View style={styles.cell}><ScoreCard label="Streak" value={s.currentStreak} tone="warning" /></View>
        <View style={styles.cell}><ScoreCard label="Best Streak" value={s.bestStreak} /></View>
      </View>

      {isSelf ? (
        <AppButton title="View my profile" variant="secondary" fullWidth onPress={() => goTab('ProfileTab')} />
      ) : (
        <View style={{ gap: 10 }}>
          {isBlocked ? (
            <AppButton testID="profile-unblock" title="Unblock" variant="secondary" fullWidth icon={<ShieldOff size={16} color={c.text} />} onPress={() => setConfirm('unblock')} />
          ) : (
            <>
              {friend ? (
                <AppButton testID="profile-remove" title="Remove friend" variant="outline" fullWidth icon={<UserMinus size={16} color={c.text} />} onPress={() => setConfirm('remove')} />
              ) : inc ? (
                <View style={styles.pair}>
                  <AppButton testID="profile-accept" title="Accept" style={{ flex: 1 }} icon={<Check size={16} color="#fff" />} onPress={() => void run(() => actions.accept.mutateAsync(inc.friendshipId), `You and ${name} are now friends`)} />
                  <AppButton testID="profile-reject" title="Decline" variant="outline" style={{ flex: 1 }} icon={<X size={16} color={c.text} />} onPress={() => void run(() => actions.reject.mutateAsync(inc.friendshipId), 'Request declined')} />
                </View>
              ) : out ? (
                <AppButton testID="profile-cancel" title="Cancel request" variant="outline" fullWidth onPress={() => void run(() => actions.remove.mutateAsync(out.friendshipId), 'Request cancelled')} />
              ) : (
                <AppButton testID="profile-add" title="Add friend" fullWidth icon={<UserPlus size={16} color="#fff" />} onPress={() => void run(() => actions.request.mutateAsync({ userId: p.id }), 'Friend request sent')} />
              )}
              <AppButton testID="profile-block" title="Block" variant="danger" fullWidth icon={<Ban size={16} color="#F87171" />} onPress={() => setConfirm('block')} />
            </>
          )}
          <AppButton testID="profile-report" title="Report" variant="ghost" fullWidth icon={<Flag size={16} color={c.textSecondary} />} onPress={() => setReportOpen(true)} />
        </View>
      )}

      <ConfirmDialog open={!!cc} title={cc?.title ?? ''} message={cc?.message ?? ''} confirmLabel={cc?.label} destructive={cc?.destructive} onCancel={() => setConfirm(null)} onConfirm={doConfirm} />
      <ReportSheet open={reportOpen} name={name} onClose={() => setReportOpen(false)} userId={p.id} />
      {sheet}
    </Screen>
  );
};

const ReportSheet: React.FC<{ open: boolean; name: string; userId: string; onClose: () => void }> = ({ open, name, userId, onClose }) => {
  const c = useTheme();
  const [busy, setBusy] = useState(false);
  const send = async (reason: Reason) => {
    setBusy(true);
    try {
      await userApi.report(userId, reason);
      toast.success('Report sent', 'Thanks, our team will review it.');
      onClose();
    } catch (e) {
      toast.error('Could not send report', socialError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppModal open={open} title={`Report ${name}`} onClose={onClose}>
      <Text style={[type.body, { color: c.textSecondary }]}>Why are you reporting this player?</Text>
      {REASONS.map((r) => (
        <AppButton key={r.id} testID={`report-${r.id}`} title={r.label} variant="secondary" fullWidth disabled={busy} onPress={() => void send(r.id)} />
      ))}
    </AppModal>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1 },
  pair: { flexDirection: 'row', gap: 10 },
});
