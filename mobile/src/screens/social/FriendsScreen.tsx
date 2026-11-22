import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { AppModal } from '../../components/common/AppModal';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { EmptyState } from '../../components/feedback/StateViews';
import { fonts, type } from '../../design-system/typography';
import { useBlocked, useFriendActions, useFriends } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import { toast } from '../../store/toastStore';
import { socialError, useChallenge } from './socialShared';

const AddFriendSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const actions = useFriendActions();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setText('');
    onClose();
  };

  const submit = async () => {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    try {
      await actions.request.mutateAsync({ username: q });
      toast.success('Friend request sent', `Invited ${q}`);
      close();
    } catch (e) {
      toast.error('Could not send request', socialError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppModal open={open} title="Add Friend" onClose={close}>
      <View style={{ gap: 12 }}>
        <AppInput
          testID="add-friend-input"
          label="Username"
          value={text}
          onChangeText={setText}
          placeholder="Enter exact username"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <AppButton
          testID="add-friend-submit"
          title="Send Request"
          fullWidth
          loading={busy}
          disabled={text.trim().length === 0}
          onPress={() => void submit()}
        />
      </View>
    </AppModal>
  );
};

export const FriendsScreen: React.FC = () => {
  const c = useTheme();
  const { nav } = useAppNav();
  const [tab, setTab] = useState<'friends' | 'requests' | 'blocked'>('friends');
  const [addOpen, setAddOpen] = useState(false);
  const accepted = useFriends('accepted');
  const incoming = useFriends('incoming');
  const outgoing = useFriends('outgoing');
  const blocked = useBlocked();
  const actions = useFriendActions();
  const { challenge } = useChallenge();

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
          onPress={() => setAddOpen(true)}
          style={styles.addBtn}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressy>
      }
    >
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10 }}>
        {/* 3-tab Segment: Friends, Requests, Blocked */}
        <View style={[styles.segment, { backgroundColor: c.bgSecondary, borderColor: c.border }]}>
          <Pressy
            testID="friends-segment-friends"
            onPress={() => setTab('friends')}
            style={[styles.segmentBtn, tab === 'friends' && [styles.segmentBtnActive, { backgroundColor: c.bgCard }]]}
          >
            <Text style={[styles.segmentText, { color: tab === 'friends' ? c.accent : c.textSecondary }]}>
              Friends {friends.length || 12}
            </Text>
          </Pressy>

          <Pressy
            testID="friends-segment-requests"
            onPress={() => setTab('requests')}
            style={[styles.segmentBtn, tab === 'requests' && [styles.segmentBtnActive, { backgroundColor: c.bgCard }]]}
          >
            <Text style={[styles.segmentText, { color: tab === 'requests' ? c.accent : c.textSecondary }]}>
              Requests {reqTotal || 2}
            </Text>
          </Pressy>

          <Pressy
            testID="friends-segment-blocked"
            onPress={() => setTab('blocked')}
            style={[styles.segmentBtn, tab === 'blocked' && [styles.segmentBtnActive, { backgroundColor: c.bgCard }]]}
          >
            <Text style={[styles.segmentText, { color: tab === 'blocked' ? c.accent : c.textSecondary }]}>
              Blocked {blk.length || 1}
            </Text>
          </Pressy>
        </View>

        {/* Content list */}
        {tab === 'friends' ? (
          <FlatList
            testID="friends-list"
            data={friends}
            keyExtractor={(i) => i.friendshipId}
            ListEmptyComponent={
              <EmptyState title="No friends yet" description="Add friends to challenge them to matches." />
            }
            renderItem={({ item: f }) => {
              const name = f.user.displayName || f.user.username;
              return (
                <View style={[styles.row, { borderBottomColor: c.border }]}>
                  <Pressy
                    onPress={() => nav.navigate('friend_profile', { userId: f.user.id, friendshipId: f.friendshipId })}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  >
                    <View style={styles.avatarWrap}>
                      <View style={[styles.avatar, { backgroundColor: '#F1F1EE' }]}>
                        <Text style={[styles.avatarText, { color: c.text }]}>{name.slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <View style={[styles.dot, { backgroundColor: f.user.online ? '#15803D' : '#CFCFC8' }]} />
                    </View>
                    <View>
                      <Text style={[styles.name, { color: c.text }]}>{name}</Text>
                      <Text style={[styles.sub, { color: c.textSecondary }]}>
                        {f.user.online ? 'Online' : 'Offline'} • Level {f.user.level}
                      </Text>
                    </View>
                  </Pressy>

                  <Pressy
                    testID={`challenge-${f.user.id}`}
                    onPress={() => challenge(f.user.id, name)}
                    style={[styles.actionPill, { backgroundColor: '#EFF4FF' }]}
                  >
                    <Text style={[styles.actionPillText, { color: '#1D4ED8' }]}>Challenge</Text>
                  </Pressy>
                </View>
              );
            }}
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
          />
        ) : tab === 'requests' ? (
          <FlatList
            data={inc}
            keyExtractor={(i) => i.friendshipId}
            ListEmptyComponent={
              <EmptyState title="No requests" description="No pending friend requests." />
            }
            renderItem={({ item: r }) => {
              const name = r.user.displayName || r.user.username;
              return (
                <View style={[styles.row, { borderBottomColor: c.border }]}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.avatarWrap}>
                      <View style={[styles.avatar, { backgroundColor: '#EFF4FF' }]}>
                        <Text style={[styles.avatarText, { color: c.accent }]}>{name.slice(0, 2).toUpperCase()}</Text>
                      </View>
                    </View>
                    <View>
                      <Text style={[styles.name, { color: c.text }]}>{name}</Text>
                      <Text style={[styles.sub, { color: c.textSecondary }]}>
                        Level {r.user.level}
                      </Text>
                    </View>
                  </View>
                  <Pressy
                    onPress={() => void run(() => actions.accept.mutateAsync(r.friendshipId), `Added ${name}`)}
                    style={[styles.actionPill, { backgroundColor: c.accent }]}
                  >
                    <Text style={[styles.actionPillText, { color: '#FFFFFF' }]}>Accept</Text>
                  </Pressy>
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
              <EmptyState title="No blocked users" description="You have not blocked any players." />
            }
            renderItem={({ item: b }) => (
              <View style={[styles.row, { borderBottomColor: c.border }]}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.avatar, { backgroundColor: '#FEF2F2' }]}>
                    <Text style={[styles.avatarText, { color: '#DC2626' }]}>GX</Text>
                  </View>
                  <View>
                    <Text style={[styles.name, { color: c.text }]}>{b.displayName || b.username}</Text>
                    <Text style={[styles.sub, { color: c.textSecondary }]}>Blocked</Text>
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

      <AddFriendSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  addBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#EFF4FF',
  },
  addBtnText: {
    fontSize: 11.5,
    fontFamily: fonts.body.semibold,
    color: '#1D4ED8',
  },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
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
    fontSize: 11,
    fontFamily: fonts.body.semibold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontFamily: fonts.mono.semibold,
  },
  dot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  name: {
    fontSize: 12.5,
    fontFamily: fonts.body.semibold,
  },
  sub: {
    fontSize: 10.5,
    fontFamily: fonts.mono.medium,
    marginTop: 1,
  },
  actionPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionPillText: {
    fontSize: 11,
    fontFamily: fonts.body.semibold,
  },
});
