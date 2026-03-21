import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------- mocks ----------
vi.mock('../auth/AuthProvider', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../utils/notifications', () => ({
  notifyInfo: vi.fn(),
  notifySuccess: vi.fn(),
}));
vi.mock('../utils/analytics', () => ({
  track: vi.fn(),
}));

import { useAuth } from '../auth/AuthProvider';
import { notifyInfo, notifySuccess } from '../utils/notifications';

// A minimal EventSource mock
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners: Record<string, EventListener[]> = {};
  readyState = 0; // CONNECTING

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    // Simulate async open
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.();
    }, 0);
  }

  addEventListener(type: string, listener: EventListener) {
    (this.listeners[type] ??= []).push(listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    const arr = this.listeners[type];
    if (arr) {
      const idx = arr.indexOf(listener);
      if (idx >= 0) arr.splice(idx, 1);
    }
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  // Test helper: simulate a named event from the server
  simulateEvent(type: string, data: string) {
    const event = new MessageEvent(type, { data });
    for (const listener of this.listeners[type] ?? []) {
      listener(event);
    }
    // Also fire onmessage for generic listener
    this.onmessage?.(event);
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

// Install the mock on globalThis
const OriginalEventSource = globalThis.EventSource;

beforeEach(() => {
  MockEventSource.reset();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.EventSource = MockEventSource as any;
  localStorage.setItem('token', 'test-jwt-token');
});

afterEach(() => {
  globalThis.EventSource = OriginalEventSource;
  localStorage.removeItem('token');
  vi.restoreAllMocks();
});

// ---------- tests ----------

describe('useEventStream', () => {
  // We test the hook logic by importing it and calling it in a controlled way.
  // Since it relies on useAuth and useQueryClient, we mock those.

  it('should not connect when user is null', async () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, loading: false });

    // Dynamic import so mocks are in place
    const { useEventStream } = await import('./useEventStream');

    // Render in a minimal React context
    const { renderHook } = await import('@testing-library/react');
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
    const React = await import('react');

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    renderHook(() => useEventStream(), { wrapper });

    // No EventSource should have been created
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('should connect when user is logged in and include token in URL', async () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: { id: 1 }, loading: false });

    const { useEventStream } = await import('./useEventStream');
    const { renderHook } = await import('@testing-library/react');
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
    const React = await import('react');

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    renderHook(() => useEventStream(), { wrapper });

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain('/api/stream/events');
    expect(MockEventSource.instances[0].url).toContain('token=test-jwt-token');
  });

  it('should show toast and invalidate queries on order_status_changed event', async () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: { id: 1 }, loading: false });

    const { useEventStream } = await import('./useEventStream');
    const { renderHook, act } = await import('@testing-library/react');
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
    const React = await import('react');

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    renderHook(() => useEventStream(), { wrapper });

    const source = MockEventSource.instances[0];

    // Simulate an SSE event
    await act(async () => {
      source.simulateEvent('order_status_changed', JSON.stringify({
        type: 'order_status_changed',
        data: { order_id: '42', new_status: 'completed' },
        timestamp: new Date().toISOString(),
      }));
    });

    expect(invalidateSpy).toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith(expect.stringContaining('complete'));
  });

  it('should show toast on loyalty_milestone event', async () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: { id: 1 }, loading: false });

    const { useEventStream } = await import('./useEventStream');
    const { renderHook, act } = await import('@testing-library/react');
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
    const React = await import('react');

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    renderHook(() => useEventStream(), { wrapper });

    const source = MockEventSource.instances[0];

    await act(async () => {
      source.simulateEvent('loyalty_milestone', JSON.stringify({
        type: 'loyalty_milestone',
        data: { user_id: 1, milestone: 5, reward: 'Free Wash', total_visits: 5 },
        timestamp: new Date().toISOString(),
      }));
    });

    expect(notifySuccess).toHaveBeenCalledWith(expect.stringContaining('Free Wash'));
  });

  it('should close connection when user logs out', async () => {
    const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
    mockUseAuth.mockReturnValue({ user: { id: 1 }, loading: false });

    const { useEventStream } = await import('./useEventStream');
    const { renderHook } = await import('@testing-library/react');
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
    const React = await import('react');

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { rerender } = renderHook(() => useEventStream(), { wrapper });

    expect(MockEventSource.instances).toHaveLength(1);
    const source = MockEventSource.instances[0];
    expect(source.readyState).not.toBe(2); // not CLOSED

    // Simulate logout
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    rerender();

    expect(source.readyState).toBe(2); // CLOSED
  });

  it('should show toast on new_notification event', async () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: { id: 1 }, loading: false });

    const { useEventStream } = await import('./useEventStream');
    const { renderHook, act } = await import('@testing-library/react');
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
    const React = await import('react');

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    renderHook(() => useEventStream(), { wrapper });

    const source = MockEventSource.instances[0];

    await act(async () => {
      source.simulateEvent('new_notification', JSON.stringify({
        type: 'new_notification',
        data: { order_id: '10', message: 'New order placed' },
        timestamp: new Date().toISOString(),
      }));
    });

    expect(notifyInfo).toHaveBeenCalledWith(expect.stringContaining('New order'));
  });
});
