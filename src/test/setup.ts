import { beforeAll, afterEach, afterAll } from 'vitest';

// Extend Vitest's `expect` with jest-dom matchers (toBeInTheDocument, etc.)
import '@testing-library/jest-dom';

// Start MSW before all tests, reset handlers after each, tear down after all
import { server } from './msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
