import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, MessageCircle, Target, Calendar, TrendingUp, Clock } from 'lucide-react';
import { useChatStore } from '../../store/chat';
import { useAuthStore } from '../../store/auth';
import { GoalsManager } from '../goals/GoalsManager';
import { ChatPage } from '../chat/ChatPage';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MentoringDashboardProps {
  onBack: () => void;
}

export function MentoringDashboard({ onBack }: MentoringDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'chat' | 'goals'>('overview');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  const { user } = useAuthStore();
  const { 
    mentoringRelationships, 
    conversations, 
    clientGoals,
    fetchMentoringRelationships,
    fetchConversations,
    fetchClientGoals
  } = useChatStore();

  useEffect(() => {
    if (user?.type === 'Nutritionist') {
      fetchMentoringRelationships();
      fetchConversations();
    }
  }, [user, fetchMentoringRelationships, fetchConversations]);

  const activeRelationships = mentoringRelationships.filter(rel => rel.status === 'active');
  const recentConversations = conversations.slice(0, 5);

  if (activeTab === 'chat') {
    return <ChatPage onBack={() => setActiveTab('overview')} />;
  }

  if (activeTab === 'goals' && selectedClientId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <GoalsManager clientId={selectedClientId} />
        <div className="mt-6">
          <button
            onClick={() => {
              setActiveTab('overview');
              setSelectedClientId(null);
            }}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-green-600 hover:text-green-700 mb-4"
          >
            ← Voltar
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard de Mentoria
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie seus clientes e acompanhe o progresso das mentorias
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'overview', label: 'Visão Geral', icon: TrendingUp },
          { id: 'clients', label: 'Clientes', icon: Users },
          { id: 'chat', label: 'Conversas', icon: MessageCircle }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo das tabs */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Clientes Ativos</h3>
              </div>
              <p className="text-3xl font-bold text-blue-600">{activeRelationships.length}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Conversas</h3>
              </div>
              <p className="text-3xl font-bold text-green-600">{conversations.length}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Metas Ativas</h3>
              </div>
              <p className="text-3xl font-bold text-purple-600">
                {clientGoals.filter(goal => goal.status === 'active').length}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Esta Semana</h3>
              </div>
              <p className="text-3xl font-bold text-orange-600">
                {recentConversations.length}
              </p>
            </div>
          </div>

          {/* Conversas Recentes */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Conversas Recentes
            </h3>
            {recentConversations.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                Nenhuma conversa recente
              </p>
            ) : (
              <div className="space-y-3">
                {recentConversations.map(conversation => {
                  const client = conversation.mentoring_relationship?.client;
                  return (
                    <div key={conversation.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                          <span className="text-green-600 dark:text-green-400 font-semibold">
                            {client?.full_name?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {client?.full_name || 'Cliente'}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {conversation.title || 'Mentoria nutricional'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveTab('chat')}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Abrir Chat
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'clients' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Clientes em Mentoria
            </h3>
            {activeRelationships.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Você ainda não tem clientes em mentoria
                </p>
                <button
                  onClick={() => setActiveTab('chat')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Iniciar Nova Conversa
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeRelationships.map(relationship => (
                  <motion.div
                    key={relationship.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <span className="text-green-600 dark:text-green-400 font-semibold">
                          {relationship.client?.full_name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {relationship.client?.full_name || 'Cliente'}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Desde {format(new Date(relationship.created_at), 'MMM yyyy', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActiveTab('chat')}
                        className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Chat
                      </button>
                      <button
                        onClick={() => {
                          setSelectedClientId(relationship.client_id);
                          setActiveTab('goals');
                        }}
                        className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Metas
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}