import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Bot, User, Loader2, Sparkles, ChefHat,
  Star, MessageCircle, Clock, Plus, Trash2, History, Flame, Check,
  Cherry, Leaf, Dumbbell, Moon,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useAIStore } from '../../store/ai';
import { isGeminiConfigured } from '../../services/gemini';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import type { AIResponse } from '../../types/ai';
import { useTranslation } from '../../hooks/useTranslation';
import { useAIUserContext } from '../../hooks/useAIUserContext';
import { confirmDialog } from '../../store/confirm';
import { usePremiumStore } from '../../store/premium';
import { appLocale } from '../../lib/format';

type RecipeCardData = NonNullable<AIResponse['recipes']>[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Converte **negrito** em <strong> sem usar innerHTML: o conteúdo vem do usuário
// e da IA (que lê textos de receitas de terceiros), então não pode virar HTML.
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

// Texto (rótulo e pergunta enviada) vem de t.feedback.ai.quickPrompts.
const QUICK_PROMPTS = [
  { icon: <Cherry className="w-4 h-4" />, key: 'strawberries' },
  { icon: <Moon className="w-4 h-4" />, key: 'lightDinner' },
  { icon: <Dumbbell className="w-4 h-4" />, key: 'protein' },
  { icon: <Leaf className="w-4 h-4" />, key: 'quickVegan' },
] as const;

// Títulos padrão gravados no banco (em português); na tela viram a data da conversa.
const DEFAULT_TITLES = ['Nova conversa com IA', 'Nova conversa'];

export function AIChatInterface() {
  const { user } = useAuthStore();
  const {
    conversations,
    currentConversation,
    messages,
    sendingMessage,
    loadingConversations,
    fetchConversations,
    createConversation,
    setCurrentConversation,
    archiveConversation,
    archiveAllConversations,
    sendMessage,
  } = useAIStore();
  const buildContext = useAIUserContext();

  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const t = useTranslation();
  const categoryLabels: Record<string, string> = t.feedback.ai.categoryLabels;
  const geminiConfigured = isGeminiConfigured();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sendingMessage]);

  // Histórico de conversas do usuário (antes cada visita começava do zero).
  useEffect(() => {
    if (user?.id) fetchConversations(user.id);
  }, [user?.id, fetchConversations]);

  useEffect(() => {
    if (!sendingMessage && inputRef.current) {
      inputRef.current.focus();
    }
  }, [sendingMessage]);

  // Conversa nova só existe na tela até a primeira mensagem: gravar ao abrir deixava
  // conversas vazias no banco toda vez que alguém abria e saía sem escrever.
  const [draft, setDraft] = useState(false);
  const creatingRef = useRef(false);

  useEffect(() => {
    if (currentConversation) setDraft(false);
  }, [currentConversation]);

  const handleStartConversation = () => {
    setCurrentConversation(null);
    setDraft(true);
  };

  const handleSendMessage = async (e?: React.FormEvent, overrideMsg?: string) => {
    e?.preventDefault();
    const msg = (overrideMsg ?? inputMessage).trim();
    if (!msg || !user || sendingMessage || creatingRef.current) return;
    setInputMessage('');
    try {
      let conversationId = currentConversation?.id;
      if (!conversationId) {
        creatingRef.current = true;
        try {
          conversationId = (await createConversation(user.id, usePremiumStore.getState().aiViaNutritionist ?? undefined)).id;
        } finally {
          creatingRef.current = false;
        }
      }
      await sendMessage(conversationId, msg, buildContext());
    } catch (error) {
      console.error('Error sending message:', error);
      if (!overrideMsg) setInputMessage(msg);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickPrompt = (prompt: string) => handleSendMessage(undefined, prompt);

  const formatMessageContent = (content: string) => {
    return content.split('\n').map((line, index) => {
      if (line.startsWith('# ')) {
        return (
          <h3 key={index} className="text-base font-bold mt-3 mb-1.5 text-gray-900 dark:text-white">
            {line.substring(2)}
          </h3>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h4 key={index} className="text-sm font-semibold mt-2.5 mb-1 text-gray-800 dark:text-gray-100">
            {line.substring(3)}
          </h4>
        );
      }
      if (line.startsWith('### ')) {
        return (
          <h4 key={index} className="text-sm font-semibold mt-2.5 mb-1 text-gray-800 dark:text-gray-100">
            {renderInline(line.substring(4))}
          </h4>
        );
      }
      const numbered = line.match(/^(\d{1,2})[.)] (.*)$/);
      if (numbered) {
        return (
          <div key={index} className="flex items-start gap-2 my-1">
            <span className="min-w-[1.25rem] text-right font-semibold text-emerald-600 dark:text-emerald-400">{numbered[1]}.</span>
            <span>{renderInline(numbered[2])}</span>
          </div>
        );
      }
      if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
        return (
          <div key={index} className="flex items-start gap-2 my-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
            <span>{renderInline(line.substring(2))}</span>
          </div>
        );
      }
      return line.trim() ? (
        <p key={index} className="mb-1.5 leading-relaxed">{renderInline(line)}</p>
      ) : (
        <div key={index} className="h-1" />
      );
    });
  };

  const renderRecipeCard = (recipe: RecipeCardData, index: number) => (
    <motion.div
      key={recipe.id ?? index}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
    <Link
      // Conversas antigas guardaram um ID numérico que não abre a receita: leva à busca pelo título.
      to={UUID_RE.test(String(recipe.id)) ? `/receita/${recipe.id}` : `/?q=${encodeURIComponent(recipe.title)}`}
      className="mt-2 block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors shadow-sm"
    >
      <div className="flex items-start gap-3">
        {recipe.image ? (
          <img
            src={recipe.image}
            alt=""
            loading="lazy"
            className="h-16 w-16 flex-shrink-0 rounded-lg object-cover bg-gray-100 dark:bg-gray-700"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg flex-shrink-0">
            <ChefHat className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate mb-0.5">
            {recipe.title}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-1.5">
            {recipe.description}
          </p>
          {(!!recipe.matched?.length || (recipe.category && categoryLabels[recipe.category])) && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {recipe.matched?.map((m) => (
                <span key={m} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  <Check className="w-3 h-3" />
                  {t.aiChat.contains} {m}
                </span>
              ))}
              {recipe.category && categoryLabels[recipe.category] && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  {categoryLabels[recipe.category]}
                </span>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-400">
            {recipe.author && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {recipe.author}
              </span>
            )}
            {recipe.rating > 0 && (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {recipe.rating.toFixed(1)}
              </span>
            )}
            {!!recipe.prepTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {recipe.prepTime} min
              </span>
            )}
            {!!recipe.calories && (
              <span className="flex items-center gap-1">
                <Flame className="w-3 h-3" />
                {Math.round(recipe.calories)} kcal
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
    </motion.div>
  );

  // Conversas da versão antiga ficaram com o título padrão: mostra a data no lugar.
  const conversationTitle = (c: { title?: string; created_at: string }) =>
    !c.title || DEFAULT_TITLES.includes(c.title)
      ? `${t.aiChat.conversationFrom} ${new Date(c.created_at).toLocaleDateString(appLocale(), { day: '2-digit', month: '2-digit' })}`
      : c.title;

  const lastAiMessage = [...messages].reverse().find((m) => m.sender_type === 'ai');
  const suggestions = !sendingMessage ? lastAiMessage?.metadata?.suggestions?.slice(0, 4) ?? [] : [];

  const sidebar = (
    <aside className="hidden md:flex w-64 flex-shrink-0 flex-col border-r border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-900/40">
      <div className="p-3">
        <button
          onClick={handleStartConversation}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t.aiChat.newConversation}
        </button>
      </div>
      <div className="px-3 pb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
        <History className="w-3.5 h-3.5" />
        <span className="flex-1">{t.aiChat.history}</span>
        {conversations.length > 1 && (
          <button
            onClick={async () => {
              if (user && (await confirmDialog(t.aiChat.clearHistoryConfirm))) archiveAllConversations(user.id);
            }}
            className="normal-case font-medium tracking-normal text-gray-400 hover:text-red-600 transition-colors"
          >
            {t.aiChat.clearHistory}
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-3 space-y-1" aria-label={t.aiChat.history}>
        {loadingConversations && conversations.length === 0 && (
          <p className="px-2 py-2 text-xs text-gray-400">{t.common.loading}</p>
        )}
        {!loadingConversations && conversations.length === 0 && (
          <p className="px-2 py-2 text-xs text-gray-400">{t.aiChat.noConversations}</p>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={cn(
              'group flex items-center gap-1 rounded-lg pr-1 transition-colors',
              currentConversation?.id === c.id
                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            <button
              onClick={() => currentConversation?.id !== c.id && setCurrentConversation(c)}
              className="flex-1 min-w-0 px-2.5 py-2 text-left"
            >
              <p className="truncate text-sm text-gray-800 dark:text-gray-200">{conversationTitle(c)}</p>
              <p className="text-xs text-gray-400">
                {new Date(c.last_message_at || c.created_at).toLocaleDateString(appLocale())}
              </p>
            </button>
            <button
              onClick={async () => {
                if (await confirmDialog(t.aiChat.deleteConversationConfirm)) archiveConversation(c.id);
              }}
              className="p-1.5 rounded-md text-gray-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-600 transition"
              aria-label={t.aiChat.deleteConversation}
              title={t.aiChat.deleteConversation}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );

  const main = !currentConversation && !draft ? (
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-4 py-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl"
        >
          <div className="text-center mb-10">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <Bot className="w-10 h-10 text-white" />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                  className="absolute -top-2 -right-2 w-7 h-7 bg-amber-400 rounded-full flex items-center justify-center shadow-md"
                >
                  <Sparkles className="w-4 h-4 text-white" />
                </motion.div>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
              {t.aiChat.welcomeTitle}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-base max-w-lg mx-auto leading-relaxed">
              {t.aiChat.welcomeDescription}
            </p>
          </div>

          {!geminiConfigured && (
            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>{t.aiChat.limitedModeNoticeTitle}</strong>{' '}
                {t.aiChat.limitedModeNoticeBody}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-8">
            {QUICK_PROMPTS.map((item, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => handleQuickPrompt(t.feedback.ai.quickPrompts[item.key].prompt)}
                className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-left hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group"
              >
                <span className="text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                  {item.icon}
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.feedback.ai.quickPrompts[item.key].label}</span>
              </motion.button>
            ))}
          </div>

          <motion.button
            onClick={handleStartConversation}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <MessageCircle className="w-5 h-5" />
            {t.aiChat.startConversationButton}
          </motion.button>

          {conversations.length > 0 && (
            <div className="mt-6 md:hidden">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.aiChat.history}</p>
              <div className="space-y-1.5">
                {conversations.slice(0, 5).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCurrentConversation(c)}
                    className="w-full truncate rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:border-emerald-400"
                  >
                    {conversationTitle(c)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
  ) : (
    <div className="flex-1 min-w-0 flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-700/60">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none mb-0.5">
            NutriBot
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <p className="text-xs text-gray-500 dark:text-gray-400">{t.aiChat.headerSubtitle}</p>
          </div>
        </div>
        <button
          onClick={handleStartConversation}
          className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={t.aiChat.newConversation}
          title={t.aiChat.newConversation}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'flex gap-3',
                message.sender_type === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.sender_type === 'ai' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div className={cn(
                'max-w-[75%] lg:max-w-[70%] rounded-2xl px-4 py-3',
                message.sender_type === 'user'
                  ? 'bg-emerald-600 text-white rounded-tr-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-tl-sm border border-gray-200 dark:border-gray-700'
              )}>
                <div className="text-sm leading-relaxed">
                  {formatMessageContent(message.content)}
                </div>

                {message.metadata?.recipes && message.metadata.recipes.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {message.metadata.recipes.map((recipe, index) =>
                      renderRecipeCard(recipe, index)
                    )}
                  </div>
                )}

                <div className={cn(
                  'text-xs mt-2 opacity-60 select-none',
                  message.sender_type === 'user' ? 'text-right' : 'text-left'
                )}>
                  {new Date(message.created_at).toLocaleTimeString(appLocale(), {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              {message.sender_type === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {sendingMessage && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 justify-start"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-1.5" role="status" aria-label={t.aiChat.thinking}>
                <motion.span
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
                  className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
                />
                <motion.span
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
                  className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
                />
                <motion.span
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
                  className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
                />
                <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">{t.aiChat.thinking}</span>
              </div>
            </div>
          </motion.div>
        )}

        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-11">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSendMessage(undefined, s)}
                className="rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700/60">
        <form onSubmit={handleSendMessage} className="flex gap-2.5 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              rows={1}
              value={inputMessage}
              onChange={(e) => {
                setInputMessage(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder={t.aiChat.inputPlaceholder}
              className="w-full resize-none px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all leading-relaxed"
              disabled={sendingMessage}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>
          <motion.button
            type="submit"
            disabled={!inputMessage.trim() || sendingMessage}
            aria-label={t.messages.send}
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all',
              inputMessage.trim() && !sendingMessage
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            )}
            whileHover={inputMessage.trim() && !sendingMessage ? { scale: 1.08 } : {}}
            whileTap={inputMessage.trim() && !sendingMessage ? { scale: 0.92 } : {}}
          >
            {sendingMessage ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </motion.button>
        </form>
        <p className="text-xs text-gray-400 dark:text-gray-400 mt-2 text-center">
          {t.aiChat.disclaimer}
          {!geminiConfigured && t.aiChat.limitedModeSuffix}
        </p>
      </div>
    </div>
  );

  return (
    // No celular a conversa ocupa a altura visível (menos cabeçalho e barra inferior) e a tela
    // de boas-vindas cresce com a página; no desktop, 640px.
    <div
      className={cn(
        'flex md:h-[640px]',
        (currentConversation || draft) && 'h-[calc(100dvh-13rem)] min-h-[440px]'
      )}
    >
      {sidebar}
      {main}
    </div>
  );
}
