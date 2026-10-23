import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useToastStore } from '../../store/toast';
import { useUnreadMessagesStore } from '../../store/unread-messages';
import { appLocale } from '../../lib/format';
import { useTranslation } from '../../hooks/useTranslation';
import { listMessages, markMessagesRead, sendMessage, subscribeMessages, type CareMessage } from '../../services/messages';
import { cn } from '../../lib/utils';

interface ChatThreadProps {
  nutritionistId: string;
  clientId: string;
  /** Nome de quem está do outro lado (título da conversa). */
  otherName: string;
  /** Conversa ocupando quase a tela toda no celular (aba Mensagens). */
  tall?: boolean;
  /** Algo no canto do título (ex.: link para a ficha do paciente). */
  action?: ReactNode;
}

// Enter envia só com teclado físico; no celular o Enter quebra a linha e o envio é pelo botão.
const enterSends = () => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

const sameDay = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10);

/** Conversa entre nutricionista e paciente, com mensagens chegando na hora. */
export function ChatThread({ nutritionistId, clientId, otherName, tall = false, action }: ChatThreadProps) {
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToastStore();
  const t = useTranslation();
  const m = t.messages;
  const [messages, setMessages] = useState<CareMessage[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const markRead = useCallback(() => {
    markMessagesRead(nutritionistId, clientId)
      .then(() => {
        const me = useAuthStore.getState().user?.id;
        if (me) useUnreadMessagesStore.getState().refresh(me);
      })
      .catch((error) => console.error('Error marking messages read:', error));
  }, [nutritionistId, clientId]);

  useEffect(() => {
    let active = true;
    listMessages(nutritionistId, clientId)
      .then((list) => {
        if (!active) return;
        setMessages(list);
        markRead();
      })
      .catch((error) => {
        console.error('Error loading messages:', error);
        if (active) setMessages([]);
      });
    const stop = subscribeMessages(nutritionistId, clientId, (msg) => {
      setMessages((prev) => (prev && !prev.some((p) => p.id === msg.id) ? [...prev, msg] : prev));
      if (msg.sender_id !== user?.id) markRead();
    });
    return () => {
      active = false;
      stop();
    };
  }, [nutritionistId, clientId, user?.id, markRead]);

  // Sempre mostra a mensagem mais recente.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!user || !text.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage({ nutritionistId, clientId, senderId: user.id, body: text });
      setMessages((prev) => (prev && !prev.some((p) => p.id === msg.id) ? [...prev, msg] : prev));
      setText('');
    } catch (error) {
      console.error('Error sending message:', error);
      const message = String((error as { message?: string } | null)?.message ?? '');
      showToast(message.includes('too_many_messages') ? m.tooMany : message.includes('row-level') ? m.linkEnded : m.sendError, 'error');
    } finally {
      setSending(false);
    }
  };

  const time = (iso: string) => new Date(iso).toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' });
  const date = (iso: string) => new Date(iso).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short' });

  return (
    <section className="flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <MessageCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        <h3 className="min-w-0 truncate text-base font-semibold text-slate-900 dark:text-white">{m.with.replace('{name}', otherName)}</h3>
        {action}
      </header>

      <div
        ref={listRef}
        className={cn(
          'space-y-2 overflow-y-auto px-3 py-3',
          // Altura da tela menos cabeçalho, título e barra de baixo: o campo de texto fica sempre à vista.
          tall ? 'h-[calc(100dvh-19rem)] min-h-[16rem] md:h-[28rem]' : 'h-80 sm:h-96'
        )}
        aria-live="polite"
      >
        {messages === null ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : !messages.length ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500 dark:text-slate-400">{m.empty}</p>
        ) : (
          messages.map((msg, i) => {
            const mine = msg.sender_id === user?.id;
            const showDate = i === 0 || !sameDay(messages[i - 1].created_at, msg.created_at);
            return (
              <div key={msg.id}>
                {showDate && <p className="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">{date(msg.created_at)}</p>}
                <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm',
                      mine
                        ? 'rounded-br-md bg-emerald-600 text-white'
                        : 'rounded-bl-md bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                    )}
                  >
                    {msg.body}
                    <span className={cn('mt-0.5 block text-right text-[10px]', mine ? 'text-emerald-100' : 'text-slate-400')}>
                      {time(msg.created_at)}
                      {mine && msg.read_at && ` • ${m.read}`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        className="flex items-end gap-2 border-t border-slate-100 p-3 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter envia (com teclado físico); Shift+Enter quebra a linha.
            if (e.key === 'Enter' && !e.shiftKey && enterSends()) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={m.placeholder}
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          aria-label={m.send}
          title={m.send}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </section>
  );
}
