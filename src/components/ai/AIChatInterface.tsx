import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2, Sparkles, ChefHat, Star, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useAIStore } from '../../store/ai';
import { isGeminiConfigured } from '../../services/gemini';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { cn } from '../../lib/utils';
import type { AIMessage } from '../../types/ai';
import { useTranslation } from '../../hooks/useTranslation';

export function AIChatInterface() {
  const { user } = useAuthStore();
  const {
    conversations,
    currentConversation,
    messages,
    sendingMessage,
    createConversation,
    setCurrentConversation,
    sendMessage,
    fetchMessages,
  } = useAIStore();

  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !currentConversation || sendingMessage) return;

    const messageToSend = inputMessage.trim();
    setInputMessage('');

    try {
      await sendMessage(currentConversation.id, messageToSend);
    } catch (error) {
      console.error('Error sending message:', error);
      setInputMessage(messageToSend);
    }
  };

  const formatMessageContent = (content: string) => {
    return content.split('\n').map((line, index) => {
      if (line.startsWith('# ')) {
        return (
          <h3 key={index} className="text-lg font-bold mt-4 mb-2">
            {line.substring(2)}
          </h3>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h4 key={index} className="text-md font-semibold mt-3 mb-1">
            {line.substring(3)}
          </h4>
        );
      }

      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <div key={index} className="flex items-start gap-2 my-1">
            <span className="text-purple-500 mt-1">•</span>
            <span>{line.substring(2)}</span>
          </div>
        );
      }

      const boldText = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      return line.trim() ? (
        <p key={index} className="mb-2" dangerouslySetInnerHTML={{ __html: boldText }} />
      ) : (
        <br key={index} />
      );
    });
  };

  const renderRecipeCard = (recipe: any) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-purple-200 dark:border-purple-700 mt-3"
    >
      <div className="flex items-start gap-3">
        <ChefHat className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
            {recipe.title}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {recipe.description}
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {recipe.author}
            </span>
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {recipe.rating > 0 ? recipe.rating.toFixed(1) : t.recipe.noReviews}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );

  // Sem conversa ativa: tela inicial
  if (!currentConversation) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="p-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full">
                <Bot className="w-12 h-12 text-white" />
              </div>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-1 -right-1"
              >
                <Sparkles className="w-6 h-6 text-yellow-500" />
              </motion.div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {t.aiChat.welcomeTitle}
          </h2>

          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            {t.aiChat.welcomeDescription}
          </p>

          {!geminiConfigured && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>{t.aiChat.limitedModeNoticeTitle}</strong>{' '}
                {t.aiChat.limitedModeNoticeBody}
              </p>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <h3 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">
                {t.aiChat.examples.recipesTitle}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t.aiChat.examples.recipesExample}
              </p>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
                {t.aiChat.examples.tipsTitle}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t.aiChat.examples.tipsExample}
              </p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <h3 className="font-semibold text-green-700 dark:text-green-300 mb-2">
                {t.aiChat.examples.helpTitle}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t.aiChat.examples.helpExample}
              </p>
            </div>
          </div>

          <motion.button
            onClick={handleStartConversation}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-200 flex items-center justify-center gap-2 mx-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <MessageCircle className="w-5 h-5" />
            {t.aiChat.startConversationButton}
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {/* Header do Chat */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">
                {currentConversation.ai_config?.ai_name || 'NutriBot'}
              </h3>
              <p className="text-purple-100 text-sm">
                {t.aiChat.headerSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Área de Mensagens */}
        <div className="h-96 overflow-y-auto p-4 space-y-4">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'flex gap-3',
                  message.sender_type === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.sender_type === 'ai' && (
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-xs lg:max-w-md px-4 py-2 rounded-lg',
                    message.sender_type === 'user'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  )}
                >
                  <div className="text-sm">
                    {formatMessageContent(message.content)}
                  </div>

                  {message.metadata?.recipes && message.metadata.recipes.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.metadata.recipes.map((recipe: any, index: number) =>
                        renderRecipeCard(recipe)
                      )}
                    </div>
                  )}

                  <div className="text-xs opacity-70 mt-1">
                    {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                {message.sender_type === 'user' && (
                  <div className="p-2 bg-green-600 rounded-full flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Indicador de digitação */}
          {sendingMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 justify-start"
            >
              <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t.aiChat.typing}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input de Mensagem */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={t.aiChat.inputPlaceholder}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              disabled={sendingMessage}
            />
            <motion.button
              type="submit"
              disabled={!inputMessage.trim() || sendingMessage}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2',
                !inputMessage.trim() || sendingMessage
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'
              )}
              whileHover={!sendingMessage && inputMessage.trim() ? { scale: 1.05 } : {}}
              whileTap={!sendingMessage && inputMessage.trim() ? { scale: 0.95 } : {}}
            >
              {sendingMessage ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </motion.button>
          </form>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            {t.aiChat.disclaimer}
            {!geminiConfigured && t.aiChat.limitedModeSuffix}
          </p>
        </div>
      </div>
    </div>
  );
}
