// src/mocks/server.ts
import { setupServer } from 'msw/node';

// Setup requests interception using the given handlers
// No request handlers are defined; API client is stubbed directly in tests
export const server = setupServer();
