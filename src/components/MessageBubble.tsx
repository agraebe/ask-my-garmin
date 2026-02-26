import type { Message } from '@/types';

interface Props {
  message: Message;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isStreaming = false }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mr-2 mt-1 flex-shrink-0">
          <div className="w-7 h-7 rounded-full bg-garmin-blue flex items-center justify-center">
            <span className="text-white text-xs font-bold">G</span>
          </div>
        </div>
      )}

      <div
        className={`
          max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
          ${isUser
            ? 'bg-garmin-blue text-white rounded-br-sm'
            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
          }
          ${isStreaming ? 'cursor-blink' : ''}
        `}
      >
        {message.content || (isStreaming ? '' : '…')}
      </div>
    </div>
  );
}
