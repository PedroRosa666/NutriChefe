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
