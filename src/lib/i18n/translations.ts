export const translations = {
  en: {
    common: {
      selected: "Selected",
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
      theme: {
        light: 'Light',
        dark: 'Dark',
        system: 'System'
      },
      close: 'Close',
    },
    buttons: {
      BackToRecipes: 'Back to Recipes',
      My_recipes: 'My recipes',
      Favorites: 'Favorites',
      Nutrition_goal: 'Nutrition Goals',
    },
    // ...
    profile: {
      // 👇 NOVAS CHAVES
      title: 'My profile',
      subtitle:
        'View your personal information, goals, and activity within the platform.',
      overviewClient: 'My activity',
      overviewClientDescription:
        'Track your favorites, goals, and the impact of your daily choices.',
      overviewNutritionist: 'My activity',
      overviewNutritionistDescription:
        'See the performance of your recipes, client reviews, and your presence on the platform.',

      // 👇 JÁ EXISTENTES
      myRecipes: 'My Recipes',
      favorites: 'Favorites',
      nutritionGoals: 'Nutrition Goals',
      settings: 'Settings',
      noRecipesYet: 'You haven\'t published any recipes yet.',
      noFavorites: 'You haven\'t saved any recipes as favorites yet.',
      statistics: 'Statistics',
      publishedRecipes: 'Published Recipes',
      totalReviews: 'Total Reviews',
      averageRating: 'Average Rating',
      experience: 'Experience',
      healthGoals: 'Health Goals',
      dietaryPreferences: 'Dietary Preferences',
      allergies: 'Allergies',
      dailyGoals: 'Daily Goals',
      recentFavorites: 'Recent Favorites',
      personalInfo: 'Personal Information',
      accountType: 'Account Type',
      email: 'Email',
      name: 'Name',
      password: 'Password',
      nutricionist: "Nutricionist",
      client: "Client",
      saveGoals: "Save goals",
      nutritionGoalsnames: {
        calories: 'Calories',
        protein: 'Protein',
        carbs: 'Carbs',
        fat: 'Fat',
        fiber: 'Fiber',
      },
    },
    // ...
  },

  pt: {
    common: {
      selected: "Selecionado",
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
      theme: {
        light: 'Claro',
        dark: 'Escuro',
        system: 'Sistema'
      },
      close: 'Fechar',
    },
    buttons: {
      BackToRecipes: 'Voltar para as receitas',
      My_recipes: 'Minhas receitas',
      Favorites: 'Favoritos',
      Nutrition_goal: 'Metas Nutricionais',
    },
    // ...
    profile: {
      // 👇 NOVAS CHAVES
      title: 'Meu perfil',
      subtitle:
        'Veja suas informações pessoais, metas e atividades dentro da plataforma.',
      overviewClient: 'Minha atividade',
      overviewClientDescription:
        'Acompanhe seus favoritos, metas e impacto das suas escolhas no dia a dia.',
      overviewNutritionist: 'Minha atividade',
      overviewNutritionistDescription:
        'Veja o desempenho das suas receitas, avaliações dos clientes e sua presença na plataforma.',

      // 👇 JÁ EXISTENTES
      myRecipes: 'Minhas Receitas',
      favorites: 'Favoritos',
      nutritionGoals: 'Metas Nutricionais',
      settings: 'Configurações',
      noRecipesYet: 'Você ainda não publicou nenhuma receita.',
      noFavorites: 'Você ainda não salvou nenhuma receita como favorita.',
      statistics: 'Estatísticas',
      publishedRecipes: 'Receitas Publicadas',
      totalReviews: 'Total de Avaliações',
      averageRating: 'Avaliação Média',
      experience: 'Experiência',
      healthGoals: 'Objetivos de Saúde',
      dietaryPreferences: 'Preferências Alimentares',
      allergies: 'Alergias',
      dailyGoals: 'Metas Diárias',
      recentFavorites: 'Favoritos Recentes',
      personalInfo: 'Informações Pessoais',
      accountType: 'Tipo de Conta',
      email: 'Email',
      name: 'Nome completo',
      password: 'Senha',
      nutricionist: "Nutricionista",
      client: "Cliente",
      saveGoals: "Salvar metas",
      nutritionGoalsnames: {
        calories: 'Calorias',
        protein: 'Proteína',
        carbs: 'Carboidratos',
        fat: 'Gordura',
        fiber: 'Fibra',
      },
    },
    // ...
  },
};

export type Language = keyof typeof translations;
