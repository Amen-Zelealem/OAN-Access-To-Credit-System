import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationService } from './notification.service';
import { fetchApi } from '@/lib/api/fetchApi';

vi.mock('@/lib/api/fetchApi');

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('calls GET v1/notifications with default status, page, and page_size', async () => {
      vi.mocked(fetchApi).mockResolvedValue({
        status: 'success',
        data: { unread_count: 0, notifications: [] },
      });

      await notificationService.getNotifications();

      expect(fetchApi).toHaveBeenCalledWith('v1/notifications?status=all&page=1&page_size=20');
    });

    it('maps legacy read_status, start, and limit correctly', async () => {
      vi.mocked(fetchApi).mockResolvedValue({
        status: 'success',
        data: { unread_count: 0, notifications: [] },
      });

      await notificationService.getNotifications({
        read_status: 'unread',
        limit: 10,
        start: 20,
      });

      expect(fetchApi).toHaveBeenCalledWith('v1/notifications?status=unread&page=3&page_size=10');
    });

    it('prefers modern status, page, and page_size when provided', async () => {
      vi.mocked(fetchApi).mockResolvedValue({
        status: 'success',
        data: { unread_count: 0, notifications: [] },
      });

      await notificationService.getNotifications({
        status: 'read',
        page: 2,
        page_size: 50,
      });

      expect(fetchApi).toHaveBeenCalledWith('v1/notifications?status=read&page=2&page_size=50');
    });
  });

  describe('markRead', () => {
    it('sends PATCH with { ids, read: true } when given an array of ids', async () => {
      vi.mocked(fetchApi).mockResolvedValue({ status: 'success', data: { updated: 2 } });

      await notificationService.markRead({ ids: ['n-1', 'n-2'] });

      expect(fetchApi).toHaveBeenCalledWith('v1/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ read: true, ids: ['n-1', 'n-2'] }),
      });
    });

    it('sends PATCH with { all: true, read: true } when marking all as read', async () => {
      vi.mocked(fetchApi).mockResolvedValue({ status: 'success', data: { updated: 5 } });

      await notificationService.markRead({ all: true });

      expect(fetchApi).toHaveBeenCalledWith('v1/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ read: true, all: true }),
      });
    });

    it('supports backwards-compatible mark_all and notification_ids params', async () => {
      vi.mocked(fetchApi).mockResolvedValue({ status: 'success', data: { updated: 1 } });

      await notificationService.markRead({ notification_ids: ['n-1'] });

      expect(fetchApi).toHaveBeenCalledWith('v1/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ read: true, ids: ['n-1'] }),
      });
    });
  });

  describe('clearNotifications', () => {
    it('sends DELETE with { ids } when given an array of ids', async () => {
      vi.mocked(fetchApi).mockResolvedValue({ status: 'success', data: { deleted: 2 } });

      await notificationService.clearNotifications({ ids: ['n-1', 'n-2'] });

      expect(fetchApi).toHaveBeenCalledWith('v1/notifications', {
        method: 'DELETE',
        body: JSON.stringify({ ids: ['n-1', 'n-2'] }),
      });
    });

    it('sends DELETE with { all: true } when clearing all', async () => {
      vi.mocked(fetchApi).mockResolvedValue({ status: 'success', data: { deleted: 10 } });

      await notificationService.clearNotifications({ all: true });

      expect(fetchApi).toHaveBeenCalledWith('v1/notifications', {
        method: 'DELETE',
        body: JSON.stringify({ all: true }),
      });
    });

    it('supports backwards-compatible clear_all and notification_ids params', async () => {
      vi.mocked(fetchApi).mockResolvedValue({ status: 'success', data: { deleted: 1 } });

      await notificationService.clearNotifications({ clear_all: true });

      expect(fetchApi).toHaveBeenCalledWith('v1/notifications', {
        method: 'DELETE',
        body: JSON.stringify({ all: true }),
      });
    });
  });
});
