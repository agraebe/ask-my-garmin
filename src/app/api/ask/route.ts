import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getRecentActivities, getDailySummary, getSleepData, formatDuration, metersToMiles } from '@/lib/garmin';
import type { Message } from '@/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(garminData: object): string {
  return `You are a knowledgeable and friendly fitness assistant. You have access to the user's \
real-time Garmin health and activity data shown below. Answer questions conversationally and \
precisely — cite specific numbers from the data when relevant. If a metric is missing or null, \
say so rather than guessing.

Formatting tips:
- Use plain text; avoid markdown headers.
- Convert distances to miles unless the user asks for km.
- Convert durations to hours/minutes.
- Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

## User's Garmin Data
${JSON.stringify(garminData, null, 2)}`;
}

export async function POST(request: NextRequest) {
  let question: string;
  let history: Message[];

  try {
    ({ question, history = [] } = await request.json());
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (!question?.trim()) {
    return new Response('Question is required', { status: 400 });
  }

  // Fetch Garmin data in parallel; surface partial data on failures
  const [activitiesResult, dailyResult, sleepResult] = await Promise.allSettled([
    getRecentActivities(10),
    getDailySummary(),
    getSleepData(),
  ]);

  const garminData = {
    recentActivities: activitiesResult.status === 'fulfilled'
      ? activitiesResult.value.map((a) => ({
          ...a,
          distanceMiles: metersToMiles(a.distance),
          durationFormatted: formatDuration(a.duration),
        }))
      : { error: (activitiesResult.reason as Error).message },
    todaysSummary: dailyResult.status === 'fulfilled'
      ? dailyResult.value
      : { error: (dailyResult.reason as Error).message },
    lastNightSleep: sleepResult.status === 'fulfilled'
      ? sleepResult.value
      : { error: (sleepResult.reason as Error).message },
  };

  // Build conversation history for Claude (exclude system messages)
  const claudeMessages: Anthropic.Messages.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  // Stream the response back
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: buildSystemPrompt(garminData),
    messages: claudeMessages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
