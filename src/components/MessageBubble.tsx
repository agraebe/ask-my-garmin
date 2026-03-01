import type { Message } from '@/types';

interface Props {
  message: Message;
  isStreaming?: boolean;
}

function GarminIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function MessageBubble({ message, isStreaming = false }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mr-2 mt-1 flex-shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-garmin-blue text-white">
            <GarminIcon />
          </div>
        </div>
      )}

      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] ${
          isUser
            ? 'rounded-br-sm bg-garmin-blue text-white'
            : 'rounded-bl-sm border border-garmin-border bg-garmin-surface text-garmin-text shadow-sm'
        } ${isStreaming && message.content ? 'cursor-blink' : ''}`}
      >
        {isStreaming && !message.content ? (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-garmin-text-muted [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-garmin-text-muted [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-garmin-text-muted" />
          </span>
        ) : (
          <span className="whitespace-pre-wrap">{message.content || '…'}</span>
        )}
      </div>
    </div>
  );
}
