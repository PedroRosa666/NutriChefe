{/* Preço */}
<div className="text-center mb-6">
  <span className="text-4xl font-bold text-purple-600 dark:text-purple-400">
    {priceBRL}
  </span>
  <span className="text-gray-600 dark:text-gray-400 ml-2">
    / {billing === 'monthly' ? 'mês' : billing}
  </span>
</div>

{/* Benefícios — 8 itens (4 de cada lado, alinhados no topo) */}
<div className="rounded-xl border border-purple-100 dark:border-purple-900/40 bg-white/70 dark:bg-white/5 backdrop-blur p-4 md:p-6">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
    {/* Coluna esquerda */}
    <ul className="space-y-3">
      <li className="flex items-center gap-3">
        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
        <span className="text-gray-700 dark:text-gray-300">
          Acesso a <span className="font-medium">nutricionistas certificados</span>
        </span>
      </li>
      <li className="flex items-center gap-3">
        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
        <span className="text-gray-700 dark:text-gray-300">
          <span className="font-medium">WhatsApp direto</span> com nutricionistas
        </span>
      </li>
      <li className="flex items-center gap-3">
        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
        <span className="text-gray-700 dark:text-gray-300">
          <span className="font-medium">Metas personalizadas</span> e periodização
        </span>
      </li>
      <li className="flex items-center gap-3">
        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
        <span className="text-gray-700 dark:text-gray-300">
          <span className="font-medium">Planos alimentares</span> ajustados ao seu perfil
        </span>
      </li>
    </ul>

    {/* Coluna direita (com divisor como borda à esquerda) */}
    <div className="md:pl-6 md:border-l md:border-purple-200/60 dark:md:border-purple-900/40">
      <ul className="space-y-3">
        <li className="flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="text-gray-700 dark:text-gray-300">
            <span className="font-medium">Acompanhamento semanal</span> e ajustes contínuos
          </span>
        </li>
        <li className="flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="text-gray-700 dark:text-gray-300">
            <span className="font-medium">Relatórios de progresso</span> com gráficos
          </span>
        </li>
        <li className="flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="text-gray-700 dark:text-gray-300">
            <span className="font-medium">Receitas premium</span> exclusivas
          </span>
        </li>
        <li className="flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="text-gray-700 dark:text-gray-300">
            <span className="font-medium">Comunidade VIP</span> e desafios mensais
          </span>
        </li>
      </ul>
    </div>
  </div>
</div>
