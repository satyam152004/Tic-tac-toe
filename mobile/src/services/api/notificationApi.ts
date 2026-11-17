import { api, unwrap, unwrapPage } from './apiClient';
import type { NotificationItem } from './types';

export const notificationApi = {
  async list(page = 1, unreadOnly = false) {
    const r = await unwrapPage<NotificationItem>(api.get('/notifications', { params: { page, limit: 30, unreadOnly: unreadOnly || undefined } }));
    return { items: r.items, unread: Number(r.meta.unread ?? 0), total: r.total };
  },
  readAll: () => unwrap<{ updated: number }>(api.patch('/notifications/read-all')),
  read: (id: string) => unwrap<NotificationItem>(api.patch(`/notifications/${id}/read`)),
  remove: (id: string) => unwrap<{ deleted: true }>(api.delete(`/notifications/${id}`)),
};
