import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * LoadingGate
 * - Tela de loading “radical” com tempo mínimo em tela
 * - Props:
 *    - initialized: boolean (quando true, some após respeitar o minDurationMs)
 *    - minDurationMs?: number (padrão 4500ms)
 *    - appName?: string (padrão "NutriChef")
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
                {/* >>> Garfo & Faca gigantes em X (atrás do medalhão) <<< */}
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
                  <ForkKnifeCrossBg />
                </div>

                {/* LOGO / MEDALHÃO */}
                <div className="relative z-10 mx-auto mb-10 h-40 w-40 md:h-48 md:w-48">
                  {/* Halo suave (fundo) */}
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

                    {/* Círculo interno com leve textura (não apaga o conteúdo) */}
                    <div className="absolute inset-[14%] rounded-full bg-black/5 backdrop-blur-[1px] ring-1 ring-white/10 overflow-hidden z-10">
                      {/* scanlines bem discretas */}
                      <div className="absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_1px,transparent_1px,transparent_3px)]" />
                    </div>

                    {/* Letras N ⚡ C por cima */}
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                      <motion.div
                        initial={{ scale: 0.95 }}
                        animate={{ scale: [0.95, 1, 0.95] }}
                        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
                        className="font-black tracking-tight text-4xl md:text-5xl drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
                      >
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-emerald-100 to-white">
                          N
                        </span>
                        <span className="mx-2 text-emerald-50">⚡</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-emerald-100 to-white">
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
          `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity="0.06"/></svg>`
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

function RadicalBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 -z-0">
      {/* gradiente base */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-[#0a1f1a] to-[#030a08]" />
      {/* blobs */}
      <div className="absolute -top-24 -left-24 h-[42rem] w-[42rem] rounded-full bg-emerald-600/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-[38rem] w-[38rem] rounded-full bg-teal-500/20 blur-3xl" />
      {/* linhas de grade */}
      <div className="gridlines absolute inset-0 opacity-30" />
      {/* ruído */}
      <div className="noise" />
      {/* vinheta */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_55%,rgba(0,0,0,.5)_100%)]" />
    </div>
  );
}

function IndeterminateProgress() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative h-2 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
        {/* trilho brilho */}
        <div className="absolute inset-0 -translate-x-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shimmerX_1.8s_ease_infinite]" />
        {/* barra principal */}
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

/** Ícone de plano de fundo — garfo e faca gigantes em X */
/** Ícone de plano de fundo — garfo e faca em X (modelo clássico) */
function ForkKnifeCrossBg() {
  // Grande, clean e “com cara” de talher mesmo :)
  return (
    <svg
      width="520"
      height="520"
      viewBox="0 0 520 520"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="opacity-30"
      aria-hidden
    >
      <defs>
        {/* Degradê combina com sua paleta emerald/cyan */}
        <linearGradient id="utGrad" x1="80" y1="80" x2="440" y2="440" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A7F3D0" />  {/* emerald-200 */}
          <stop offset="55%" stopColor="#34D399" /> {/* emerald-400 */}
          <stop offset="100%" stopColor="#22D3EE" />{/* cyan-400 */}
        </linearGradient>
      </defs>

      {/* ===== FORK (garfo) ===== */}
      <g transform="translate(260 260) rotate(-35) translate(-260 -260)">
        {/* cabo */}
        <path
          d="M190 380 L190 190"
          stroke="url(#utGrad)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* cabeça do garfo */}
        <path
          d="M170 190 Q190 175 210 190"
          stroke="url(#utGrad)"
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
        />
        {/* dentes (4 pontas) */}
        <path d="M175 165 L175 190" stroke="url(#utGrad)" strokeWidth="10" strokeLinecap="round" />
        <path d="M185 160 L185 190" stroke="url(#utGrad)" strokeWidth="10" strokeLinecap="round" />
        <path d="M195 160 L195 190" stroke="url(#utGrad)" strokeWidth="10" strokeLinecap="round" />
        <path d="M205 165 L205 190" stroke="url(#utGrad)" strokeWidth="10" strokeLinecap="round" />
        {/* final do cabo arredondado */}
        <circle cx="190" cy="380" r="7" fill="url(#utGrad)" />
      </g>

      {/* ===== KNIFE (faca) ===== */}
      <g transform="translate(260 260) rotate(35) translate(-260 -260)">
        {/* lâmina (chefe de cozinha, ponta curva) */}
        <path
          d="
            M300 360 
            L430 230 
            Q450 210 430 190 
            L300 320 
            Z
          "
          fill="url(#utGrad)"
          fillOpacity="0.55"
          stroke="url(#utGrad)"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        {/* fio da lâmina (linha brilhante) */}
        <path
          d="M305 352 L430 225"
          stroke="white"
          strokeOpacity="0.25"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* cabo (pílula) */}
        <rect
          x="245"
          y="338"
          width="64"
          height="26"
          rx="13"
          fill="url(#utGrad)"
          fillOpacity="0.85"
        />
        {/* rebites do cabo */}
        <circle cx="262" cy="351" r="3" fill="white" fillOpacity="0.55" />
        <circle cx="292" cy="351" r="3" fill="white" fillOpacity="0.55" />
      </g>
    </svg>
  );
}
