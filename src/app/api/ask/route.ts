import { type NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  getRecentActivities,
  getDailyStats,
  getSleepData,
  getTrainingLoad,
  getHeartRateZones,
  getRecoveryMetrics,
  formatDuration,
  metersToMiles,
} from '@/lib/garmin';
import type { Message } from '@/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(garminData: object): string {
  return `You are a knowledgeable and friendly fitness assistant with expertise in endurance training, \
recovery science, and sports physiology. You have access to the user's comprehensive Garmin health \
and activity data shown below. Answer questions conversationally and precisely — cite specific \
numbers from the data when relevant. If a metric is missing or null, say so rather than guessing.

You can provide insights on:
- Training readiness and race predictions based on fitness trends and training load
- Optimal pacing recommendations using heart rate zones and historical performance
- Injury risk assessment from training load progression and recovery metrics
- Daily training decisions using HRV, sleep quality, and stress levels
- Training plan recommendations based on current fitness and performance history
- Return-to-training strategies after illness or time off

Formatting tips:
- Use plain text; avoid markdown headers.
- Convert distances to miles unless the user asks for km.
- Convert durations to hours/minutes.
- When discussing heart rate, reference the user's specific zones.
- Consider training stress balance (TSB) and acute/chronic load ratios for training advice.
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
  const [activitiesResult, dailyResult, sleepResult, trainingResult, hrZonesResult, recoveryResult] = await Promise.allSettled([
    getRecentActivities(10),
    getDailyStats(),
    getSleepData(),
    getTrainingLoad(),
    getHeartRateZones(),
    getRecoveryMetrics(),
  ]);

  const garminData = {
    recentActivities:
      activitiesResult.status === 'fulfilled'
        ? activitiesResult.value.map((a) => ({
            ...a,
            distanceMiles: metersToMiles(a.distance),
            durationFormatted: formatDuration(a.duration),
          }))
        : { error: (activitiesResult.reason as Error).message },
    todayStats:
      dailyResult.status === 'fulfilled'
        ? dailyResult.value
        : { error: (dailyResult.reason as Error).message },
    lastNightSleep:
      sleepResult.status === 'fulfilled'
        ? sleepResult.value
        : { error: (sleepResult.reason as Error).message },
    trainingLoad:
      trainingResult.status === 'fulfilled'
        ? trainingResult.value
        : { error: (trainingResult.reason as Error).message },
    heartRateZones:
      hrZonesResult.status === 'fulfilled'
        ? hrZonesResult.value
        : { error: (hrZonesResult.reason as Error).message },
    recoveryMetrics:
      recoveryResult.status === 'fulfilled'
        ? recoveryResult.value
        : { error: (recoveryResult.reason as Error).message },
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
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
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
