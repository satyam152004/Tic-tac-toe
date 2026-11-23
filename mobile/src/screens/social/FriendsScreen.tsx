import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ConfirmDialog } from '../../components/common/AppModal';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { fonts } from '../../design-system/typography';
import { useBlocked, useFriendActions, useFriends } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import { toast } from '../../store/toastStore';
import { AddFriendSearchSheet } from './AddFriendSearchSheet';
import { isOffline, socialError, useChallenge } from './socialShared';

import { fs, ms } from '../../design-system/responsive';
export const FriendsScreen: React.FC = () => {
  const c = useTheme();
  const { nav } = useAppNav();
  const [tab, setTab] = useState<'friends' | 'requests' | 'blocked'>('friends');
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<{ friendshipId: string; name: string } | null>(null);
  const accepted = useFriends('accepted');
  const incoming = useFriends('incoming');
  const outgoing = useFriends('outgoing');
  const blocked = useBlocked();
  const actions = useFriendActions();
  const { challenge, sheet } = useChallenge();

  const friends = accepted.data?.items ?? [];
  const inc = incoming.data?.items ?? [];
  const out = outgoing.data?.items ?? [];
  const blk = blocked.data?.items ?? [];
  const reqTotal = inc.length + out.length;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error('Something went wrong', socialError(e));
    }
  };

  const refresh = () => void Promise.all([accepted.refetch(), incoming.refetch(), outgoing.refetch(), blocked.refetch()]);
  const refreshing = accepted.isRefetching || incoming.isRefetching || outgoing.isRefetching || blocked.isRefetching;

  return (
    <Screen
      title="Friends"
      tabs
      scroll={false}
      padded={false}
      rightAction={
        <Pressy
          testID="friends-add-button"
          hitSlop={4}
          onPress={() => setAddOpen(true)}
          style={styles.addBtn}
        >
          <Text style={styles.addBtnText} numberOfLines={1}>+ Add</Text>
        </Pressy>
      }
    >
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
        {/* 3-tab Segment: Friends, Requests, Blocked */}
        <View style={[styles.segment, { backgroundColor: c.bgSecondary, borderColor: c.border }]}>
          <Pressy
            testID="friends-segment-friends"
            onPress={() => setTab('friends')}
            style={[styles.segmentBtn, tab === 'friends' && [styles.segmentBtnActive, { backgroundColor: c.bgCard }]]}
          >
            <Text style={[styles.segmentText, { color: tab === 'friends' ? c.accent : c.textSecondary }]}>
              Friends {friends.length}
            </Text>
          </Pressy>

          <Pressy
            testID="friends-segment-requests"
            onPress={() => setTab('requests')}
            style={[styles.segmentBtn, tab === 'requests' && [styles.segmentBtnActive, { backgroundColor: c.bgCard }]]}
          >
            <Text style={[styles.segmentText, { color: tab === 'requests' ? c.accent : c.textSecondary }]}>
              Requests {reqTotal}
            </Text>
          </Pressy>

          <Pressy
            testID="friends-segment-blocked"
            onPress={() => setTab('blocked')}
            style={[styles.segmentBtn, tab === 'blocked' && [styles.segmentBtnActive, { backgroundColor: c.bgCard }]]}
          >
            <Text style={[styles.segmentText, { color: tab === 'blocked' ? c.accent : c.textSecondary }]}>
              Blocked {blk.length}
            </Text>
          </Pressy>
        </View>

        {/* Content list */}
        {accepted.isError && !accepted.data ? (
          <ErrorState
            offline={isOffline(accepted.error)}
            message={isOffline(accepted.error) ? 'Connect to the internet to see your friends.' : socialError(accepted.error)}
            onRetry={() => void accepted.refetch()}
          />
        ) : tab === 'friends' ? (
          <FlatList
            testID="friends-list"
            data={friends}
            keyExtractor={(i) => i.friendshipId}
            ListEmptyComponent={
              <EmptyState title="No friends yet" description="Add friends to play matches together." />
            }
            renderItem={({ item: f }) => {
              const name = f.user.displayName || f.user.username;
              return (
                <View style={[styles.row, { borderBottomColor: c.border }]}>
                  <Pressy
                    onPress={() => nav.navigate('friend_profile', { userId: f.user.id, friendshipId: f.friendshipId })}
                    onLongPress={() => setRemoving({ friendshipId: f.friendshipId, name })}
                    accessibilityHint="Press and hold to remove this friend"
                    style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  >
                    <View style={styles.avatarWrap}>
                      <View style={[styles.avatar, { backgroundColor: '#F1F1EE' }]}>
                        <Text style={[styles.avatarText, { color: c.text }]}>{name.slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <View style={[styles.dot, { backgroundColor: f.activeGameId ? '#B45309' : f.user.online ? '#15803D' : '#CFCFC8' }]} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[styles.name, { color: c.text }]}>{name}</Text>
                      <Text numberOfLines={2} style={[styles.sub, { color: c.textSecondary }]}>
                        {f.activeGameId ? 'In Match' : f.user.online ? 'Online' : 'Offline'} • Level {f.user.level}
                      </Text>
                    </View>
                  </Pressy>

                  {f.activeGameId ? (
                    <Pressy
                      testID={`spectate-${f.user.id}`}
                      accessibilityLabel={`Spectate ${name}`}
                      onPress={() => nav.navigate('spectate_match', { gameId: f.activeGameId as string, friendName: f.user.displayName })}
                      style={[styles.actionPill, { backgroundColor: '#F1F1EE' }]}
                    >
                      <Text style={[styles.actionPillText, { color: '#141518' }]}>Spectate</Text>
                    </Pressy>
                  ) : (
                    <Pressy
                      testID={`challenge-${f.user.id}`}
                      accessibilityLabel={`Challenge ${name}`}
                      onPress={() => challenge(f.user.id, name)}
                      style={[styles.actionPill, { backgroundColor: f.user.online ? '#EFF4FF' : '#F8F8F6' }]}
                    >
                      <Text style={[styles.actionPillText, { color: f.user.online ? '#1D4ED8' : '#8E939E' }]}>Challenge</Text>
                    </Pressy>
                  )}
                </View>
              );
            }}
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
          />
        ) : tab === 'requests' ? (
          <FlatList
            data={[...inc.map((r) => ({ ...r, dir: 'in' as const })), ...out.map((r) => ({ ...r, dir: 'out' as const }))]}
            keyExtractor={(i) => i.dir + i.friendshipId}
            ListEmptyComponent={
              <EmptyState title="No requests" description="You have no friend requests." />
            }
            renderItem={({ item: r }) => {
              const name = r.user.displayName || r.user.username;
              return (
                <View style={[styles.row, { borderBottomColor: c.border }]}>
                  <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.avatarWrap}>
                      <View style={[styles.avatar, { backgroundColor: '#EFF4FF' }]}>
                        <Text style={[styles.avatarText, { color: c.accent }]}>{name.slice(0, 2).toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[styles.name, { color: c.text }]}>{name}</Text>
                      <Text numberOfLines={2} style={[styles.sub, { color: c.textSecondary }]}>
                        Level {r.user.level} • {r.dir === 'in' ? 'Wants to be friends' : 'Request sent'}
                      </Text>
                    </View>
                  </View>
                  {r.dir === 'in' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <Pressy
                      testID={`decline-${r.user.id}`}
                      accessibilityLabel={`Decline ${name}`}
                      onPress={() => void run(() => actions.reject.mutateAsync(r.friendshipId), 'Request declined')}
                      style={[styles.actionPill, { backgroundColor: '#F1F1EE' }]}
                    >
                      <Text style={[styles.actionPillText, { color: '#141518' }]}>Decline</Text>
                    </Pressy>
                    <Pressy
                      accessibilityLabel={`Accept ${name}`}
                      onPress={() => void run(() => actions.accept.mutateAsync(r.friendshipId), `Added ${name}`)}
                      style={[styles.actionPill, { backgroundColor: c.accent }]}
                    >
                      <Text style={[styles.actionPillText, { color: '#FFFFFF' }]}>Accept</Text>
                    </Pressy>
                    </View>
                  ) : (
                    <Pressy
                      accessibilityLabel={`Cancel request to ${name}`}
                      onPress={() => void run(() => actions.remove.mutateAsync(r.friendshipId), 'Request cancelled')}
                      style={[styles.actionPill, { backgroundColor: '#F1F1EE' }]}
                    >
                      <Text style={[styles.actionPillText, { color: '#141518' }]}>Cancel</Text>
                    </Pressy>
                  )}
                </View>
              );
            }}
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 24 }}
          />
        ) : (
          <FlatList
            data={blk}
            keyExtractor={(i) => i.id}
            ListEmptyComponent={
              <EmptyState title="No blocked players" description="You haven't blocked anyone." />
            }
            renderItem={({ item: b }) => (
              <View style={[styles.row, { borderBottomColor: c.border }]}>
                <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.avatar, { backgroundColor: '#FEF2F2' }]}>
                    <Text style={[styles.avatarText, { color: '#B91C1C' }]}>{(b.displayName || b.username).slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[styles.name, { color: c.text }]}>{b.displayName || b.username}</Text>
                    <Text numberOfLines={2} style={[styles.sub, { color: c.textSecondary }]}>Blocked</Text>
                  </View>
                </View>
                <Pressy
                  onPress={() => void run(() => actions.unblock.mutateAsync(b.id), 'Unblocked')}
                  style={[styles.actionPill, { backgroundColor: '#FEF2F2' }]}
                >
                  <Text style={[styles.actionPillText, { color: '#B91C1C' }]}>Unblock</Text>
                </Pressy>
              </View>
            )}
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 24 }}
          />
        )}
      </View>

      <AddFriendSearchSheet open={addOpen} onClose={() => setAddOpen(false)} />
      {sheet}
      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.name ?? ''}?`}
        message="They'll be removed from your friends list."
        confirmLabel="Remove"
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) void run(() => actions.remove.mutateAsync(target.friendshipId), 'Friend removed');
        }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  addBtn: {
    paddingHorizontal: 12,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#EFF4FF',
  },
  addBtnText: {
    fontSize: fs(11.5),
    fontFamily: fonts.body.semibold,
    color: '#1D4ED8',
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: fs(12),
    fontFamily: fonts.body.semibold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: ms(10),
    minHeight: 64,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fs(12),
    fontFamily: fonts.mono.semibold,
  },
  dot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: ms(11),
    height: ms(11),
    borderRadius: ms(5.5),
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  name: {
    fontSize: fs(12),
    fontFamily: fonts.body.semibold,
  },
  sub: {
    fontSize: fs(11),
    fontFamily: fonts.mono.medium,
    marginTop: 2,
  },
  actionPill: {
    paddingHorizontal: ms(12),
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 10,
  },
  actionPillText: {
    fontSize: fs(11.5),
    fontFamily: fonts.body.semibold,
  },
});
