-- Criar tabela para configuração de mapeamentos de campos
CREATE TABLE public.field_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'exames', 'medicos', 'clientes', 'escalas', 'faturamento'
  source_field TEXT NOT NULL, -- nome da coluna no arquivo origem
  target_field TEXT NOT NULL, -- nome da coluna no banco destino
  target_table TEXT NOT NULL, -- nome da tabela destino
  field_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'number', 'date', 'boolean'
  is_required BOOLEAN NOT NULL DEFAULT false,
  default_value TEXT NULL,
  transformation_rules JSONB NULL, -- regras de transformação se necessário
  validation_rules JSONB NULL, -- regras de validação
  order_index INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Criar tabela para templates de importação
CREATE TABLE public.import_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  description TEXT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  auto_detect_columns JSONB NULL, -- colunas que identificam este template
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Criar tabela para histórico de importações
CREATE TABLE public.import_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.import_templates(id),
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  records_imported INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed', 'partial'
  error_details JSONB NULL,
  import_summary JSONB NULL, -- resumo dos dados importados
  preview_data JSONB NULL, -- preview dos primeiros registros
  mapping_used JSONB NULL, -- mapeamento usado na importação
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para field_mappings
CREATE POLICY "Admins podem gerenciar mapeamentos" ON public.field_mappings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver mapeamentos" ON public.field_mappings
  FOR SELECT USING (is_manager_or_admin());

-- Políticas RLS para import_templates
CREATE POLICY "Admins podem gerenciar templates" ON public.import_templates
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver templates" ON public.import_templates
  FOR SELECT USING (is_manager_or_admin());

-- Políticas RLS para import_history
CREATE POLICY "Admins podem gerenciar histórico" ON public.import_history
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver histórico" ON public.import_history
  FOR SELECT USING (is_manager_or_admin());

-- Triggers para updated_at
CREATE TRIGGER update_field_mappings_updated_at
  BEFORE UPDATE ON public.field_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_import_templates_updated_at
  BEFORE UPDATE ON public.import_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir templates padrão para MobileMed
INSERT INTO public.import_templates (name, file_type, description, is_default, auto_detect_columns) VALUES
('MobileMed - Exames', 'exames', 'Template padrão para importação de exames do MobileMed', true, '["Data do Exame", "Paciente", "Médico", "Modalidade"]'),
('MobileMed - Médicos', 'medicos', 'Template padrão para importação de médicos do MobileMed', true, '["Nome", "CRM", "Especialidade"]'),
('MobileMed - Clientes', 'clientes', 'Template padrão para importação de clientes do MobileMed', true, '["Nome", "CNPJ", "Email"]'),
('MobileMed - Escalas', 'escalas', 'Template padrão para importação de escalas médicas do MobileMed', true, '["Data", "Médico", "Turno", "Modalidade"]'),
('MobileMed - Faturamento', 'faturamento', 'Template padrão para importação de faturamento do MobileMed', true, '["Número da Fatura", "Cliente", "Valor", "Data Emissão"]');

-- Inserir mapeamentos padrão para exames
INSERT INTO public.field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index) VALUES
('MobileMed - Exames', 'exames', 'Data do Exame', 'data_exame', 'exames', 'date', true, 1),
('MobileMed - Exames', 'exames', 'Paciente', 'paciente_nome', 'exames', 'text', true, 2),
('MobileMed - Exames', 'exames', 'Médico', 'medico_id', 'exames', 'text', true, 3),
('MobileMed - Exames', 'exames', 'Modalidade', 'modalidade', 'exames', 'text', true, 4),
('MobileMed - Exames', 'exames', 'Especialidade', 'especialidade', 'exames', 'text', true, 5),
('MobileMed - Exames', 'exames', 'Categoria', 'categoria', 'exames', 'text', false, 6),
('MobileMed - Exames', 'exames', 'Cliente', 'cliente_id', 'exames', 'text', true, 7),
('MobileMed - Exames', 'exames', 'Valor Unitário', 'valor_unitario', 'exames', 'number', false, 8),
('MobileMed - Exames', 'exames', 'Quantidade', 'quantidade', 'exames', 'number', false, 9),
('MobileMed - Exames', 'exames', 'Valor Total', 'valor_total', 'exames', 'number', false, 10),
('MobileMed - Exames', 'exames', 'Observações', 'observacoes', 'exames', 'text', false, 11);

