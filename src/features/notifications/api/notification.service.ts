import { fetchApi } from '@/lib/api/fetchApi';

export interface NotificationItem {
  id: string;
  subject: string;
  message?: string | null;
  type?: string | null;
  read: boolean | number;
  created_at?: string;
  document_type?: string | null;
  document_name?: string | null;
  /** Backwards compatibility alias for id */
  name?: string;
  /** Backwards compatibility alias for message */
  email_content?: string | null;
  /** Backwards compatibility alias for created_at */
  creation?: string;
  from_user?: string;
  for_user?: string;
  [key: string]: unknown;
}

export interface GetNotificationsParams {
  status?: 'unread' | 'read' | 'all';
  read_status?: 'unread' | 'read' | 'all';
  page?: number;
  page_size?: number;
  limit?: number;
  start?: number;
}

export interface GetNotificationsResponse {
  notifications?: NotificationItem[];
  items?: NotificationItem[];
  data?: NotificationItem[] | { notifications?: NotificationItem[]; unread_count?: number };
  unread_count?: number;
  total_count?: number;
  status?: string;
  message?: string;
}

export interface MarkReadParams {
  ids?: string[];
  all?: boolean;
  read?: boolean;
  /** Backwards compatibility aliases */
  notification_ids?: string[];
  mark_all?: boolean;
}

export interface ClearNotificationsParams {
  ids?: string[];
  all?: boolean;
  /** Backwards compatibility aliases */
  notification_ids?: string[];
  clear_all?: boolean;
}

export const notificationService = {
  async getNotifications(params: GetNotificationsParams = {}): Promise<GetNotificationsResponse> {
    const status = params.status ?? params.read_status ?? 'all';
    const page =
      params.page ??
      (params.start !== undefined && params.limit ? Math.floor(params.start / params.limit) + 1 : 1);
    const pageSize = params.page_size ?? params.limit ?? 20;

    const query = new URLSearchParams({
      status,
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    return fetchApi(`v1/notifications?${query.toString()}`);
  },

  async markRead(params: MarkReadParams): Promise<{ status: string; message?: string }> {
    const markAll = params.all ?? params.mark_all ?? false;
    const targetIds = params.ids ?? params.notification_ids ?? [];
    const read = params.read ?? true;

    const body: Record<string, unknown> = { read };
    if (markAll) {
      body.all = true;
    } else {
      body.ids = targetIds;
    }

    return fetchApi('v1/notifications', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  async clearNotifications(params: ClearNotificationsParams): Promise<{ status: string; message?: string }> {
    const clearAll = params.all ?? params.clear_all ?? false;
    const targetIds = params.ids ?? params.notification_ids ?? [];

    const body: Record<string, unknown> = {};
    if (clearAll) {
      body.all = true;
    } else {
      body.ids = targetIds;
    }

    return fetchApi('v1/notifications', {
      method: 'DELETE',
      body: JSON.stringify(body),
    });
  },
};
