import React, { useState } from 'react';
import { useNutritionGoalsStore } from '../../store/nutrition-goals';
import { useTranslation } from '../../hooks/useTranslation';

export function NutritionGoalsForm() {
  const { goals, setGoals } = useNutritionGoalsStore();
  const [formData, setFormData] = useState(goals);
  const t = useTranslation();
  const saveGoals = t.profile.saveGoals;
  const dailyGoals = t.profile.dailyGoals;

  // Mapeia as chaves para suas versões traduzidas
  const goalLabels = t.profile.nutritionGoalsnames;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGoals(formData);
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">{dailyGoals}</h3>

      {Object.entries(formData).map(([key, value]) => (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-300 mb-1 capitalize">
            {goalLabels[key as keyof typeof goalLabels]} {key === 'calories' ? '(kcal)' : '(g)'}
          </label>

          <input
            type="number"
            value={value}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              [key]: Number(e.target.value)
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
            min="0"
            required
          />
        </div>
      ))}

      <button
        type="submit"
        className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        {saveGoals}
      </button>
    </form>
  );
}