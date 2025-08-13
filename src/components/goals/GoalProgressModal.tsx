import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, TrendingUp, Calendar } from 'lucide-react';
import { useChatStore } from '../../store/chat';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ClientGoal } from '../../types/chat';

interface GoalProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: ClientGoal | null;
}

export function GoalProgressModal({ isOpen, onClose, goal }: GoalProgressModalProps) {
  const { addGoalProgress } = useChatStore();
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !goal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;

    setLoading(true);
    try {
      await addGoalProgress(goal.id, parseFloat(value), notes || undefined);
      onClose();
      setValue('');
      setNotes('');
    } catch (error) {
      console.error('Error adding progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const progressPercentage = goal.progress_percentage || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Registrar Progresso
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Informações da meta */}
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            {goal.title}
          </h3>
          
          {goal.target_value && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Progresso atual:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {goal.current_value} / {goal.target_value} {goal.unit}
                </span>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, progressPercentage)}%` }}
                />
              </div>
              
              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                {progressPercentage.toFixed(1)}% concluído
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Novo Valor {goal.unit && `(${goal.unit})`} *
            </label>
            <input
              type="number"
              step="0.1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              placeholder={`Valor atual: ${goal.current_value}`}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              rows={3}
              placeholder="Como você se sente? Alguma dificuldade ou conquista?"
            />
          </div>

          {/* Progresso recente */}
          {goal.recent_progress && goal.recent_progress.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Registros Recentes
              </h4>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {goal.recent_progress.slice(0, 5).map((progress) => (
                  <div key={progress.id} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded">
                    <span className="text-gray-600 dark:text-gray-400">
                      {format(new Date(progress.recorded_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {progress.value} {goal.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !value.trim()}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}