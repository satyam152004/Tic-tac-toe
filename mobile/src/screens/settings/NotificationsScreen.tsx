import React, { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Gift, Trash2 } from 'lucide-react-native';
import { AppIconButton } from '../../components/common/AppIconButton';
import { Group, SectionLabel } from '../../components/profile/ProtoUi';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { fonts } from '../../design-system/typography';
import { useDailyReward, useNotifications } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { notificationApi } from '../../services/api/notificationApi';
import type { NotificationItem } from '../../services/api/types';
import { toast } from '../../store/toastStore';
import { timeAgo } from '../../utils/format';

import { fs, ms } from '../../design-system/responsive';
interface Inbox { items: NotificationItem[]; unread: number; total: number }

type NotificationFilter = 'all' | 'unread' | 'requests';
const FILTERS: Array<{ key: NotificationFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'requests', label: 'Requests' },
];
/** Notifications that ask the user to respond: friend requests, game invites and rematch requests. */
const REQUEST_TYPES: string[] = ['FRIEND_REQUEST', 'GAME_INVITE', 'REMATCH_REQUEST'];

export const NotificationsScreen: React.FC<RootScreenProps<'notifications'>> = () => {
  const c = useTheme();
  const { nav, goTab, back } = useAppNav();
  const qc = useQueryClient();
  const q = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  // Live reward status, shown as a "Daily reward ready" row while a reward can be claimed.
  const reward = useDailyReward();
  const rewardDay = reward.data?.cycle.find((d) => d.status === 'claimable')?.day ?? null;
  const rewardReady = !!reward.data?.canClaim && rewardDay !== null;
  const showReward = rewardReady && filter !== 'requests';

  const patch = (fn: (d: Inbox) => Inbox) => qc.setQueryData<Inbox>(['notifications'], (d) => (d ? fn(d) : d));

  const route = (n: NotificationItem) => {
    const d = n.data ?? {};
    switch (n.type) {
      case 'FRIEND_REQUEST':
      case 'FRIEND_ACCEPTED':
        goTab('FriendsTab');
        break;
      case 'GAME_INVITE':
        nav.navigate('match_invitation', { gameId: d.gameId, roomCode: d.roomCode, fromName: d.fromName ?? d.fromDisplayName });
        break;
      case 'REMATCH_REQUEST':
        if (d.gameId) nav.navigate('online_board', { gameId: d.gameId });
        break;
      case 'MATCH_FOUND':
        if (d.gameId) nav.navigate('match_found', { gameId: d.gameId, source: 'RANKED' });
        break;
      case 'ACHIEVEMENT_UNLOCKED':
        nav.navigate('achievements');
        break;
      case 'LEVEL_UP':
        goTab('ProfileTab');
        break;
      case 'OPPONENT_JOINED':
        // Friend accepted a game invite (gameId), or someone joined your private room (roomId).
        if (d.gameId) nav.navigate('match_found', { gameId: d.gameId, source: 'FRIEND' });
        else if (d.roomId) nav.navigate('room_details', { roomId: d.roomId });
        break;
      case 'ACCOUNT':
        nav.navigate('settings');
        break;
      default:
        break;
    }
  };

  const open = (n: NotificationItem) => {
    if (!n.readAt) {
      patch((d) => ({ ...d, unread: Math.max(0, d.unread - 1), items: d.items.map((i) => (i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i)) }));
      notificationApi.read(n.id).catch(() => void q.refetch());
    }
    route(n);
  };

  const markAll = async () => {
    try {
      await notificationApi.readAll();
      const now = new Date().toISOString();
      patch((d) => ({ ...d, unread: 0, items: d.items.map((i) => ({ ...i, readAt: i.readAt ?? now })) }));
    } catch (e) {
      toast.error("Couldn't mark as read", friendlyMessage(e));
    }
  };

  const remove = async (n: NotificationItem) => {
    try {
      await notificationApi.remove(n.id);
      patch((d) => ({ ...d, total: Math.max(0, d.total - 1), unread: n.readAt ? d.unread : Math.max(0, d.unread - 1), items: d.items.filter((i) => i.id !== n.id) }));
    } catch (e) {
      toast.error("Couldn't delete notification", friendlyMessage(e));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await q.refetch();
    setRefreshing(false);
  };

  const err = q.error && !q.data ? toApiError(q.error) : null;
  const unread = q.data?.unread ?? 0;

  const items = q.data?.items ?? [];
  const filtered = items.filter((i) =>
    filter === 'all' ? true : filter === 'unread' ? !i.readAt : REQUEST_TYPES.includes(i.type),
  );
  const unreadItems = filtered.filter((i) => !i.readAt);
  const earlier = filtered.filter((i) => !!i.readAt);

  const renderRow = (n: NotificationItem) => (
    <View key={n.id} testID={`notification-${n.id}`} style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 8, minHeight: 56 }}>
      <Pressy
        testID={`notification-open-${n.id}`}
        accessibilityLabel={`${n.title}. ${n.body}${n.readAt ? '' : '. Unread'}`}
        onPress={() => open(n)}
        onLongPress={() => void remove(n)}
        scaleTo={0.995}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: ms(10), paddingVertical: 12, paddingLeft: ms(14) }}
      >
        <View style={{ width: ms(9), height: ms(9), borderRadius: 5, marginTop: ms(6), backgroundColor: n.readAt ? 'transparent' : c.accent }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: fs(13), lineHeight: Math.round(fs(13) * 1.3), fontFamily: n.readAt ? fonts.body.medium : fonts.body.semibold, color: n.readAt ? c.textSecondary : c.text }}>{n.title}</Text>
          <Text style={{ fontSize: fs(11), lineHeight: Math.round(fs(11) * 1.3), marginTop: 2, fontFamily: fonts.mono.regular, color: '#8E939E' }}>
            {timeAgo(n.createdAt)}
            {n.body ? ` • ${n.body}` : ''}
          </Text>
        </View>
      </Pressy>
      <AppIconButton testID={`notification-delete-${n.id}`} label="Delete notification" icon={<Trash2 size={ms(18)} color="#8E939E" />} onPress={() => void remove(n)} />
    </View>
  );

  return (
    <Screen
      title="Notifications"
      onBack={back}
      scroll={false}
      padded={false}
      rightAction={
        q.data ? (
          <Pressy testID="mark-all-read" accessibilityLabel="Mark all read" disabled={unread === 0} onPress={() => void markAll()} hitSlop={10} style={{ opacity: unread > 0 ? 1 : 0.4 }}>
            <Text style={{ fontSize: fs(12), fontFamily: fonts.body.semibold, color: c.accent }} numberOfLines={1}>Mark all read</Text>
          </Pressy>
        ) : undefined
      }
    >
      {err ? (
        <View style={{ padding: 16 }}>
          <ErrorState offline={err.code === 'NETWORK_ERROR'} message={friendlyMessage(err)} onRetry={() => void q.refetch()} />
        </View>
      ) : q.isLoading ? (
        <AppLoader label="Loading notifications..." />
      ) : items.length === 0 && !rewardReady ? (
        <EmptyState icon={<Bell size={ms(28)} color={c.accent} />} title="No notifications" description="Friend requests, invites and rewards will show up here." />
      ) : (
        <ScrollView
          testID="notification-list"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 14 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.accent} />}
        >
          <View testID="notification-filters" style={{ flexDirection: 'row', gap: 8 }}>
            {FILTERS.map((f) => {
              const on = filter === f.key;
              return (
                <Pressy
                  key={f.key}
                  testID={`notification-filter-${f.key}`}
                  accessibilityLabel={`Show ${f.label}`}
                  onPress={() => setFilter(f.key)}
                  style={{
                    paddingHorizontal: ms(14),
                    paddingVertical: ms(7),
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: on ? c.accent : c.border,
                    backgroundColor: on ? c.accent : c.bgCard,
                  }}
                >
                  <Text style={{ fontSize: fs(12.5), fontFamily: fonts.body.semibold, color: on ? c.onAccent : c.text }}>{f.label}</Text>
                </Pressy>
              );
            })}
          </View>

          {showReward ? (
            <Group>
              <Pressy
                testID="reward-ready-notification"
                accessibilityLabel={`Daily reward ready. Day ${rewardDay} is ready to claim`}
                onPress={() => nav.navigate('daily_rewards')}
                scaleTo={0.995}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ms(10), paddingVertical: 12, paddingHorizontal: ms(14) }}
              >
                <View style={{ width: ms(9), height: ms(9), borderRadius: 5, marginTop: ms(6), backgroundColor: c.accent }} />
                <Gift size={ms(18)} color={c.warning} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: fs(13), lineHeight: Math.round(fs(13) * 1.3), fontFamily: fonts.body.semibold, color: c.text }}>Daily reward ready</Text>
                  <Text style={{ fontSize: fs(11), lineHeight: Math.round(fs(11) * 1.3), marginTop: 2, fontFamily: fonts.mono.regular, color: c.textSecondary }}>
                    Day {rewardDay} is ready to claim
                  </Text>
                </View>
              </Pressy>
            </Group>
          ) : null}

          {filtered.length === 0 && !showReward ? (
            <Text style={{ textAlign: 'center', paddingVertical: 24, fontSize: fs(12.5), color: c.textSecondary }}>
              {filter === 'unread' ? 'No unread notifications.' : 'No requests right now.'}
            </Text>
          ) : null}

          {unreadItems.length > 0 ? (
            <View>
              <SectionLabel>Unread</SectionLabel>
              <Group>{unreadItems.map(renderRow)}</Group>
            </View>
          ) : null}
          {earlier.length > 0 ? (
            <View>
              <SectionLabel>Earlier</SectionLabel>
              <Group>{earlier.map(renderRow)}</Group>
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
};
