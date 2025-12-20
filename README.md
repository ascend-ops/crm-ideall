# supastarter for Next.js

# Guia de Instalação e Configuração: Sistema de Gestão de Clientes

Este documento fornece instruções para configurar o ambiente de desenvolvimento e executar o sistema de gestão de clientes multi-tenant na sua máquina. O projeto foi construído com **Next.js**, **Supabase**, e utiliza **PNPM** como gerenciador de pacotes.

## Índice
1.  [Visão Geral do Projeto](#visão-geral-do-projeto)
2.  [Pré-requisitos](#pré-requisitos)
3.  [Passo a Passo de Instalação](#passo-a-passo-de-instalação)
4.  [Configuração do Supabase](#configuração-do-supabase)
5.  [Executando a Aplicação](#executando-a-aplicação)
6.  [Estrutura do Projeto](#estrutura-do-projeto)

---

## 1. Visão Geral do Projeto

Este é um sistema de gestão de leads e clientes desenvolvido para múltiplas empresas (**tenants**). A aplicação possui um dashboard analítico, controle de status de clientes e um sistema de permissões baseado em três funções principais:

*   **Tenant:** Tem acesso total a todos os clientes e usuários (gestores e parceiros) vinculados à sua organização.
*   **Gestor:** Pode gerenciar os clientes que criou e os parceiros vinculados a ele.
*   **Parceiro:** Acesso somente leitura aos clientes que lhe foram atribuídos.

A aplicação principal está na pasta `apps/web/` e é um **monorepo** gerenciado com **PNPM Workspaces**.

## 2. Pré-requisitos

Antes de começar, verifique se o seu sistema atende aos requisitos e instale as ferramentas fundamentais.

### 2.1 Requisitos do Sistema
*   **Sistema Operacional:** Windows 10/11, macOS ou Linux.
*   **Node.js:** Versão 20.9 ou superior, que é o requisito mínimo para o Next.js 16.
*   **Gerenciador de Pacotes:** **PNPM** (recomendado) ou NPM/Yarn.
*   **Contêiner Docker** (opcional, para desenvolvimento local com Supabase).

### 2.2 Instalando o Node.js e o NPM

Se você não tem o Node.js instalado, siga estas etapas:

1.  **Baixe o instalador:** Acesse o [site oficial do Node.js](https://nodejs.org) e baixe a versão **LTS (Long Term Support)**.
2.  **Execute o instalador:** Siga as instruções do assistente de instalação.
3.  **Verifique a instalação:** Abra um novo terminal (PowerShell no Windows, Terminal no Mac) e execute:
    ```bash
    node -v
    npm -v
    ```
    Os comandos devem retornar os números de versão do Node.js e do NPM.

### 2.3 Instalando o PNPM (Recomendado)

O projeto utiliza PNPM Workspaces. Para instalar o PNPM globalmente, você tem várias opções:

*   **Usando NPM (funciona em Windows e Mac):**
    ```bash
    npm install -g pnpm
    ```

*   **No Mac, usando Homebrew:**
    ```bash
    brew install pnpm
    ```

*   **No Windows, usando Winget:**
    ```bash
    winget install -e --id pnpm.pnpm
    ```

**Verifique a instalação:**
```bash
pnpm --version
```

## 3. Passo a Passo de Instalação

Com os pré-requisitos instalados, siga os passos abaixo para configurar o projeto.

Clone o repositório do projeto para a sua máquina.

Acesse a pasta do projeto no terminal:

```bash
cd /caminho/para/o/projeto/leads
```

Instale todas as dependências do projeto usando o PNPM. Este comando instalará as dependências de todos os pacotes no monorepo:

```bash
pnpm install
```

## 4. Configuração do Supabase

O projeto usa o Supabase (uma plataforma backend-as-a-service) para autenticação e banco de dados. Você pode se conectar ao projeto online existente ou configurar um ambiente local.

### 4.1 Usando o Projeto Online (Recomendado para Início)

Obtenha as credenciais: Você precisará das variáveis de ambiente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` do projeto Supabase existente.

Configure as variáveis: Na pasta `apps/web/`, crie um arquivo chamado `.env.local`.

Cole as credenciais no arquivo `.env.local` no seguinte formato:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_publica_aqui
```

### 4.2 Configuração Local (Avançado - Opcional)

Para desenvolver localmente com um banco de dados Supabase em sua máquina, você precisará do Docker e da CLI do Supabase.

Instale a CLI do Supabase:

```bash
npm install supabase --save-dev
```

Inicie os serviços locais do Supabase (requer Docker em execução):

```bash
npx supabase start
```

Este comando irá baixar as imagens Docker e iniciar todos os serviços (banco de dados, autenticação, etc.), fornecendo novas credenciais locais para usar no seu arquivo `.env.local`.

## 5. Executando a Aplicação

Com as dependências instaladas e o Supabase configurado, você pode iniciar o servidor de desenvolvimento.

Navegue até a aplicação principal:

```bash
cd apps/web
```

Inicie o servidor de desenvolvimento do Next.js. O comando é o mesmo para Windows e macOS:

```bash
pnpm dev
```

O Next.js 16 usa o Turbopack por padrão, que é um bundler mais rápido para desenvolvimento.

O servidor será iniciado na porta 3000.

Acesse a aplicação: Abra seu navegador e vá para **http://localhost:3000**.

Você será redirecionado para a página de login (**/auth/login**).

Use suas credenciais de usuário no Supabase para acessar o sistema.

## 6. Estrutura do Projeto

Para seu conhecimento, segue um resumo da estrutura de pastas principal:

```
leads/
├── apps/
│   └── web/                          # Aplicação principal (Next.js)
│       ├── app/                      # Rotas da aplicação (App Router)
│       │   ├── (saas)/               # Rotas protegidas (Dashboard)
│       │   │   ├── app/
│       │   │   │   ├── dashboard/    # Página do Dashboard
│       │   │   │   ├── clientes/     # Lista e gestão de clientes
│       │   │   │   └── aprovados/    # Gráfico de clientes aprovados
│       │   │   └── layout.tsx        # Layout das áreas logadas
│       │   ├── auth/                 # Páginas de autenticação (login)
│       │   └── layout.tsx            # Layout raiz
│       ├── lib/
│       │   └── supabase/             # Configuração do cliente Supabase
│       └── .env.local                # Variáveis de ambiente
├── packages/                         # Pacotes compartilhados do monorepo
│   ├── @ui/                         # Componentes de interface reutilizáveis
│   └── @shared/                     # Utilitários e configurações comuns
└── pnpm-workspace.yaml              # Configuração do monorepo PNPM
```

## Comandos Úteis no Terminal

`pnpm dev`: Inicia o servidor de desenvolvimento na pasta atual.  
`pnpm build`: Cria uma versão otimizada para produção da aplicação.  
`pnpm start`: Inicia o servidor de produção (após o build).  
