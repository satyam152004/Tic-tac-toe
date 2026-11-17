import React, { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Trash2 } from 'lucide-react-native';
import { AppCard } from '../../components/common/AppCard';
import { AppIconButton } from '../../components/common/AppIconButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { type } from '../../design-system/typography';
import { useNotifications } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { notificationApi } from '../../services/api/notificationApi';
import type { NotificationItem } from '../../services/api/types';
import { toast } from '../../store/toastStore';
import { timeAgo } from '../../utils/format';

interface Inbox { items: NotificationItem[]; unread: number; total: number }

export const NotificationsScreen: React.FC<RootScreenProps<'notifications'>> = () => {
  const c = useTheme();
  const { nav, goTab, back } = useAppNav();
  const qc = useQueryClient();
  const q = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

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
      case 'MATCH_FOUND':
        if (d.gameId) nav.navigate('online_board', { gameId: d.gameId });
        break;
      case 'ACHIEVEMENT_UNLOCKED':
        nav.navigate('achievements');
        break;
      case 'LEVEL_UP':
        goTab('ProfileTab');
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

  return (
    <Screen
      title="Notifications"
      subtitle={q.data ? (unread > 0 ? `${unread} unread` : 'All caught up') : undefined}
      onBack={back}
      scroll={false}
      padded={false}
      rightAction={
        unread > 0 ? (
          <AppIconButton testID="mark-all-read" label="Mark all read" icon={<CheckCheck size={18} color={c.accent} />} onPress={() => void markAll()} />
        ) : undefined
      }
    >
      {err ? (
        <View style={{ padding: 16 }}>
          <ErrorState offline={err.code === 'NETWORK_ERROR'} message={friendlyMessage(err)} onRetry={() => void q.refetch()} />
        </View>
      ) : q.isLoading ? (
        <AppLoader label="Loading notifications..." />
      ) : (
        <FlatList
          testID="notification-list"
          data={q.data?.items ?? []}
          keyExtractor={(i) => i.id}
          ListEmptyComponent={<EmptyState icon={<Bell size={24} color={c.accent} />} title="No notifications" description="Friend requests, invites and rewards will show up here." />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.accent} />}
          renderItem={({ item: n }) => (
            <AppCard padding="sm" selected={!n.readAt} testID={`notification-${n.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressy
                  testID={`notification-open-${n.id}`}
                  accessibilityLabel={`${n.title}. ${n.body}${n.readAt ? '' : '. Unread'}`}
                  onPress={() => open(n)}
                  onLongPress={() => void remove(n)}
                  style={{ flex: 1, flexDirection: 'row', gap: 10, minHeight: 44, alignItems: 'center' }}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: n.readAt ? 'transparent' : c.accent }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[type.bodyStrong, { color: c.text }]}>{n.title}</Text>
                    <Text style={[type.small, { color: c.textSecondary }]}>{n.body}</Text>
                    <Text style={[type.caption, { color: c.textSecondary, marginTop: 4 }]}>{timeAgo(n.createdAt)}</Text>
                  </View>
                </Pressy>
                <AppIconButton testID={`notification-delete-${n.id}`} label="Delete notification" icon={<Trash2 size={16} color={c.textSecondary} />} onPress={() => void remove(n)} />
              </View>
            </AppCard>
          )}
        />
      )}
    </Screen>
  );
};
