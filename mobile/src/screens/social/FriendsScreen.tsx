import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ban, Check, Search, Swords, UserMinus, UserPlus, X } from 'lucide-react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { AppModal, ConfirmDialog } from '../../components/common/AppModal';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useBlocked, useFriendActions, useFriends } from '../../hooks/queries';
import { useAppNav } from '../../navigation/useAppNav';
import { toApiError } from '../../services/api/errors';
import { userApi } from '../../services/api/userApi';
import type { FriendItem, PlayerCard } from '../../services/api/types';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { isOffline, socialError, useChallenge } from './socialShared';

type Row =
  | { key: string; kind: 'header'; label: string }
  | { key: string; kind: 'friend' | 'incoming' | 'outgoing'; item: FriendItem };

const sheetIconBtn = { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' } as const;

export const FriendsScreen: React.FC = () => {
  const c = useTheme();
  const { nav } = useAppNav();
  const [segment, setSegment] = useState<'friends' | 'requests'>('friends');
  const [filter, setFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [removing, setRemoving] = useState<FriendItem | null>(null);
  const accepted = useFriends('accepted');
  const incoming = useFriends('incoming');
  const outgoing = useFriends('outgoing');
  const actions = useFriendActions();
  const { challenge, sheet } = useChallenge();

  const friends = accepted.data?.items ?? [];
  const inc = incoming.data?.items ?? [];
  const out = outgoing.data?.items ?? [];
  const requestCount = inc.length + out.length;
  const onlineCount = friends.filter((f) => f.user.online).length;
  const active = segment === 'friends' ? accepted : incoming.isLoading || incoming.isError ? incoming : outgoing.isLoading || outgoing.isError ? outgoing : incoming;

  const rows = useMemo<Row[]>(() => {
    if (segment === 'friends') {
      const needle = filter.trim().toLowerCase();
      return friends
        .filter((f) => !needle || f.user.username.toLowerCase().includes(needle) || f.user.displayName.toLowerCase().includes(needle))
        .map((f) => ({ key: f.friendshipId, kind: 'friend' as const, item: f }));
    }
    const list: Row[] = [];
    if (inc.length) {
      list.push({ key: 'h-in', kind: 'header', label: `Incoming (${inc.length})` });
      inc.forEach((f) => list.push({ key: f.friendshipId, kind: 'incoming', item: f }));
    }
    if (out.length) {
      list.push({ key: 'h-out', kind: 'header', label: `Sent (${out.length})` });
      out.forEach((f) => list.push({ key: f.friendshipId, kind: 'outgoing', item: f }));
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, filter, accepted.data, incoming.data, outgoing.data]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error('Something went wrong', socialError(e));
    }
  };
  const refresh = () => void Promise.all([accepted.refetch(), incoming.refetch(), outgoing.refetch()]);
  const refreshing = accepted.isRefetching || incoming.isRefetching || outgoing.isRefetching;

  const header = (
    <View style={{ gap: 16 }}>
      <View style={[styles.segments, { backgroundColor: c.bgCard, borderColor: c.border }]}>
        {(['friends', 'requests'] as const).map((s) => {
          const on = s === segment;
          const label = s === 'friends' ? `Friends (${friends.length})` : `Requests (${requestCount})`;
          return (
            <Pressy
              key={s}
              testID={`friends-segment-${s}`}
              accessibilityLabel={label}
              accessibilityState={{ selected: on }}
              onPress={() => setSegment(s)}
              style={[styles.segment, { backgroundColor: on ? c.accent : 'transparent' }]}
            >
              <Text style={[type.smallStrong, { color: on ? '#fff' : c.textSecondary }]}>{label}</Text>
            </Pressy>
          );
        })}
      </View>
      {segment === 'friends' ? (
        <AppInput testID="friends-filter" value={filter} onChangeText={setFilter} placeholder="Search friends by username..." leftIcon={<Search size={16} color={c.textSecondary} />} autoCapitalize="none" autoCorrect={false} />
      ) : null}
    </View>
  );

  const renderRow = ({ item: row }: { item: Row }) => {
    if (row.kind === 'header') return <Text style={[type.smallStrong, { color: c.textSecondary, marginTop: 4 }]}>{row.label}</Text>;
    const { user } = row.item;
    const name = user.displayName || user.username;
    const who = (
      <Pressy
        testID={`friend-open-${user.id}`}
        accessibilityLabel={`Open ${name}'s profile`}
        onPress={() => nav.navigate('friend_profile', { userId: user.id, friendshipId: row.item.friendshipId })}
        style={styles.who}
      >
        <AppAvatar avatarId={user.avatar} name={name} size="sm" status={user.online ? 'online' : 'offline'} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text }]}>{name}</Text>
          <Text numberOfLines={1} style={[type.caption, { color: c.textSecondary }]}>
            {row.kind === 'friend' ? `${user.online ? 'Online' : 'Offline'} · Level ${user.level}` : `Level ${user.level} · @${user.username}`}
          </Text>
        </View>
      </Pressy>
    );
    return (
      <AppCard padding="sm" style={styles.row}>
        {who}
        {row.kind === 'friend' ? (
          <>
            <AppButton testID={`challenge-${user.id}`} title="Challenge" size="md" variant="secondary" icon={<Swords size={16} color={c.accent} />} onPress={() => challenge(user.id, name)} />
            <Pressy testID={`remove-${user.id}`} accessibilityLabel={`Remove ${name}`} onPress={() => setRemoving(row.item)} style={[sheetIconBtn, { borderColor: c.border }]}>
              <UserMinus size={18} color={c.textSecondary} />
            </Pressy>
          </>
        ) : row.kind === 'incoming' ? (
          <>
            <AppButton testID={`accept-${user.id}`} title="Accept" size="md" icon={<Check size={16} color="#fff" />} onPress={() => void run(() => actions.accept.mutateAsync(row.item.friendshipId), `You and ${name} are now friends`)} />
            <Pressy testID={`reject-${user.id}`} accessibilityLabel={`Decline ${name}`} onPress={() => void run(() => actions.reject.mutateAsync(row.item.friendshipId))} style={[sheetIconBtn, { borderColor: c.border }]}>
              <X size={18} color={c.textSecondary} />
            </Pressy>
          </>
        ) : (
          <AppButton testID={`cancel-${user.id}`} title="Cancel" size="md" variant="outline" onPress={() => void run(() => actions.remove.mutateAsync(row.item.friendshipId), 'Request cancelled')} />
        )}
      </AppCard>
    );
  };

  let empty: React.ReactNode = null;
  if (active.isLoading) empty = <AppLoader label="Loading friends..." />;
  else if (active.isError) {
    const off = isOffline(active.error);
    empty = <ErrorState offline={off} message={off ? 'Connect to the internet to see your friends.' : toApiError(active.error).message} onRetry={refresh} />;
  } else if (segment === 'friends') {
    empty = filter.trim() ? (
      <EmptyState title="No Friends Found" description="Try another search or add new rivals from the leaderboard." />
    ) : (
      <EmptyState title="No friends yet" description="Add friends by username to challenge them." actionLabel="Add a friend" onAction={() => setAddOpen(true)} />
    );
  } else empty = <EmptyState title="No pending requests" description="Friend requests you send or receive show up here." />;

  return (
    <Screen
      title="Friends"
      subtitle={`${onlineCount} online`}
      tabs
      scroll={false}
      padded={false}
      rightAction={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressy testID="friends-blocked" accessibilityLabel="Blocked players" onPress={() => setBlockedOpen(true)} style={[sheetIconBtn, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <Ban size={18} color={c.textSecondary} />
          </Pressy>
          <Pressy testID="friends-add" accessibilityLabel="Add friend" onPress={() => setAddOpen(true)} style={[sheetIconBtn, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <UserPlus size={18} color={c.accent} />
          </Pressy>
        </View>
      }
    >
      <FlatList
        testID="friends-list"
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderRow}
        ListHeaderComponent={header}
        ListEmptyComponent={<>{empty}</>}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
      />

      <AddFriendSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <BlockedSheet open={blockedOpen} onClose={() => setBlockedOpen(false)} />
      <ConfirmDialog
        open={!!removing}
        destructive
        title="Remove friend?"
        message={`${removing?.user.displayName ?? 'This player'} will be removed from your friends list.`}
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const r = removing;
          setRemoving(null);
          if (r) void run(() => actions.remove.mutateAsync(r.friendshipId), 'Friend removed');
        }}
      />
      {sheet}
    </Screen>
  );
};

const AddFriendSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const c = useTheme();
  const me = useAuthStore((s) => s.user);
  const actions = useFriendActions();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<PlayerCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const q = text.trim().replace(/^@/, '');

  useEffect(() => {
    if (!open || q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let live = true;
    setSearching(true);
    const t = setTimeout(() => {
      userApi
        .search(q)
        .then((r) => live && setResults(r.items.filter((u) => u.id !== me?.id)))
        .catch(() => live && setResults([]))
        .finally(() => live && setSearching(false));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, open, me?.id]);

  const close = () => {
    setText('');
    setError(null);
    setResults([]);
    setSent({});
    onClose();
  };

  const submit = async () => {
    if (q.length < 3) {
      setError('Enter a username of at least 3 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await actions.request.mutateAsync({ username: q });
      toast.success('Friend request sent', `Invited ${q}`);
      close();
    } catch (e) {
      setError(socialError(e));
    } finally {
      setBusy(false);
    }
  };

  const addResult = async (u: PlayerCard) => {
    try {
      await actions.request.mutateAsync({ userId: u.id });
      setSent((s) => ({ ...s, [u.id]: true }));
      toast.success('Friend request sent', `Invited ${u.displayName || u.username}`);
    } catch (e) {
      toast.error('Could not send request', socialError(e));
    }
  };

  return (
    <AppModal open={open} title="Add friend" onClose={close}>
      <AppInput
        testID="add-friend-input"
        label="Username"
        value={text}
        onChangeText={(v) => {
          setText(v);
          setError(null);
        }}
        placeholder="Search or enter a username"
        autoCapitalize="none"
        autoCorrect={false}
        error={error}
        leftIcon={<Search size={16} color={c.textSecondary} />}
        onSubmitEditing={() => void submit()}
      />
      <AppButton testID="add-friend-submit" title="Send request" fullWidth loading={busy} icon={<UserPlus size={16} color="#fff" />} onPress={() => void submit()} />
      {searching ? <Text style={[type.small, { color: c.textSecondary }]}>Searching...</Text> : null}
      {results.map((u) => (
        <View key={u.id} style={styles.result}>
          <AppAvatar avatarId={u.avatar} name={u.displayName || u.username} size="sm" status={u.online ? 'online' : 'offline'} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text }]}>{u.displayName || u.username}</Text>
            <Text numberOfLines={1} style={[type.caption, { color: c.textSecondary }]}>@{u.username} · Level {u.level}</Text>
          </View>
          <AppButton testID={`add-result-${u.id}`} title={sent[u.id] ? 'Sent' : 'Add'} size="md" variant="secondary" disabled={sent[u.id]} onPress={() => void addResult(u)} />
        </View>
      ))}
    </AppModal>
  );
};

const BlockedSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const c = useTheme();
  const blocked = useBlocked();
  const actions = useFriendActions();
  const items = blocked.data?.items ?? [];
  return (
    <AppModal open={open} title="Blocked players" onClose={onClose}>
      {blocked.isLoading ? (
        <Text style={[type.body, { color: c.textSecondary }]}>Loading...</Text>
      ) : blocked.isError ? (
        <ErrorState offline={isOffline(blocked.error)} message={toApiError(blocked.error).message} onRetry={() => void blocked.refetch()} />
      ) : items.length === 0 ? (
        <Text style={[type.body, { color: c.textSecondary }]}>You have not blocked anyone.</Text>
      ) : (
        items.map((u) => (
          <View key={u.id} style={styles.result}>
            <AppAvatar avatarId={u.avatar} name={u.displayName || u.username} size="sm" />
            <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text, flex: 1 }]}>{u.displayName || u.username}</Text>
            <AppButton
              testID={`unblock-${u.id}`}
              title="Unblock"
              size="md"
              variant="outline"
              onPress={() =>
                void actions.unblock
                  .mutateAsync(u.id)
                  .then(() => toast.success('Player unblocked'))
                  .catch((e) => toast.error('Could not unblock', socialError(e)))
              }
            />
          </View>
        ))
      )}
    </AppModal>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  segments: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 16, borderWidth: 1 },
  segment: { flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  who: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
