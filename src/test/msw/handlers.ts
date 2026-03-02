import { http, HttpResponse } from 'msw';
import type { Memory } from '@/types';

const mockMemories: Memory[] = [
  {
    id: 'mem-1',
    key: 'Next Marathon',
    content: 'Boston Marathon on April 21, 2026',
    category: 'race_event',
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    source_context: 'My next marathon is Boston on April 21',
  },
];

// Default happy-path handlers used across all tests.
// Override per-test with server.use(...) inside the test body.
export const handlers = [
  http.get('/api/auth/status', () =>
    HttpResponse.json({ connected: true, email: 'runner@example.com' })
  ),

  http.post('/api/auth/login', () => HttpResponse.json({ status: 'ok' })),

  http.post('/api/auth/mfa', () => HttpResponse.json({ status: 'ok' })),

  http.post('/api/auth/logout', () => HttpResponse.json({ status: 'ok' })),

  http.post(
    '/api/ask',
    () =>
      new HttpResponse('This is a test response.', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
  ),

  http.get('/api/memories', () => HttpResponse.json({ memories: mockMemories })),

  http.post('/api/memories', () =>
    HttpResponse.json({
      id: 'mem-new',
      key: 'New Memory',
      content: 'Test content',
      category: 'personal',
      created_at: '2026-01-20T10:00:00Z',
      updated_at: '2026-01-20T10:00:00Z',
      source_context: '',
    })
  ),

  http.patch('/api/memories/:id', () =>
    HttpResponse.json({
      id: 'mem-1',
      key: 'Updated Memory',
      content: 'Updated content',
      category: 'personal',
      created_at: '2026-01-15T10:00:00Z',
      updated_at: '2026-01-20T10:00:00Z',
      source_context: '',
    })
  ),

  http.delete('/api/memories/:id', () => HttpResponse.json({ status: 'ok' })),
];
