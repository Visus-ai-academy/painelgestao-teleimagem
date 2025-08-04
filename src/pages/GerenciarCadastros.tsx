import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { SimpleFileUpload } from '@/components/SimpleFileUpload';
import { CadastroDataTable } from '@/components/CadastroDataTable';
import { ValoresReferenciaTable } from '@/components/ValoresReferenciaTable';
import { FileText, DollarSign, Shield, UserCheck, Database, Trash2, AlertTriangle, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CompactUploadStatus } from '@/components/CompactUploadStatus';
import { UploadStatusPanel } from '@/components/UploadStatusPanel';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useValoresReferencia } from '@/hooks/useValoresReferencia';
import { 
  useCadastroExames, 
  useQuebraExames, 
  usePrecosServicos, 
  useRegrasExclusao, 
  useRepasseMedico,
  useModalidades,
  useEspecialidades,
  useCategoriasExame,
  usePrioridades
} from '@/hooks/useCadastroData';

export default function GerenciarCadastros() {
  const { toast } = useToast();
  const { isAdmin } = useUserPermissions();
  const [isClearing, setIsClearing] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [refreshStatusPanel, setRefreshStatusPanel] = useState(0);
  const [clearOptions, setClearOptions] = useState({
    cadastro_exames: false,
    quebra_exames: false,
    precos_servicos: false,
    regras_exclusao: false,
    medicos_valores_repasse: false,
    modalidades: false,
    especialidades: false,
    categorias_exame: false,
    prioridades: false,
    logs_uploads: false
  });

  // Hooks para buscar dados dos cadastros
  const examesData = useCadastroExames();
  const quebraData = useQuebraExames();
  const precosData = usePrecosServicos();
  const regrasData = useRegrasExclusao();
  const repasseData = useRepasseMedico();
  const modalidadesData = useModalidades();
  const especialidadesData = useEspecialidades();
  const categoriasData = useCategoriasExame();
  const prioridadesData = usePrioridades();
  const valoresReferenciaData = useValoresReferencia();

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
        precos_servicos: false,
        regras_exclusao: false,
        medicos_valores_repasse: false,
        modalidades: false,
        especialidades: false,
        categorias_exame: false,
        prioridades: false,
        logs_uploads: false
      });
      setShowClearDialog(false);

      // Recarregar dados conforme as tabelas que foram limpas
      if (data.tabelas_limpas?.includes('cadastro_exames')) {
        examesData.refetch();
      }
      if (data.tabelas_limpas?.includes('regras_quebra_exames')) {
        quebraData.refetch();
      }
      if (data.tabelas_limpas?.includes('precos_servicos')) {
        precosData.refetch();
      }
      if (data.tabelas_limpas?.includes('regras_exclusao')) {
        regrasData.refetch();
      }
      if (data.tabelas_limpas?.includes('medicos_valores_repasse')) {
        repasseData.refetch();
      }
      if (data.tabelas_limpas?.includes('modalidades')) {
        modalidadesData.refetch();
      }
      if (data.tabelas_limpas?.includes('especialidades')) {
        especialidadesData.refetch();
      }
      if (data.tabelas_limpas?.includes('categorias_exame')) {
        categoriasData.refetch();
      }
      if (data.tabelas_limpas?.includes('prioridades')) {
        prioridadesData.refetch();
      }
      
      // Atualizar status dos uploads
      setRefreshStatusPanel(prev => prev + 1);
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
    
    // Recarregar dados e status
    examesData.refetch();
    setRefreshStatusPanel(prev => prev + 1);
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
    
    // Recarregar dados e status
    quebraData.refetch();
    setRefreshStatusPanel(prev => prev + 1);
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
    
    // Recarregar dados e status
    precosData.refetch();
    setRefreshStatusPanel(prev => prev + 1);
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
    
    // Recarregar dados e status
    regrasData.refetch();
    setRefreshStatusPanel(prev => prev + 1);
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
    
    // Recarregar dados e status
    repasseData.refetch();
    setRefreshStatusPanel(prev => prev + 1);
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
    
    // Recarregar dados e status
    modalidadesData.refetch();
    setRefreshStatusPanel(prev => prev + 1);
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
    
    // Recarregar dados e status
    especialidadesData.refetch();
    setRefreshStatusPanel(prev => prev + 1);
  };

  // Handler para categorias
  const handleUploadCategorias = async (file: File) => {
    console.log('🔄 Iniciando upload de categorias:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await supabase.functions.invoke('processar-categorias', {
      body: formData
    });

    if (error) throw error;
    
    toast({
      title: "Categorias Processadas!",
      description: `${data.inseridos} categorias cadastradas, ${data.atualizados} atualizadas, ${data.erros} erros`,
    });
    
    // Recarregar dados e status
    categoriasData.refetch();
    setRefreshStatusPanel(prev => prev + 1);
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
    
    // Recarregar dados e status
    prioridadesData.refetch();
    setRefreshStatusPanel(prev => prev + 1);
  };

  // Handler para valores de referência de-para
  const handleUploadValoresReferencia = async (file: File) => {
    console.log('🔄 Iniciando upload de valores de referência:', file.name);
    
    // Primeiro, fazer upload do arquivo para o storage
    const fileName = `de-para-${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, file);

    if (uploadError) {
      throw new Error(`Erro no upload: ${uploadError.message}`);
    }

    // Processar o arquivo
    const { data, error } = await supabase.functions.invoke('processar-valores-de-para', {
      body: { fileName }
    });

    if (error) throw error;
    
    toast({
      title: "Valores De-Para Processados!",
      description: `${data.valores_inseridos} valores cadastrados com sucesso`,
    });
    
    // Recarregar dados e status
    valoresReferenciaData.refetch();
    setRefreshStatusPanel(prev => prev + 1);
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
      {/* Status dos Uploads */}
      <UploadStatusPanel refreshTrigger={refreshStatusPanel} />
      
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

      <Tabs defaultValue="exames" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-11">
          <TabsTrigger value="exames">Exames</TabsTrigger>
          <TabsTrigger value="quebra-exames">Quebra Exames</TabsTrigger>
          <TabsTrigger value="de-para">Exames Fora Padrão</TabsTrigger>
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
              <div className="space-y-4">
                <div>
                  <SimpleFileUpload
                    title="Upload Cadastro de Exames"
                    acceptedTypes={['.csv', '.xlsx', '.xls']}
                    onUpload={handleUploadExames}
                  />
                </div>
              </div>
              
              <div className="mt-8">
                <CadastroDataTable
                  data={examesData.data}
                  loading={examesData.loading}
                  error={examesData.error}
                  type="exames"
                  title="Exames Cadastrados"
                />
              </div>
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
              <div className="space-y-4">
                <div>
                  <SimpleFileUpload
                    title="Upload Quebra de Exames"
                    acceptedTypes={['.csv', '.xlsx', '.xls']}
                    onUpload={handleUploadQuebraExames}
                  />
                </div>
              </div>
              
              <div className="mt-8">
                <CadastroDataTable
                  data={quebraData.data}
                  loading={quebraData.loading}
                  error={quebraData.error}
                  type="quebra"
                  title="Regras de Quebra Cadastradas"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* De-Para Exames */}
        <TabsContent value="de-para">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Exames Fora Padrão (Valores de Referência)
              </CardTitle>
              <CardDescription>
                Upload de planilha com valores de referência para exames fora de padrão. Estes valores são aplicados automaticamente quando detectados exames com valores zerados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <SimpleFileUpload
                    title="Upload De-Para Exames"
                    acceptedTypes={['.csv', '.xlsx', '.xls']}
                    onUpload={handleUploadValoresReferencia}
                  />
                </div>
              </div>
              
              <div className="mt-8">
                <ValoresReferenciaTable />
              </div>
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
              <div className="space-y-4">
                <div>
                  <SimpleFileUpload
                    title="Upload Preços de Serviços"
                    acceptedTypes={['.csv', '.xlsx', '.xls']}
                    onUpload={handleUploadPrecos}
                  />
                </div>
              </div>
              
              <div className="mt-8">
                <CadastroDataTable
                  data={precosData.data}
                  loading={precosData.loading}
                  error={precosData.error}
                  type="precos"
                  title="Preços de Serviços Cadastrados"
                />
              </div>
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
              <div className="space-y-4">
                <div>
                  <SimpleFileUpload
                    title="Upload Regras de Exclusão"
                    acceptedTypes={['.csv', '.xlsx', '.xls']}
                    onUpload={handleUploadRegras}
                  />
                </div>
              </div>
              
              <div className="mt-8">
                <CadastroDataTable
                  data={regrasData.data}
                  loading={regrasData.loading}
                  error={regrasData.error}
                  type="regras"
                  title="Regras de Exclusão Cadastradas"
                />
              </div>
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
              <div className="space-y-4">
                <div>
                  <SimpleFileUpload
                    title="Upload Repasse Médico"
                    acceptedTypes={['.csv', '.xlsx', '.xls']}
                    onUpload={handleUploadRepasse}
                  />
                </div>
              </div>
              
              <div className="mt-8">
                <CadastroDataTable
                  data={repasseData.data}
                  loading={repasseData.loading}
                  error={repasseData.error}
                  type="repasse"
                  title="Valores de Repasse Cadastrados"
                />
              </div>
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
                <SimpleFileUpload
                  title="Upload Volumetria Legada"
                  acceptedTypes={['.csv', '.xlsx', '.xls']}
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
                <SimpleFileUpload
                  title="Upload Faturamento Legado"
                  acceptedTypes={['.csv', '.xlsx', '.xls']}
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
                Upload de planilha com modalidades de exames disponíveis no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <SimpleFileUpload
                    title="Upload Modalidades"
                    acceptedTypes={['.csv', '.xlsx', '.xls']}
                    onUpload={handleUploadModalidades}
                  />
                </div>
              </div>
              
              <div className="mt-8">
                <CadastroDataTable
                  data={modalidadesData.data}
                  loading={modalidadesData.loading}
                  error={modalidadesData.error}
                  type="modalidades"
                  title="Modalidades Cadastradas"
                />
              </div>
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
                Upload de planilha com especialidades médicas disponíveis no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <SimpleFileUpload
                    title="Upload Especialidades"
                    acceptedTypes={['.csv', '.xlsx', '.xls']}
                    onUpload={handleUploadEspecialidades}
                  />
                </div>
              </div>
              
              <div className="mt-8">
                <CadastroDataTable
                  data={especialidadesData.data}
                  loading={especialidadesData.loading}
                  error={especialidadesData.error}
                  type="especialidades"
                  title="Especialidades Cadastradas"
                />
              </div>
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
                Upload de planilha com categorias de exames disponíveis no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <SimpleFileUpload
                    title="Upload Categorias"
                    acceptedTypes={['.csv', '.xlsx', '.xls']}
                    onUpload={handleUploadCategorias}
                  />
                </div>
              </div>
              
              <div className="mt-8">
                <CadastroDataTable
                  data={categoriasData.data}
                  loading={categoriasData.loading}
                  error={categoriasData.error}
                  type="categorias"
                  title="Categorias Cadastradas"
                />
              </div>
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
                Upload de planilha com prioridades de exames disponíveis no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <SimpleFileUpload
                    title="Upload Prioridades"
                    acceptedTypes={['.csv', '.xlsx', '.xls']}
                    onUpload={handleUploadPrioridades}
                  />
                </div>
              </div>
              
              <div className="mt-8">
                <CadastroDataTable
                  data={prioridadesData.data}
                  loading={prioridadesData.loading}
                  error={prioridadesData.error}
                  type="prioridades"
                  title="Prioridades Cadastradas"
                />
              </div>
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
                id="precos-servicos"
                checked={clearOptions.precos_servicos}
                onCheckedChange={(checked) => 
                  setClearOptions(prev => ({ ...prev, precos_servicos: !!checked }))
                }
              />
              <label htmlFor="precos-servicos" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Limpar Preços de Serviços ({clearOptions.precos_servicos ? 'TODOS os preços serão removidos' : 'Manter preços'})
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="regras-exclusao"
                checked={clearOptions.regras_exclusao}
                onCheckedChange={(checked) => 
                  setClearOptions(prev => ({ ...prev, regras_exclusao: !!checked }))
                }
              />
              <label htmlFor="regras-exclusao" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Limpar Regras de Exclusão ({clearOptions.regras_exclusao ? 'TODAS as regras serão removidas' : 'Manter regras'})
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="medicos-valores-repasse"
                checked={clearOptions.medicos_valores_repasse}
                onCheckedChange={(checked) => 
                  setClearOptions(prev => ({ ...prev, medicos_valores_repasse: !!checked }))
                }
              />
              <label htmlFor="medicos-valores-repasse" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Limpar Valores de Repasse Médico ({clearOptions.medicos_valores_repasse ? 'TODOS os valores serão removidos' : 'Manter valores'})
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="modalidades"
                checked={clearOptions.modalidades}
                onCheckedChange={(checked) => 
                  setClearOptions(prev => ({ ...prev, modalidades: !!checked }))
                }
              />
              <label htmlFor="modalidades" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Limpar Modalidades ({clearOptions.modalidades ? 'TODAS as modalidades serão removidas' : 'Manter modalidades'})
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="especialidades"
                checked={clearOptions.especialidades}
                onCheckedChange={(checked) => 
                  setClearOptions(prev => ({ ...prev, especialidades: !!checked }))
                }
              />
              <label htmlFor="especialidades" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Limpar Especialidades ({clearOptions.especialidades ? 'TODAS as especialidades serão removidas' : 'Manter especialidades'})
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="categorias-exame"
                checked={clearOptions.categorias_exame}
                onCheckedChange={(checked) => 
                  setClearOptions(prev => ({ ...prev, categorias_exame: !!checked }))
                }
              />
              <label htmlFor="categorias-exame" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Limpar Categorias de Exame ({clearOptions.categorias_exame ? 'TODAS as categorias serão removidas' : 'Manter categorias'})
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="prioridades"
                checked={clearOptions.prioridades}
                onCheckedChange={(checked) => 
                  setClearOptions(prev => ({ ...prev, prioridades: !!checked }))
                }
              />
              <label htmlFor="prioridades" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Limpar Prioridades ({clearOptions.prioridades ? 'TODAS as prioridades serão removidas' : 'Manter prioridades'})
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