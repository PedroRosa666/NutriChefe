import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Target, Calendar } from 'lucide-react';
import { useChatStore } from '../../store/chat';
import { useAuthStore } from '../../store/auth';
import type { ClientGoal } from '../../types/chat';

interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId?: string;
}

export function CreateGoalModal({ isOpen, onClose, clientId }: CreateGoalModalProps) {
  const { user } = useAuthStore();
  const { createClientGoal } = useChatStore();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goal_type: 'weight_loss' as ClientGoal['goal_type'],
    target_value: '',
    unit: '',
    target_date: '',
    priority: 'medium' as ClientGoal['priority']
  });
  
  const [loading, setLoading] = useState(false);

  const targetClientId = clientId || (user?.type === 'Client' ? user.id : '');
  const nutritionistId = user?.type === 'Nutritionist' ? user.id : undefined;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetClientId) return;

    setLoading(true);
    try {
      await createClientGoal({
        client_id: targetClientId,
        nutritionist_id: nutritionistId,
        title: formData.title,
        description: formData.description,
        goal_type: formData.goal_type,
        target_value: formData.target_value ? parseFloat(formData.target_value) : undefined,
        unit: formData.unit || undefined,
        target_date: formData.target_date || undefined,
        priority: formData.priority,
        status: 'active'
      });
      
      onClose();
      setFormData({
        title: '',
        description: '',
        goal_type: 'weight_loss',
        target_value: '',
        unit: '',
        target_date: '',
        priority: 'medium'
      });
    } catch (error) {
      console.error('Error creating goal:', error);
    } finally {
      setLoading(false);
    }
  };

  const goalTypes = [
    { value: 'weight_loss', label: 'Perda de Peso' },
    { value: 'weight_gain', label: 'Ganho de Peso' },
    { value: 'muscle_gain', label: 'Ganho de Massa Muscular' },
    { value: 'health_improvement', label: 'Melhoria da Saúde' },
    { value: 'nutrition_education', label: 'Educação Nutricional' },
    { value: 'custom', label: 'Personalizada' }
  ];

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
            <Target className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Nova Meta
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Título da Meta *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              placeholder="Ex: Perder 5kg em 3 meses"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de Meta *
            </label>
            <select
              value={formData.goal_type}
              onChange={(e) => setFormData(prev => ({ ...prev, goal_type: e.target.value as ClientGoal['goal_type'] }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              required
            >
              {goalTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descrição
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              rows={3}
              placeholder="Descreva os detalhes da meta..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Valor Alvo
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.target_value}
                onChange={(e) => setFormData(prev => ({ ...prev, target_value: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Unidade
              </label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                placeholder="kg, cm, %"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Alvo
            </label>
            <input
              type="date"
              value={formData.target_date}
              onChange={(e) => setFormData(prev => ({ ...prev, target_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Prioridade
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as ClientGoal['priority'] }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </select>
          </div>

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
              disabled={loading || !formData.title}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Criando...' : 'Criar Meta'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}