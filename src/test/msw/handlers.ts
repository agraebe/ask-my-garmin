import { http, HttpResponse } from 'msw';

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
];
