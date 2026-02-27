'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';
import SuggestedQuestions from './SuggestedQuestions';
import type { Message } from '@/types';

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to the bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || isStreaming) return;

      const userMessage: Message = { role: 'user', content: question };
      const updatedHistory = [...messages, userMessage];

      setMessages(updatedHistory);
      setInput('');
      setIsStreaming(true);

      // Add a placeholder assistant message to stream into
      const assistantPlaceholder: Message = { role: 'assistant', content: '' };
      setMessages([...updatedHistory, assistantPlaceholder]);

      try {
        const sessionToken = sessionStorage.getItem('garmin_session') ?? '';
        const response = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            history: messages, // send history before the new user message
            session_token: sessionToken,
          }),
        });

        // Refresh session token if the backend rotated it (e.g. OAuth refresh)
        const updatedToken = response.headers.get('X-Session-Token');
        if (updatedToken) {
          sessionStorage.setItem('garmin_session', updatedToken);
        }

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `HTTP ${response.status}`);
        }

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setMessages([...updatedHistory, { role: 'assistant', content: accumulated }]);
        }
      } catch (err) {
        const errorText = err instanceof Error ? err.message : 'Something went wrong';
        setMessages([...updatedHistory, { role: 'assistant', content: `Error: ${errorText}` }]);
      } finally {
        setIsStreaming(false);
        inputRef.current?.focus();
      }
    },
    [messages, isStreaming]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Message list */}
      <div className="chat-scroll flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {messages.length === 0 ? (
          <SuggestedQuestions onSelect={(q) => sendMessage(q)} />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.map((msg, i) => {
              const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1;
              return (
                <MessageBubble key={i} message={msg} isStreaming={isStreaming && isLastAssistant} />
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-garmin-border bg-garmin-surface px-3 py-3 sm:px-6">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your activities, sleep, heart rate…"
            rows={1}
            disabled={isStreaming}
            className="max-h-32 flex-1 resize-none overflow-y-auto rounded-xl border border-garmin-border bg-garmin-bg px-4 py-3 text-sm text-garmin-text placeholder:text-garmin-text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-garmin-blue disabled:cursor-not-allowed disabled:opacity-50"
            style={{ minHeight: '44px' }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-garmin-blue text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send"
          >
            {isStreaming ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
              </svg>
            )}
          </button>
        </form>
        <p className="mt-2 text-center text-xs text-garmin-text-muted">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
