import { http, HttpResponse } from 'msw';

// Default happy-path handlers used across all tests.
// Override per-test with server.use(...) inside the test body.
export const handlers = [
  http.get('/api/garmin/status', () =>
    HttpResponse.json({ connected: true, email: 'runner@example.com' })
  ),

  http.get('/api/garmin/data', () =>
    HttpResponse.json({
      activities: [],
      dailySummary: null,
      sleepData: null,
      fetchedAt: new Date().toISOString(),
    })
  ),

  http.post('/api/ask', () =>
    new HttpResponse('This is a test response.', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  ),
];
