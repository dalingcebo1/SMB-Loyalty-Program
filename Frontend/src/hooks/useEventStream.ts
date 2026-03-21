/**
 * useEventStream — React hook for consuming Server-Sent Events (SSE).
 *
 * Connects to the backend SSE endpoint after the user is authenticated,
 * automatically reconnects with exponential backoff on disconnection,
 * and degrades gracefully (falls back to existing React Query polling)
 * when the SSE connection is unavailable.
 *
 * ## Usage
 * ```tsx
 * // In App.tsx or a top-level layout:
 * import { useEventStream } from './hooks/useEventStream';
 * useEventStream();
 * ```
 */
import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryClient';
import { notifyInfo, notifySuccess } from '../utils/notifications';
import { track } from '../utils/analytics';

/** Supported SSE event types from the backend. */
type SSEEventType =
  | 'order_status_changed'
  | 'payment_verified'
  | 'new_notification'
  | 'loyalty_milestone';

interface SSEPayload {
  type: SSEEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

/** Maximum reconnect delay in ms (30 s). */
const MAX_BACKOFF_MS = 30_000;
/** Initial reconnect delay in ms (1 s). */
const INITIAL_BACKOFF_MS = 1_000;

/**
 * Compute the absolute SSE endpoint URL.
 * Re-uses the same base-URL logic as the axios API client.
 */
function getSSEUrl(): string {
  const raw =
    (import.meta.env?.VITE_API_BASE_URL_DEV as string | undefined) ??
    (import.meta.env?.VITE_API_BASE_URL as string | undefined) ??
    '';
  const trimmed = raw.replace(/\/+$/g, '');

  let base: string;
  if (!trimmed) {
    base = '/api';
  } else if (trimmed.endsWith('/api')) {
    base = trimmed;
  } else {
    base = `${trimmed}/api`;
  }

  return `${base}/stream/events`;
}

export function useEventStream() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const sourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Handle incoming SSE event and update React Query caches / show toasts. */
  const handleEvent = useCallback(
    (payload: SSEPayload) => {
      track('sse_event', { type: payload.type });

      switch (payload.type) {
        case 'order_status_changed': {
          const orderId = payload.data.order_id as string | undefined;
          const newStatus = payload.data.new_status as string | undefined;
          // Invalidate order-related caches so React Query re-fetches
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
          if (orderId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
          }
          if (newStatus === 'completed') {
            notifySuccess('Your wash is complete! 🚗✨');
          } else if (newStatus === 'in_progress') {
            notifyInfo('Your wash has started 🧽');
          }
          break;
        }

        case 'payment_verified': {
          const orderId = payload.data.order_id as string | undefined;
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
          if (orderId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
          }
          notifySuccess('Payment confirmed! ✅');
          break;
        }

        case 'new_notification':
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
          notifyInfo('New order received 📋');
          break;

        case 'loyalty_milestone': {
          const reward = payload.data.reward as string | undefined;
          queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.me });
          queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.rewards });
          notifySuccess(
            reward
              ? `Congratulations! You earned: ${reward} 🎁`
              : 'Congratulations! Free wash earned! 🎉',
          );
          break;
        }

        default:
          // Unknown event type — ignore gracefully
          break;
      }
    },
    [queryClient],
  );

  /** Open SSE connection with token-based auth via query parameter. */
  const connect = useCallback(() => {
    // Graceful degradation: if EventSource is not supported, skip SSE
    if (typeof EventSource === 'undefined') return;

    const token = localStorage.getItem('token');
    if (!token) return; // Not authenticated

    // EventSource does not support custom headers. Pass the JWT as a query
    // parameter so the backend can authenticate the connection. The
    // `get_current_user` dependency also accepts tokens in query params.
    // Note: For production, consider using a short-lived ticket instead.
    const url = `${getSSEUrl()}?token=${encodeURIComponent(token)}`;

    const source = new EventSource(url);
    sourceRef.current = source;

    source.onopen = () => {
      retryCountRef.current = 0; // Reset backoff on successful connect
      track('sse_connected');
    };

    source.onmessage = (event: MessageEvent) => {
      try {
        const payload: SSEPayload = JSON.parse(event.data);
        handleEvent(payload);
      } catch (err) {
        track('sse_parse_error', { error: String(err) });
      }
    };

    // Named event listeners (SSE events with "event:" prefix)
    const eventTypes: SSEEventType[] = [
      'order_status_changed',
      'payment_verified',
      'new_notification',
      'loyalty_milestone',
    ];
    for (const eventType of eventTypes) {
      source.addEventListener(eventType, ((event: MessageEvent) => {
        try {
          const payload: SSEPayload = JSON.parse(event.data);
          handleEvent(payload);
        } catch (err) {
          track('sse_parse_error', { type: eventType, error: String(err) });
        }
      }) as EventListener);
    }

    source.onerror = () => {
      source.close();
      sourceRef.current = null;
      track('sse_disconnected');

      // Exponential backoff reconnect
      const delay = Math.min(
        INITIAL_BACKOFF_MS * 2 ** retryCountRef.current,
        MAX_BACKOFF_MS,
      );
      retryCountRef.current += 1;
      retryTimerRef.current = setTimeout(connect, delay);
    };
  }, [handleEvent]);

  useEffect(() => {
    if (!user) {
      // Not logged in — close any existing connection
      sourceRef.current?.close();
      sourceRef.current = null;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      return;
    }

    // User is logged in — establish SSE connection
    connect();

    return () => {
      sourceRef.current?.close();
      sourceRef.current = null;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [user, connect]);
}
