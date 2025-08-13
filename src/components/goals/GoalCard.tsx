import React from 'react';
import { motion } from 'framer-motion';
import { Target, TrendingUp, Calendar, Plus, CheckCircle, Pause, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ClientGoal } from '../../types/chat';

interface GoalCardProps {
  goal: ClientGoal;
  onAddProgress: () => void;
  onStatusChange: (status: ClientGoal['status']) => void;
  canEdit: boolean;
}

export function GoalCard({ goal, onAddProgress, onStatusChange, canEdit }: GoalCardProps) {
  const getGoalTypeLabel = (type: ClientGoal['goal_type']) => {
    const labels = {
      weight_loss: 'Perda de Peso',
      weight_gain: 'Ganho de Peso',
      muscle_gain: 'Ganho de Massa',
      health_improvement: 'Melhoria da Saúde',
      nutrition_education: 'Educação Nutricional',
      custom: 'Personalizada'
    };
    return labels[type] || type;
  };

  const getPriorityColor = (priority: ClientGoal['priority']) => {
    const colors = {
      low: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
      medium: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
      high: 'text-red-600 bg-red-100 dark:bg-red-900/30'
    };
    return colors[priority] || colors.medium;
  };

  const getStatusColor = (status: ClientGoal['status']) => {
    const colors = {
      active: 'text-green-600 bg-green-100 dark:bg-green-900/30',
      completed: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
      paused: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
      cancelled: 'text-red-600 bg-red-100 dark:bg-red-900/30'
    };
    return colors[status] || colors.active;
  };

  const progressPercentage = goal.progress_percentage || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">{goal.title}</h3>
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(goal.priority)}`}>
              {goal.priority === 'low' ? 'Baixa' : goal.priority === 'medium' ? 'Média' : 'Alta'}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(goal.status)}`}>
              {goal.status === 'active' ? 'Ativa' : 
               goal.status === 'completed' ? 'Concluída' :
               goal.status === 'paused' ? 'Pausada' : 'Cancelada'}
            </span>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {getGoalTypeLabel(goal.goal_type)}
          </p>

          {goal.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {goal.description}
            </p>
          )}
        </div>
      </div>

      {/* Progresso */}
      {goal.target_value && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Progresso
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {goal.current_value} / {goal.target_value} {goal.unit}
            </span>
          </div>
          
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, progressPercentage)}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {progressPercentage.toFixed(1)}% concluído
            </span>
            {goal.target_date && (
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(goal.target_date), 'dd/MM/yyyy', { locale: ptBR })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Progresso recente */}
      {goal.recent_progress && goal.recent_progress.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Progresso Recente
          </h4>
          <div className="space-y-2">
            {goal.recent_progress.slice(0, 3).map((progress) => (
              <div key={progress.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {format(new Date(progress.recorded_at), 'dd/MM', { locale: ptBR })}
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {progress.value} {goal.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ações */}
      {canEdit && goal.status === 'active' && (
        <div className="flex items-center gap-2">
          <button
            onClick={onAddProgress}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Registrar Progresso
          </button>
          
          <button
            onClick={() => onStatusChange('completed')}
            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
            title="Marcar como concluída"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => onStatusChange('paused')}
            className="p-2 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors"
            title="Pausar meta"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      )}

      {goal.status === 'completed' && (
        <div className="flex items-center justify-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg text-sm">
          <CheckCircle className="w-4 h-4" />
          Meta Concluída!
        </div>
      )}
    </motion.div>
  );
}