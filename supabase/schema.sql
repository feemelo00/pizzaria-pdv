-- ============================================================
-- PDV PIZZARIA - Schema Supabase
-- Execute este SQL no SQL Editor do Supabase
-- ============================================================

-- Habilitar extensão de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELAS BASE
-- ============================================================

CREATE TABLE condominios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR NOT NULL,
  valor_frete DECIMAL(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE clientes (
  telefone VARCHAR PRIMARY KEY,
  nome VARCHAR NOT NULL,
  condominio_id INT REFERENCES condominios(id),
  quadra VARCHAR NOT NULL,
  lote VARCHAR NOT NULL,
  rua VARCHAR NOT NULL,
  data_criacao TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE motoboys (
  id SERIAL PRIMARY KEY,
  nome VARCHAR NOT NULL,
  telefone VARCHAR,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- CARDÁPIO
-- ============================================================

CREATE TABLE ingredientes (
  id SERIAL PRIMARY KEY,
  nome VARCHAR NOT NULL,
  quantidade_estoque DECIMAL(10,3) NOT NULL DEFAULT 0,
  unidade VARCHAR NOT NULL DEFAULT 'g',
  permite_adicional BOOLEAN DEFAULT FALSE,
  quantidade_adicional DECIMAL(10,3),
  preco_adicional DECIMAL(10,2) DEFAULT 0,
  estoque_minimo DECIMAL(10,3) DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE pizzas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR NOT NULL,
  tamanho VARCHAR NOT NULL DEFAULT 'grande',
  preco DECIMAL(10,2) NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE pizza_ingredientes (
  id SERIAL PRIMARY KEY,
  pizza_id INT NOT NULL REFERENCES pizzas(id) ON DELETE CASCADE,
  ingrediente_id INT NOT NULL REFERENCES ingredientes(id),
  quantidade DECIMAL(10,3) NOT NULL,
  UNIQUE(pizza_id, ingrediente_id)
);

CREATE TABLE bebidas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR NOT NULL,
  tamanho VARCHAR,
  preco DECIMAL(10,2) NOT NULL,
  quantidade_estoque DECIMAL(10,3) DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE outros_produtos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR NOT NULL,
  tamanho VARCHAR,
  preco DECIMAL(10,2) NOT NULL,
  quantidade_estoque DECIMAL(10,3) DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bordas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR NOT NULL,
  preco DECIMAL(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- PEDIDOS
-- ============================================================

CREATE TABLE pedidos (
  id SERIAL PRIMARY KEY,
  cliente_telefone VARCHAR REFERENCES clientes(telefone),
  tipo VARCHAR NOT NULL, -- 'balcao_retirada','balcao_delivery','online_retirada','online_delivery'
  status VARCHAR NOT NULL DEFAULT 'solicitado',
  -- solicitado | fazendo | pronto | delivery | balcao | finalizado | devolvido
  condominio_id INT REFERENCES condominios(id),
  valor_frete DECIMAL(10,2) DEFAULT 0,
  valor_total DECIMAL(10,2) DEFAULT 0,
  forma_pagamento VARCHAR, -- pix | dinheiro | credito | debito | vr
  motoboy_id INT REFERENCES motoboys(id),
  observacao TEXT,
  origem VARCHAR DEFAULT 'pdv', -- pdv | whatsapp
  data_criacao TIMESTAMP DEFAULT NOW(),
  data_finalizacao TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE itens_pedido (
  id SERIAL PRIMARY KEY,
  pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  tipo_item VARCHAR NOT NULL, -- pizza | bebida | outro
  pizza_id INT REFERENCES pizzas(id),
  bebida_id INT REFERENCES bebidas(id),
  outro_id INT REFERENCES outros_produtos(id),
  quantidade INT NOT NULL DEFAULT 1,
  meia_pizza BOOLEAN DEFAULT FALSE,
  pizza_metade_1_id INT REFERENCES pizzas(id),
  pizza_metade_2_id INT REFERENCES pizzas(id),
  borda_id INT REFERENCES bordas(id),
  observacao TEXT,
  valor_unitario DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE adicionais_item (
  id SERIAL PRIMARY KEY,
  item_pedido_id INT NOT NULL REFERENCES itens_pedido(id) ON DELETE CASCADE,
  ingrediente_id INT NOT NULL REFERENCES ingredientes(id),
  quantidade DECIMAL(10,3) NOT NULL DEFAULT 1,
  aplicado_em VARCHAR DEFAULT 'inteira', -- inteira | metade_1 | metade_2
  valor DECIMAL(10,2) DEFAULT 0
);

CREATE TABLE entregas (
  id SERIAL PRIMARY KEY,
  pedido_id INT UNIQUE NOT NULL REFERENCES pedidos(id),
  motoboy_id INT REFERENCES motoboys(id),
  status VARCHAR DEFAULT 'aguardando', -- aguardando | saiu | entregue
  data_saida TIMESTAMP,
  data_entrega TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE pagamentos (
  id SERIAL PRIMARY KEY,
  pedido_id INT NOT NULL REFERENCES pedidos(id),
  metodo VARCHAR NOT NULL, -- pix | dinheiro | credito | debito | vr
  valor DECIMAL(10,2) NOT NULL,
  confirmado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE movimentacoes_estoque (
  id SERIAL PRIMARY KEY,
  ingrediente_id INT NOT NULL REFERENCES ingredientes(id),
  tipo VARCHAR NOT NULL, -- entrada | saida_pedido | saida_manual | ajuste
  quantidade DECIMAL(10,3) NOT NULL,
  motivo VARCHAR,
  pedido_id INT REFERENCES pedidos(id),
  data TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- USUÁRIOS DO SISTEMA (integrado com Supabase Auth)
-- ============================================================

CREATE TABLE usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  role VARCHAR NOT NULL DEFAULT 'funcionario', -- funcionario | proprietario
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================

CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_pedidos_data ON pedidos(data_criacao DESC);
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_telefone);
CREATE INDEX idx_itens_pedido ON itens_pedido(pedido_id);
CREATE INDEX idx_movimentacoes_ingrediente ON movimentacoes_estoque(ingrediente_id);
CREATE INDEX idx_ingredientes_estoque ON ingredientes(quantidade_estoque) WHERE ativo = TRUE;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - Supabase
-- ============================================================

ALTER TABLE condominios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE motoboys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pizzas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pizza_ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bebidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE outros_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE bordas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE adicionais_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados têm acesso total
CREATE POLICY "Acesso autenticado" ON condominios FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acesso autenticado" ON clientes FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acesso autenticado" ON motoboys FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acesso autenticado" ON ingredientes FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acesso autenticado" ON pizzas FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acesso autenticado" ON pizza_ingredientes FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acesso autenticado" ON bebidas FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acesso autenticado" ON outros_produtos FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acesso autenticado" ON bordas FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acesso autenticado" ON pedidos FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acesso autenticado" ON itens_pedido FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acesso autenticado" ON adicionais_item FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acesso autenticado" ON entregas FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acesso autenticado" ON pagamentos FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acesso autenticado" ON movimentacoes_estoque FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acesso autenticado" ON usuarios FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- FUNÇÃO: criar usuário automaticamente no cadastro
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usuarios (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuário'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'funcionario')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNÇÃO: atualizar updated_at automaticamente
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pedidos_updated BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ingredientes_updated BEFORE UPDATE ON ingredientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- REALTIME: habilitar para o kanban funcionar
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE itens_pedido;
ALTER PUBLICATION supabase_realtime ADD TABLE entregas;

-- ============================================================
-- DADOS INICIAIS DE EXEMPLO (opcional - remova se quiser)
-- ============================================================

INSERT INTO condominios (nome, valor_frete) VALUES
  ('Alphaville', 5.00),
  ('Residencial Park', 7.00),
  ('Centro', 0.00),
  ('Vila das Flores', 6.00);
