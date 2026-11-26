import { type } from '../../design-system/typography';
import type { ThemeColors } from '../../design-system/colors';
import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { EllipsisVertical, Search, UserPlus, X } from 'lucide-react-native';
import { Popup, type PopupAction } from '../../components/common/Popup';
import { ConfirmDialog } from '../../components/common/AppModal';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { fonts } from '../../design-system/typography';
import { withAlpha } from '../../design-system/colors';
import { useBlocked, useFriendActions, useFriends, useInvites } from '../../hooks/queries';
import { joinGame } from '../../services/onlineActions';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import { toast } from '../../store/toastStore';
import { AddFriendSearchSheet } from './AddFriendSearchSheet';
import { isOffline, socialError, useChallenge } from './socialShared';
import { ChallengeList } from './ChallengeList';
import { ReportPlayerModal } from './ReportPlayerModal';

import { fs, ms } from '../../design-system/responsive';
export const FriendsScreen: React.FC = () => {
  const c = useTheme();
  const styles = makeStyles(c);
  const { nav } = useAppNav();
  const [tab, setTab] = useState<'friends' | 'requests' | 'blocked'>('friends');
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [removing, setRemoving] = useState<{ friendshipId: string; name: string } | null>(null);
  // The row's three-dot menu, and the follow-up dialogs it opens.
  const [menuFor, setMenuFor] = useState<{ friendshipId: string; userId: string; name: string } | null>(null);
  const [blocking, setBlocking] = useState<{ userId: string; name: string } | null>(null);
  const [reporting, setReporting] = useState<{ userId: string; name: string } | null>(null);
  const accepted = useFriends('accepted');
  const incoming = useFriends('incoming');
  const outgoing = useFriends('outgoing');
  const blocked = useBlocked();
  const actions = useFriendActions();
  const { challenge } = useChallenge();
  const invites = useInvites();
  // Friends who have sent you a challenge that is still waiting: their card shows a Join button.
  const challengeFrom = new Map(
    (invites.data?.incoming ?? []).filter((i) => i.from).map((i) => [i.from!.id, i] as const),
  );

  const joinChallenge = async (gameId: string, name: string) => {
    try {
      await joinGame(gameId);
      nav.replace('match_found', { gameId, source: 'FRIEND', opponentName: name });
    } catch (e) {
      toast.error("Couldn't join the challenge", socialError(e));
    }
  };

  // Tab labels show the full counts; the lists below show only what matches the search.
  const friendsAll = accepted.data?.items ?? [];
  const incAll = incoming.data?.items ?? [];
  const outAll = outgoing.data?.items ?? [];
  const blkAll = blocked.data?.items ?? [];
  const reqTotal = incAll.length + outAll.length;

  const q = query.trim().toLowerCase();
  const matches = (u: { displayName?: string; username: string }) =>
    !q || (u.displayName ?? '').toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
  const friends = friendsAll.filter((f) => matches(f.user));
  const inc = incAll.filter((r) => matches(r.user));
  const out = outAll.filter((r) => matches(r.user));
  const blk = blkAll.filter((b) => matches(b));
  const noMatch = <EmptyState title="No matches" description={`Nothing matches "${query.trim()}".`} />;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error('Something went wrong', socialError(e));
    }
  };

  /** Actions for the friend row's menu. Each one closes the menu first, then opens its own dialog or screen. */
  const menuActions = (m: { friendshipId: string; userId: string; name: string } | null): PopupAction[] => {
    if (!m) return [];
    const close = () => setMenuFor(null);
    return [
      { testID: 'friend-menu-challenge', label: 'Challenge', variant: 'primary', onPress: () => { close(); challenge(m.userId, m.name); } },
      { testID: 'friend-menu-report', label: 'Report player', variant: 'secondary', onPress: () => { close(); setReporting({ userId: m.userId, name: m.name }); } },
      { testID: 'friend-menu-block', label: 'Block player', variant: 'danger', onPress: () => { close(); setBlocking({ userId: m.userId, name: m.name }); } },
      { testID: 'friend-menu-remove', label: 'Remove friend', variant: 'danger', onPress: () => { close(); setRemoving({ friendshipId: m.friendshipId, name: m.name }); } },
    ];
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
          accessibilityLabel="Add friend"
          hitSlop={8}
          onPress={() => setAddOpen(true)}
          style={[styles.addBtn, { backgroundColor: withAlpha(c.accent, 0.12) }]}
        >
          <UserPlus size={ms(20)} color={c.accent} />
        </Pressy>
      }
    >
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
        {/* Search: filters the friends, requests and blocked lists by name or username */}
        <View testID="friends-search" style={[styles.search, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Search size={ms(16)} color={c.textSecondary} />
          <TextInput
            testID="friends-search-input"
            accessibilityLabel="Search friends"
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or username"
            placeholderTextColor={c.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.searchInput, { color: c.text }]}
          />
          {query ? (
            <Pressy testID="friends-search-clear" accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')}>
              <X size={ms(16)} color={c.textSecondary} />
            </Pressy>
          ) : null}
        </View>

        {/* 3-tab Segment: Friends, Requests, Blocked */}
        <View style={[styles.segment, { backgroundColor: c.bgSecondary, borderColor: c.border }]}>
          <Pressy
            testID="friends-segment-friends"
            onPress={() => setTab('friends')}
            style={[styles.segmentBtn, tab === 'friends' && [styles.segmentBtnActive, { backgroundColor: c.bgCard }]]}
          >
            <Text style={[styles.segmentText, { color: tab === 'friends' ? c.accent : c.textSecondary }]}>
              Friends {friendsAll.length}
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
              Blocked {blkAll.length}
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
            ListEmptyComponent={q ? noMatch : <EmptyState title="No friends yet" description="Add friends to play matches together." />}
            renderItem={({ item: f }) => {
              const name = f.user.displayName || f.user.username;
              return (
                <View style={[styles.row, { borderBottomColor: c.border }]}>
                  <Pressy
                    onPress={() => nav.navigate('friend_profile', { userId: f.user.id, friendshipId: f.friendshipId })}
                    style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  >
                    <View style={styles.avatarWrap}>
                      <View style={[styles.avatar, { backgroundColor: c.bgSecondary }]}>
                        <Text style={[styles.avatarText, { color: c.text }]}>{name.slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <View style={[styles.dot, { backgroundColor: f.activeGameId ? c.warning : f.user.online ? c.success : c.border }]} />
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
                      style={[styles.actionPill, { backgroundColor: c.bgSecondary }]}
                    >
                      <Text style={[styles.actionPillText, { color: c.text }]}>Spectate</Text>
                    </Pressy>
                  ) : (
                    <Pressy
                      testID={`challenge-${f.user.id}`}
                      accessibilityLabel={`Challenge ${name}`}
                      onPress={() => challenge(f.user.id, name)}
                      style={[styles.actionPill, { backgroundColor: f.user.online ? withAlpha(c.accent, 0.12) : c.bgSecondary }]}
                    >
                      <Text style={[styles.actionPillText, { color: f.user.online ? c.accent : c.textSecondary }]}>Challenge</Text>
                    </Pressy>
                  )}

                  {challengeFrom.get(f.user.id) ? (
                    <Pressy
                      testID={`join-${f.user.id}`}
                      accessibilityLabel={`Join ${name}'s challenge`}
                      onPress={() => {
                        const invite = challengeFrom.get(f.user.id);
                        if (invite) void joinChallenge(invite.game.id, name);
                      }}
                      style={[styles.actionPill, { backgroundColor: c.accent }]}
                    >
                      <Text style={[styles.actionPillText, { color: c.onAccent }]}>Join</Text>
                    </Pressy>
                  ) : null}

                  <Pressy
                    testID={`friend-menu-${f.user.id}`}
                    accessibilityLabel={`More options for ${name}`}
                    hitSlop={8}
                    onPress={() => setMenuFor({ friendshipId: f.friendshipId, userId: f.user.id, name })}
                    style={styles.moreBtn}
                  >
                    <EllipsisVertical size={ms(20)} color={c.textSecondary} />
                  </Pressy>
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
            ListHeaderComponent={<ChallengeList />}
            ListEmptyComponent={q ? noMatch : <EmptyState title="No requests" description="You have no friend requests." />}
            renderItem={({ item: r }) => {
              const name = r.user.displayName || r.user.username;
              return (
                <View style={[styles.row, { borderBottomColor: c.border }]}>
                  <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.avatarWrap}>
                      <View style={[styles.avatar, { backgroundColor: withAlpha(c.accent, 0.12) }]}>
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
                      style={[styles.actionPill, { backgroundColor: c.bgSecondary }]}
                    >
                      <Text style={[styles.actionPillText, { color: c.text }]}>Decline</Text>
                    </Pressy>
                    <Pressy
                      accessibilityLabel={`Accept ${name}`}
                      onPress={() => void run(() => actions.accept.mutateAsync(r.friendshipId), `Added ${name}`)}
                      style={[styles.actionPill, { backgroundColor: c.accent }]}
                    >
                      <Text style={[styles.actionPillText, { color: c.bgCard }]}>Accept</Text>
                    </Pressy>
                    </View>
                  ) : (
                    <Pressy
                      accessibilityLabel={`Cancel request to ${name}`}
                      onPress={() => void run(() => actions.remove.mutateAsync(r.friendshipId), 'Request cancelled')}
                      style={[styles.actionPill, { backgroundColor: c.bgSecondary }]}
                    >
                      <Text style={[styles.actionPillText, { color: c.text }]}>Cancel</Text>
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
            ListEmptyComponent={q ? noMatch : <EmptyState title="No blocked players" description="You haven't blocked anyone." />}
            renderItem={({ item: b }) => (
              <View style={[styles.row, { borderBottomColor: c.border }]}>
                <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.avatar, { backgroundColor: c.dangerSoft }]}>
                    <Text style={[styles.avatarText, { color: c.dangerText }]}>{(b.displayName || b.username).slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[styles.name, { color: c.text }]}>{b.displayName || b.username}</Text>
                    <Text numberOfLines={2} style={[styles.sub, { color: c.textSecondary }]}>Blocked</Text>
                  </View>
                </View>
                <Pressy
                  onPress={() => void run(() => actions.unblock.mutateAsync(b.id), 'Unblocked')}
                  style={[styles.actionPill, { backgroundColor: c.dangerSoft }]}
                >
                  <Text style={[styles.actionPillText, { color: c.dangerText }]}>Unblock</Text>
                </Pressy>
              </View>
            )}
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 24 }}
          />
        )}
      </View>

      <AddFriendSearchSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <Popup
        open={!!menuFor}
        layout="center"
        title={menuFor?.name ?? ''}
        onDismiss={() => setMenuFor(null)}
        testID="friend-menu"
        actions={menuActions(menuFor)}
      />

      <ReportPlayerModal open={!!reporting} userId={reporting?.userId ?? ''} playerName={reporting?.name} onClose={() => setReporting(null)} />

      <ConfirmDialog
        open={!!blocking}
        title={`Block ${blocking?.name ?? ''}?`}
        message="They'll be removed from your friends, and neither of you can challenge the other."
        confirmLabel="Block"
        destructive
        onCancel={() => setBlocking(null)}
        onConfirm={() => {
          const target = blocking;
          setBlocking(null);
          if (target) void run(() => actions.block.mutateAsync(target.userId), 'Player blocked');
        }}
      />

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

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  addBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    minHeight: 44,
    paddingHorizontal: ms(12),
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchInput: { ...type.small, flex: 1,
    minWidth: 0,
    paddingVertical: ms(8),
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
  segmentText: { ...type.caption, },
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
  avatarText: { ...type.num, },
  dot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: ms(11),
    height: ms(11),
    borderRadius: ms(5.5),
    borderWidth: 1.5,
    borderColor: c.bgCard,
  },
  name: { ...type.caption, },
  sub: { ...type.num, marginTop: 2,
  },
  moreBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  actionPill: {
    paddingHorizontal: ms(12),
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 10,
  },
  actionPillText: { ...type.overline, },
});
