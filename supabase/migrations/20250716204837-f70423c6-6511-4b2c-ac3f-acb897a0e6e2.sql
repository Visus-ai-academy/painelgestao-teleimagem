-- Create table for Omie integration data
CREATE TABLE public.omie_faturas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  omie_id TEXT NOT NULL UNIQUE,
  cliente_nome TEXT NOT NULL,
  cliente_email TEXT,
  numero_fatura TEXT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  status TEXT DEFAULT 'em_aberto' CHECK (status IN ('pago', 'em_aberto', 'cancelado')),
  data_pagamento DATE,
  sync_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for collection rule controls
CREATE TABLE public.regua_cobranca (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fatura_id UUID REFERENCES public.omie_faturas(id) ON DELETE CASCADE NOT NULL,
  dias_envio INTEGER DEFAULT 0,
  proximo_envio DATE,
  emails_enviados INTEGER DEFAULT 0,
  max_emails INTEGER DEFAULT 10,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for email logs
CREATE TABLE public.emails_cobranca (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  regua_id UUID REFERENCES public.regua_cobranca(id) ON DELETE CASCADE NOT NULL,
  fatura_id UUID REFERENCES public.omie_faturas(id) ON DELETE CASCADE NOT NULL,
  cliente_email TEXT NOT NULL,
  assunto TEXT NOT NULL,
  corpo TEXT NOT NULL,
  enviado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'enviado' CHECK (status IN ('enviado', 'erro', 'pendente')),
  erro_mensagem TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.omie_faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regua_cobranca ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails_cobranca ENABLE ROW LEVEL SECURITY;

-- RLS policies for omie_faturas
CREATE POLICY "Authenticated users can view omie invoices" ON public.omie_faturas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create omie invoices" ON public.omie_faturas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update omie invoices" ON public.omie_faturas
  FOR UPDATE TO authenticated USING (true);

-- RLS policies for regua_cobranca
CREATE POLICY "Authenticated users can view collection rules" ON public.regua_cobranca
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create collection rules" ON public.regua_cobranca
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update collection rules" ON public.regua_cobranca
  FOR UPDATE TO authenticated USING (true);

-- RLS policies for emails_cobranca
CREATE POLICY "Authenticated users can view collection emails" ON public.emails_cobranca
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create collection emails" ON public.emails_cobranca
  FOR INSERT TO authenticated WITH CHECK (true);

-- Add triggers for updated_at
CREATE TRIGGER update_omie_faturas_updated_at
  BEFORE UPDATE ON public.omie_faturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_regua_cobranca_updated_at
  BEFORE UPDATE ON public.regua_cobranca
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indices for better performance
CREATE INDEX idx_omie_faturas_omie_id ON public.omie_faturas(omie_id);
CREATE INDEX idx_omie_faturas_status ON public.omie_faturas(status);
CREATE INDEX idx_omie_faturas_vencimento ON public.omie_faturas(data_vencimento);
CREATE INDEX idx_regua_cobranca_fatura_id ON public.regua_cobranca(fatura_id);
CREATE INDEX idx_regua_cobranca_proximo_envio ON public.regua_cobranca(proximo_envio);
CREATE INDEX idx_emails_cobranca_regua_id ON public.emails_cobranca(regua_id);