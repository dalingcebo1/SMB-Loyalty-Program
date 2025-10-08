import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaBell, FaPaperPlane, FaUsers, FaEye, FaPlus, FaTimes } from 'react-icons/fa';
import { HiOutlineRefresh } from 'react-icons/hi';
import api from '../../../api/api';
import { useCapabilities } from '../hooks/useCapabilities';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { toast } from 'react-toastify';

interface AdminNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  created_at: string;
  read_at: string | null;
  action_url: string | null;
  user: {
    id: number;
    email: string;
    name?: string | null;
  } | null;
}

interface NotificationStatsResponse {
  stats_by_type: Array<{
    type: string;
    total: number;
    read: number;
    unread: number;
    read_rate: number;
  }>;
  recent_activity: Array<{
    date: string;
    count: number;
  }>;
}

interface SendNotificationForm {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  recipient_type: 'all' | 'individual';
  recipient_filter: string;
}

const NotificationsAdmin: React.FC = () => {
  const { has: hasCapability } = useCapabilities();
  const canManageNotifications = hasCapability('manage_notifications');
  const queryClient = useQueryClient();
  const [showSendForm, setShowSendForm] = useState(false);
  const [sendForm, setSendForm] = useState<SendNotificationForm>({
    title: '',
    message: '',
    type: 'info',
    recipient_type: 'all',
    recipient_filter: '',
  });

  // Fetch notifications
  const { data: notificationsData, isLoading: notificationsLoading } = useQuery<AdminNotification[]>({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const response = await api.get('/notifications/admin/all');
      return response.data as AdminNotification[];
    },
    enabled: canManageNotifications,
  });

  const notifications = notificationsData ?? [];

  // Fetch notification stats
  const { data: statsData, isLoading: statsLoading } = useQuery<NotificationStatsResponse>({
    queryKey: ['notification-stats'],
    queryFn: async () => {
      const response = await api.get('/notifications/admin/stats');
      return response.data as NotificationStatsResponse;
    },
    enabled: canManageNotifications,
  });

  const statsSummary = useMemo(() => {
    if (!statsData) {
      return null;
    }

    const totals = statsData.stats_by_type.reduce(
      (acc, item) => {
        acc.totalSent += item.total;
        acc.totalRead += item.read;
        acc.totalUnread += item.unread;
        return acc;
      },
      { totalSent: 0, totalRead: 0, totalUnread: 0 }
    );

    const deliveryRate = totals.totalSent > 0 ? totals.totalRead / totals.totalSent : 0;

    return {
      totalSent: totals.totalSent,
      totalRead: totals.totalRead,
      totalUnread: totals.totalUnread,
      deliveryRate,
    };
  }, [statsData]);

  // Send notification mutation
  const sendNotificationMutation = useMutation({
    mutationFn: async (notification: SendNotificationForm) => {
      const payload: Record<string, unknown> = {
        title: notification.title.trim(),
        message: notification.message.trim(),
        type: notification.type,
      };

      if (notification.recipient_type === 'all') {
        payload.all_users = true;
      } else {
        const userIds = notification.recipient_filter
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
          .map((id) => Number(id))
          .filter((id) => !Number.isNaN(id));

        if (userIds.length === 0) {
          throw new Error('Please provide at least one valid user ID.');
        }

        payload.user_ids = userIds;
      }

      const response = await api.post('/notifications/send', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
      setShowSendForm(false);
      setSendForm({
        title: '',
        message: '',
        type: 'info',
        recipient_type: 'all',
        recipient_filter: '',
      });
      toast.success('Notification sent successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send notification';
      toast.error(errorMessage);
    },
  });

  const handleSendNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendForm.title.trim() || !sendForm.message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    sendNotificationMutation.mutate(sendForm);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const formatRecipient = (notification: AdminNotification) => {
    if (!notification.user) {
      return 'Unknown recipient';
    }
    const name = notification.user.name?.trim();
    if (name) {
      return name;
    }
    if (notification.user.email) {
      return notification.user.email;
    }
    return `User #${notification.user.id}`;
  };

  const formatReadStatus = (notification: AdminNotification) => (
    notification.read_at ? 'Read' : 'Unread'
  );

  // Check permissions
  if (!canManageNotifications) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">You don't have permission to manage notifications.</p>
        </div>
      </div>
    );
  }

  const isLoading = notificationsLoading || statsLoading;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Management</h1>
          <p className="text-gray-600">Send and manage notifications to your users</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowSendForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaPlus className="w-4 h-4" />
            Send Notification
          </button>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
              queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
            }}
            className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <HiOutlineRefresh className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Send Notification Modal */}
      {showSendForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Send Notification</h2>
              <button
                onClick={() => setShowSendForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSendNotification} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={sendForm.title}
                  onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Notification title..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={sendForm.message}
                  onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Notification message..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={sendForm.type}
                  onChange={(e) => setSendForm({ ...sendForm, type: e.target.value as 'info' | 'success' | 'warning' | 'error' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="info">Information</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipients
                </label>
                <select
                  value={sendForm.recipient_type}
                  onChange={(e) => setSendForm({ 
                    ...sendForm, 
                    recipient_type: e.target.value as 'all' | 'individual',
                    recipient_filter: ''
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Users</option>
                  <option value="individual">Individual User</option>
                </select>
              </div>
              
              {sendForm.recipient_type === 'individual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User ID
                  </label>
                  <input
                    type="number"
                    value={sendForm.recipient_filter}
                    onChange={(e) => setSendForm({ ...sendForm, recipient_filter: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter user ID (e.g. 42)"
                  />
                  <p className="mt-1 text-xs text-gray-500">To send to multiple users, enter comma-separated IDs (e.g. 4,12,19).</p>
                </div>
              )}
              
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={sendNotificationMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <FaPaperPlane className="w-4 h-4" />
                  Send Notification
                </button>
                <button
                  type="button"
                  onClick={() => setShowSendForm(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {/* Statistics */}
          {statsSummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Sent</p>
                    <p className="text-2xl font-bold text-gray-900">{statsSummary.totalSent}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <FaPaperPlane className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Read</p>
                    <p className="text-2xl font-bold text-gray-900">{statsSummary.totalRead}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <FaEye className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Unread</p>
                    <p className="text-2xl font-bold text-gray-900">{statsSummary.totalUnread}</p>
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-full">
                    <FaBell className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Read Rate</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(statsSummary.deliveryRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-full">
                    <FaUsers className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {statsData?.stats_by_type?.length ? (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Breakdown by Type</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">Type</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">Total</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">Read</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">Unread</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">Read Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {statsData.stats_by_type.map((row) => (
                      <tr key={row.type}>
                        <td className="px-4 py-2 capitalize text-gray-900">{row.type}</td>
                        <td className="px-4 py-2 text-gray-700">{row.total}</td>
                        <td className="px-4 py-2 text-gray-700">{row.read}</td>
                        <td className="px-4 py-2 text-gray-700">{row.unread}</td>
                        <td className="px-4 py-2 text-gray-700">{row.read_rate.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Notifications List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Sent Notifications</h2>
            </div>
            
            {notifications && notifications.length === 0 ? (
              <div className="p-8 text-center">
                <FaBell className="mx-auto w-12 h-12 text-gray-400 mb-4" />
                <p className="text-gray-600">No notifications sent yet</p>
                <p className="text-sm text-gray-500 mt-2">Send your first notification to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div key={notification.id} className="p-6">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-gray-900">{notification.title}</h3>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(notification.type)}`}>
                            {notification.type}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-3">{notification.message}</p>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <span>Recipient: {formatRecipient(notification)}</span>
                          <span>Status: {formatReadStatus(notification)}</span>
                          <span>Sent: {new Date(notification.created_at).toLocaleString()}</span>
                          {notification.action_url && (
                            <a
                              href={notification.action_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              View action
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationsAdmin;
