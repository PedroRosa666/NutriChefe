import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Target, MessageCircle, Calendar, TrendingUp, Award, Clock, User, Star, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useChatStore } from '../../store/chat';
import { getClientRealStats } from '../../services/chat';
import { NutritionistsList } from './NutritionistsList';
import { ChatPage } from '../chat/ChatPage';
import { GoalsManager } from '../goals/GoalsManager';

interface ClientDashboardProps {
  onBack: () => void;
}

export function ClientDashboard({ onBack }: ClientDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'nutritionists' | 'chat' | 'goals' | 'sessions'>('overview');
  const [selectedNutritionistId, setSelectedNutritionistId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    activeGoals: 0,
    completedGoals: 0,
    upcomingSessions: 0,
    unreadMessages: 0,
    progressPercentage: 0,
    totalGoals: 0
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
    if (user?.type === 'Client') {
      loadClientData();
    }
  }, [user]);

  const loadClientData = async () => {
    if (!user) return;

    try {
      // Carregar dados do store
      await fetchMentoringRelationships();
      await fetchConversations();
      await fetchClientGoals();

      // Carregar estatísticas reais
      const clientStats = await getClientRealStats(user.id);
      setStats(clientStats);
    } catch (error) {
      console.error('Error loading client data:', error);
    }
  };

  const handleSelectNutritionist = (nutritionist: any) => {
    setSelectedNutritionistId(nutritionist.id);
    // Aqui poderia abrir um modal de agendamento
  };

  const handleStartChat = (nutritionistId: string) => {
    setSelectedNutritionistId(nutritionistId);
    setActiveTab('chat');
  };

  // Encontrar nutricionista atual
  const currentNutritionist = mentoringRelationships
    .find(rel => rel.status === 'active')?.nutritionist;

  if (activeTab === 'chat') {
    return <ChatPage onBack={() => setActiveTab('overview')} />;
  }

  if (activeTab === 'goals') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => setActiveTab('overview')}
          className="flex items-center gap-2 text-green-600 hover:text-green-700 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar ao Dashboard
        </button>
        <GoalsManager />
      </div>
    );
  }

  if (activeTab === 'nutritionists') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => setActiveTab('overview')}
          className="flex items-center gap-2 text-green-600 hover:text-green-700 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar ao Dashboard
        </button>
        <NutritionistsList
          onSelectNutritionist={handleSelectNutritionist}
          onStartChat={handleStartChat}
        />
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
            Minha Jornada Nutricional
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Acompanhe seu progresso e conecte-se com nutricionistas
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {[
          { id: 'overview', label: 'Visão Geral', icon: TrendingUp },
          { id: 'nutritionists', label: 'Nutricionistas', icon: User },
          { id: 'goals', label: 'Minhas Metas', icon: Target },
          { id: 'chat', label: 'Conversas', icon: MessageCircle },
          { id: 'sessions', label: 'Sessões', icon: Calendar }
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Metas Ativas</h3>
              </div>
              <p className="text-3xl font-bold text-green-600">{stats.activeGoals}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Award className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Concluídas</h3>
              </div>
              <p className="text-3xl font-bold text-blue-600">{stats.completedGoals}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Próximas Sessões</h3>
              </div>
              <p className="text-3xl font-bold text-purple-600">{stats.upcomingSessions}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <MessageCircle className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Mensagens</h3>
              </div>
              <p className="text-3xl font-bold text-orange-600">{stats.unreadMessages}</p>
            </div>
          </div>

          {/* Progresso geral */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Progresso Geral
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Metas concluídas
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {stats.progressPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${stats.progressPercentage}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  {stats.completedGoals}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  de {stats.totalGoals}
                </div>
              </div>
            </div>
          </div>

          {/* Nutricionista atual */}
          {currentNutritionist && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Meu Nutricionista
              </h3>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  {currentNutritionist.avatar_url ? (
                    <img
                      src={currentNutritionist.avatar_url}
                      alt={currentNutritionist.full_name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-green-600 dark:text-green-400 font-semibold text-lg">
                      {currentNutritionist.full_name?.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {currentNutritionist.full_name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Nutricionista especializada
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">4.8</span>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Mentoria ativa
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Conversar
                  </button>
                  <button
                    onClick={() => setActiveTab('sessions')}
                    className="px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                  >
                    Agendar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Metas recentes */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Metas Recentes
              </h3>
              <button
                onClick={() => setActiveTab('goals')}
                className="text-green-600 hover:text-green-700 text-sm font-medium"
              >
                Ver todas
              </button>
            </div>
            {clientGoals.slice(0, 3).length > 0 ? (
              <div className="space-y-3">
                {clientGoals.slice(0, 3).map((goal) => (
                  <div key={goal.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Target className="w-5 h-5 text-green-600" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {goal.title}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {goal.status === 'active' ? 'Em andamento' : 'Concluída'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {goal.progress_percentage?.toFixed(0) || 0}%
                      </div>
                      <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-1">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${goal.progress_percentage || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Você ainda não tem metas definidas
                </p>
                <button
                  onClick={() => setActiveTab('goals')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Criar Primeira Meta
                </button>
              </div>
            )}
          </div>

          {/* Estado sem nutricionista */}
          {!currentNutritionist && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="text-center py-8">
                <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Encontre seu Nutricionista
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Conecte-se com um profissional para iniciar sua jornada nutricional
                </p>
                <button
                  onClick={() => setActiveTab('nutritionists')}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Explorar Nutricionistas
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Minhas Sessões
          </h3>
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Nenhuma sessão agendada
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Agende uma sessão com seu nutricionista para começar
            </p>
            <button
              onClick={() => setActiveTab('nutritionists')}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Encontrar Nutricionista
            </button>
          </div>
        </div>
      )}
    </div>
  );
}