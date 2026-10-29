import type { NutritionGoals } from '../store/nutrition-goals';

export type Sex = 'female' | 'male';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type BodyGoal = 'lose' | 'maintain' | 'gain';

export interface BodyData {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: BodyGoal;
}

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function bmi(heightCm: number, weightKg: number): number | null {
  if (!heightCm || !weightKg) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export type BmiRange = 'under' | 'normal' | 'over' | 'obese';

export function bmiRange(value: number): BmiRange {
  if (value < 18.5) return 'under';
  if (value < 25) return 'normal';
  if (value < 30) return 'over';
  return 'obese';
}

/** Taxa metabólica basal (Mifflin-St Jeor), em kcal/dia. */
function bmr({ sex, age, heightCm, weightKg }: BodyData): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** Gasto energético total estimado, em kcal/dia. */
export function tdee(data: BodyData): number {
  return bmr(data) * ACTIVITY_FACTORS[data.activityLevel];
}

/**
 * Metas diárias sugeridas a partir dos dados corporais.
 * Ajuste calórico moderado (-20% / +10%), proteína por kg de peso,
 * 28% das calorias em gordura, carboidrato no restante e 14 g de fibra a cada 1000 kcal.
 * São estimativas educativas; o plano individual deve vir de um nutricionista.
 */
export function suggestGoals(data: BodyData): NutritionGoals {
  const adjust = data.goal === 'lose' ? 0.8 : data.goal === 'gain' ? 1.1 : 1;
  const minimum = data.sex === 'male' ? 1500 : 1200;
  const calories = Math.max(minimum, Math.round((tdee(data) * adjust) / 10) * 10);

  const proteinPerKg = data.goal === 'maintain' ? 1.4 : 1.8;
  const protein = Math.round(data.weightKg * proteinPerKg);
  const fat = Math.round((calories * 0.28) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((calories / 1000) * 14);

  return { calories, protein, carbs, fat, fiber };
}
