import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Target, TrendingUp, Calendar, Search, Filter, User, Clock, Bell } from 'lucide-react';
import { getNutritionistClients } from '../../services/nutritionist';
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
  last_seen?: string;
  relationship_id: string;
  active_goals: number;
  completed_goals: number;
  progress_percentage: number;
  unread_messages: number;
  next_session?: string;
  last_activity: string;
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

  useEffect(() => {
    if (user?.type === 'Nutritionist') {
      fetchClients();
    }
  }, [user]);

  useEffect(() => {
    filterAndSortClients();
  }, [clients, searchQuery, statusFilter, sortBy]);

  const fetchClients = async () => {
    if (!user) return;

    try {
      const clientsData = await getNutritionistClients(user.id);
      setClients(clientsData);
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
        (statusFilter === 'messages' && client.unread_messages > 0) ||
        (statusFilter === 'sessions' && client.next_session);

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
        case 'joined':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });

    setFilteredClients(filtered);
  };

  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return 'Nunca visto';
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60));
    
    if (diffMinutes < 5) return 'Online agora';
    if (diffMinutes < 60) return `Visto há ${diffMinutes}min`;
    if (diffMinutes < 1440) return `Visto há ${Math.floor(diffMinutes / 60)}h`;
    return `Visto há ${Math.floor(diffMinutes / 1440)}d`;
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
                  <option value="messages">Com mensagens pendentes</option>
                  <option value="sessions">Com sessões agendadas</option>
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
                  <option value="joined">Data de entrada</option>
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
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 relative">
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
                
                {/* Indicador de status online */}
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                  formatLastSeen(client.last_seen) === 'Online agora' ? 'bg-green-500' : 'bg-gray-400'
                }`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {client.full_name}
                  </h3>
                  {client.unread_messages > 0 && (
                    <div className="flex items-center gap-1">
                      <Bell className="w-4 h-4 text-red-500" />
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                        {client.unread_messages}
                      </span>
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {client.email}
                </p>

                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>Cliente desde {format(new Date(client.created_at), 'MMM yyyy', { locale: ptBR })}</span>
                  <span>•</span>
                  <span>{formatLastSeen(client.last_seen)}</span>
                </div>
              </div>
            </div>

            {/* Bio do cliente */}
            {client.bio && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                {client.bio}
              </p>
            )}

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

            {/* Próxima sessão */}
            {client.next_session && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Próxima sessão: {format(new Date(client.next_session), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </span>
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-2">
              <button
                onClick={() => onStartChat(client.id)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                Chat
                {client.unread_messages > 0 && (
                  <span className="bg-green-800 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {client.unread_messages}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => onViewGoals(client.id)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm"
              >
                <Target className="w-4 h-4" />
                Metas ({client.active_goals})
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
            {searchQuery || statusFilter !== 'all' ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {searchQuery || statusFilter !== 'all' 
              ? 'Tente ajustar os filtros de busca' 
              : 'Quando clientes iniciarem mentoria com você, eles aparecerão aqui'
            }
          </p>
        </div>
      )}
    </div>
  );
}