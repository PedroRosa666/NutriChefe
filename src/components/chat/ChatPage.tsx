import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import { ConversationsList } from './ConversationsList';
import { ChatInterface } from './ChatInterface';
import { CreateConversationModal } from './CreateConversationModal';
import { useChatStore } from '../../store/chat';
import type { Conversation } from '../../types/chat';

interface ChatPageProps {
  onBack: () => void;
}

export function ChatPage({ onBack }: ChatPageProps) {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { setActiveConversation } = useChatStore();

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setActiveConversation(conversation);
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
    setActiveConversation(null);
  };

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header mobile */}
      <div className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-green-600" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {selectedConversation ? 'Chat' : 'Conversas'}
            </h1>
          </div>
        </div>
      </div>

      <div className="flex h-full md:h-screen">
        {/* Lista de conversas - Desktop sempre visível, Mobile apenas quando não há conversa selecionada */}
        <div className={`${
          selectedConversation ? 'hidden md:block' : 'block'
        } w-full md:w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800`}>
          <div className="hidden md:block p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-6 h-6 text-green-600" />
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">Conversas</h1>
                </div>
              </div>
            </div>
          </div>
          
          <ConversationsList
            onSelectConversation={handleSelectConversation}
            onCreateConversation={() => setIsCreateModalOpen(true)}
            selectedConversation={selectedConversation}
          />
        </div>

        {/* Interface de chat - Desktop sempre visível, Mobile apenas quando há conversa selecionada */}
        <div className={`${
          selectedConversation ? 'block' : 'hidden md:block'
        } flex-1 flex flex-col`}>
          {selectedConversation ? (
            <ChatInterface
              conversation={selectedConversation}
              onBack={handleBackToList}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Selecione uma conversa
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Escolha uma conversa para começar a mentoria
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateConversationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}