import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUpload } from '@/components/FileUpload';
import { FileText, DollarSign, Shield, UserCheck, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function GerenciarCadastros() {
  const { toast } = useToast();

  // Handler para cadastro de exames
  const handleUploadExames = async (file: File) => {
    console.log('🔄 Iniciando upload de cadastro de exames:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await supabase.functions.invoke('processar-cadastro-exames', {
      body: formData
    });

    if (error) throw error;
    
    toast({
      title: "Cadastro de Exames Processado!",
      description: `${data.inseridos} exames cadastrados, ${data.atualizados} atualizados, ${data.erros} erros`,
    });
  };

  // Handler para quebra de exames
  const handleUploadQuebraExames = async (file: File) => {
    console.log('🔄 Iniciando upload de quebra de exames:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await supabase.functions.invoke('processar-quebra-exames', {
      body: formData
    });

    if (error) throw error;
    
    toast({
      title: "Regras de Quebra Processadas!",
      description: `${data.inseridos} regras cadastradas, ${data.atualizados} atualizadas, ${data.erros} erros`,
    });
  };

  // Handler para preços de serviços
  const handleUploadPrecos = async (file: File) => {
    console.log('🔄 Iniciando upload de preços de serviços:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await supabase.functions.invoke('processar-precos-servicos', {
      body: formData
    });

    if (error) throw error;
    
    toast({
      title: "Preços de Serviços Processados!",
      description: `${data.inseridos} preços cadastrados, ${data.atualizados} atualizados, ${data.erros} erros`,
    });
  };

  // Handler para regras de exclusão
  const handleUploadRegras = async (file: File) => {
    console.log('🔄 Iniciando upload de regras de exclusão:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await supabase.functions.invoke('processar-regras-exclusao', {
      body: formData
    });

    if (error) throw error;
    
    toast({
      title: "Regras de Exclusão Processadas!",
      description: `${data.inseridos} regras cadastradas, ${data.atualizados} atualizadas, ${data.erros} erros`,
    });
  };

  // Handler para repasse médico
  const handleUploadRepasse = async (file: File) => {
    console.log('🔄 Iniciando upload de repasse médico:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await supabase.functions.invoke('processar-repasse-medico', {
      body: formData
    });

    if (error) throw error;
    
    toast({
      title: "Repasse Médico Processado!",
      description: `${data.inseridos} valores cadastrados, ${data.atualizados} atualizados, ${data.erros} erros`,
    });
  };

  // Handler para dados legados
  const handleUploadLegado = async (file: File, tipoArquivo: string, periodoReferencia: string, descricao?: string) => {
    console.log('🔄 Iniciando upload de dados legados:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tipo_arquivo', tipoArquivo);
    formData.append('periodo_referencia', periodoReferencia);
    if (descricao) formData.append('descricao', descricao);

    const { data, error } = await supabase.functions.invoke('processar-dados-legado', {
      body: formData
    });

    if (error) throw error;
    
    toast({
      title: "Dados Legados Processados!",
      description: `${data.inseridos} registros inseridos, ${data.erros} erros`,
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gerenciar Cadastros</h1>
        <p className="text-muted-foreground mt-2">
          Upload e gerenciamento de todos os tipos de cadastros do sistema
        </p>
      </div>

      <Tabs defaultValue="exames" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="exames">Exames</TabsTrigger>
          <TabsTrigger value="quebra-exames">Quebra Exames</TabsTrigger>
          <TabsTrigger value="precos">Preços</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
          <TabsTrigger value="repasse">Repasse</TabsTrigger>
          <TabsTrigger value="legado">Legado</TabsTrigger>
        </TabsList>

        {/* Cadastro de Exames */}
        <TabsContent value="exames">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Cadastro de Exames
              </CardTitle>
              <CardDescription>
                Upload de planilha com cadastro completo de exames, incluindo modalidades, especialidades, categorias e regras de quebra
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                title="Cadastro de Exames"
                description="Planilha com todas as informações dos exames cadastrados no sistema"
                acceptedTypes={['.csv', '.xlsx', '.xls']}
                maxSizeInMB={50}
                expectedFormat={[
                  "EXAME (obrigatório)",
                  "descricao (opcional)",
                  "modalidade (obrigatório)",
                  "especialidade (obrigatório)",
                  "categoria (obrigatório)",
                  "codigo_exame (opcional)",
                  "permite_quebra (true/false)",
                  "criterio_quebra (JSON opcional)",
                  "exames_derivados (JSON opcional)"
                ]}
                onUpload={handleUploadExames}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quebra de Exames */}
        <TabsContent value="quebra-exames">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Regras de Quebra de Exames
              </CardTitle>
              <CardDescription>
                Upload de regras para quebrar exames originais em múltiplos exames com categorias específicas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                title="Quebra de Exames"
                description="Planilha com regras para dividir exames em sub-exames específicos"
                acceptedTypes={['.csv', '.xlsx', '.xls']}
                maxSizeInMB={50}
                expectedFormat={[
                  "EXAME (obrigatório) - Nome do exame original",
                  "QUEBRA (obrigatório) - Nome do exame quebrado", 
                  "CATEGORIA (obrigatório) - Categoria do exame quebrado"
                ]}
                onUpload={handleUploadQuebraExames}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preços de Serviços */}
        <TabsContent value="precos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Preços de Serviços
              </CardTitle>
              <CardDescription>
                Upload de tabela de preços por modalidade, especialidade, categoria, prioridade e cliente específico
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                title="Tabela de Preços"
                description="Planilha com preços base e de urgência por combinação de serviços"
                acceptedTypes={['.csv', '.xlsx', '.xls']}
                maxSizeInMB={50}
                expectedFormat={[
                  "tipo_preco (padrao/cliente_especifico)",
                  "modalidade (obrigatório)",
                  "especialidade (obrigatório)",
                  "categoria (obrigatório)",
                  "prioridade (obrigatório)",
                  "valor_base (obrigatório)",
                  "valor_urgencia (obrigatório)",
                  "cliente_id (opcional, para preços específicos)",
                  "data_inicio_vigencia (obrigatório)",
                  "data_fim_vigencia (opcional)",
                  "aplicar_legado (true/false)",
                  "aplicar_incremental (true/false)"
                ]}
                onUpload={handleUploadPrecos}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Regras de Exclusão */}
        <TabsContent value="regras">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Regras de Exclusão
              </CardTitle>
              <CardDescription>
                Upload de regras para exclusão automática de registros do faturamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                title="Regras de Exclusão"
                description="Planilha com critérios para exclusão automática de itens do faturamento"
                acceptedTypes={['.csv', '.xlsx', '.xls']}
                maxSizeInMB={50}
                expectedFormat={[
                  "nome_regra (obrigatório)",
                  "descricao (opcional)",
                  "criterios (JSON com condições)",
                  "prioridade (1-100, menor = maior prioridade)",
                  "acao (exclusao/alerta)",
                  "motivo_exclusao (obrigatório)",
                  "aplicar_legado (true/false)",
                  "aplicar_incremental (true/false)"
                ]}
                onUpload={handleUploadRegras}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Repasse Médico */}
        <TabsContent value="repasse">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Repasse Médico
              </CardTitle>
              <CardDescription>
                Upload de valores de repasse por médico e combinação de serviços
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                title="Valores de Repasse"
                description="Planilha com valores de repasse específicos por médico ou gerais"
                acceptedTypes={['.csv', '.xlsx', '.xls']}
                maxSizeInMB={50}
                expectedFormat={[
                  "medico_id (opcional, se vazio = regra geral)",
                  "modalidade (obrigatório)",
                  "especialidade (obrigatório)",
                  "prioridade (obrigatório)",
                  "valor (obrigatório)"
                ]}
                onUpload={handleUploadRepasse}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dados Legados */}
        <TabsContent value="legado">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Dados Legados - Volumetria
                </CardTitle>
                <CardDescription>
                  Upload de dados históricos de volumetria para análise e relatórios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload
                  title="Volumetria Legada"
                  description="Dados históricos de volumetria para importação"
                  acceptedTypes={['.csv', '.xlsx', '.xls']}
                  maxSizeInMB={100}
                  expectedFormat={[
                    "EMPRESA/Cliente",
                    "MODALIDADE",
                    "ESPECIALIDADE", 
                    "CATEGORIA",
                    "PRIORIDADE",
                    "MEDICO",
                    "PACIENTE",
                    "ESTUDO_DESCRICAO/Exame",
                    "VALORES/Valor",
                    "DATA_REALIZACAO/Data",
                    "DATA_LAUDO",
                    "DATA_PRAZO"
                  ]}
                  onUpload={(file) => handleUploadLegado(file, 'volumetria', '2024-LEGADO', 'Importação volumetria histórica')}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Dados Legados - Faturamento
                </CardTitle>
                <CardDescription>
                  Upload de dados históricos de faturamento para análise e relatórios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload
                  title="Faturamento Legado"
                  description="Dados históricos de faturamento para importação"
                  acceptedTypes={['.csv', '.xlsx', '.xls']}
                  maxSizeInMB={100}
                  expectedFormat={[
                    "cliente_nome/Cliente",
                    "numero_fatura/Numero",
                    "data_emissao/Data",
                    "valor/Valor",
                    "paciente/Paciente",
                    "medico/Medico",
                    "modalidade/Modalidade",
                    "especialidade/Especialidade",
                    "nome_exame/Exame",
                    "data_exame/DataExame"
                  ]}
                  onUpload={(file) => handleUploadLegado(file, 'faturamento', '2024-LEGADO', 'Importação faturamento histórico')}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}