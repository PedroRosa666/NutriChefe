import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, DollarSign, Clock, FileText, Users, Save, Plus, X, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { getNutritionistService, createNutritionistService, updateNutritionistService } from '../../services/nutritionist';
import { useToastStore } from '../../store/toast';
import type { NutritionistService } from '../../services/nutritionist';

export function NutritionistServiceConfig() {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();
  const [service, setService] = useState<NutritionistService | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSpecialization, setNewSpecialization] = useState('');

  const [formData, setFormData] = useState({
    service_price: 100.00,
    description: '',
    specializations: [] as string[],
    response_time: '24 horas',
    requirements: '',
    availability_notes: '',
    is_available: true
  });

  useEffect(() => {
    if (user?.type === 'Nutritionist') {
      loadService();
    }
  }, [user]);

  const loadService = async () => {
    if (!user) return;

    try {
      let serviceData = await getNutritionistService(user.id);
      
      if (!serviceData) {
        // Criar serviço padrão se não existir
        serviceData = await createNutritionistService(user.id);
      }

      setService(serviceData);
      setFormData({
        service_price: serviceData.service_price,
        description: serviceData.description,
        specializations: serviceData.specializations,
        response_time: serviceData.response_time,
        requirements: serviceData.requirements,
        availability_notes: serviceData.availability_notes,
        is_available: serviceData.is_available
      });
    } catch (error) {
      console.error('Error loading service:', error);
      showToast('Erro ao carregar configurações do serviço', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const updatedService = await updateNutritionistService(user.id, formData);
      setService(updatedService);
      showToast('Configurações salvas com sucesso!', 'success');
    } catch (error) {
      console.error('Error saving service:', error);
      showToast('Erro ao salvar configurações', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addSpecialization = () => {
    if (newSpecialization.trim() && !formData.specializations.includes(newSpecialization.trim())) {
      setFormData(prev => ({
        ...prev,
        specializations: [...prev.specializations, newSpecialization.trim()]
      }));
      setNewSpecialization('');
    }
  };

  const removeSpecialization = (index: number) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.filter((_, i) => i !== index)
    }));
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
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-6 h-6 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Configurações do Serviço
          </h2>
        </div>

        <div className="space-y-6">
          {/* Preço do serviço */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <DollarSign className="w-4 h-4" />
              Valor do Serviço (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.service_price}
              onChange={(e) => setFormData(prev => ({ ...prev, service_price: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              placeholder="100.00"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Valor cobrado por sessão de mentoria
            </p>
          </div>

          {/* Descrição */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FileText className="w-4 h-4" />
              Descrição da Mentoria
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              rows={4}
              placeholder="Descreva detalhadamente como funciona sua mentoria, metodologia, benefícios..."
            />
          </div>

          {/* Especializações */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Users className="w-4 h-4" />
              Especializações
            </label>
            
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newSpecialization}
                onChange={(e) => setNewSpecialization(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialization())}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                placeholder="Ex: Emagrecimento, Nutrição Esportiva, Diabetes..."
              />
              <button
                type="button"
                onClick={addSpecialization}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {formData.specializations.map((spec, index) => (
                <span
                  key={index}
                  className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm"
                >
                  {spec}
                  <button
                    type="button"
                    onClick={() => removeSpecialization(index)}
                    className="hover:text-green-900 dark:hover:text-green-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Tempo de resposta */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Clock className="w-4 h-4" />
              Tempo de Resposta
            </label>
            <select
              value={formData.response_time}
              onChange={(e) => setFormData(prev => ({ ...prev, response_time: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="1 hora">1 hora</option>
              <option value="2 horas">2 horas</option>
              <option value="4 horas">4 horas</option>
              <option value="12 horas">12 horas</option>
              <option value="24 horas">24 horas</option>
              <option value="48 horas">48 horas</option>
            </select>
          </div>

          {/* Requisitos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Especificações e Requisitos
            </label>
            <textarea
              value={formData.requirements}
              onChange={(e) => setFormData(prev => ({ ...prev, requirements: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              rows={3}
              placeholder="Ex: Disponibilidade para consultas semanais, compromisso com o plano alimentar, exames recentes..."
            />
          </div>

          {/* Disponibilidade */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Disponibilidade e Horários
            </label>
            <textarea
              value={formData.availability_notes}
              onChange={(e) => setFormData(prev => ({ ...prev, availability_notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              rows={3}
              placeholder="Ex: Segunda a sexta, das 8h às 18h. Finais de semana apenas emergências. Consultas online e presenciais..."
            />
          </div>

          {/* Status de disponibilidade */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <input
              type="checkbox"
              id="is_available"
              checked={formData.is_available}
              onChange={(e) => setFormData(prev => ({ ...prev, is_available: e.target.checked }))}
              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <label htmlFor="is_available" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Aceitar novos clientes
            </label>
            {formData.is_available && (
              <CheckCircle className="w-4 h-4 text-green-600" />
            )}
          </div>

          {/* Botão salvar */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>
      </div>

      {/* Preview do que os clientes verão */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Preview - Como os clientes veem seu perfil
        </h3>
        
        <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              {user?.profile?.avatar_url ? (
                <img
                  src={user.profile.avatar_url}
                  alt={user.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <span className="text-green-600 dark:text-green-400 font-semibold text-lg">
                  {user?.name?.charAt(0) || 'N'}
                </span>
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 dark:text-white text-lg">
                {user?.name}
              </h4>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-600 dark:text-green-400 font-semibold">
                  R$ {formData.service_price.toFixed(2)}
                </span>
                <span className="text-gray-500 dark:text-gray-400">por sessão</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Responde em: {formData.response_time}
              </p>
            </div>
          </div>

          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {formData.description || 'Descrição não definida'}
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {formData.specializations.map((spec, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full"
              >
                {spec}
              </span>
            ))}
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            {formData.requirements && (
              <p><strong>Requisitos:</strong> {formData.requirements}</p>
            )}
            {formData.availability_notes && (
              <p><strong>Disponibilidade:</strong> {formData.availability_notes}</p>
            )}
          </div>

          <div className="flex items-center gap-2 mt-4">
            <div className={`w-2 h-2 rounded-full ${formData.is_available ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {formData.is_available ? 'Aceitando novos clientes' : 'Não disponível'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}