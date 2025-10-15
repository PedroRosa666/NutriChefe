import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat } from "lucide-react";

/**
 * LoadingGate — otimizado para mobile
 * - Menos elementos e efeitos em telas pequenas
 * - Respeita prefers-reduced-motion
 * - Pausa rotação quando a aba estiver oculta
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

  // media queries
  const isMobile = useMediaQuery("(max-width: 640px)");
  const prefersReduced = useMediaQuery("(prefers-reduced-motion: reduce)");

  // -> permanência mínima
  useEffect(() => {
    if (!initialized) return;
    const elapsed = Date.now() - startRef.current;
    const remain = Math.max(0, minDurationMs - elapsed);
    const t = setTimeout(() => setVisible(false), remain);
    return () => clearTimeout(t);
  }, [initialized, minDurationMs]);

  // frases rotativas (mantido)
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
    const i = setInterval(() => setPhraseIndex((p) => (p + 1) % phrases.length), 1400);
    return () => clearInterval(i);
  }, []);

  // ====== MEDIÇÃO DO MEDALHÃO PARA ÓRBITAS EXTERNAS ======
  const medalRef = useRef<HTMLDivElement>(null);
  const [medalDiameter, setMedalDiameter] = useState<number>(0);

  useEffect(() => {
    const el = medalRef.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        setMedalDiameter(Math.max(rect.width, rect.height));
      });
    };

    update();

    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => {
        ro.disconnect();
        cancelAnimationFrame(raf);
      };
    } else {
      window.addEventListener("resize", update);
      return () => {
        window.removeEventListener("resize", update);
        cancelAnimationFrame(raf);
      };
    }
  }, []);

  // Pausar animações quando a aba estiver oculta (performance/bateria)
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // partículas de fundo (desligadas no mobile)
  const dots = isMobile ? 0 : 10;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const seeds = useMemo(() => Array.from({ length: dots }, (_, i) => i), [dots]);

  // parâmetros dependentes de ambiente
  const orbit1 = useMemo(
    () => ({
      emojis: isMobile ? ["🥑", "🍅", "🥕", "🍋"] : ["🥑", "🍅", "🥕", "🍋", "🥖", "🧀", "🌶️", "🥬"],
      radiusOffset: isMobile ? 12 : 16,
      durationSec: prefersReduced ? 0 : pageVisible ? (isMobile ? 16 : 14) : 0,
      direction: "cw" as const,
      sizePattern: isMobile ? [18, 16] : [22, 20],
    }),
    [isMobile, prefersReduced, pageVisible]
  );

  const orbit2 = useMemo(
    () => ({
      emojis: isMobile
        ? ["🍓", "🍍", "🍇", "🍄"]
        : ["🍓", "🍍", "🍇", "🍄", "🍤", "🥚", "🧄", "🧅", "🍞", "🥔"],
      radiusOffset: isMobile ? 24 : 34,
      durationSec: prefersReduced ? 0 : pageVisible ? (isMobile ? 22 : 20) : 0,
      direction: "ccw" as const,
      sizePattern: isMobile ? [16, 14] : [20, 18, 16],
    }),
    [isMobile, prefersReduced, pageVisible]
  );

  // rotação do anel e halo (desliga se prefers-reduced-motion / aba oculta)
  const ringRotate = prefersReduced || !pageVisible ? undefined : { rotate: [0, 360] };
  const ringTransition =
    prefersReduced || !pageVisible
      ? undefined
      : { duration: 16, repeat: Infinity as const, ease: "linear" };

  const conicRotate = prefersReduced || !pageVisible ? undefined : { rotate: [0, 360] };
  const conicTransition =
    prefersReduced || !pageVisible
      ? undefined
      : { duration: 10, repeat: Infinity as const, ease: "linear" };

  const haloAnim =
    prefersReduced || !pageVisible
      ? undefined
      : { opacity: [0.6, 0.85, 0.6], scale: [1, 1.03, 1] };

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
            transition={{ duration: 0.4 }}
          >
            <RadicalBackdrop />

            <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
              <div className="relative mx-auto w-full max-w-xl text-center">
                {/* ====== BLOCO CENTRAL: MEDALHÃO + ÓRBITAS EXTERNAS ====== */}
                <div className="relative mx-auto mb-10 flex items-center justify-center">
                  {/* ÓRBITAS (fora do medalhão) */}
                  <OrbitsOutside
                    medalDiameter={medalDiameter}
                    rings={[orbit1, orbit2]}
                  />

                  {/* ===== MEDALHÃO ===== */}
                  <div
                    ref={medalRef}
                    className="relative z-10 h-40 w-40 md:h-52 md:w-52"
                    style={{ willChange: "transform" }}
                  >
                    {/* Halo pulsante (reduzido no mobile) */}
                    <motion.div
                      className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-400/25 via-green-500/15 to-cyan-400/20 blur-xl md:blur-2xl"
                      animate={haloAnim}
                      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                    />

                    {/* Disco principal */}
                    <motion.div
                      className="relative h-full w-full rounded-full bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 ring-1 ring-white/15 shadow-[0_0_28px_-10px_rgba(16,185,129,0.55)] md:shadow-[0_0_45px_-10px_rgba(16,185,129,0.55)]"
                      animate={ringRotate}
                      transition={ringTransition}
                      style={{ willChange: "transform" }}
                    >
                      {/* Anel externo (conic) */}
                      <motion.div
                        className="absolute -inset-1 rounded-full z-0"
                        style={{
                          background:
                            "conic-gradient(from 0deg, rgba(16,185,129,0) 0%, rgba(16,185,129,.85) 25%, rgba(6,182,212,.85) 50%, rgba(16,185,129,.85) 75%, rgba(16,185,129,0) 100%)",
                          willChange: "transform",
                        }}
                        animate={conicRotate}
                        transition={conicTransition}
                      />

                      {/* Fundo interno + brilho sweep */}
                      <div className="absolute inset-[14%] rounded-full bg-black/10 backdrop-blur-[1.5px] ring-1 ring-white/10 overflow-hidden z-10">
                        <div className="absolute inset-0 opacity-15 [background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_1px,transparent_1px,transparent_3px)]" />
                        {!prefersReduced && pageVisible && <ShineSweep />}
                      </div>

                      {/* Conteúdo central (chapéu + NC claras) */}
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
                        <motion.div
                          initial={prefersReduced ? false : { y: -6, opacity: 0 }}
                          animate={prefersReduced ? undefined : { y: 0, opacity: 1 }}
                          transition={{ duration: 0.9, ease: "easeOut" }}
                        >
                          <ChefHat size={isMobile ? 44 : 52} className="text-white" />
                        </motion.div>

                        <motion.div
                          initial={prefersReduced ? false : { scale: 0.96 }}
                          animate={
                            prefersReduced || !pageVisible
                              ? undefined
                              : { scale: [0.96, 1, 0.96] }
                          }
                          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
                          className="mt-1 font-extrabold tracking-tight text-5xl md:text-6xl"
                        >
                          <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-emerald-100 to-white">
                            N
                          </span>
                          <span className="mx-1 bg-clip-text text-transparent bg-gradient-to-r from-white via-emerald-100 to-white">
                            C
                          </span>
                        </motion.div>
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* TÍTULO */}
                <motion.h1
                  initial={prefersReduced ? false : { y: 16, opacity: 0 }}
                  animate={prefersReduced ? undefined : { y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="mb-3 text-3xl md:text-6xl font-extrabold tracking-tight"
                >
                  <span className="bg-clip-text text-transparent bg-gradient-to-br from-emerald-300 via-white to-emerald-200 drop-shadow">
                    {appName}
                  </span>
                </motion.h1>

                <motion.p
                  initial={prefersReduced ? false : { y: 10, opacity: 0 }}
                  animate={prefersReduced ? undefined : { y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="mx-auto max-w-md text-sm md:text-lg text-white/70"
                >
                  Cozinhando algo épico para você
                </motion.p>

                {/* PROGRESSO */}
                <div className="mt-8 md:mt-10 space-y-4">
                  <IndeterminateProgress prefersReduced={prefersReduced} />
                  <motion.div
                    key={phraseIndex}
                    initial={prefersReduced ? false : { y: 8, opacity: 0 }}
                    animate={prefersReduced ? undefined : { y: 0, opacity: 1 }}
                    exit={{ y: -8, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-sm md:text-base text-emerald-100/80"
                  >
                    {phrases[phraseIndex]}
                  </motion.div>
                </div>
              </div>
            </div>

            {/* partículas ambiente — desligadas no mobile */}
            {seeds.length > 0 && (
              <div className="pointer-events-none absolute inset-0 z-0">
                {seeds.map((i) => (
                  <motion.span
                    key={i}
                    className="absolute h-1 w-1 rounded-full bg-emerald-300/60"
                    initial={{
                      x: Math.random() * vw,
                      y: Math.random() * vh,
                      scale: Math.random() * 0.8 + 0.4,
                      opacity: Math.random() * 0.6 + 0.2,
                    }}
                    animate={
                      prefersReduced || !pageVisible
                        ? undefined
                        : { y: ["0%", "-10%", "0%"], x: ["0%", "4%", "0%"] }
                    }
                    transition={{
                      duration: 7 + Math.random() * 6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    style={{ left: 0, top: 0, willChange: "transform" }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Fundo simples (sem grid/ruído para reduzir custo no mobile) */
function RadicalBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 -z-0">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-[#0a1f1a] to-[#030a08]" />
      <div className="absolute -top-24 -left-24 h-[42rem] w-[42rem] rounded-full bg-emerald-600/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-[38rem] w-[38rem] rounded-full bg-teal-500/20 blur-3xl" />
    </div>
  );
}

/** Barra de progresso — sem animação se prefers-reduced-motion */
function IndeterminateProgress({ prefersReduced }: { prefersReduced: boolean }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative h-2 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
        {!prefersReduced && (
          <div className="absolute inset-0 -translate-x-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shimmerX_1.8s_ease_infinite]" />
        )}
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-300"
          initial={{ width: "12%" }}
          animate={prefersReduced ? undefined : { width: ["12%", "45%", "70%", "90%", "100%"] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }}
          style={{ willChange: "width" }}
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
        transform: "translateZ(0)", // ativa aceleração
        mixBlendMode: "screen",
        maskImage:
          "radial-gradient(circle at 50% 50%, rgba(0,0,0,1) 52%, rgba(0,0,0,0.0) 64%)",
        willChange: "opacity, transform",
      }}
    />
  );
}

/** Múltiplas órbitas FORA do medalhão */
function OrbitsOutside({
  medalDiameter,
  rings,
}: {
  medalDiameter: number; // px
  rings: Array<{
    emojis: string[];
    radiusOffset: number; // px
    durationSec: number;
    direction: "cw" | "ccw";
    sizePattern: number[];
  }>;
}) {
  const radiusBase = Math.max(0, medalDiameter / 2); // raio real do medalhão

  return (
    <>
      {rings.map((ring, idx) => (
        <SingleOrbit
          key={idx}
          emojis={ring.emojis}
          radiusPx={radiusBase + ring.radiusOffset}
          durationSec={ring.durationSec}
          direction={ring.direction}
          sizePattern={ring.sizePattern}
        />
      ))}
    </>
  );
}

/** Uma órbita (fora do medalhão) — usa apenas transform (GPU) */
function SingleOrbit({
  emojis,
  radiusPx,
  durationSec,
  direction,
  sizePattern,
}: {
  emojis: string[];
  radiusPx: number;
  durationSec: number;
  direction: "cw" | "ccw";
  sizePattern: number[];
}) {
  const step = 360 / emojis.length;

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-1/2 z-0"
      animate={durationSec ? { rotate: direction === "cw" ? 360 : -360 } : undefined}
      transition={
        durationSec
          ? { duration: durationSec, repeat: Infinity, ease: "linear" }
          : undefined
      }
      style={{ transform: "translate(-50%, -50%)", willChange: "transform" }}
      aria-hidden
    >
      {emojis.map((emoji, i) => {
        const deg = i * step;
        const fontSize = sizePattern[i % sizePattern.length];

        return (
          <div
            key={`${emoji}-${i}`}
            className="absolute"
            style={{ transform: `rotate(${deg}deg)`, willChange: "transform" }}
          >
            <span
              className="absolute left-0 top-0 select-none"
              style={{
                transform: `translateX(${radiusPx}px) rotate(${
                  direction === "cw" ? -deg : deg
                }deg)`,
                fontSize,
                // usar text-shadow leve em vez de filter: drop-shadow (melhor no mobile)
                textShadow: "0 0 6px rgba(16,185,129,0.35)",
                willChange: "transform",
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

/** hook simples p/ matchMedia */
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    // older Safari
    // @ts-ignore
    mql.addEventListener ? mql.addEventListener("change", onChange) : mql.addListener(onChange);
    setMatches(mql.matches);
    return () => {
      // @ts-ignore
      mql.removeEventListener ? mql.removeEventListener("change", onChange) : mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}
