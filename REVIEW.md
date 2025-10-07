# Code Review Notes

## Pontos de Atenção

1. **Feedback de erro ao criar receitas**  
   Em `CreateRecipeForm` ainda registramos falhas apenas no console quando a criação de receitas lança exceção, sem avisar o usuário. Integrar o `useToastStore` para exibir um toast de erro mantém a experiência consistente com o restante da aplicação. 【F:src/components/CreateRecipeForm.tsx†L63-L85】【F:src/store/toast.ts†L1-L15】

2. **Textos de acessibilidade sem tradução**  
   Os `aria-label` adicionados ao botão de favoritos foram escritos diretamente em português. Caso o usuário altere o idioma, esses textos permanecem fixos. Usar o objeto de traduções (`useTranslation`) manteria a acessibilidade alinhada ao idioma selecionado. 【F:src/components/RecipeCard.tsx†L13-L92】【F:src/lib/i18n/translations.ts†L1-L120】

## Sugestões de Melhoria

1. **Alinhar valor inicial do filtro de categoria**  
   O store de filtros inicia `category` com `'All'`, mas o app e os botões usam `'all'`. Isso gera um breve estado sem botão selecionado até que o efeito em `App` normalize o valor. Ajustar o estado inicial ou normalizar no próprio store elimina esse flash. 【F:src/store/filters.ts†L5-L33】【F:src/App.tsx†L27-L70】

2. **Evitar confirmar ações com `window.confirm`**  
   As confirmações de exclusão na página de detalhes ainda usam `window.confirm`, o que impede personalizar texto/idioma e não combina com o visual do app. Substituir por um modal controlado manteria consistência visual e permitiria tradução fácil. 【F:src/components/RecipeDetails.tsx†L53-L138】