-- Inserir mapeamentos padrão para médicos
INSERT INTO public.field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index) VALUES
('MobileMed - Médicos', 'medicos', 'Nome', 'nome', 'medicos', 'text', true, 1),
('MobileMed - Médicos', 'medicos', 'CRM', 'crm', 'medicos', 'text', true, 2),
('MobileMed - Médicos', 'medicos', 'Especialidade', 'especialidade', 'medicos', 'text', true, 3),
('MobileMed - Médicos', 'medicos', 'Email', 'email', 'medicos', 'text', false, 4),
('MobileMed - Médicos', 'medicos', 'Telefone', 'telefone', 'medicos', 'text', false, 5),
('MobileMed - Médicos', 'medicos', 'Categoria', 'categoria', 'medicos', 'text', false, 6),
('MobileMed - Médicos', 'medicos', 'Modalidades', 'modalidades', 'medicos', 'text', false, 7),
('MobileMed - Médicos', 'medicos', 'Especialidades', 'especialidades', 'medicos', 'text', false, 8);

-- Inserir mapeamentos padrão para clientes
INSERT INTO public.field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index) VALUES
('MobileMed - Clientes', 'clientes', 'Nome', 'nome', 'clientes', 'text', true, 1),
('MobileMed - Clientes', 'clientes', 'CNPJ', 'cnpj', 'clientes', 'text', false, 2),
('MobileMed - Clientes', 'clientes', 'Email', 'email', 'clientes', 'text', false, 3),
('MobileMed - Clientes', 'clientes', 'Telefone', 'telefone', 'clientes', 'text', false, 4),
('MobileMed - Clientes', 'clientes', 'Endereço', 'endereco', 'clientes', 'text', false, 5);

-- Inserir mapeamentos padrão para escalas
INSERT INTO public.field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index) VALUES
('MobileMed - Escalas', 'escalas', 'Data', 'data', 'escalas_medicas', 'date', true, 1),
('MobileMed - Escalas', 'escalas', 'Médico', 'medico_id', 'escalas_medicas', 'text', true, 2),
('MobileMed - Escalas', 'escalas', 'Turno', 'turno', 'escalas_medicas', 'text', true, 3),
('MobileMed - Escalas', 'escalas', 'Modalidade', 'modalidade', 'escalas_medicas', 'text', true, 4),
('MobileMed - Escalas', 'escalas', 'Especialidade', 'especialidade', 'escalas_medicas', 'text', true, 5),
('MobileMed - Escalas', 'escalas', 'Tipo Escala', 'tipo_escala', 'escalas_medicas', 'text', true, 6),
('MobileMed - Escalas', 'escalas', 'Observações', 'observacoes', 'escalas_medicas', 'text', false, 7);

-- Inserir mapeamentos padrão para faturamento
INSERT INTO public.field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index) VALUES
('MobileMed - Faturamento', 'faturamento', 'Número da Fatura', 'numero_fatura', 'faturamento', 'text', true, 1),
('MobileMed - Faturamento', 'faturamento', 'OMIE ID', 'omie_id', 'faturamento', 'text', true, 2),
('MobileMed - Faturamento', 'faturamento', 'Cliente', 'cliente_nome', 'faturamento', 'text', true, 3),
('MobileMed - Faturamento', 'faturamento', 'Email Cliente', 'cliente_email', 'faturamento', 'text', false, 4),
('MobileMed - Faturamento', 'faturamento', 'Valor', 'valor', 'faturamento', 'number', true, 5),
('MobileMed - Faturamento', 'faturamento', 'Data Emissão', 'data_emissao', 'faturamento', 'date', true, 6),
('MobileMed - Faturamento', 'faturamento', 'Data Vencimento', 'data_vencimento', 'faturamento', 'date', true, 7),
('MobileMed - Faturamento', 'faturamento', 'Data Pagamento', 'data_pagamento', 'faturamento', 'date', false, 8),
('MobileMed - Faturamento', 'faturamento', 'Status', 'status', 'faturamento', 'text', true, 9);