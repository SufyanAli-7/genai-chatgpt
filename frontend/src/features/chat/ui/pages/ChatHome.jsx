import { memo, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import useAuth from '../../../auth/hooks/useAuth.js';
import useChat from '../../hooks/useChat.js';
import 'highlight.js/styles/github-dark.css';

const ChatMessageItem = memo(({ chatMessage, isSending, isLast }) => {
  if (chatMessage.author === 'user') {
    return (
      <div className="ml-auto w-fit max-w-2xl rounded-3xl bg-zinc-200 px-6 py-3 text-sm text-zinc-900">
        {chatMessage.content}
      </div>
    );
  }

  return (
    <div className="markdown-content max-w-3xl text-[15px] leading-7 text-zinc-100">
      {chatMessage.content ? (
        <ReactMarkdown remarkPlugins={[ remarkGfm ]} rehypePlugins={[ rehypeHighlight ]}>
          {chatMessage.content}
        </ReactMarkdown>
      ) : isSending && isLast ? (
        <span className="inline-flex items-center gap-2 text-zinc-400">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
          Thinking...
        </span>
      ) : null}
    </div>
  );
});

ChatMessageItem.displayName = 'ChatMessageItem';

const ChatHome = () => {
  const [ message, setMessage ] = useState('');
  const scrollContainerRef = useRef(null);
  const isAutoScrollEnabledRef = useRef(true);
  const { user } = useAuth();
  const { messages, isSending, error, send, clearError, selectedConversationId } = useChat();

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // Keep auto-scroll active only if user is near the bottom (within 80px)
    isAutoScrollEnabledRef.current = scrollHeight - scrollTop - clientHeight < 80;
  };

  useEffect(() => {
    if (isAutoScrollEnabledRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [ messages ]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!message.trim() || isSending) {
      return;
    }

    clearError();
    const messageToSend = message;
    setMessage('');
    isAutoScrollEnabledRef.current = true;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
    await send(messageToSend);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="relative flex h-screen w-full flex-col">
      {!hasMessages ? (
        <div className="mx-auto mt-24 w-full max-w-4xl px-4 text-center md:mt-32">
          <h2 className="text-4xl font-medium tracking-tight text-zinc-100 md:text-5xl">What&apos;s on your mind today?</h2>
          <p className="mt-3 text-sm text-zinc-500">Signed in as {user?.email}</p>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-4xl flex-1 min-h-0 flex-col px-4 pb-28 pt-2">
        {hasMessages ? (
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="chat-scrollbar flex-1 space-y-6 overflow-y-auto pr-2"
          >
            {messages.map((chatMessage, index) => (
              <ChatMessageItem
                key={chatMessage.id}
                chatMessage={chatMessage}
                isSending={isSending}
                isLast={index === messages.length - 1}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black via-black/95 to-transparent pb-5 pt-16">
        <div className="pointer-events-auto mx-auto w-full max-w-4xl px-4">
          {error ? <p className="mb-2 text-sm text-rose-400">{error}</p> : null}

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-3 rounded-[30px] border border-white/10 bg-[#2a2a2b] px-4 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
          >
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
              aria-label="Add attachment"
            >
              +
            </button>

            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask anything"
              className="h-10 flex-1 bg-transparent text-[17px] text-zinc-100 outline-none placeholder:text-zinc-400"
              disabled={isSending}
            />

            <button
              type="submit"
              disabled={isSending || !message.trim()}
              className="rounded-full bg-zinc-100 px-5 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </form>

          <div className="mt-2 px-2 text-xs text-zinc-500">
            {selectedConversationId ? `Conversation ID: ${selectedConversationId}` : 'New chat starts with your first message.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatHome;
