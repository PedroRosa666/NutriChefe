import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Target, TrendingUp, Calendar, Search, Filter, User, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { useChatStore } from '../../store/chat';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Client {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
  active_goals: number;
  completed_goals: number;
  last_activity: string;
  unread_messages: number;
  next_session?: string;
  progress_percentage: number;
  dietary_preferences?: string[];
  health_conditions?: string[];
}

interface ClientsListProps {
  onSelectClient: (client: Client) => void;
  onStartChat: (clientId: string) => void;
  onViewGoals: (clientId: string) => void;
}

export function ClientsList({ onSelectClient, onStartChat, onViewGoals }: ClientsListProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('activity');
  const [showFilters, setShowFilters] = useState(false);

  const { user } = useAuthStore();
  const { mentoringRelationships, fetchMentoringRelationships } = useChatStore();

  useEffect(() => {
    fetchClients();
    fetchMentoringRelationships();
  }, []);

  useEffect(() => {
    filterAndSortClients();
  }, [clients, searchQuery, statusFilter, sortBy]);

  const fetchClients = async () => {
    try {
      // Buscar clientes que têm relacionamento de mentoria com o nutricionista atual
      const { data: relationships, error: relError } = await supabase
        .from('mentoring_relationships')
        .select(`
          client_id,
          status,
          created_at,
          client:profiles!mentoring_relationships_client_id_fkey(
            id,
            full_name,
            email,
            avatar_url,
            bio,
            created_at
          )
        `)
        .eq('nutritionist_id', user?.id)
        .eq('status', 'active');

      if (relError) throw relError;

      // Buscar metas dos clientes
      const clientIds = relationships?.map(rel => rel.client_id) || [];
      
      const { data: goals, error: goalsError } = await supabase
        .from('client_goals')
        .select('client_id, status')
        .in('client_id', clientIds);

      if (goalsError) throw goalsError;

      // Enriquecer dados dos clientes
      const enrichedClients = relationships?.map(rel => {
        const clientGoals = goals?.filter(goal => goal.client_id === rel.client_id) || [];
        const activeGoals = clientGoals.filter(goal => goal.status === 'active').length;
        const completedGoals = clientGoals.filter(goal => goal.status === 'completed').length;

        return {
          ...rel.client,
          active_goals: activeGoals,
          completed_goals: completedGoals,
          last_activity: rel.created_at,
          unread_messages: Math.floor(Math.random() * 5), // Simulado
          progress_percentage: completedGoals > 0 ? (completedGoals / (activeGoals + completedGoals)) * 100 : 0,
          dietary_preferences: ['Vegetariano', 'Sem Lactose'], // Simulado
          health_conditions: ['Diabetes Tipo 2'] // Simulado
        };
      }) || [];

      setClients(enrichedClients);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortClients = () => {
    let filtered = clients.filter(client => {
      const matchesSearch = client.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && client.active_goals > 0) ||
        (statusFilter === 'inactive' && client.active_goals === 0) ||
        (statusFilter === 'messages' && client.unread_messages > 0);

      return matchesSearch && matchesStatus;
    });

    // Ordenação
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'activity':
          return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
        case 'progress':
          return b.progress_percentage - a.progress_percentage;
        case 'goals':
          return b.active_goals - a.active_goals;
        case 'messages':
          return b.unread_messages - a.unread_messages;
        case 'name':
          return a.full_name.localeCompare(b.full_name);
        default:
          return 0;
      }
    });

    setFilteredClients(filtered);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com busca e filtros */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Meus Clientes
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {filteredClients.length} clientes em acompanhamento
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente..."
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white w-full sm:w-64"
              />
            </div>

            {/* Botão de filtros */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filtros
            </button>
          </div>
        </div>

        {/* Filtros expandidos */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="all">Todos os clientes</option>
                  <option value="active">Com metas ativas</option>
                  <option value="inactive">Sem metas ativas</option>
                  <option value="messages">Com mensagens</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ordenar por
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="activity">Última atividade</option>
                  <option value="progress">Progresso</option>
                  <option value="goals">Metas ativas</option>
                  <option value="messages">Mensagens pendentes</option>
                  <option value="name">Nome</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Lista de clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredClients.map((client) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6"
          >
            {/* Header do card */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                {client.avatar_url ? (
                  <img
                    src={client.avatar_url}
                    alt={client.full_name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-green-600 dark:text-green-400 font-semibold">
                    {client.full_name.charAt(0)}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {client.full_name}
                  </h3>
                  {client.unread_messages > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {client.unread_messages}
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {client.email}
                </p>

                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>Cliente desde {format(new Date(client.created_at), 'MMM yyyy', { locale: ptBR })}</span>
                  <span>•</span>
                  <span>Última atividade: {format(new Date(client.last_activity), 'dd/MM', { locale: ptBR })}</span>
                </div>
              </div>
            </div>

            {/* Estatísticas */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {client.active_goals}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Metas Ativas</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {client.completed_goals}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Concluídas</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {client.progress_percentage.toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Progresso</div>
              </div>
            </div>

            {/* Barra de progresso */}
            <div className="mb-4">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${client.progress_percentage}%` }}
                />
              </div>
            </div>

            {/* Preferências e condições */}
            <div className="mb-4 space-y-2">
              {client.dietary_preferences && client.dietary_preferences.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Preferências: </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {client.dietary_preferences.map((pref, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full"
                      >
                        {pref}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {client.health_conditions && client.health_conditions.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Condições: </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {client.health_conditions.map((condition, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs rounded-full"
                      >
                        {condition}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex gap-2">
              <button
                onClick={() => onStartChat(client.id)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                Chat
              </button>
              
              <button
                onClick={() => onViewGoals(client.id)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm"
              >
                <Target className="w-4 h-4" />
                Metas
              </button>

              <button
                onClick={() => onSelectClient(client)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                <User className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Nenhum cliente encontrado
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {searchQuery ? 'Tente ajustar os filtros de busca' : 'Você ainda não tem clientes em acompanhamento'}
          </p>
        </div>
      )}
    </div>
  );
}