-- Criar tabela de faturamento do Omie
CREATE TABLE public.faturamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  omie_id TEXT NOT NULL UNIQUE,
  cliente_nome TEXT NOT NULL,
  cliente_email TEXT,
  numero_fatura TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pago', 'em_aberto', 'cancelado')),
  data_pagamento DATE,
  sync_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de emails de cobrança
CREATE TABLE public.emails_cobranca (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fatura_id UUID REFERENCES public.faturamento(id) ON DELETE CASCADE,
  cliente_email TEXT NOT NULL,
  assunto TEXT NOT NULL,
  corpo_email TEXT,
  enviado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('enviado', 'falhou', 'pendente')),
  erro_detalhes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de configuração da régua de cobrança
CREATE TABLE public.regua_cobranca (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fatura_id UUID REFERENCES public.faturamento(id) ON DELETE CASCADE,
  dias_envio INTEGER NOT NULL DEFAULT 0,
  proximo_envio DATE,
  emails_enviados INTEGER NOT NULL DEFAULT 0,
  max_emails INTEGER NOT NULL DEFAULT 10,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(fatura_id)
);

-- Habilitar RLS
ALTER TABLE public.faturamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails_cobranca ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regua_cobranca ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS - Admins e managers podem ver todos os dados
CREATE POLICY "Admins podem gerenciar faturamento" 
ON public.faturamento FOR ALL 
USING (is_admin());

CREATE POLICY "Managers podem ver faturamento" 
ON public.faturamento FOR SELECT 
USING (is_manager_or_admin());

CREATE POLICY "Admins podem gerenciar emails cobrança" 
ON public.emails_cobranca FOR ALL 
USING (is_admin());

CREATE POLICY "Managers podem ver emails cobrança" 
ON public.emails_cobranca FOR SELECT 
USING (is_manager_or_admin());

CREATE POLICY "Admins podem gerenciar régua cobrança" 
ON public.regua_cobranca FOR ALL 
USING (is_admin());

CREATE POLICY "Managers podem ver régua cobrança" 
ON public.regua_cobranca FOR SELECT 
USING (is_manager_or_admin());

-- Trigger para updated_at
CREATE TRIGGER update_faturamento_updated_at
BEFORE UPDATE ON public.faturamento
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_regua_cobranca_updated_at
BEFORE UPDATE ON public.regua_cobranca
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para performance
CREATE INDEX idx_faturamento_omie_id ON public.faturamento(omie_id);
CREATE INDEX idx_faturamento_status ON public.faturamento(status);
CREATE INDEX idx_faturamento_data_vencimento ON public.faturamento(data_vencimento);
CREATE INDEX idx_emails_cobranca_fatura_id ON public.emails_cobranca(fatura_id);
CREATE INDEX idx_regua_cobranca_fatura_id ON public.regua_cobranca(fatura_id);