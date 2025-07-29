import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUpload } from '@/components/FileUpload';
import { FileText, DollarSign, Shield, UserCheck, Database, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UploadStatusPanel } from '@/components/UploadStatusPanel';
import { useUserPermissions } from '@/hooks/useUserPermissions';

export default function GerenciarCadastros() {
  const { toast } = useToast();
  const { isAdmin } = useUserPermissions();
  const [isClearing, setIsClearing] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearOptions, setClearOptions] = useState({
    cadastro_exames: false,
    quebra_exames: false,
    logs_uploads: false
  });

  // Handler para limpar cadastros (individualizado)
  const handleClearCadastros = async () => {
    if (!isAdmin) {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem limpar cadastros",
        variant: "destructive",
      });
      return;
    }

    // Verificar se pelo menos uma opção foi selecionada
    const hasSelection = Object.values(clearOptions).some(option => option);
    if (!hasSelection) {
      toast({
        title: "Nenhuma Opção Selecionada",
        description: "Selecione pelo menos uma tabela para limpar",
        variant: "destructive",
      });
      return;
    }

    setIsClearing(true);
    try {
      const { data, error } = await supabase.functions.invoke('limpar-cadastros', {
        body: clearOptions
      });

      if (error) throw error;

      toast({
        title: "Limpeza Concluída!",
        description: `${data.message}. Tabelas limpas: ${data.tabelas_limpas.join(', ')}`,
      });

      // Resetar opções e fechar dialog
      setClearOptions({
        cadastro_exames: false,
        quebra_exames: false,
        logs_uploads: false
      });
      setShowClearDialog(false);

      // Recarregar o painel de status
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Erro na Limpeza",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

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

  // Handler para modalidades
  const handleUploadModalidades = async (file: File) => {
    console.log('🔄 Iniciando upload de modalidades:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await supabase.functions.invoke('processar-modalidades', {
      body: formData
    });

    if (error) throw error;
    
    toast({
      title: "Modalidades Processadas!",
      description: `${data.inseridos} modalidades cadastradas, ${data.atualizados} atualizadas, ${data.erros} erros`,
    });
  };

  // Handler para especialidades
  const handleUploadEspecialidades = async (file: File) => {
    console.log('🔄 Iniciando upload de especialidades:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await supabase.functions.invoke('processar-especialidades', {
      body: formData
    });

    if (error) throw error;
    
    toast({
      title: "Especialidades Processadas!",
      description: `${data.inseridos} especialidades cadastradas, ${data.atualizados} atualizadas, ${data.erros} erros`,
    });
  };

  // Handler para categorias
  const handleUploadCategorias = async (file: File) => {
    console.log('🔄 Iniciando upload de categorias:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await supabase.functions.invoke('processar-categorias-exame', {
      body: formData
    });

    if (error) throw error;
    
    toast({
      title: "Categorias Processadas!",
      description: `${data.inseridos} categorias cadastradas, ${data.atualizados} atualizadas, ${data.erros} erros`,
    });
  };

  // Handler para prioridades
  const handleUploadPrioridades = async (file: File) => {
    console.log('🔄 Iniciando upload de prioridades:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await supabase.functions.invoke('processar-prioridades', {
      body: formData
    });

    if (error) throw error;
    
    toast({
      title: "Prioridades Processadas!",
      description: `${data.inseridos} prioridades cadastradas, ${data.atualizados} atualizadas, ${data.erros} erros`,
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerenciar Cadastros</h1>
          <p className="text-muted-foreground mt-2">
            Upload e gerenciamento de todos os tipos de cadastros do sistema
          </p>
        </div>
        {isAdmin && (
          <Button 
            variant="destructive" 
            onClick={() => setShowClearDialog(true)}
            disabled={isClearing}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Limpar Cadastros
          </Button>
        )}
      </div>

      {/* Painel de Status dos Uploads */}
      <UploadStatusPanel />

      <Tabs defaultValue="exames" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-10">
          <TabsTrigger value="exames">Exames</TabsTrigger>
          <TabsTrigger value="quebra-exames">Quebra Exames</TabsTrigger>
          <TabsTrigger value="precos">Preços</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
          <TabsTrigger value="repasse">Repasse</TabsTrigger>
          <TabsTrigger value="legado">Legado</TabsTrigger>
          <TabsTrigger value="modalidades">Modalidades</TabsTrigger>
          <TabsTrigger value="especialidades">Especialidades</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="prioridades">Prioridades</TabsTrigger>
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

        {/* Modalidades */}
        <TabsContent value="modalidades">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Modalidades
              </CardTitle>
              <CardDescription>
                Upload de arquivo CSV com modalidades de exames. <Button variant="link" className="p-0 h-auto" onClick={() => window.open('/configuracao/listas?tab=modalidades', '_blank')}>Acessar Gerenciamento Completo</Button>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                title="Upload de Modalidades"
                description="Arquivo CSV com uma coluna contendo os nomes das modalidades"
                acceptedTypes={['.csv']}
                maxSizeInMB={10}
                expectedFormat={[
                  "modalidade (obrigatório) - Nome da modalidade"
                ]}
                onUpload={handleUploadModalidades}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Especialidades */}
        <TabsContent value="especialidades">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Especialidades
              </CardTitle>
              <CardDescription>
                Upload de arquivo CSV com especialidades médicas. <Button variant="link" className="p-0 h-auto" onClick={() => window.open('/configuracao/listas?tab=especialidades', '_blank')}>Acessar Gerenciamento Completo</Button>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                title="Upload de Especialidades"
                description="Arquivo CSV com uma coluna contendo os nomes das especialidades"
                acceptedTypes={['.csv']}
                maxSizeInMB={10}
                expectedFormat={[
                  "especialidade (obrigatório) - Nome da especialidade"
                ]}
                onUpload={handleUploadEspecialidades}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categorias */}
        <TabsContent value="categorias">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Categorias de Exame
              </CardTitle>
              <CardDescription>
                Upload de arquivo CSV com categorias de exames. <Button variant="link" className="p-0 h-auto" onClick={() => window.open('/configuracao/listas?tab=categorias_exame', '_blank')}>Acessar Gerenciamento Completo</Button>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                title="Upload de Categorias"
                description="Arquivo CSV com uma coluna contendo os nomes das categorias"
                acceptedTypes={['.csv']}
                maxSizeInMB={10}
                expectedFormat={[
                  "categoria (obrigatório) - Nome da categoria"
                ]}
                onUpload={handleUploadCategorias}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prioridades */}
        <TabsContent value="prioridades">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Prioridades
              </CardTitle>
              <CardDescription>
                Upload de arquivo CSV com prioridades de exames. <Button variant="link" className="p-0 h-auto" onClick={() => window.open('/configuracao/listas?tab=prioridades', '_blank')}>Acessar Gerenciamento Completo</Button>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                title="Upload de Prioridades"
                description="Arquivo CSV com uma coluna contendo os nomes das prioridades"
                acceptedTypes={['.csv']}
                maxSizeInMB={10}
                expectedFormat={[
                  "prioridade (obrigatório) - Nome da prioridade"
                ]}
                onUpload={handleUploadPrioridades}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Confirmação para Limpeza */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              ⚠️ ATENÇÃO - Limpeza de Cadastros
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta é uma operação <strong>IRREVERSÍVEL</strong> e pode causar perda de dados permanente. 
              Selecione cuidadosamente quais tabelas deseja limpar:
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="cadastro-exames"
                checked={clearOptions.cadastro_exames}
                onCheckedChange={(checked) => 
                  setClearOptions(prev => ({ ...prev, cadastro_exames: !!checked }))
                }
              />
              <label htmlFor="cadastro-exames" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Limpar Cadastro de Exames ({clearOptions.cadastro_exames ? 'TODOS os exames serão removidos' : 'Manter exames'})
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="quebra-exames"
                checked={clearOptions.quebra_exames}
                onCheckedChange={(checked) => 
                  setClearOptions(prev => ({ ...prev, quebra_exames: !!checked }))
                }
              />
              <label htmlFor="quebra-exames" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Limpar Regras de Quebra ({clearOptions.quebra_exames ? 'TODAS as regras serão removidas' : 'Manter regras'})
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="logs-uploads"
                checked={clearOptions.logs_uploads}
                onCheckedChange={(checked) => 
                  setClearOptions(prev => ({ ...prev, logs_uploads: !!checked }))
                }
              />
              <label htmlFor="logs-uploads" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Limpar Logs de Upload ({clearOptions.logs_uploads ? 'TODOS os logs serão removidos' : 'Manter logs'})
              </label>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearCadastros}
              disabled={isClearing || !Object.values(clearOptions).some(option => option)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isClearing ? 'Limpando...' : 'CONFIRMAR LIMPEZA'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}