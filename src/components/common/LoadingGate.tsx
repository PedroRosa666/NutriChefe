import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UtensilsCrossed } from "lucide-react";

/**
 * LoadingGate
 * - Splash “radical” com talheres reais, anel neon e tempo mínimo em tela
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

  // Permanência mínima na tela
  useEffect(() => {
    if (!initialized) return;
    const elapsed = Date.now() - startRef.current;
    const remain = Math.max(0, minDurationMs - elapsed);
    const t = setTimeout(() => setVisible(false), remain);
    return () => clearTimeout(t);
  }, [initialized, minDurationMs]);

  // Frases rotativas
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

  // Partículas
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
            {/* BACKGROUND LAYERS */}
            <RadicalBackdrop />

            {/* CONTENT */}
            <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
              <div className="relative mx-auto w-full max-w-xl text-center">
                {/* >>> Talheres reais em X (atrás do medalhão) <<< */}
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
                  <BigUtensils />
                </div>

                {/* LOGO / MEDALHÃO */}
                <div className="relative z-10 mx-auto mb-10 h-40 w-40 md:h-48 md:w-48">
                  {/* Halo suave */}
                  <div className="absolute inset-0 rounded-full blur-2xl bg-gradient-to-tr from-emerald-400/25 via-green-500/15 to-cyan-400/25" />

                  {/* Disco base */}
                  <motion.div
                    className="relative h-full w-full rounded-full bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 ring-1 ring-white/15 shadow-[0_0_40px_-10px_rgba(16,185,129,0.55)]"
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
                  >
                    {/* Anel externo animado (atrás do conteúdo) */}
                    <motion.div
                      className="absolute -inset-1 rounded-full z-0"
                      style={{
                        background:
                          "conic-gradient(from 0deg, rgba(16,185,129,0) 0%, rgba(16,185,129,.85) 25%, rgba(6,182,212,.85) 50%, rgba(16,185,129,.85) 75%, rgba(16,185,129,0) 100%)",
                      }}
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    />

                    {/* Círculo interno com leve textura (não cobre o texto) */}
                    <div className="absolute inset-[14%] rounded-full bg-black/5 backdrop-blur-[1px] ring-1 ring-white/10 overflow-hidden z-10">
                      <div className="absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_1px,transparent_1px,transparent_3px)]" />
                    </div>

                    {/* Monograma central (NC) por cima */}
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                      <motion.div
                        initial={{ scale: 0.96 }}
                        animate={{ scale: [0.96, 1, 0.96] }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                        className="font-extrabold tracking-tight text-4xl md:text-5xl"
                      >
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-emerald-100 to-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
                          N
                        </span>
                        <span className="mx-1.5 text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-emerald-100 drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
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

            {/* Partículas flutuantes */}
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

      {/* estilos auxiliares inline (sem mexer no tailwind.config) */}
      <style>{`
        /* ruído/grão suave */
        .noise { position: absolute; inset: -200%; background-image: url('data:image/svg+xml;utf8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23n)" opacity="0.06"/></svg>`
        )}'); mix-blend-mode: overlay; opacity: .35; }

        /* grid animado sutil */
        .gridlines { background-image: linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px); background-size: 48px 48px, 48px 48px; animation: gridFloat 14s linear infinite; }
        @keyframes gridFloat { from { transform: translateY(0); } to { transform: translateY(-48px); } }

        /* brilho pulsante da barra */
        @keyframes shimmerX { 0% { transform: translateX(-100%);} 100% { transform: translateX(100%);} }
      `}</style>
    </div>
  );
}

/* Fundo estilizado */
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

/* Barra indeterminada */
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

/* Talheres grandes reais (lucide-react) ao fundo */
function BigUtensils() {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative"
      aria-hidden
    >
      {/* Glow circular suave atrás dos talheres */}
      <div className="absolute -inset-6 rounded-full blur-3xl bg-emerald-500/10" />
      <UtensilsCrossed
        // tamanho grandão
        style={{ width: 520, height: 520 }}
        className="opacity-30"
        strokeWidth={1.75}
      />
      {/* contorno suave para dar “peso” */}
      <div className="absolute inset-0 -z-10 rounded-full" />
    </motion.div>
  );
}
