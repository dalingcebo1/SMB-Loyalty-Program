// src/utils/analytics.ts
// Simple analytics tracker stub
// Simple analytics tracker stub
export function track(event: string, data?: Record<string, unknown>) {
  console.log(`[Analytics] Event: ${event}`, data || {});
}

// Track viewing a step in the flow
export function trackStepView(step: number) {
  track('step_view', { step });
}
