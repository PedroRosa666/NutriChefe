diff --git a/src/lib/i18n/translations.ts b/src/lib/i18n/translations.ts
index 36eccbe1506eaf78cb383b023af592edbaaf4abe..23ab74476f17ef4c73e8a2b118c2cd8a91d6f863 100644
--- a/src/lib/i18n/translations.ts
+++ b/src/lib/i18n/translations.ts
@@ -1,45 +1,47 @@
 export const translations = {
   en: {
     common: {
       search: 'Search for recipes...',
       signIn: 'Sign In',
       signUp: 'Sign Up',
       signOut: 'Sign Out',
       profile: 'Profile',
       darkMode: 'Dark Mode',
       language: 'Language',
       loading: 'Loading...',
       save: 'Save',
       cancel: 'Cancel',
       delete: 'Delete',
       edit: 'Edit',
       back: 'Back',
       settings: 'Settings',
       createaccount: "Create Account",
       dontHaveAccount: "Don't have an account? ",
       alreadyHaveAccount: "Already have an account? ",
+      continueWithGoogle: 'Continue with Google',
+      orContinue: 'or continue with',
       theme: {
         light: 'Light',
         dark: 'Dark',
         system: 'System'
       }
     },
     buttons: {
       BackToRecipes: 'Back to Recipes',
       My_recipes: 'My recipes',
       Favorites: 'Favorites',
       Nutrition_goal: 'Nutrition Goals',
     },
     filters: {
       advanced: 'Advanced Filters',
       minRating: 'Minimum Rating',
       clearAll: 'Clear All Filters',
       prepTime: {
         quick: 'Quick (≤15 min)',
         medium: 'Medium (≤30 min)',
         long: 'Long (>30 min)'
       }
     },
     home: {
       title: 'Discover Healthy Recipes',
       subtitle: 'Find and share nutritious recipes that match your dietary preferences.',
@@ -120,50 +122,52 @@ export const translations = {
       CreateRecipe: 'Create recipe',
       rating:'Rating',
       noReviews:'No reviews',
     },
   },
 
   pt: {
     common: {
       search: 'Buscar receitas...',
       signIn: 'Entrar',
       signUp: 'Cadastrar',
       signOut: 'Sair',
       profile: 'Perfil',
       darkMode: 'Modo Escuro',
       language: 'Idioma',
       loading: 'Carregando...',
       save: 'Salvar',
       cancel: 'Cancelar',
       delete: 'Excluir',
       edit: 'Editar',
       back: 'Voltar',
       settings: 'Configurações',
       createaccount: 'Criar conta',
       dontHaveAccount: "Não tem uma conta? ",
       alreadyHaveAccount: "Já tem uma conta? ",
+      continueWithGoogle: 'Continuar com o Google',
+      orContinue: 'ou continue com',
       theme: {
         light: 'Claro',
         dark: 'Escuro',
         system: 'Sistema'
       }
     },
     buttons: {
       BackToRecipes: 'Voltar para as receitas',
       My_recipes: 'Minhas receitas',
       Favorites: 'Favoritos',
       Nutrition_goal: 'Metas Nutricionais',
     },
     filters: {
       advanced: 'Filtros Avançados',
       minRating: 'Avaliação Mínima',
       clearAll: 'Limpar Todos os Filtros',
       prepTime: {
         quick: 'Rápido (≤15 min)',
         medium: 'Médio (≤30 min)',
         long: 'Longo (>30 min)'
       }
     },
     home: {
       title: 'Descubra Receitas Saudáveis',
       subtitle: 'Encontre e compartilhe receitas nutritivas que combinam com suas preferências alimentares.',
