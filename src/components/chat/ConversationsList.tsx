import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Plus, Search, Bell, User } from 'lucide-react';
import { useChatStore } from '../../store/chat';
import { useAuthStore } from '../../store/auth';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Conversation } from '../../types/chat';

interface ConversationsListProps {
  onSelectConversation: (conversation: Conversation) => void;
  onCreateConversation: () => void;
  selectedConversation?: Conversation | null;
}

export function ConversationsList({ 
  onSelectConversation, 
  onCreateConversation, 
  selectedConversation 
}: ConversationsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuthStore();
  const { conversations, fetchConversations, loading } = useChatStore();

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [fetchConversations]);

  const getOtherParticipant = (conversation: Conversation) => {
    const relationship = conversation.mentoring_relationship;
    if (!relationship) return null;
    
    return relationship?.nutritionist_id === user?.id
      ? relationship.client
      : relationship?.nutritionist;
  };

  const formatLastMessageTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), {
      addSuffix: true,
      locale: ptBR
    });
  };

  const getLastMessagePreview = (conversation: Conversation) => {
    if (!conversation.last_message) return 'Conversa iniciada';
    
    const content = conversation.last_message.content;
    if (conversation.last_message.message_type === 'image') {
      return '🖼️ Imagem';
    } else if (conversation.last_message.message_type === 'file') {
      return '📎 Arquivo';
    }
    
    return content.length > 50 ? content.substring(0, 50) + '...' : content;
  };

  const filteredConversations = conversations.filter(conversation => {
    const otherParticipant = getOtherParticipant(conversation);
    
    // Mostrar conversa se tem relacionamento válido
    if (!conversation.mentoring_relationship) return false;
    if (!otherParticipant) return false;
    
    if (!searchQuery) return true;
    
    return otherParticipant.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (conversation.title && conversation.title.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  if (loading.conversations) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 min-h-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Conversas</h2>
          {user?.type === 'Nutritionist' && (
            <button
              onClick={onCreateConversation}
              className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
              title="Nova conversa"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Barra de pesquisa */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar conversas..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* Lista de conversas */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {searchQuery ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery 
                ? 'Tente buscar por outro termo'
                : user?.type === 'Nutritionist' 
                  ? 'Inicie uma nova conversa para começar a mentoria'
                  : 'Encontre um nutricionista para iniciar sua jornada'
              }
            </p>
            {user?.type === 'Nutritionist' && !searchQuery && (
              <button
                onClick={onCreateConversation}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Nova Conversa
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredConversations.map((conversation) => {
              const otherParticipant = getOtherParticipant(conversation);
              const isSelected = selectedConversation?.id === conversation.id;
              const unreadCount = conversation.unread_count || 0;
              const lastMessagePreview = getLastMessagePreview(conversation);
              const isLastMessageFromOther = conversation.last_message?.sender_id !== user?.id;

              return (
                <motion.button
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation)}
                  className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    isSelected ? 'bg-green-50 dark:bg-green-900/20 border-r-2 border-green-600' : ''
                  }`}
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 relative">
                      {otherParticipant?.avatar_url ? (
                        <img
                          src={otherParticipant.avatar_url}
                          alt={otherParticipant.full_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-green-600 dark:text-green-400 font-semibold">
                          {otherParticipant?.full_name?.charAt(0) || <User className="w-6 h-6" />}
                        </span>
                      )}
                      
                      {/* Indicador de mensagens não lidas */}
                      {unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-semibold truncate ${
                          unreadCount > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {otherParticipant?.full_name || 'Usuário'}
                        </h3>
                        <div className="flex items-center gap-1">
                          {unreadCount > 0 && (
                            <Bell className="w-3 h-3 text-red-500" />
                          )}
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                            {formatLastMessageTime(conversation.last_message_at || conversation.created_at)}
                          </span>
                        </div>
                      </div>
                      
                      <p className={`text-sm truncate ${
                        unreadCount > 0 && isLastMessageFromOther
                          ? 'text-gray-900 dark:text-white font-medium' 
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {conversation.last_message?.sender_id === user?.id && '✓ '}
                        {lastMessagePreview}
                      </p>
                      
                      {/* Status do relacionamento */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          conversation.mentoring_relationship?.status === 'active' 
                            ? 'bg-green-500' 
                            : 'bg-gray-400'
                        }`} />
                        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {conversation.mentoring_relationship?.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}