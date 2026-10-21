import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ListChecks, Pause, Play, RotateCcw, Timer, X, PartyPopper } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { findStepMinutes } from '../../lib/ingredients';
import { SMOOTH } from '../../lib/motion';
import { cn } from '../../lib/utils';

interface CookingModeProps {
  title: string;
  steps: string[];
  ingredients: string[];
  onClose: () => void;
}

/** Bipe curto pelo Web Audio (sem arquivo de som). */
function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.3);
    });
    navigator.vibrate?.([300, 150, 300]);
  } catch {
    /* sem áudio disponível */
  }
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function CookingMode({ title, steps, ingredients, onClose }: CookingModeProps) {
  const t = useTranslation();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [showIngredients, setShowIngredients] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const finished = index >= steps.length;
  const stepMinutes = finished ? null : findStepMinutes(steps[index]);

  // Tela acesa enquanto o modo cozinha estiver aberto (quando o navegador permite).
  const lockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    let cancelled = false;
    const request = async () => {
      try {
        const lock = await navigator.wakeLock?.request('screen');
        if (cancelled) lock?.release();
        else lockRef.current = lock ?? null;
      } catch {
        /* sem permissão */
      }
    };
    request();
    const onVisible = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lockRef.current?.release().catch(() => undefined);
    };
  }, []);

  // Timer
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r === null) return r;
        if (r <= 1) {
          setRunning(false);
          setTimeUp(true);
          beep();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const go = useCallback(
    (delta: number) => {
      setDirection(delta);
      setIndex((i) => Math.min(steps.length, Math.max(0, i + delta)));
      setTimeUp(false);
    },
    [steps.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    // Captura: o Esc fecha só o modo cozinha, não a receita por trás.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [go, onClose]);

  const startTimer = (minutes: number) => {
    setRemaining(minutes * 60);
    setTimeUp(false);
    setRunning(true);
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] flex flex-col bg-slate-950 text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={t.cooking.start}
    >
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-8">
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label={t.cooking.exit}>
          <X className="h-6 w-6" />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-white/80">{title}</p>
        <button
          type="button"
          onClick={() => setShowIngredients((v) => !v)}
          className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium', showIngredients ? 'bg-emerald-600' : 'bg-white/10 hover:bg-white/15')}
        >
          <ListChecks className="h-4 w-4" />
          <span className="hidden sm:inline">{t.cooking.ingredients}</span>
        </button>
      </header>

      {/* Progresso */}
      <div className="h-1 bg-white/10">
        <motion.div className="h-full bg-emerald-500" animate={{ width: `${(Math.min(index, steps.length) / steps.length) * 100}%` }} transition={SMOOTH} />
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <main className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8 sm:px-16">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={index}
              custom={direction}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={SMOOTH}
              className="w-full max-w-3xl text-center"
            >
              {finished ? (
                <div className="flex flex-col items-center gap-4">
                  <PartyPopper className="h-16 w-16 text-emerald-400" />
                  <p className="text-3xl font-bold sm:text-4xl">{t.cooking.finished}</p>
                </div>
              ) : (
                <>
                  <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-emerald-400">
                    {t.cooking.step} {index + 1} {t.cooking.of} {steps.length}
                  </p>
                  <p className="text-2xl font-medium leading-relaxed sm:text-3xl lg:text-4xl">{steps[index]}</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Timer do passo */}
          {!finished && (stepMinutes || remaining !== null) && (
            <div className={cn('mt-10 flex flex-wrap items-center justify-center gap-3 rounded-2xl px-5 py-3', timeUp ? 'animate-pulse bg-rose-600' : 'bg-white/10')}>
              <Timer className="h-5 w-5" />
              {remaining !== null ? (
                <>
                  <span className="font-mono text-3xl font-bold tabular-nums">{timeUp ? t.cooking.timeUp : mmss(remaining)}</span>
                  {!timeUp && (
                    <button type="button" onClick={() => setRunning((r) => !r)} className="rounded-lg bg-white/15 p-2 hover:bg-white/25" aria-label={running ? t.cooking.pause : t.cooking.resume}>
                      {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRunning(false);
                      setRemaining(null);
                      setTimeUp(false);
                    }}
                    className="rounded-lg bg-white/15 p-2 hover:bg-white/25"
                    aria-label={t.cooking.reset}
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => startTimer(stepMinutes!)} className="text-lg font-semibold">
                  {t.cooking.startTimer.replace('{min}', String(stepMinutes))}
                </button>
              )}
            </div>
          )}
        </main>

        <AnimatePresence>
          {showIngredients && (
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={SMOOTH}
              className="absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto border-l border-white/10 bg-slate-900 p-6 shadow-2xl"
            >
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-emerald-400">{t.cooking.ingredients}</p>
              <ul className="space-y-3 text-lg">
                {ingredients.map((ing, i) => (
                  <li key={i} className="border-b border-white/5 pb-3">
                    {ing}
                  </li>
                ))}
              </ul>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <footer className="flex items-center gap-3 border-t border-white/10 px-4 py-4 sm:px-8">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-4 text-lg font-semibold hover:bg-white/15 disabled:opacity-30 sm:flex-none sm:px-8"
        >
          <ChevronLeft className="h-6 w-6" />
          {t.cooking.previous}
        </button>
        <p className="hidden flex-1 text-center text-xs text-white/40 sm:block">{t.cooking.screenOn}</p>
        {finished ? (
          <button type="button" onClick={onClose} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-4 text-lg font-semibold hover:bg-emerald-500 sm:flex-none sm:px-8">
            {t.cooking.exit}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go(1)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-4 text-lg font-semibold hover:bg-emerald-500 sm:flex-none sm:px-8"
          >
            {index === steps.length - 1 ? t.cooking.finish : t.cooking.next}
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </footer>
    </motion.div>,
    document.body
  );
}
