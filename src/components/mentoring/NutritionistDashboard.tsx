import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, MessageCircle, Target, Calendar, TrendingUp, DollarSign, Clock, Award } from 'lucide-react';
import { useChatStore } from '../../store/chat';
import { useAuthStore } from '../../store/auth';
import { ClientsList } from './ClientsList';
import { ChatPage } from '../chat/ChatPage';
import { GoalsManager } from '../goals/GoalsManager';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NutritionistDashboardProps {
  onBack: () => void;
}

export function NutritionistDashboard({ onBack }: NutritionistDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'chat' | 'goals' | 'sessions' | 'analytics'>('overview');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
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

  // Estatísticas do nutricionista
  const [stats, setStats] = useState({
    activeClients: 0,
    totalGoals: 0,
    completedGoals: 0,
    upcomingSessions: 0,
    totalSessions: 0,
    monthlyRevenue: 0,
    averageRating: 4.8,
    responseTime: '2h',
    engagementRate: 85
  });

  useEffect(() => {
    if (user?.type === 'Nutritionist') {
      fetchMentoringRelationships();
      fetchConversations();
      fetchClientGoals();
    }
  }, [user]);

  useEffect(() => {
    // Calcular estatísticas
    const activeClients = mentoringRelationships.filter(rel => rel.status === 'active').length;
    const totalGoals = clientGoals.length;
    const completedGoals = clientGoals.filter(goal => goal.status === 'completed').length;
    const upcomingSessions = mentoringSessions.filter(session => 
      session.status === 'scheduled' && new Date(session.scheduled_at) > new Date()
    ).length;

    setStats(prev => ({
      ...prev,
      activeClients,
      totalGoals,
      completedGoals,
      upcomingSessions,
      totalSessions: mentoringSessions.length,
      monthlyRevenue: activeClients * 320, // Simulado
    }));
  }, [mentoringRelationships, clientGoals, mentoringSessions]);

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
            Dashboard Profissional
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie seus clientes e acompanhe o crescimento da sua prática
          </p>
        </div>
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
              <p className="text-3xl font-bold text-blue-600">{stats.activeClients}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                +12% este mês
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Metas Concluídas</h3>
              </div>
              <p className="text-3xl font-bold text-green-600">{stats.completedGoals}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                de {stats.totalGoals} total
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Sessões Este Mês</h3>
              </div>
              <p className="text-3xl font-bold text-purple-600">{stats.totalSessions}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {stats.upcomingSessions} agendadas
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Receita Mensal</h3>
              </div>
              <p className="text-3xl font-bold text-green-600">R$ {stats.monthlyRevenue.toLocaleString()}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                +8% vs mês anterior
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
                      {stats.averageRating}
                    </span>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="text-yellow-400">★</span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Tempo de Resposta</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {stats.responseTime}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Taxa de Engajamento</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {stats.engagementRate}%
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
                      {stats.totalGoals > 0 ? ((stats.completedGoals / stats.totalGoals) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${stats.totalGoals > 0 ? (stats.completedGoals / stats.totalGoals) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.completedGoals}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Concluídas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.totalGoals - stats.completedGoals}
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
                <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <MessageCircle className="w-4 h-4 text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white">
                      Nova mensagem de Maria Silva
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      há 15 minutos
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <Target className="w-4 h-4 text-green-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white">
                      João concluiu meta de peso
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      há 2 horas
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white">
                      Sessão agendada para amanhã
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      há 4 horas
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Próximas sessões */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Próximas Sessões
              </h3>
              <button
                onClick={() => setActiveTab('sessions')}
                className="text-green-600 hover:text-green-700 text-sm font-medium"
              >
                Ver agenda completa
              </button>
            </div>
            
            {stats.upcomingSessions > 0 ? (
              <div className="space-y-3">
                {/* Simulação de sessões */}
                {[1, 2, 3].slice(0, stats.upcomingSessions).map((_, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <span className="text-green-600 dark:text-green-400 font-semibold text-sm">
                          {['MS', 'JP', 'AC'][index]}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {['Maria Silva', 'João Pedro', 'Ana Costa'][index]}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Consulta de acompanhamento
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {format(new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000), 'dd/MM', { locale: ptBR })}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {['14:00', '15:30', '16:00'][index]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhuma sessão agendada para os próximos dias
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
              Agenda em desenvolvimento
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Em breve você poderá gerenciar sua agenda completa aqui
            </p>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Análises Detalhadas
            </h3>
            <div className="text-center py-12">
              <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Relatórios em desenvolvimento
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Em breve você terá acesso a relatórios detalhados sobre sua prática
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}