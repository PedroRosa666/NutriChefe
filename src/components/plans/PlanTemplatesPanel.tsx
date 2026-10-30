import { useEffect, useState } from 'react';
import { countText } from '../../lib/format';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useFoodsStore } from '../../store/foods';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import type { MealPlanItem, PlanMeal } from '../../services/care';
import { createTemplate, deleteTemplate, listTemplates, templateToPlan, type PlanTemplate } from '../../services/templates';
import { confirmDialog } from '../../store/confirm';

interface PlanTemplatesPanelProps {
  /** Cardápio aberto no editor (para salvar como modelo). */
  meals: PlanMeal[];
  items: MealPlanItem[];
  title: string;
  notes: string;
  onApply: (input: { meals: PlanMeal[]; items: MealPlanItem[]; title: string; notes: string }) => void;
}

/** Modelos do usuário dentro do editor: aplicar um modelo ou salvar o cardápio atual como modelo. */
export function PlanTemplatesPanel({ meals, items, title, notes, onApply }: PlanTemplatesPanelProps) {
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToastStore();
  const t = useTranslation();
  const s = t.templates;
  const [templates, setTemplates] = useState<PlanTemplate[] | null>(null);
  const [name, setName] = useState(title);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listTemplates(user.id)
      .then(setTemplates)
      .catch((error) => {
        console.error('Error loading templates:', error);
        setTemplates([]);
      });
  }, [user]);

  const save = async () => {
    if (!user || !name.trim() || !items.length) return;
    setSaving(true);
    try {
      const created = await createTemplate(user.id, { title: name, notes, meals, items });
      setTemplates((prev) => [created, ...(prev ?? [])]);
      showToast(s.saved, 'success');
    } catch (error) {
      console.error('Error saving template:', error);
      showToast(s.error, 'error');
    } finally {
      setSaving(false);
    }
  };

  const apply = async (template: PlanTemplate) => {
    setBusyId(template.id);
    try {
      // Os alimentos do modelo precisam do catálogo carregado (nome e nutrientes).
      await useFoodsStore.getState().fetch();
      const foodsById = new Map(useFoodsStore.getState().foods.map((f) => [f.id, f]));
      // Cópia com ids novos: o plano não fica ligado ao modelo nem a quem o usou antes.
      const next = templateToPlan(template, foodsById, t.plan.meals);
      onApply({ ...next, title: template.title, notes: template.notes });
      const missing = next.items.length < template.items.length;
      showToast(missing ? s.appliedMissing : s.applied, missing ? 'warning' : 'success');
    } catch (error) {
      console.error('Error applying template:', error);
      showToast(s.error, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (template: PlanTemplate) => {
    if (!(await confirmDialog(s.deleteConfirm.replace('{name}', template.title)))) return;
    setBusyId(template.id);
    try {
      await deleteTemplate(template.id);
      setTemplates((prev) => (prev ?? []).filter((x) => x.id !== template.id));
    } catch (error) {
      console.error('Error deleting template:', error);
      showToast(s.error, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-sky-200 bg-sky-50/50 p-3 sm:p-4 dark:border-sky-900/40 dark:bg-sky-900/10">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.useTitle}</p>
        {templates === null ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : !templates.length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{s.empty}</p>
        ) : (
          <ul className="space-y-1.5">
            {templates.map((tpl) => (
              <li key={tpl.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 dark:bg-slate-900">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{tpl.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{countText(s.itemsCount, tpl.items.length)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => apply(tpl)}
                  disabled={busyId === tpl.id}
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {busyId === tpl.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {s.apply}
                </button>
                <button
                  type="button"
                  onClick={() => remove(tpl)}
                  disabled={busyId === tpl.id}
                  className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                  aria-label={s.delete}
                  title={s.delete}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {templates !== null && templates.length > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">{s.applyHint}</p>}
      </div>

      <div className="space-y-2 border-t border-sky-200 pt-3 dark:border-sky-900/40">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.saveTitle}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input aria-label={s.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder={s.namePlaceholder}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving || !name.trim() || !items.length}
            className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-300"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {s.save}
          </button>
        </div>
        {!items.length && <p className="text-xs text-slate-500 dark:text-slate-400">{s.saveNeedsItems}</p>}
      </div>
    </div>
  );
}
