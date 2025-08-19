import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Search, UserPlus, User } from 'lucide-react';
import { useChatStore } from '../../store/chat';
import { useAuthStore } from '../../store/auth';
import { getAvailableClients } from '../../services/chat';

interface CreateConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AvailableClient {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

export function CreateConversationModal({ isOpen, onClose }: CreateConversationModalProps) {
  const [availableClients, setAvailableClients] = useState<AvailableClient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<AvailableClient | null>(null);
  const [notes, setNotes] = useState('');

  const { user } = useAuthStore();
  const { 
    mentoringRelationships, 
    createMentoringRelationship, 
    createConversation,
    fetchMentoringRelationships 
  } = useChatStore();

  useEffect(() => {
    if (isOpen && user?.type === 'Nutritionist') {
      loadAvailableClients();
    }
  }, [isOpen, user]);

  const loadAvailableClients = async () => {
    setLoading(true);
    try {
      const clients = await getAvailableClients();
      
      // Filtrar clientes que já têm relacionamento ativo
      const existingClientIds = mentoringRelationships
        .filter(rel => rel.status === 'active')
        .map(rel => rel.client_id);
      
      const availableClients = clients.filter(
        client => !existingClientIds.includes(client.id)
      );
      
      setAvailableClients(availableClients);
    } catch (error) {
      console.error('Error loading available clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = availableClients.filter(client =>
    client.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateRelationshipAndConversation = async () => {
    if (!selectedClient || !user) return;

    setLoading(true);
    try {
      // Criar relacionamento de mentoria
      await createMentoringRelationship(selectedClient.id, notes);
      
      // Recarregar relacionamentos para obter o novo
      await fetchMentoringRelationships();
      
      // Buscar o relacionamento recém-criado
      const { data: newRelationship } = await supabase
        .from('mentoring_relationships')
        .select('id')
        .eq('nutritionist_id', user.id)
        .eq('client_id', selectedClient.id)
        .single();
      
      if (newRelationship) {
        // Criar conversa
        await createConversation(newRelationship.id, `Mentoria - ${selectedClient.full_name}`);
        
        // Recarregar conversas para mostrar a nova
        const { useChatStore } = await import('../../store/chat');
        await useChatStore.getState().fetchConversations();
      }
      
      onClose();
      setSelectedClient(null);
      setNotes('');
      setSearchQuery('');
    } catch (error) {
      console.error('Error creating relationship and conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Nova Conversa
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {user?.type === 'Nutritionist' ? (
          <>
            {/* Busca de clientes */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar clientes..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Lista de clientes */}
            <div className="max-h-64 overflow-y-auto mb-4">
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center py-8">
                  <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">
                    {searchQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente disponível'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className={`w-full p-3 text-left rounded-lg border transition-colors ${
                        selectedClient?.id === client.id
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                          {client.avatar_url ? (
                            <img
                              src={client.avatar_url}
                              alt={client.full_name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-green-600 dark:text-green-400 font-semibold">
                              {client.full_name.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {client.full_name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {client.email}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notas */}
            {selectedClient && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notas sobre a mentoria (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Descreva os objetivos da mentoria..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
                />
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateRelationshipAndConversation}
                disabled={!selectedClient || loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Criando...' : 'Criar Conversa'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Apenas nutricionistas podem iniciar novas conversas de mentoria.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Entendi
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}