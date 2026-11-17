import { api, unwrap, unwrapPage } from './apiClient';
import type { FriendItem, PlayerCard } from './types';

export type FriendListStatus = 'accepted' | 'incoming' | 'outgoing';

export const friendApi = {
  list: (status: FriendListStatus = 'accepted', page = 1) => unwrapPage<FriendItem>(api.get('/friends', { params: { status, page, limit: 50 } })),
  blocked: () => unwrapPage<PlayerCard>(api.get('/friends/blocked', { params: { limit: 100 } })),
  request: (target: { userId: string } | { username: string }) => unwrap<{ id: string; status: string }>(api.post('/friends/request', target)),
  /** :id is the friendshipId */
  accept: (friendshipId: string) => unwrap<{ id: string; status: 'ACCEPTED'; friendId: string }>(api.post(`/friends/${friendshipId}/accept`)),
  reject: (friendshipId: string) => unwrap<{ rejected: true }>(api.post(`/friends/${friendshipId}/reject`)),
  remove: (friendshipId: string) => unwrap<{ removed: true }>(api.delete(`/friends/${friendshipId}`)),
  /** :id is the userId */
  block: (userId: string) => unwrap<{ blocked: true }>(api.post(`/friends/${userId}/block`)),
  unblock: (userId: string) => unwrap<{ blocked: false }>(api.post(`/friends/${userId}/unblock`)),
};
