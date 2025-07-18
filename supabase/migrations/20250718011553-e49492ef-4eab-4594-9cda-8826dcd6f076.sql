-- Adicionar suporte a documentos para médicos na tabela existente
ALTER TABLE public.documentos_clientes
ADD COLUMN medico_id UUID REFERENCES public.medicos(id) ON DELETE CASCADE;

-- Atualizar constraint para permitir ou cliente_id ou medico_id
ALTER TABLE public.documentos_clientes 
DROP CONSTRAINT documentos_clientes_cliente_id_fkey;

-- Recriar constraint como opcional
ALTER TABLE public.documentos_clientes
ADD CONSTRAINT documentos_clientes_cliente_id_fkey 
FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

-- Adicionar constraint para garantir que tem cliente_id OU medico_id
ALTER TABLE public.documentos_clientes
ADD CONSTRAINT documentos_um_proprietario 
CHECK (
  (cliente_id IS NOT NULL AND medico_id IS NULL) OR 
  (cliente_id IS NULL AND medico_id IS NOT NULL)
);

-- Adicionar tipos de documento específicos para médicos
ALTER TABLE public.documentos_clientes 
DROP CONSTRAINT documentos_clientes_tipo_documento_check;

ALTER TABLE public.documentos_clientes 
ADD CONSTRAINT documentos_clientes_tipo_documento_check 
CHECK (tipo_documento IN ('contrato', 'termo_aditivo', 'termo_renovacao', 'contrato_medico', 'aditivo_medico'));

-- Atualizar políticas para incluir médicos
DROP POLICY "Admins podem gerenciar documentos" ON public.documentos_clientes;
DROP POLICY "Managers podem ver documentos" ON public.documentos_clientes;

CREATE POLICY "Admins podem gerenciar todos documentos" 
ON public.documentos_clientes 
FOR ALL 
USING (is_admin());

CREATE POLICY "Managers podem ver todos documentos" 
ON public.documentos_clientes 
FOR SELECT 
USING (is_manager_or_admin());

CREATE POLICY "Médicos podem ver seus próprios documentos" 
ON public.documentos_clientes 
FOR SELECT 
USING (medico_id IN (
  SELECT id FROM medicos WHERE user_id = auth.uid()
));