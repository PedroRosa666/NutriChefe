import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat } from "lucide-react";

/**
 * LoadingGate
 * - Splash “radical” com chapéu de chef, letras nítidas e fumaça subindo
 */
export default function LoadingGate({
  initialized,
  minDurationMs = 4500,
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

  const dots = 24;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const seeds = useMemo(() => Array.from({ length: dots }, (_, i) => i), []);

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
                <div className="relative z-10 mx-auto mb-10 h-40 w-40 md:h-48 md:w-48">
                  {/* Halo */}
                  <div className="absolute inset-0 rounded-full blur-2xl bg-gradient-to-tr from-emerald-400/25 via-green-500/15 to-cyan-400/25" />

                  <motion.div
                    className="relative h-full w-full rounded-full bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 ring-1 ring-white/15 shadow-[0_0_40px_-10px_rgba(16,185,129,0.55)]"
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
                  >
                    {/* Anel externo */}
                    <motion.div
                      className="absolute -inset-1 rounded-full z-0"
                      style={{
                        background:
                          "conic-gradient(from 0deg, rgba(16,185,129,0) 0%, rgba(16,185,129,.85) 25%, rgba(6,182,212,.85) 50%, rgba(16,185,129,.85) 75%, rgba(16,185,129,0) 100%)",
                      }}
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    />

                    {/* Fundo interno (área visível para a fumaça) */}
                    <div className="absolute inset-[14%] rounded-full bg-black/10 backdrop-blur-[2px] ring-1 ring-white/10 overflow-hidden z-10">
                      <div className="absolute inset-0 opacity-15 [background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_1px,transparent_1px,transparent_3px)]" />
                      {/* Fumaça subindo atrás do chapéu */}
                      <Steam />
                    </div>

                    {/* Chapéu + Letras por cima de tudo */}
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
                      {/* Chapéu */}
                      <motion.div
                        initial={{ y: -6, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 1.0, ease: "easeOut" }}
                        className="drop-shadow-[0_3px_14px_rgba(0,0,0,0.55)]"
                      >
                        <ChefHat size={46} className="text-white" />
                      </motion.div>

                      {/* Letras (mais nítidas) */}
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

                {/* TÍTULOS */}
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

                {/* PROGRESS + FRASE */}
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

                {/* TIP */}
                <div className="mt-10 flex items-center justify-center gap-3 text-xs md:text-sm text-white/50">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Aprimorando sabores com IA em tempo real…</span>
                </div>
              </div>
            </div>

            {/* Partículas do fundo */}
            <div className="pointer-events-none absolute inset-0 z-0">
              {seeds.map((i) => (
                <motion.span
                  key={i}
                  className="absolute h-1 w-1 rounded-full bg-emerald-300/60 shadow-[0_0_12px_2px_rgba(16,185,129,0.55)]"
                  initial={{
                    x: Math.random() * vw,
                    y: Math.random() * vh,
                    scale: Math.random() * 0.8 + 0.4,
                    opacity: Math.random() * 0.7 + 0.2,
                  }}
                  animate={{
                    y: ["0%", "-10%", "0%"],
                    x: ["0%", "5%", "0%"],
                  }}
                  transition={{
                    duration: 6 + Math.random() * 6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{ left: 0, top: 0 }}
                />
              ))}
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

      {/* estilos inline auxiliares */}
      <style>{`
        .noise { position: absolute; inset: -200%; background-image: url('data:image/svg+xml;utf8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity="0.06"/></svg>`
        )}'); mix-blend-mode: overlay; opacity: .35; }
        .gridlines { background-image: linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px); background-size: 48px 48px, 48px 48px; animation: gridFloat 14s linear infinite; }
        @keyframes gridFloat { from { transform: translateY(0); } to { transform: translateY(-48px); } }
        @keyframes shimmerX { 0% { transform: translateX(-100%);} 100% { transform: translateX(100%);} }
      `}</style>
    </div>
  );
}

function RadicalBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 -z-0">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-[#0a1f1a] to-[#030a08]" />
      <div className="absolute -top-24 -left-24 h-[42rem] w-[42rem] rounded-full bg-emerald-600/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-[38rem] w-[38rem] rounded-full bg-teal-500/20 blur-3xl" />
      <div className="gridlines absolute inset-0 opacity-30" />
      <div className="noise" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_55%,rgba(0,0,0,.5)_100%)]" />
    </div>
  );
}

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

/** Fumaça (vapor) subindo por trás do chapéu, dentro do círculo interno */
function Steam() {
  // 6 “puffs” com posições horizontais diferentes e delays variados
  const puffs = useMemo(
    () =>
      [
        { left: "48%", delay: 0 },
        { left: "40%", delay: 0.6 },
        { left: "56%", delay: 1.1 },
        { left: "44%", delay: 1.6 },
        { left: "52%", delay: 2.1 },
        { left: "60%", delay: 2.6 },
      ] as const,
    []
  );

  return (
    <div className="absolute inset-0">
      {puffs.map((p, i) => (
        <motion.div
          key={i}
          initial={{ y: 28, opacity: 0, scale: 0.6, filter: "blur(2px)" }}
          animate={{ y: -36, opacity: [0, 0.6, 0], scale: 1.1, filter: "blur(3.5px)" }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeOut", delay: p.delay }}
          className="absolute bottom-[22%]"
          style={{ left: p.left }}
        >
          {/* Puff com gradiente radial suave e blend para parecer vapor */}
          <div className="relative">
            <div className="h-6 w-6 rounded-full opacity-70"
                 style={{
                   background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.25) 45%, rgba(255,255,255,0.0) 70%)",
                   mixBlendMode: "screen"
                 }} />
            {/* segundo blob pequeno para dar organicidade */}
            <div className="absolute -left-2 -top-2 h-4 w-4 rounded-full opacity-60"
                 style={{
                   background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.18) 45%, rgba(255,255,255,0.0) 70%)",
                   mixBlendMode: "screen"
                 }} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
