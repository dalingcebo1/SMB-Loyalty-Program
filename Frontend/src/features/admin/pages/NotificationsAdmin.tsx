import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaBell, FaPaperPlane, FaUsers, FaEye, FaTrash, FaPlus, FaTimes } from 'react-icons/fa';
import { HiOutlineRefresh } from 'react-icons/hi';
import api from '../../../api/api';
import { useCapabilities } from '../hooks/useCapabilities';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { toast } from 'react-toastify';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  recipient_type: 'all' | 'role' | 'individual';
  recipient_filter: string | null;
  read_count: number;
  total_recipients: number;
  sent_at: string;
  sender_name: string;
}

interface NotificationStats {
  total_sent: number;
  total_read: number;
  unread_notifications: number;
  delivery_rate: number;
}

interface SendNotificationForm {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  recipient_type: 'all' | 'role' | 'individual';
  recipient_filter: string;
}

const NotificationsAdmin: React.FC = () => {
  const { has: hasCapability } = useCapabilities();
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
  const { data: notifications, isLoading: notificationsLoading } = useQuery<Notification[]>({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const response = await api.get('/notifications/admin');
      return response.data;
    },
  });

  // Fetch notification stats
  const { data: stats, isLoading: statsLoading } = useQuery<NotificationStats>({
    queryKey: ['notification-stats'],
    queryFn: async () => {
      const response = await api.get('/notifications/admin/stats');
      return response.data;
    },
  });

  // Send notification mutation
  const sendNotificationMutation = useMutation({
    mutationFn: async (notification: SendNotificationForm) => {
      const payload = {
        title: notification.title,
        message: notification.message,
        type: notification.type,
        recipient_type: notification.recipient_type,
        recipient_filter: notification.recipient_filter || undefined,
      };
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

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      await api.delete(`/notifications/admin/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
      toast.success('Notification deleted successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete notification';
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

  const handleDeleteNotification = (id: number) => {
    if (window.confirm('Are you sure you want to delete this notification?')) {
      deleteNotificationMutation.mutate(id);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getRecipientText = (notification: Notification) => {
    switch (notification.recipient_type) {
      case 'all':
        return 'All users';
      case 'role':
        return `${notification.recipient_filter} users`;
      case 'individual':
        return `User ID: ${notification.recipient_filter}`;
      default:
        return 'Unknown';
    }
  };

  // Check permissions
  if (!hasCapability('manage_notifications')) {
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
                    recipient_type: e.target.value as 'all' | 'role' | 'individual',
                    recipient_filter: ''
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Users</option>
                  <option value="role">By Role</option>
                  <option value="individual">Individual User</option>
                </select>
              </div>
              
              {sendForm.recipient_type === 'role' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={sendForm.recipient_filter}
                    onChange={(e) => setSendForm({ ...sendForm, recipient_filter: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select role...</option>
                    <option value="user">Users</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admins</option>
                  </select>
                </div>
              )}
              
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
                    placeholder="Enter user ID..."
                  />
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
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Sent</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total_sent}</p>
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
                    <p className="text-2xl font-bold text-gray-900">{stats.total_read}</p>
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
                    <p className="text-2xl font-bold text-gray-900">{stats.unread_notifications}</p>
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
                      {(stats.delivery_rate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-full">
                    <FaUsers className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>
          )}

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
                {notifications?.map((notification) => (
                  <div key={notification.id} className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-gray-900">{notification.title}</h3>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(notification.type)}`}>
                            {notification.type}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-3">{notification.message}</p>
                        <div className="flex items-center gap-6 text-sm text-gray-500">
                          <span>To: {getRecipientText(notification)}</span>
                          <span>
                            Read: {notification.read_count}/{notification.total_recipients}
                          </span>
                          <span>Sent: {new Date(notification.sent_at).toLocaleString()}</span>
                          <span>By: {notification.sender_name}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteNotification(notification.id)}
                        className="ml-4 p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete notification"
                      >
                        <FaTrash className="w-4 h-4" />
                      </button>
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
