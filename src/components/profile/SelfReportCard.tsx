import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, FileDown, Loader2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuthStore } from '../../store/auth';
import { useHealthProfileStore } from '../../store/health-profile';
import { useOwnPremium } from '../../store/premium';
import { useToastStore } from '../../store/toast';
import { getPatientData, type PatientData } from '../../services/care';
import { listPlanViews } from '../../services/plans';
import { loadAdherence, type AdherenceResult } from '../../services/adherence';
import { PatientReportView } from '../care/PatientReportView';

const PERIODS = [30, 90] as const;

/** Relatório de evolução do próprio cliente (Premium), no mesmo formato do relatório do nutricionista. */
export function SelfReportCard() {
  const t = useTranslation();
  const c = t.clientPremium;
  const user = useAuthStore((s) => s.user);
  const targetWeight = useHealthProfileStore((s) => s.profile.target_weight_kg);
  const premium = useOwnPremium();
  const navigate = useNavigate();
  const { showToast } = useToastStore();
  const [loading, setLoading] = useState<number | null>(null);
  const [report, setReport] = useState<{ days: number; data: PatientData; adherence: AdherenceResult | null } | null>(null);
  const close = useCallback(() => setReport(null), []);

  const open = async (days: number) => {
    if (!premium) {
      navigate('/mentoria-ia');
      return;
    }
    if (!user) return;
    setLoading(days);
    try {
      const [data, plans] = await Promise.all([getPatientData(user.id, days), listPlanViews(user.id).catch(() => [])]);
      // Adesão ao plano em uso (ou o mais recente), do nutricionista ou do próprio cliente.
      const plan = plans.find((p) => p.active && p.current) ?? plans.find((p) => p.current);
      const adherence = plan ? await loadAdherence(user.id, plan.createdBy).catch(() => null) : null;
      setReport({ days, data, adherence });
    } catch (error) {
      console.error('Error preparing report:', error);
      showToast(t.adminPanel.loadError, 'error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <FileDown className="h-6 w-6 flex-shrink-0 text-emerald-600" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
          {c.report}
          {!premium && <Crown className="h-4 w-4 text-amber-500" />}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{c.reportHint}</p>
      </div>
      <div className="flex gap-2">
        {PERIODS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => open(days)}
            disabled={loading !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300"
          >
            {loading === days && <Loader2 className="h-4 w-4 animate-spin" />}
            {c.reportDays.replace('{n}', String(days))}
          </button>
        ))}
      </div>

      {report && user && (
        <PatientReportView
          patientName={user.name}
          data={report.data}
          adherence={report.adherence}
          nutritionistName="NutriChef"
          crn={null}
          contact={null}
          days={report.days}
          targetWeight={targetWeight ?? null}
          title={c.report.replace(' (PDF)', '')}
          onDone={close}
        />
      )}
    </section>
  );
}
