import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat } from "lucide-react";

/**
 * LoadingGate — versão com fumaça densa saindo para fora do medalhão
 */
export default function LoadingGate({
  initialized,
  minDurationMs = 5000,
  appName = "NutriChef",
  children,
}: {
  initialized: boolean;
  minDurationMs?: number;
  appName?: string;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(true);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!initialized) return;
    const elapsed = Date.now() - startRef.current;
    const remain = Math.max(0, minDurationMs - elapsed);
    const t = setTimeout(() => setVisible(false), remain);
    return () => clearTimeout(t);
  }, [initialized, minDurationMs]);

  const phrases = useMemo(
    () => [
      "Preparando suas receitas favoritas…",
      "Aquecendo os fornos virtuais…",
      "Picando ingredientes e ideias…",
      "Temperando a experiência…",
      "Quase lá!",
    ],
    []
  );
  const [phraseIndex, setPhraseIndex] = useState(0);
  useEffect(() => {
    const i = setInterval(() => {
      setPhraseIndex((p) => (p + 1) % phrases.length);
    }, 1400);
    return () => clearInterval(i);
  }, [phrases.length]);

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {visible ? (
          <motion.div
            key="splash"
            className="relative min-h-screen overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <RadicalBackdrop />

            <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
              <div className="relative mx-auto w-full max-w-xl text-center">
                {/* MEDALHÃO */}
                <div className="relative z-10 mx-auto mb-10 h-44 w-44 md:h-52 md:w-52">
                  <div className="absolute inset-0 rounded-full blur-2xl bg-gradient-to-tr from-emerald-400/30 via-green-500/20 to-cyan-400/25" />

                  <motion.div
                    className="relative h-full w-full rounded-full bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 ring-1 ring-white/15 shadow-[0_0_45px_-10px_rgba(16,185,129,0.55)] overflow-visible"
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
                  >
                    {/* ANEL EXTERNO */}
                    <motion.div
                      className="absolute -inset-1 rounded-full z-0"
                      style={{
                        background:
                          "conic-gradient(from 0deg, rgba(16,185,129,0) 0%, rgba(16,185,129,.85) 25%, rgba(6,182,212,.85) 50%, rgba(16,185,129,.85) 75%, rgba(16,185,129,0) 100%)",
                      }}
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    />

                    {/* FUNDO INTERNO */}
                    <div className="absolute inset-[14%] rounded-full bg-black/10 backdrop-blur-[2px] ring-1 ring-white/10 overflow-visible z-10">
                      <Steam dense />
                    </div>

                    {/* CONTEÚDO CENTRAL */}
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
                      <motion.div
                        initial={{ y: -6, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 1.0, ease: "easeOut" }}
                        className="drop-shadow-[0_3px_14px_rgba(0,0,0,0.55)]"
                      >
                        <ChefHat size={52} className="text-white" />
                      </motion.div>

                      <motion.div
                        initial={{ scale: 0.95 }}
                        animate={{ scale: [0.95, 1, 0.95] }}
                        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
                        className="mt-1 font-extrabold tracking-tight text-5xl md:text-6xl [text-shadow:0_3px_18px_rgba(0,0,0,0.7)]"
                      >
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-emerald-100 to-white">
                          N
                        </span>
                        <span className="mx-1.5 bg-clip-text text-transparent bg-gradient-to-r from-white via-emerald-100 to-white">
                          C
                        </span>
                      </motion.div>
                    </div>
                  </motion.div>
                </div>

                {/* TÍTULO */}
                <motion.h1
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="mb-3 text-4xl md:text-6xl font-extrabold tracking-tight"
                >
                  <span className="bg-clip-text text-transparent bg-gradient-to-br from-emerald-300 via-white to-emerald-200 drop-shadow">
                    {appName}
                  </span>
                </motion.h1>
                <motion.p
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="mx-auto max-w-md text-base md:text-lg text-white/70"
                >
                  Cozinhando algo épico para você
                </motion.p>

                {/* PROGRESSO */}
                <div className="mt-10 space-y-4">
                  <IndeterminateProgress />
                  <motion.div
                    key={phraseIndex}
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -8, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="text-sm md:text-base text-emerald-100/80"
                  >
                    {phrases[phraseIndex]}
                  </motion.div>
                </div>

                {/* DICA */}
                <div className="mt-10 flex items-center justify-center gap-3 text-xs md:text-sm text-white/50">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Aprimorando sabores com IA em tempo real…</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .noise { position: absolute; inset: -200%; background-image: url('data:image/svg+xml;utf8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity="0.06"/></svg>`
        )}'); mix-blend-mode: overlay; opacity: .35; }
      `}</style>
    </div>
  );
}

/** Fundo */
function RadicalBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 -z-0">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-[#0a1f1a] to-[#030a08]" />
      <div className="absolute -top-24 -left-24 h-[42rem] w-[42rem] rounded-full bg-emerald-600/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-[38rem] w-[38rem] rounded-full bg-teal-500/20 blur-3xl" />
    </div>
  );
}

/** Barra */
function IndeterminateProgress() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative h-2 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
        <div className="absolute inset-0 -translate-x-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shimmerX_1.8s_ease_infinite]" />
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-300 shadow-[0_0_20px_2px_rgba(110,231,183,0.45)]"
          initial={{ width: "8%" }}
          animate={{ width: ["8%", "45%", "65%", "85%", "60%", "92%", "100%"] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

/** Fumaça — mais intensa, larga e saindo pra fora do círculo */
function Steam({ dense = false }: { dense?: boolean }) {
  const puffCount = dense ? 12 : 6;
  const puffs = useMemo(
    () =>
      Array.from({ length: puffCount }, (_, i) => ({
        left: `${42 + Math.random() * 16}%`,
        delay: i * 0.4,
        size: 18 + Math.random() * 14,
      })),
    [dense]
  );

  return (
    <div className="absolute inset-0 overflow-visible">
      {puffs.map((p, i) => (
        <motion.div
          key={i}
          initial={{ y: 24, opacity: 0, scale: 0.7, filter: "blur(2px)" }}
          animate={{
            y: -90 - Math.random() * 40, // sai pra fora do círculo
            opacity: [0, 0.8, 0],
            scale: 1.3,
            filter: "blur(4px)",
          }}
          transition={{
            duration: 3.4 + Math.random() * 1.2,
            repeat: Infinity,
            ease: "easeOut",
            delay: p.delay,
          }}
          className="absolute bottom-[18%]"
          style={{ left: p.left }}
        >
          <div
            className="rounded-full opacity-80"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              background:
                "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.3) 45%, rgba(255,255,255,0) 75%)",
              mixBlendMode: "screen",
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}
