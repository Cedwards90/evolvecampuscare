import { useEffect, useRef, useState } from 'react';
import { MessageCircleQuestion, Send, X, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'How do I submit a support request?',
  'What documents do I need to attach?',
  'What happens after I submit a request?',
];

/**
 * Role-aware, knowledge-only assistant. It answers platform and policy questions
 * and has no access to student or request records.
 */
export function PlatformAssistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!user) return null;

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || isStreaming) return;
    setError(null);
    setInput('');
    const next: ChatMessage[] = [...messages, { role: 'user', content: question }];
    setMessages(next);
    setIsStreaming(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/platform-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token ?? ''}`,
          },
          body: JSON.stringify({ messages: next }),
        }
      );

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'The assistant is unavailable right now.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let answer = '';
      setMessages([...next, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta) {
              answer += delta;
              setMessages([...next, { role: 'assistant', content: answer }]);
            }
          } catch {
            // ignore partial JSON chunks
          }
        }
      }

      if (!answer) {
        setMessages([
          ...next,
          { role: 'assistant', content: 'I could not generate an answer. Please try rephrasing.' },
        ]);
      }
    } catch (err) {
      setMessages(next);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  };

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 gap-2 rounded-full shadow-lg md:bottom-6"
        aria-label="Open the platform assistant"
      >
        <MessageCircleQuestion className="h-4 w-4" />
        <span className="hidden sm:inline">Ask a question</span>
      </Button>
    );
  }

  return (
    <div className="fixed bottom-20 right-2 left-2 z-40 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border bg-background shadow-xl sm:left-auto sm:right-4 sm:w-96 md:bottom-6">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Platform assistant</p>
          <p className="truncate text-xs text-muted-foreground">
            Answers about the platform and policies
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close assistant">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Ask about requests, surveys, reports, or program policy. I cannot see any student
              records.
            </p>
            {SUGGESTIONS.map((s) => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                className="h-auto w-full justify-start whitespace-normal text-left"
                onClick={() => send(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === 'user'
                ? 'ml-auto max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground [overflow-wrap:anywhere]'
                : 'max-w-[90%] rounded-2xl bg-muted px-3 py-2 text-sm [overflow-wrap:anywhere]'
            }
          >
            {message.role === 'assistant' ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            ) : (
              message.content
            )}
          </div>
        ))}
        {isStreaming && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> thinking…
          </p>
        )}
        {error && <p className="text-sm text-destructive [overflow-wrap:anywhere]">{error}</p>}
      </div>

      <div className="flex items-end gap-2 border-t p-3">
        <Textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask a question…"
          className="min-h-0 resize-none"
        />
        <Button
          size="icon"
          onClick={() => send(input)}
          disabled={isStreaming || !input.trim()}
          aria-label="Send question"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
