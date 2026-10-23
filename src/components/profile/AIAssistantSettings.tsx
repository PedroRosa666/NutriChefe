import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Crown, Loader2, Save } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useToastStore } from '../../store/toast';
import { usePremiumStore } from '../../store/premium';
import { useTranslation } from '../../hooks/useTranslation';
import { createAIConfiguration, getAIConfiguration, updateAIConfiguration } from '../../services/ai';
import type { AIConfiguration } from '../../types/ai';

const PERSONALITIES = ['empathetic', 'scientific', 'friendly', 'professional'] as const;
type Personality = (typeof PERSONALITIES)[number];

/**
 * Assistente dos pacientes (Premium Nutricionista): nome, tom e orientações que a IA segue
 * ao conversar com os pacientes deste nutricionista. A função ai-chat lê daqui (nunca do navegador).
 */
export function AIAssistantSettings() {
  const user = useAuthStore((s) => s.user);
  const showToast = useToastStore((s) => s.showToast);
  const nutritionistPro = usePremiumStore((s) => s.nutritionistPro);
  const t = useTranslation();
  const a = t.assistant;

  const [config, setConfig] = useState<AIConfiguration | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('NutriBot');
  const [personality, setPersonality] = useState<Personality>('empathetic');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    getAIConfiguration(userId)
      .then((c) => {
        setConfig(c);
        if (c) {
          setName(c.ai_name || 'NutriBot');
          setPersonality((PERSONALITIES as readonly string[]).includes(c.personality) ? (c.personality as Personality) : 'empathetic');
          setInstructions(c.custom_instructions || '');
        }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [userId]);

  if (!user || !loaded) return null;

  const save = async () => {
    setSaving(true);
    try {
      const values = { ai_name: name.trim().slice(0, 40) || 'NutriBot', personality, custom_instructions: instructions.slice(0, 1500), is_active: true };
      const next = config
        ? await updateAIConfiguration(config.id, values)
        : await createAIConfiguration({ nutritionist_id: user.id, ...values });
      setConfig(next);
      showToast(a.saved, 'success');
    } catch (error) {
      console.error('save assistant failed', error);
      showToast(a.error, 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

  return (
    <section className="max-w-4xl rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
        <Bot className="h-5 w-5 text-emerald-600" />
        {a.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.subtitle}</p>

      {!nutritionistPro && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
          <Crown className="h-4 w-4" />
          <span className="flex-1">{a.locked}</span>
          <Link to="/mentoria-ia" className="font-semibold underline">
            {a.unlock}
          </Link>
        </div>
      )}

      <fieldset disabled={!nutritionistPro} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {a.name}
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {a.tone}
          <select className={inputClass} value={personality} onChange={(e) => setPersonality(e.target.value as Personality)}>
            {PERSONALITIES.map((p) => (
              <option key={p} value={p}>
                {a.tones[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2 dark:text-slate-200">
          {a.instructions}
          <textarea
            className={inputClass}
            rows={4}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            maxLength={1500}
            placeholder={a.instructionsPlaceholder}
          />
        </label>
      </fieldset>

      {nutritionistPro && (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t.common.save}
        </button>
      )}
    </section>
  );
}
