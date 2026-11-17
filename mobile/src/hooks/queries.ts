import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { achievementApi } from '../services/api/achievementApi';
import { friendApi, FriendListStatus } from '../services/api/friendApi';
import { leaderboardApi, LeaderboardMetric, LeaderboardScope } from '../services/api/leaderboardApi';
import { notificationApi } from '../services/api/notificationApi';
import { rewardApi } from '../services/api/rewardApi';
import { statisticsApi } from '../services/api/statisticsApi';
import { gameApi } from '../services/api/gameApi';
import { userApi, UpdateMeInput } from '../services/api/userApi';
import { useAuthStore } from '../store/authStore';

/**
 * Server-state hooks (TanStack Query). Keys are user-scoped by clearing the cache on logout (authStore).
 * `enabled` is tied to being signed in so nothing fires before the session exists.
 */
const useSignedIn = () => useAuthStore((s) => s.status === 'signedIn');

export const useMe = () => {
  const on = useSignedIn();
  const cached = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const me = await userApi.me();
      setUser(me);
      return me;
    },
    enabled: on,
    initialData: cached ?? undefined,
    staleTime: 15_000,
  });
};

export const usePublicProfile = (userId: string) =>
  useQuery({ queryKey: ['profile', userId], queryFn: () => userApi.get(userId), enabled: useSignedIn() && !!userId });

export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: statisticsApi.me, enabled: useSignedIn() });
export const useStreaks = () => useQuery({ queryKey: ['streaks'], queryFn: statisticsApi.streaks, enabled: useSignedIn() });

export const useHistory = (filter: { type?: string; result?: 'WIN' | 'LOSS' | 'DRAW' } = {}) =>
  useQuery({ queryKey: ['history', filter], queryFn: () => statisticsApi.history(filter), enabled: useSignedIn(), placeholderData: keepPreviousData });

export const useLeaderboard = (scope: LeaderboardScope, metric: LeaderboardMetric = 'points') =>
  useQuery({ queryKey: ['leaderboard', scope, metric], queryFn: () => leaderboardApi.get(scope, metric), enabled: useSignedIn(), placeholderData: keepPreviousData });

export const useFriends = (status: FriendListStatus = 'accepted') =>
  useQuery({ queryKey: ['friends', status], queryFn: () => friendApi.list(status), enabled: useSignedIn() });

export const useBlocked = () => useQuery({ queryKey: ['friends', 'blocked'], queryFn: friendApi.blocked, enabled: useSignedIn() });

export const useAchievements = () => useQuery({ queryKey: ['achievements'], queryFn: achievementApi.mine, enabled: useSignedIn() });

export const useDailyReward = () => useQuery({ queryKey: ['rewards'], queryFn: rewardApi.status, enabled: useSignedIn() });

export const useNotifications = () => useQuery({ queryKey: ['notifications'], queryFn: () => notificationApi.list(), enabled: useSignedIn(), refetchInterval: false });

export const useReplay = (gameId: string | undefined) =>
  useQuery({ queryKey: ['replay', gameId], queryFn: () => gameApi.replay(gameId!), enabled: useSignedIn() && !!gameId });

// ---------------------------------------------------------------- mutations
export const useUpdateProfile = () => {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (input: UpdateMeInput) => userApi.update(input),
    onSuccess: (me) => {
      setUser(me);
      qc.setQueryData(['me'], me);
    },
  });
};

export const useClaimDailyReward = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rewardApi.claim,
    onSuccess: (r) => {
      qc.setQueryData(['rewards'], r.status);
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
};

export const useFriendActions = () => {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['friends'] });
  return {
    request: useMutation({ mutationFn: (t: { userId: string } | { username: string }) => friendApi.request(t), onSuccess: refresh }),
    accept: useMutation({ mutationFn: (id: string) => friendApi.accept(id), onSuccess: refresh }),
    reject: useMutation({ mutationFn: (id: string) => friendApi.reject(id), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => friendApi.remove(id), onSuccess: refresh }),
    block: useMutation({ mutationFn: (userId: string) => friendApi.block(userId), onSuccess: refresh }),
    unblock: useMutation({ mutationFn: (userId: string) => friendApi.unblock(userId), onSuccess: refresh }),
  };
};
