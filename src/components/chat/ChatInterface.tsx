import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, MoreVertical, Phone, Video, ArrowLeft, Image, FileText, Mic, Download } from 'lucide-react';
import { useChatStore } from '../../store/chat';
import { useAuthStore } from '../../store/auth';
import { subscribeToMessages } from '../../services/chat';
import { updateLastSeen } from '../../services/nutritionist';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Conversation, Message } from '../../types/chat';

interface ChatInterfaceProps {
  conversation: Conversation;
  onBack: () => void;
}

export function ChatInterface({ conversation, onBack }: ChatInterfaceProps) {
  const [newMessage, setNewMessage] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { user } = useAuthStore();
  const { messages, sendMessage, addMessage, loading } = useChatStore();

  // Determinar o outro participante da conversa
  const otherParticipant = conversation.mentoring_relationship?.nutritionist_id === user?.id
    ? conversation.mentoring_relationship.client
    : conversation.mentoring_relationship?.nutritionist;

  // Atualizar última visualização
  useEffect(() => {
    if (user) {
      updateLastSeen(user.id);
    }
  }, [user]);

  useEffect(() => {
    // Subscrever a mensagens em tempo real
    const subscription = subscribeToMessages(conversation.id, (message: Message) => {
      addMessage(message);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [conversation.id, addMessage]);

  useEffect(() => {
    // Scroll para a última mensagem apenas quando novas mensagens chegam
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      await sendMessage(messageContent);
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageContent); // Restaurar mensagem em caso de erro
    }
  };

  const handleFileUpload = async (file: File) => {
    // Implementar upload de arquivo
    console.log('File upload:', file);
    // Por enquanto, simular envio de mensagem com nome do arquivo
    try {
      await sendMessage(`📎 Arquivo enviado: ${file.name}`, 'file');
    } catch (error) {
      console.error('Error sending file:', error);
    }
  };

  const handleImageUpload = async (file: File) => {
    // Implementar upload de imagem
    console.log('Image upload:', file);
    try {
      await sendMessage(`🖼️ Imagem enviada: ${file.name}`, 'image');
    } catch (error) {
      console.error('Error sending image:', error);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), {
      addSuffix: true,
      locale: ptBR
    });
  };

  const isMyMessage = (message: Message) => message.sender_id === user?.id;

  const renderMessageContent = (message: Message) => {
    switch (message.message_type) {
      case 'image':
        return (
          <div className="space-y-2">
            <p className="text-sm">{message.content}</p>
            {/* Aqui seria renderizada a imagem real */}
            <div className="w-48 h-32 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center">
              <Image className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        );
      case 'file':
        return (
          <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-600 rounded-lg">
            <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="text-sm flex-1">{message.content}</span>
            <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-500 rounded">
              <Download className="w-4 h-4" />
            </button>
          </div>
        );
      default:
        return <p className="text-sm">{message.content}</p>;
    }
  };

  const formatOnlineStatus = (lastSeen?: string) => {
    if (!lastSeen) return 'Offline';
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60));
    
    if (diffMinutes < 5) return 'Online';
    if (diffMinutes < 60) return `Visto há ${diffMinutes}min`;
    return 'Offline';
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Header da conversa */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors md:hidden"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center relative">
              {otherParticipant?.avatar_url ? (
                <img
                  src={otherParticipant.avatar_url}
                  alt={otherParticipant.full_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <span className="text-green-600 dark:text-green-400 font-semibold">
                  {otherParticipant?.full_name?.charAt(0) || '?'}
                </span>
              )}
              
              {/* Indicador de status online */}
              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                formatOnlineStatus() === 'Online' ? 'bg-green-500' : 'bg-gray-400'
              }`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {otherParticipant?.full_name || 'Usuário'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatOnlineStatus()}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <Phone className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <Video className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Área de mensagens */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
      >
        {loading.messages ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Inicie uma conversa
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Envie sua primeira mensagem para começar a mentoria
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMyMessage(message) ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs lg:max-w-md ${isMyMessage(message) ? 'order-2' : 'order-1'}`}>
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      isMyMessage(message)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    {renderMessageContent(message)}
                  </div>
                  <p className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${
                    isMyMessage(message) ? 'text-right' : 'text-left'
                  }`}>
                    {formatMessageTime(message.created_at)}
                    {message.read_at && isMyMessage(message) && (
                      <span className="ml-2 text-green-500">✓✓</span>
                    )}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de mensagem */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <Paperclip className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            
            {/* Menu de anexos */}
            {showAttachmentMenu && (
              <div className="absolute bottom-12 left-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-10">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <Image className="w-4 h-4" />
                  Imagem
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <FileText className="w-4 h-4" />
                  Documento
                </button>
                <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <Mic className="w-4 h-4" />
                  Áudio
                </button>
              </div>
            )}
          </div>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>

        {/* Input de arquivo oculto */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.type.startsWith('image/')) {
                handleImageUpload(file);
              } else {
                handleFileUpload(file);
              }
              setShowAttachmentMenu(false);
            }
          }}
        />
      </div>
    </div>
  );
}