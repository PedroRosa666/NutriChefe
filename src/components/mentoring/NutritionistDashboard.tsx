import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, MessageCircle, Target, Calendar, TrendingUp, DollarSign, Clock, Award, Settings, ArrowLeft } from 'lucide-react';
import { useChatStore } from '../../store/chat';
import { useAuthStore } from '../../store/auth';
import { ClientsList } from './ClientsList';
import { ChatPage } from '../chat/ChatPage';
import { GoalsManager } from '../goals/GoalsManager';
import { NutritionistServiceConfig } from './NutritionistServiceConfig';
import { getNutritionistRealStats } from '../../services/chat';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDistanceToNow } from 'date-fns';

interface NutritionistDashboardProps {
  onBack: () => void;
}

export function NutritionistDashboard({ onBack }: NutritionistDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'chat' | 'goals' | 'sessions' | 'analytics' | 'config'>('overview');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total_clients: 0,
    active_clients: 0,
    total_reviews: 0,
    average_rating: 0,
    total_sessions: 0,
    completed_goals: 0
  });
  
  const { user } = useAuthStore();
  const { 
    mentoringRelationships, 
    conversations, 
    clientGoals,
    mentoringSessions,
    fetchMentoringRelationships,
    fetchConversations,
    fetchClientGoals,
    fetchMentoringSessions
  } = useChatStore();

  useEffect(() => {
    if (user?.type === 'Nutritionist') {
      loadNutritionistData();
    }
  }, [user]);

  const loadNutritionistData = async () => {
    if (!user) return;

    try {
      // Carregar dados do store
      await fetchMentoringRelationships();
      await fetchConversations();

      // Carregar estatísticas reais
      try {
        const nutritionistStats = await getNutritionistRealStats(user.id);
        setStats(nutritionistStats);
      } catch (statsError) {
        console.error('Error loading stats:', statsError);
        // Usar valores padrão se não conseguir carregar estatísticas
        setStats({
          total_clients: mentoringRelationships.length,
          active_clients: mentoringRelationships.filter(rel => rel.status === 'active').length,
          total_reviews: 0,
          average_rating: 0,
          total_sessions: 0,
          completed_goals: 0
        });
      }
    } catch (error) {
      console.error('Error loading nutritionist data:', error);
    }
  };

  const handleSelectClient = (client: any) => {
    setSelectedClientId(client.id);
  };

  const handleStartChat = (clientId: string) => {
    setSelectedClientId(clientId);
    setActiveTab('chat');
  };

  const handleViewGoals = (clientId: string) => {
    setSelectedClientId(clientId);
    setActiveTab('goals');
  };

  // Calcular métricas adicionais baseadas em dados reais
  const monthlyRevenue = stats.active_clients * 320; // Baseado no número real de clientes
  const engagementRate = stats.total_clients > 0 ? (stats.active_clients / stats.total_clients) * 100 : 0;
  const goalCompletionRate = clientGoals.length > 0 ? (stats.completed_goals / clientGoals.length) * 100 : 0;

  if (activeTab === 'chat') {
    return <ChatPage onBack={() => setActiveTab('overview')} />;
  }

  if (activeTab === 'goals' && selectedClientId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => {
            setActiveTab('overview');
            setSelectedClientId(null);
          }}
          className="flex items-center gap-2 text-green-600 hover:text-green-700 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar ao Dashboard
        </button>
        <GoalsManager clientId={selectedClientId} />
      </div>
    );
  }

  if (activeTab === 'config') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => setActiveTab('overview')}
          className="flex items-center gap-2 text-green-600 hover:text-green-700 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar ao Dashboard
        </button>
        <NutritionistServiceConfig />
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
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard Profissional
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie seus clientes e acompanhe o crescimento da sua prática
          </p>
        </div>

        <button
          onClick={() => setActiveTab('config')}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Configurar Serviço
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {[
          { id: 'overview', label: 'Visão Geral', icon: TrendingUp },
          { id: 'clients', label: 'Clientes', icon: Users },
          { id: 'chat', label: 'Conversas', icon: MessageCircle },
          { id: 'sessions', label: 'Sessões', icon: Calendar },
          { id: 'analytics', label: 'Análises', icon: Award }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${
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
          {/* Estatísticas principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Clientes Ativos</h3>
              </div>
              <p className="text-3xl font-bold text-blue-600">{stats.active_clients}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                de {stats.total_clients} total
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Metas Concluídas</h3>
              </div>
              <p className="text-3xl font-bold text-green-600">{stats.completed_goals}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {goalCompletionRate.toFixed(1)}% de sucesso
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Sessões Realizadas</h3>
              </div>
              <p className="text-3xl font-bold text-purple-600">{stats.total_sessions}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Este mês
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Receita Estimada</h3>
              </div>
              <p className="text-3xl font-bold text-green-600">R$ {monthlyRevenue.toLocaleString()}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Mensal
              </p>
            </div>
          </div>

          {/* Métricas de performance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Performance
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Avaliação Média</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {stats.average_rating.toFixed(1)}
                    </span>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={`${i < Math.floor(stats.average_rating) ? 'text-yellow-400' : 'text-gray-300'}`}>
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total de Avaliações</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {stats.total_reviews}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Taxa de Engajamento</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {engagementRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Progresso das Metas
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Taxa de Conclusão
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {goalCompletionRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${goalCompletionRate}%` }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.completed_goals}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Concluídas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {clientGoals.filter(goal => goal.status === 'active').length}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Em Andamento</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Atividade Recente
              </h3>
              <div className="space-y-3">
                {conversations.slice(0, 3).map((conversation) => {
                  const client = conversation.mentoring_relationship?.client;
                  return (
                    <div key={conversation.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <MessageCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white truncate">
                          {client?.full_name || 'Cliente'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(new Date(conversation.last_message_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                
                {conversations.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    Nenhuma atividade recente
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Resumo de conversas recentes */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Conversas Recentes
              </h3>
              <button
                onClick={() => setActiveTab('chat')}
                className="text-green-600 hover:text-green-700 text-sm font-medium"
              >
                Ver todas
              </button>
            </div>
            
            {conversations.length > 0 ? (
              <div className="space-y-3">
                {conversations.slice(0, 5).map(conversation => {
                  const client = conversation.mentoring_relationship?.client;
                  return (
                    <div key={conversation.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                          <span className="text-green-600 dark:text-green-400 font-semibold text-sm">
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
                      <div className="text-right">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(new Date(conversation.last_message_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </p>
                        <button
                          onClick={() => setActiveTab('chat')}
                          className="text-xs text-green-600 hover:text-green-700 font-medium"
                        >
                          Abrir Chat
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhuma conversa ainda
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'clients' && (
        <ClientsList
          onSelectClient={handleSelectClient}
          onStartChat={handleStartChat}
          onViewGoals={handleViewGoals}
        />
      )}

      {activeTab === 'sessions' && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Agenda de Sessões
          </h3>
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Sistema de agendamento
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Gerencie sua agenda e sessões com clientes
            </p>
            <p className="text-sm text-gray-400">
              Funcionalidade em desenvolvimento
            </p>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Análises Detalhadas
            </h3>
            
            {/* Gráficos de performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white mb-4">
                  Crescimento de Clientes
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Este mês</span>
                    <span className="font-medium text-gray-900 dark:text-white">{stats.active_clients}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Total</span>
                    <span className="font-medium text-gray-900 dark:text-white">{stats.total_clients}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Taxa de retenção</span>
                    <span className="font-medium text-green-600">{engagementRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white mb-4">
                  Efetividade das Metas
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Metas concluídas</span>
                    <span className="font-medium text-gray-900 dark:text-white">{stats.completed_goals}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Em andamento</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {clientGoals.filter(goal => goal.status === 'active').length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Taxa de sucesso</span>
                    <span className="font-medium text-green-600">{goalCompletionRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}