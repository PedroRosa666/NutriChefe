import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat } from "lucide-react";

/**
 * LoadingGate — ChefHat + letras claras + órbitas de alimentos AO REDOR do medalhão
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

  // partículas de fundo leve
  const dots = 14;
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
                <div className="relative z-10 mx-auto mb-10 h-44 w-44 md:h-52 md:w-52">
                  {/* Halo pulsante */}
                  <motion.div
                    className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-400/30 via-green-500/20 to-cyan-400/25 blur-2xl"
                    animate={{ opacity: [0.6, 0.85, 0.6], scale: [1, 1.03, 1] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                  />

                  {/* Disco principal */}
                  <motion.div
                    className="relative h-full w-full rounded-full bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 ring-1 ring-white/15 shadow-[0_0_45px_-10px_rgba(16,185,129,0.55)] overflow-visible"
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

                    {/* Fundo interno + brilho sweep */}
                    <div className="absolute inset-[14%] rounded-full bg-black/10 backdrop-blur-[2px] ring-1 ring-white/10 overflow-hidden z-10">
                      <div className="absolute inset-0 opacity-15 [background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_1px,transparent_1px,transparent_3px)]" />
                      <ShineSweep />
                    </div>

                    {/* Conteúdo central (ChefHat + NC) */}
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
                      {/* Chapéu */}
                      <motion.div
                        initial={{ y: -6, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 1.0, ease: "easeOut" }}
                      >
                        <ChefHat size={52} className="text-white" />
                      </motion.div>

                      {/* Letras claras: sem sombra escura */}
                      <motion.div
                        initial={{ scale: 0.96 }}
                        animate={{ scale: [0.96, 1, 0.96] }}
                        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
                        className="mt-1 font-extrabold tracking-tight text-5xl md:text-6xl"
                      >
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-emerald-100 to-white">
                          N
                        </span>
                        <span className="mx-1.5 bg-clip-text text-transparent bg-gradient-to-r from-white via-emerald-100 to-white">
                          C
                        </span>
                      </motion.div>
                    </div>

                    {/* >>> ÓRBITAS AO REDOR DO MEDALHÃO (emojis) <<< */}
                    <OrbitAroundMedal
                      emojis={["🥑", "🍅", "🥕", "🍋", "🥖", "🧀", "🌶️", "🥬"]}
                      radiusOffsetPx={10}    // bem colada na borda
                      durationSec={14}       // mais rápida
                      sizePattern={[22, 20]} // alterna tamanhos
                      direction="cw"
                    />
                    <OrbitAroundMedal
                      emojis={["🍓", "🍍", "🍇", "🍄", "🍤", "🥚", "🥔", "🧄", "🧅", "🍞"]}
                      radiusOffsetPx={28}    // um pouco mais afastada
                      durationSec={20}       // mais lenta
                      sizePattern={[20, 18, 16]}
                      direction="ccw"
                    />
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
              </div>
            </div>

            {/* partículas ambiente */}
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
    </div>
  );
}

/** Fundo simples */
function RadicalBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 -z-0">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-[#0a1f1a] to-[#030a08]" />
      <div className="absolute -top-24 -left-24 h-[42rem] w-[42rem] rounded-full bg-emerald-600/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-[38rem] w-[38rem] rounded-full bg-teal-500/20 blur-3xl" />
    </div>
  );
}

/** Barra de progresso */
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

/** Brilho diagonal que varre o interior do medalhão */
function ShineSweep() {
  return (
    <motion.div
      className="absolute -inset-8 pointer-events-none"
      initial={{ opacity: 0.0 }}
      animate={{ opacity: [0.0, 0.18, 0.0] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      style={{
        background:
          "linear-gradient(120deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 65%)",
        transform: "rotate(0.001deg)",
        mixBlendMode: "screen",
        maskImage:
          "radial-gradient(circle at 50% 50%, rgba(0,0,0,1) 52%, rgba(0,0,0,0.0) 64%)",
      }}
    />
  );
}

/**
 * ÓRBITA AO REDOR DO MEDALHÃO
 * - Posicionada dentro do disco principal, porém usa container maior que o medalhão
 * - O raio é calculado como: 50% do medalhão + radiusOffsetPx
 * - direction: "cw" (horário) | "ccw" (anti-horário)
 */
function OrbitAroundMedal({
  emojis,
  radiusOffsetPx = 25,
  durationSec = 16,
  sizePattern = [20],
  direction = "cw",
}: {
  emojis: string[];
  radiusOffsetPx?: number;
  durationSec?: number;
  sizePattern?: number[];
  direction?: "cw" | "ccw";
}) {
  const step = 360 / emojis.length;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      style={{
        // container maior para a órbita ficar fora da borda
        transform: "translate(-0%, -0%)",
      }}
      animate={{ rotate: direction === "cw" ? 360 : -360 }}
      transition={{ duration: durationSec, repeat: Infinity, ease: "linear" }}
      aria-hidden
    >
      {emojis.map((emoji, i) => {
        const deg = i * step;
        const radius = `calc(50% + ${radiusOffsetPx}px)`;
        const fontSize = sizePattern[i % sizePattern.length];

        // cada item tem seu próprio "braço" rotacionado em deg, e o emoji fica no topo desse braço
        return (
          <div
            key={`${emoji}-${i}`}
            className="absolute inset-0"
            style={{
              transform: `rotate(${deg}deg)`,
            }}
          >
            <span
              className="absolute left-1/2 top-1/2 select-none"
              style={{
                transform: `translate(-50%, -50%) translateY(-${radius}) rotate(${
                  direction === "cw" ? -deg : deg
                }deg)`,
                fontSize,
                filter: "drop-shadow(0 0 6px rgba(16,185,129,0.45))",
              }}
            >
              {emoji}
            </span>
          </div>
        );
      })}
    </motion.div>
  );
}
