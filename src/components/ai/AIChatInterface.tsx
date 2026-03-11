import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Bot, User, Loader2, Sparkles, ChefHat,
  Star, MessageCircle, Utensils, Clock, BarChart2, Lightbulb,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useAIStore } from '../../store/ai';
import { isGeminiConfigured } from '../../services/gemini';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { cn } from '../../lib/utils';
import type { AIMessage } from '../../types/ai';
import { useTranslation } from '../../hooks/useTranslation';

const QUICK_PROMPTS = [
  { icon: <Utensils className="w-4 h-4" />, label: 'Receitas fáceis', prompt: 'Mostre receitas fáceis e rápidas' },
  { icon: <BarChart2 className="w-4 h-4" />, label: 'Rica em proteína', prompt: 'Receitas ricas em proteína' },
  { icon: <Lightbulb className="w-4 h-4" />, label: 'Dica nutricional', prompt: 'Me dê uma dica de nutrição para hoje' },
  { icon: <Clock className="w-4 h-4" />, label: 'Até 20 minutos', prompt: 'Receitas prontas em até 20 minutos' },
];

export function AIChatInterface() {
  const { user } = useAuthStore();
  const {
    currentConversation,
    messages,
    sendingMessage,
    createConversation,
    setCurrentConversation,
    sendMessage,
  } = useAIStore();

  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const t = useTranslation();
  const geminiConfigured = isGeminiConfigured();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!sendingMessage && inputRef.current) {
      inputRef.current.focus();
    }
  }, [sendingMessage]);

  const handleStartConversation = async () => {
    if (!user) return;
    try {
      const conversation = await createConversation(user.id);
      setCurrentConversation(conversation);
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, overrideMsg?: string) => {
    e?.preventDefault();
    const msg = (overrideMsg ?? inputMessage).trim();
    if (!msg || !currentConversation || sendingMessage) return;
    setInputMessage('');
    try {
      await sendMessage(currentConversation.id, msg);
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

  const handleQuickPrompt = async (prompt: string) => {
    if (!currentConversation) {
      if (!user) return;
      try {
        const conversation = await createConversation(user.id);
        setCurrentConversation(conversation);
        await new Promise(r => setTimeout(r, 100));
        await sendMessage(conversation.id, prompt);
      } catch {}
      return;
    }
    await handleSendMessage(undefined, prompt);
  };

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
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <div key={index} className="flex items-start gap-2 my-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
            <span>{line.substring(2)}</span>
          </div>
        );
      }
      const boldText = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return line.trim() ? (
        <p key={index} className="mb-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: boldText }} />
      ) : (
        <div key={index} className="h-1" />
      );
    });
  };

  const renderRecipeCard = (recipe: any, index: number) => (
    <motion.div
      key={index}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="mt-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg flex-shrink-0">
          <ChefHat className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate mb-0.5">
            {recipe.title}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-1.5">
            {recipe.description}
          </p>
          <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
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
            {recipe.prepTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {recipe.prepTime} min
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (!currentConversation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[560px] px-4 py-10">
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
                onClick={() => handleQuickPrompt(item.prompt)}
                className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-left hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group"
              >
                <span className="text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                  {item.icon}
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
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
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[640px]">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-700/60">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none mb-0.5">
            {currentConversation.ai_config?.ai_name || 'NutriBot'}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <p className="text-xs text-gray-500 dark:text-gray-400">{t.aiChat.headerSubtitle}</p>
          </div>
        </div>
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
                    {message.metadata.recipes.map((recipe: any, index: number) =>
                      renderRecipeCard(recipe, index)
                    )}
                  </div>
                )}

                <div className={cn(
                  'text-[10px] mt-2 opacity-60 select-none',
                  message.sender_type === 'user' ? 'text-right' : 'text-left'
                )}>
                  {new Date(message.created_at).toLocaleTimeString('pt-BR', {
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
              <div className="flex items-center gap-1.5">
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
              </div>
            </div>
          </motion.div>
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
              className="w-full resize-none px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all leading-relaxed"
              disabled={sendingMessage}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>
          <motion.button
            type="submit"
            disabled={!inputMessage.trim() || sendingMessage}
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
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 text-center">
          {t.aiChat.disclaimer}
          {!geminiConfigured && t.aiChat.limitedModeSuffix}
        </p>
      </div>
    </div>
  );
}
