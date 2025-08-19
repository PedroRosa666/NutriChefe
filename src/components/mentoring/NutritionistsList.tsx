import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageCircle, Calendar, Filter, Search, MapPin, Award, DollarSign, Clock, Users } from 'lucide-react';
import { getNutritionists } from '../../services/nutritionist';
import { useAuthStore } from '../../store/auth';
import { useChatStore } from '../../store/chat';
import { useToastStore } from '../../store/toast';
import type { NutritionistProfile } from '../../services/nutritionist';

interface NutritionistsListProps {
  onSelectNutritionist: (nutritionist: NutritionistProfile) => void;
  onStartChat: (nutritionistId: string) => void;
}

export function NutritionistsList({ onSelectNutritionist, onStartChat }: NutritionistsListProps) {
  const [nutritionists, setNutritionists] = useState<NutritionistProfile[]>([]);
  const [filteredNutritionists, setFilteredNutritionists] = useState<NutritionistProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [priceRange, setPriceRange] = useState('all');
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState('rating');
  const [showFilters, setShowFilters] = useState(false);

  const { user } = useAuthStore();
  const { createMentoringRelationship, createConversation, mentoringRelationships } = useChatStore();
  const { showToast } = useToastStore();

  // Especialidades únicas extraídas dos dados reais
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);

  useEffect(() => {
    fetchNutritionists();
  }, []);

  useEffect(() => {
    filterAndSortNutritionists();
  }, [nutritionists, searchQuery, selectedSpecialty, priceRange, minRating, sortBy]);

  const fetchNutritionists = async () => {
    try {
      const data = await getNutritionists();
      setNutritionists(data);
      
      // Extrair especialidades únicas
      const specialties = new Set<string>();
      data.forEach(nutritionist => {
        nutritionist.service?.specializations?.forEach(spec => specialties.add(spec));
      });
      setAvailableSpecialties(Array.from(specialties));
      
    } catch (error) {
      console.error('Error fetching nutritionists:', error);
      showToast('Erro ao carregar nutricionistas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortNutritionists = () => {
    let filtered = nutritionists.filter(nutritionist => {
      // Filtro de busca
      const matchesSearch = nutritionist.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        nutritionist.service?.specializations?.some(spec => 
          spec.toLowerCase().includes(searchQuery.toLowerCase())
        ) ||
        nutritionist.service?.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Filtro de especialidade
      const matchesSpecialty = selectedSpecialty === 'all' || 
        nutritionist.service?.specializations?.includes(selectedSpecialty);

      // Filtro de preço
      const price = nutritionist.service?.service_price || 0;
      const matchesPrice = priceRange === 'all' ||
        (priceRange === 'low' && price <= 80) ||
        (priceRange === 'medium' && price > 80 && price <= 150) ||
        (priceRange === 'high' && price > 150);

      // Filtro de avaliação
      const matchesRating = (nutritionist.stats?.average_rating || 0) >= minRating;

      // Apenas nutricionistas disponíveis
      const isAvailable = nutritionist.service?.is_available !== false;

      return matchesSearch && matchesSpecialty && matchesPrice && matchesRating && isAvailable;
    });

    // Ordenação
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return (b.stats?.average_rating || 0) - (a.stats?.average_rating || 0);
        case 'reviews':
          return (b.stats?.total_reviews || 0) - (a.stats?.total_reviews || 0);
        case 'price_low':
          return (a.service?.service_price || 0) - (b.service?.service_price || 0);
        case 'price_high':
          return (b.service?.service_price || 0) - (a.service?.service_price || 0);
        case 'clients':
          return (b.stats?.active_clients || 0) - (a.stats?.active_clients || 0);
        case 'experience':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
    });

    setFilteredNutritionists(filtered);
  };

  const handleStartChat = async (nutritionist: NutritionistProfile) => {
    if (!user) return;

    try {
      // Verificar se já existe relacionamento
      const existingRelationship = mentoringRelationships.find(
        rel => rel.nutritionist_id === nutritionist.id && rel.client_id === user.id
      );
      
      if (existingRelationship) {
        // Se já existe, apenas iniciar chat
        onStartChat(nutritionist.id);
        return;
      }

      // Criar novo relacionamento de mentoria
      await createMentoringRelationship(nutritionist.id);
      
      // Buscar o relacionamento recém-criado
      const { data: newRelationship } = await supabase
        .from('mentoring_relationships')
        .select('id')
        .eq('nutritionist_id', nutritionist.id)
        .eq('client_id', user.id)
        .single();

      if (newRelationship) {
        // Criar conversa
        await createConversation(newRelationship.id, `Mentoria - ${nutritionist.full_name}`);
      }

      showToast('Mentoria iniciada com sucesso!', 'success');
      onStartChat(nutritionist.id);
    } catch (error) {
      console.error('Error starting chat:', error);
      showToast('Erro ao iniciar mentoria', 'error');
    }
  };

  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return 'Offline';
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60));
    
    if (diffMinutes < 5) return 'Online';
    if (diffMinutes < 60) return `${diffMinutes}min atrás`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h atrás`;
    return `${Math.floor(diffMinutes / 1440)}d atrás`;
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
              Encontre seu Nutricionista
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {filteredNutritionists.length} profissionais disponíveis
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
                placeholder="Buscar por nome ou especialidade..."
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Especialidade
                </label>
                <select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="all">Todas as especialidades</option>
                  {availableSpecialties.map(specialty => (
                    <option key={specialty} value={specialty}>
                      {specialty}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Faixa de Preço
                </label>
                <select
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="all">Todos os preços</option>
                  <option value="low">Até R$ 80</option>
                  <option value="medium">R$ 80 - R$ 150</option>
                  <option value="high">Acima de R$ 150</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Avaliação Mínima
                </label>
                <select
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value={0}>Qualquer avaliação</option>
                  <option value={3}>3+ estrelas</option>
                  <option value={4}>4+ estrelas</option>
                  <option value={4.5}>4.5+ estrelas</option>
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
                  <option value="rating">Melhor avaliação</option>
                  <option value="reviews">Mais avaliações</option>
                  <option value="price_low">Menor preço</option>
                  <option value="price_high">Maior preço</option>
                  <option value="clients">Mais clientes</option>
                  <option value="experience">Mais experiente</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Lista de nutricionistas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNutritionists.map((nutritionist) => (
          <motion.div
            key={nutritionist.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6"
          >
            {/* Header do card */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 relative">
                {nutritionist.avatar_url ? (
                  <img
                    src={nutritionist.avatar_url}
                    alt={nutritionist.full_name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-green-600 dark:text-green-400 font-semibold text-lg">
                    {nutritionist.full_name.charAt(0)}
                  </span>
                )}
                
                {/* Indicador de status online */}
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${
                  formatLastSeen(nutritionist.last_seen) === 'Online' ? 'bg-green-500' : 'bg-gray-400'
                }`} />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1">
                  {nutritionist.full_name}
                </h3>
                
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {nutritionist.stats?.average_rating?.toFixed(1) || '0.0'}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({nutritionist.stats?.total_reviews || 0} avaliações)
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="text-lg font-bold text-green-600">
                    R$ {nutritionist.service?.service_price?.toFixed(2) || '0.00'}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">por sessão</span>
                </div>

                <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>Responde em: {nutritionist.service?.response_time || 'N/A'}</span>
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {formatLastSeen(nutritionist.last_seen)}
                </div>
              </div>
            </div>

            {/* Descrição */}
            {nutritionist.service?.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                {nutritionist.service.description}
              </p>
            )}

            {/* Especialidades */}
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {nutritionist.service?.specializations?.slice(0, 3).map((spec, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full"
                  >
                    {spec}
                  </span>
                ))}
                {(nutritionist.service?.specializations?.length || 0) > 3 && (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                    +{(nutritionist.service?.specializations?.length || 0) - 3}
                  </span>
                )}
              </div>
            </div>

            {/* Estatísticas */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div className="text-center">
                <div className="font-bold text-blue-600">{nutritionist.stats?.active_clients || 0}</div>
                <div className="text-gray-500 dark:text-gray-400">Clientes Ativos</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-purple-600">{nutritionist.stats?.completed_goals || 0}</div>
                <div className="text-gray-500 dark:text-gray-400">Metas Concluídas</div>
              </div>
            </div>

            {/* Bio */}
            {nutritionist.bio && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                {nutritionist.bio}
              </p>
            )}

            {/* Requisitos */}
            {nutritionist.service?.requirements && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                  Requisitos:
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {nutritionist.service.requirements}
                </p>
              </div>
            )}

            {/* Disponibilidade */}
            {nutritionist.service?.availability_notes && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                  Disponibilidade:
                </h4>
                <p className="text-xs text-green-700 dark:text-green-300">
                  {nutritionist.service.availability_notes}
                </p>
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-2">
              <button
                onClick={() => handleStartChat(nutritionist)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                Conversar
              </button>
              
              <button
                onClick={() => onSelectNutritionist(nutritionist)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm"
              >
                <Calendar className="w-4 h-4" />
                Agendar
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredNutritionists.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Nenhum nutricionista encontrado
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Tente ajustar os filtros ou buscar por outros termos
          </p>
        </div>
      )}
    </div>
  );
}