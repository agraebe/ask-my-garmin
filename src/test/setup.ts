import { beforeAll, afterEach, afterAll, expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { server } from './msw/server';

// Extend Vitest's expect with jest-dom matchers without relying on a global `expect`
expect.extend(matchers);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  // @testing-library auto-cleanup requires a global afterEach; since globals: false,
  // we call it explicitly so rendered components don't leak between tests.
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
