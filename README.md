# 🍕 PDV Pizzaria

Sistema completo de PDV para pizzaria com React + Supabase.

---

## 🚀 Como colocar no ar (passo a passo)

### PARTE 1 — Criar o banco no Supabase (5 min)

1. Acesse https://supabase.com e crie uma conta gratuita
2. Clique em **"New Project"** e preencha:
   - Nome: `pizzaria-pdv`
   - Senha do banco: anote em lugar seguro
   - Região: `South America (São Paulo)`
3. Aguarde criar (1-2 min)
4. Vá em **SQL Editor** (menu lateral) → clique em **"New query"**
5. Copie todo o conteúdo do arquivo `supabase/schema.sql` e cole ali
6. Clique em **"Run"** (botão verde)
7. Vá em **Settings → API** e copie:
   - `Project URL` → é o seu `VITE_SUPABASE_URL`
   - `anon public` key → é o seu `VITE_SUPABASE_ANON_KEY`

### PARTE 2 — Criar o primeiro usuário

1. No Supabase, vá em **Authentication → Users**
2. Clique em **"Invite user"**
3. Coloque o email do proprietário
4. O proprietário receberá um email para criar a senha
5. Depois de criar, vá em **Table Editor → usuarios**
6. Encontre o usuário e mude o campo `role` para `proprietario`

### PARTE 3 — Publicar o site no Vercel (10 min)

1. Acesse https://github.com e crie uma conta gratuita (se não tiver)
2. Crie um repositório novo chamado `pizzaria-pdv`
3. Faça upload de todos os arquivos desta pasta para o repositório
   (ou use o GitHub Desktop se preferir interface visual)
4. Acesse https://vercel.com e crie uma conta com o GitHub
5. Clique em **"New Project"** → selecione o repositório `pizzaria-pdv`
6. Na tela de configuração, em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` = (o URL que copiou no passo 1.7)
   - `VITE_SUPABASE_ANON_KEY` = (a chave que copiou no passo 1.7)
7. Clique em **"Deploy"**
8. Em 2-3 minutos o site estará no ar com um link do tipo `pizzaria-pdv.vercel.app`

---

## 📱 Telas do sistema

| Tela | URL | Quem usa |
|------|-----|----------|
| Login | `/login` | Todos |
| PDV (pedidos) | `/pdv` | Funcionário |
| Kanban | `/kanban` | Funcionário |
| Cozinha | `/cozinha` | Pizzaiolo |
| Entregas | `/entregas` | Funcionário |
| Dashboard | `/dashboard` | Proprietário |
| Clientes | `/admin/clientes` | Proprietário |
| Pizzas | `/admin/pizzas` | Proprietário |
| Cardápio | `/admin/cardapio` | Proprietário |
| Estoque | `/admin/estoque` | Proprietário |
| Equipe | `/admin/equipe` | Proprietário |

---

## 🔌 Integração com N8N (WhatsApp)

Os endpoints que o N8N deve chamar são direto no Supabase via REST:

**Buscar cliente:**
```
GET https://SEU_PROJETO.supabase.co/rest/v1/clientes?telefone=eq.5511999999999
Headers: apikey: SUA_ANON_KEY, Authorization: Bearer SUA_ANON_KEY
```

**Criar pedido:**
```
POST https://SEU_PROJETO.supabase.co/rest/v1/pedidos
Headers: apikey: SUA_ANON_KEY, Authorization: Bearer SUA_ANON_KEY, Content-Type: application/json
Body: { "cliente_telefone": "...", "tipo": "online_delivery", "status": "solicitado", ... }
```

**Consultar cardápio disponível:**
```
GET https://SEU_PROJETO.supabase.co/rest/v1/pizzas?ativo=eq.true&select=id,nome,preco,tamanho
```

---

## 🛠️ Rodar localmente (para desenvolvimento)

```bash
# 1. Instalar dependências
npm install

# 2. Criar arquivo de variáveis
cp .env.example .env
# Edite o .env com suas chaves do Supabase

# 3. Rodar
npm run dev

# Acesse: http://localhost:3000
```

---

## 📋 Ordem de cadastro recomendada (primeiro acesso)

1. **Condomínios** → Admin → Cardápio → aba Condomínios
2. **Ingredientes** → Admin → Estoque (cadastre todos com quantidades)
3. **Pizzas** → Admin → Pizzas (vincule os ingredientes)
4. **Bordas** → Admin → Cardápio → aba Bordas
5. **Bebidas/Outros** → Admin → Cardápio
6. **Motoboys** → Admin → Equipe → aba Motoboys
7. **Usuários** → Admin → Equipe → aba Usuários do Sistema
