# 🍽️ NutriChef

Uma plataforma completa para descobrir, criar e compartilhar receitas saudáveis, desenvolvida especialmente para nutricionistas e pessoas interessadas em alimentação equilibrada.

![NutriChef](https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=400&fit=crop&crop=center)

## 📋 Sobre o Projeto

O **NutriChef** é uma aplicação web moderna que conecta nutricionistas e clientes através de receitas nutritivas e personalizadas. A plataforma permite que profissionais da nutrição compartilhem receitas com informações nutricionais detalhadas, enquanto usuários podem descobrir, avaliar e favoritar receitas que se adequem aos seus objetivos de saúde.

### ✨ Principais Funcionalidades

- 🔐 **Sistema de Autenticação Completo** - Cadastro, login e recuperação de senha
- 👥 **Dois Tipos de Usuário** - Nutricionistas (criadores) e Clientes (consumidores)
- 🍳 **Gestão de Receitas** - Criar, editar, excluir e visualizar receitas
- 🔍 **Sistema de Filtros Avançados** - Por categoria, dificuldade, tempo de preparo e avaliação
- ⭐ **Sistema de Avaliações** - Avaliar receitas com comentários e notas
- ❤️ **Favoritos** - Salvar receitas preferidas
- 📊 **Informações Nutricionais** - Calorias, proteínas, carboidratos, gorduras e fibras
- 📱 **Design Responsivo** - Interface adaptada para desktop e mobile
- 🌙 **Modo Escuro/Claro** - Alternância de temas
- 🌍 **Multilíngue** - Suporte para Português e Inglês

## 🚀 Tecnologias Utilizadas

### Frontend
- **React 18** - Biblioteca principal para interface
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Framework de estilos
- **Framer Motion** - Animações e transições
- **Zustand** - Gerenciamento de estado
- **Lucide React** - Ícones

### Backend & Banco de Dados
- **Supabase** - Backend as a Service
- **PostgreSQL** - Banco de dados relacional
- **Row Level Security (RLS)** - Segurança a nível de linha
- **Supabase Auth** - Sistema de autenticação

### Bibliotecas Auxiliares
- **clsx & tailwind-merge** - Utilitários para classes CSS
- **React DOM** - Renderização do React

## 🛠️ Como Rodar o Projeto

### Pré-requisitos
- Node.js 18+ instalado
- npm ou yarn
- Conta no Supabase

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/nutrichef.git
cd nutrichef
```

### 2. Instale as dependências
```bash
npm install
# ou
yarn install
```

### 3. Configure as variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

### 4. Configure o banco de dados
Execute as migrações do Supabase que estão na pasta `supabase/migrations/`:

```bash
# Se estiver usando Supabase CLI
supabase db reset

# Ou execute manualmente no painel do Supabase
```

### 5. Inicie o servidor de desenvolvimento
```bash
npm run dev
# ou
yarn dev
```

O projeto estará disponível em `http://localhost:5173`

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

- **profiles** - Perfis dos usuários (vinculada ao auth.users)
- **recipes** - Receitas com informações nutricionais
- **reviews** - Avaliações e comentários das receitas
- **favorites** - Receitas favoritas dos usuários

### Relacionamentos
- Um usuário pode ter muitas receitas (1:N)
- Uma receita pode ter muitas avaliações (1:N)
- Um usuário pode favoritar muitas receitas (N:M)
- Um usuário pode fazer uma avaliação por receita (1:1)

## 👤 Tipos de Usuário

### 🥗 Cliente
- Visualizar todas as receitas
- Avaliar e comentar receitas
- Favoritar receitas
- Definir metas nutricionais
- Dashboard com estatísticas pessoais

### 👨‍⚕️ Nutricionista
- Todas as funcionalidades do Cliente
- Criar, editar e excluir receitas próprias
- Dashboard com estatísticas das receitas publicadas
- Visualizar avaliações recebidas

## 🔐 Fluxo de Autenticação

1. **Cadastro**: Usuário escolhe o tipo (Cliente/Nutricionista) e cria conta
2. **Login**: Autenticação via email/senha
3. **Recuperação de Senha**: Sistema completo de reset via email
4. **Sessão**: Mantida automaticamente pelo Supabase Auth
5. **Logout**: Limpeza segura da sessão

## 🎨 Funcionalidades Detalhadas

### 🔍 Sistema de Filtros
- **Categorias**: Vegana, Vegetariana, Low Carb, Rica em Proteína, Sem Glúten
- **Dificuldade**: Fácil, Médio, Difícil
- **Tempo de Preparo**: Rápido (≤15min), Médio (≤30min), Longo (>30min)
- **Avaliação Mínima**: 4+, 4.5+, 5 estrelas
- **Busca por Texto**: Título e descrição das receitas

### 📊 Informações Nutricionais
Cada receita inclui valores por porção:
- Calorias (kcal)
- Proteínas (g)
- Carboidratos (g)
- Gorduras (g)
- Fibras (g)

### ⭐ Sistema de Avaliações
- Avaliação de 1 a 5 estrelas
- Comentários opcionais
- Edição e exclusão das próprias avaliações
- Cálculo automático da média de avaliações

## 📱 Interface Responsiva

A aplicação foi desenvolvida com design mobile-first, garantindo uma experiência otimizada em:
- 📱 Smartphones (320px+)
- 📱 Tablets (768px+)
- 💻 Desktops (1024px+)
- 🖥️ Telas grandes (1440px+)

## 🌍 Internacionalização

Suporte completo para:
- 🇧🇷 **Português** (padrão)
- 🇺🇸 **Inglês**

Todas as interfaces, mensagens e categorias são traduzidas automaticamente.

## 🚀 Deploy

O projeto está configurado para deploy automático no Netlify:

```bash
npm run build
```

### Variáveis de Ambiente para Produção
Configure as mesmas variáveis do `.env` no painel do Netlify ou plataforma de deploy escolhida.

## 🔧 Scripts Disponíveis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build para produção
npm run preview      # Preview do build
npm run lint         # Verificação de código
```

## 📸 Screenshots

### Página Principal
![Home](https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=400&fit=crop)

### Dashboard do Nutricionista
![Dashboard](https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&h=400&fit=crop)

### Detalhes da Receita
![Recipe Details](https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=400&fit=crop)

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 👨‍💻 Autor

**Desenvolvido por [Pedro Henrique Rosa]**

- 📧 Email: seu.email@exemplo.com
- 💼 LinkedIn: [linkedin.com/in/seu-perfil](https://linkedin.com/in/seu-perfil)
- 🐱 GitHub: [github.com/seu-usuario](https://github.com/seu-usuario)

---

<div align="center">
  <p>Feito com ❤️ e muito ☕</p>
  <p>NutriChef © 2024 - Alimentação saudável ao alcance de todos</p>
</div>