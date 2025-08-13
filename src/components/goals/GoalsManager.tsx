import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Plus, TrendingUp, Calendar, Edit, Trash2, CheckCircle } from 'lucide-react';
import { useChatStore } from '../../store/chat';
import { useAuthStore } from '../../store/auth';
import { CreateGoalModal } from './CreateGoalModal';
import { GoalProgressModal } from './GoalProgressModal';
import { GoalCard } from './GoalCard';
import type { ClientGoal } from '../../types/chat';

interface GoalsManagerProps {
  clientId?: string;
}

export function GoalsManager({ clientId }: GoalsManagerProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<ClientGoal | null>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  
  const { user } = useAuthStore();
  const { clientGoals, fetchClientGoals, updateClientGoal, loading } = useChatStore();

  const targetClientId = clientId || (user?.type === 'Client' ? user.id : undefined);
  const isNutritionist = user?.type === 'Nutritionist';
  const canCreateGoals = user?.type === 'Client' || (isNutritionist && clientId);

  useEffect(() => {
    if (targetClientId) {
      fetchClientGoals(targetClientId);
    }
  }, [targetClientId, fetchClientGoals]);

  const handleGoalStatusChange = async (goalId: string, status: ClientGoal['status']) => {
    try {
      await updateClientGoal(goalId, { status });
    } catch (error) {
      console.error('Error updating goal status:', error);
    }
  };

  const handleAddProgress = (goal: ClientGoal) => {
    setSelectedGoal(goal);
    setIsProgressModalOpen(true);
  };

  const activeGoals = clientGoals.filter(goal => goal.status === 'active');
  const completedGoals = clientGoals.filter(goal => goal.status === 'completed');

  if (loading.goals) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="w-6 h-6 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Metas {clientId ? 'do Cliente' : 'Pessoais'}
          </h2>
        </div>
        
        {canCreateGoals && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Meta
          </button>
        )}
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Metas Ativas</h3>
          </div>
          <p className="text-3xl font-bold text-blue-600">{activeGoals.length}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Concluídas</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{completedGoals.length}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Taxa de Sucesso</h3>
          </div>
          <p className="text-3xl font-bold text-purple-600">
            {clientGoals.length > 0 ? Math.round((completedGoals.length / clientGoals.length) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Metas Ativas */}
      {activeGoals.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Metas Ativas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {activeGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onAddProgress={() => handleAddProgress(goal)}
                  onStatusChange={(status) => handleGoalStatusChange(goal.id, status)}
                  canEdit={canCreateGoals}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Metas Concluídas */}
      {completedGoals.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Metas Concluídas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {completedGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onAddProgress={() => handleAddProgress(goal)}
                  onStatusChange={(status) => handleGoalStatusChange(goal.id, status)}
                  canEdit={canCreateGoals}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {clientGoals.length === 0 && (
        <div className="text-center py-12">
          <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Nenhuma meta definida
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {canCreateGoals 
              ? 'Crie sua primeira meta para começar a acompanhar seu progresso'
              : 'Este cliente ainda não definiu metas'
            }
          </p>
          {canCreateGoals && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Criar Primeira Meta
            </button>
          )}
        </div>
      )}

      {/* Modais */}
      <CreateGoalModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        clientId={targetClientId}
      />

      <GoalProgressModal
        isOpen={isProgressModalOpen}
        onClose={() => setIsProgressModalOpen(false)}
        goal={selectedGoal}
      />
    </div>
  );
}