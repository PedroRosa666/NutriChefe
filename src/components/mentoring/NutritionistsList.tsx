import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageCircle, Calendar, Filter, Search, MapPin, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { useChatStore } from '../../store/chat';

interface Nutritionist {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  bio?: string;
  specializations?: string[];
  experience?: string;
  rating: number;
  total_reviews: number;
  available_slots: number;
  price_per_session?: number;
  location?: string;
}

interface NutritionistsListProps {
  onSelectNutritionist: (nutritionist: Nutritionist) => void;
  onStartChat: (nutritionistId: string) => void;
}

export function NutritionistsList({ onSelectNutritionist, onStartChat }: NutritionistsListProps) {
  const [nutritionists, setNutritionists] = useState<Nutritionist[]>([]);
  const [filteredNutritionists, setFilteredNutritionists] = useState<Nutritionist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [sortBy, setSortBy] = useState('rating');
  const [showFilters, setShowFilters] = useState(false);

  const { user } = useAuthStore();
  const { createMentoringRelationship, createConversation } = useChatStore();

  const specialties = [
    'all',
    'Emagrecimento',
    'Ganho de Massa',
    'Nutrição Esportiva',
    'Nutrição Clínica',
    'Vegetarianismo',
    'Nutrição Infantil',
    'Terceira Idade'
  ];

  useEffect(() => {
    fetchNutritionists();
  }, []);

  useEffect(() => {
    filterAndSortNutritionists();
  }, [nutritionists, searchQuery, selectedSpecialty, sortBy]);

  const fetchNutritionists = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          avatar_url,
          bio,
          created_at
        `)
        .eq('user_type', 'Nutritionist');

      if (error) throw error;

      // Simular dados adicionais (em produção, viriam do banco)
      const enrichedData = data?.map(nutritionist => ({
        ...nutritionist,
        specializations: ['Emagrecimento', 'Nutrição Clínica'],
        experience: '5+ anos',
        rating: 4.5 + Math.random() * 0.5,
        total_reviews: Math.floor(Math.random() * 100) + 10,
        available_slots: Math.floor(Math.random() * 10) + 1,
        price_per_session: Math.floor(Math.random() * 100) + 80,
        location: 'São Paulo, SP'
      })) || [];

      setNutritionists(enrichedData);
    } catch (error) {
      console.error('Error fetching nutritionists:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortNutritionists = () => {
    let filtered = nutritionists.filter(nutritionist => {
      const matchesSearch = nutritionist.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        nutritionist.specializations?.some(spec => spec.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesSpecialty = selectedSpecialty === 'all' || 
        nutritionist.specializations?.includes(selectedSpecialty);

      return matchesSearch && matchesSpecialty;
    });

    // Ordenação
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'reviews':
          return b.total_reviews - a.total_reviews;
        case 'price_low':
          return (a.price_per_session || 0) - (b.price_per_session || 0);
        case 'price_high':
          return (b.price_per_session || 0) - (a.price_per_session || 0);
        case 'availability':
          return b.available_slots - a.available_slots;
        default:
          return 0;
      }
    });

    setFilteredNutritionists(filtered);
  };

  const handleStartChat = async (nutritionist: Nutritionist) => {
    if (!user) return;

    try {
      // Criar relacionamento de mentoria
      await createMentoringRelationship(nutritionist.id, user.id);
      
      // Iniciar chat
      onStartChat(nutritionist.id);
    } catch (error) {
      console.error('Error starting chat:', error);
    }
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Especialidade
                </label>
                <select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                >
                  {specialties.map(specialty => (
                    <option key={specialty} value={specialty}>
                      {specialty === 'all' ? 'Todas as especialidades' : specialty}
                    </option>
                  ))}
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
                  <option value="availability">Mais disponível</option>
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
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
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
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1">
                  {nutritionist.full_name}
                </h3>
                
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {nutritionist.rating.toFixed(1)}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({nutritionist.total_reviews} avaliações)
                  </span>
                </div>

                {nutritionist.location && (
                  <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <MapPin className="w-3 h-3" />
                    {nutritionist.location}
                  </div>
                )}
              </div>
            </div>

            {/* Especialidades */}
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {nutritionist.specializations?.slice(0, 2).map((spec, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full"
                  >
                    {spec}
                  </span>
                ))}
                {(nutritionist.specializations?.length || 0) > 2 && (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                    +{(nutritionist.specializations?.length || 0) - 2}
                  </span>
                )}
              </div>
            </div>

            {/* Informações adicionais */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Experiência:</span>
                <span className="font-medium text-gray-900 dark:text-white">{nutritionist.experience}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Horários disponíveis:</span>
                <span className="font-medium text-gray-900 dark:text-white">{nutritionist.available_slots}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Valor por sessão:</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  R$ {nutritionist.price_per_session}
                </span>
              </div>
            </div>

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