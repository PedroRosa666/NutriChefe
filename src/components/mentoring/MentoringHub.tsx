import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserCheck, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { ClientDashboard } from './ClientDashboard';
import { NutritionistDashboard } from './NutritionistDashboard';

interface MentoringHubProps {
  onBack: () => void;
}

export function MentoringHub({ onBack }: MentoringHubProps) {
  const { user } = useAuthStore();

  // Se o usuário já tem um tipo definido, mostrar o dashboard apropriado
  if (user?.type === 'Client') {
    return <ClientDashboard onBack={onBack} />;
  }

  if (user?.type === 'Nutritionist') {
    return <NutritionistDashboard onBack={onBack} />;
  }

  // Fallback caso não tenha tipo definido
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-green-600 hover:text-green-700 mb-8"
      >
        <ArrowLeft className="w-5 h-5" />
        Voltar
      </button>

      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Centro de Mentorias
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Conecte-se com profissionais ou clientes para uma jornada nutricional personalizada
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow"
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Sou Cliente
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Encontre nutricionistas qualificados, defina metas personalizadas e acompanhe seu progresso com orientação profissional.
            </p>
            <ul className="text-left space-y-2 mb-8 text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                Acesso a nutricionistas certificados
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                Metas personalizadas e acompanhamento
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                Chat em tempo real
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                Agendamento de consultas
              </li>
            </ul>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Você já está cadastrado como cliente. Acesse seu dashboard para começar!
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow"
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <UserCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Sou Nutricionista
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Expanda sua prática, gerencie clientes, crie planos personalizados e acompanhe resultados de forma profissional.
            </p>
            <ul className="text-left space-y-2 mb-8 text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                Gestão completa de clientes
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                Ferramentas de acompanhamento
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                Dashboard com métricas
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                Sistema de agendamento
              </li>
            </ul>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Você já está cadastrado como nutricionista. Acesse seu dashboard profissional!
            </p>
          </div>
        </motion.div>
      </div>

      <div className="text-center mt-12">
        <p className="text-gray-600 dark:text-gray-400">
          Sua conta já está configurada. Use o menu superior para acessar as funcionalidades de mentoria.
        </p>
      </div>
    </div>
  );
}