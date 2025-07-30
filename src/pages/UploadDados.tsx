import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUpload } from '@/components/FileUpload';
import { Button } from "@/components/ui/button";
import { FileText, Upload, Database, BarChart3, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function UploadDados() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleUploadSuccess = () => {
    console.log('Upload realizado com sucesso');
  };

  const handleUploadDePara = async (file: File) => {
    console.log('🔄 Iniciando upload do arquivo De Para:', file.name);
    
    try {
      // Sanitizar nome do arquivo (remover espaços e caracteres especiais)
      const sanitizedFileName = file.name
        .replace(/\s+/g, '_')  // substituir espaços por underscore
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ç]/g, 'c')
        .replace(/[ñ]/g, 'n')
        .replace(/[^a-zA-Z0-9._-]/g, ''); // remover outros caracteres especiais
      
      const nomeArquivo = `valores_de_para_${Date.now()}_${sanitizedFileName}`;
      console.log('📁 Nome do arquivo gerado:', nomeArquivo);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(nomeArquivo, file);

      console.log('📤 Resultado do upload:', { uploadData, uploadError });

      if (uploadError) {
        console.error('❌ Erro no upload:', uploadError);
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      console.log('✅ Upload realizado com sucesso. Iniciando processamento...');

      // Processar arquivo via edge function
      const { data: processData, error: processError } = await supabase.functions.invoke('processar-valores-de-para', {
        body: { fileName: nomeArquivo }
      });

      console.log('🔧 Resultado do processamento:', { processData, processError });

      if (processError) {
        console.error('❌ Erro no processamento:', processError);
        throw new Error(`Erro ao processar: ${processError.message}`);
      }

      console.log('✅ Processamento concluído:', processData);
      
      toast({
        title: "Sucesso!",
        description: `Arquivo processado: ${processData.valores_inseridos} valores inseridos, ${processData.aplicacao_resultado?.registros_atualizados || 0} registros atualizados`,
      });

      handleUploadSuccess();
    } catch (error) {
      console.error('💥 Erro geral no upload De Para:', error);
      throw error;
    }
  };

  // Handler para volumetria incremental
  const handleUploadVolumetria = async (file: File) => {
    console.log('🔄 Iniciando upload de volumetria:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await supabase.functions.invoke('processar-volumetria-mobilemed', {
      body: formData
    });

    if (error) throw error;
    
    toast({
      title: "Volumetria Processada!",
      description: `${data.inseridos} registros inseridos, ${data.erros} erros`,
    });
  };

  // Handler para faturamento incremental
  const handleUploadFaturamento = async (file: File) => {
    console.log('🔄 Iniciando upload de faturamento:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await supabase.functions.invoke('processar-faturamento', {
      body: formData
    });

    if (error) throw error;
    
    toast({
      title: "Faturamento Processado!",
      description: `${data.inseridos} registros inseridos, ${data.erros} erros`,
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upload de Dados</h1>
          <p className="text-muted-foreground mt-2">
            Upload de dados incrementais e arquivos de referência
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/gerenciar-cadastros')} className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Gerenciar Cadastros
          </Button>
          <Button onClick={() => navigate('/limpar-dados')} variant="outline" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Limpar Dados
          </Button>
        </div>
      </div>

      <Tabs defaultValue="incremental" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="incremental">Dados Incrementais</TabsTrigger>
          <TabsTrigger value="referencia">Dados de Referência</TabsTrigger>
        </TabsList>

        {/* Dados Incrementais */}
        <TabsContent value="incremental" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Volumetria Incremental
              </CardTitle>
              <CardDescription>
                Upload de dados de volumetria do mês atual para processamento incremental
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                title="Dados de Volumetria"
                description="Arquivo com dados de exames e laudos do período atual"
                acceptedTypes={['.csv', '.xlsx', '.xls']}
                maxSizeInMB={100}
                expectedFormat={[
                  "EMPRESA",
                  "MODALIDADE", 
                  "ESPECIALIDADE",
                  "CATEGORIA",
                  "PRIORIDADE",
                  "MEDICO",
                  "PACIENTE",
                  "ESTUDO_DESCRICAO",
                  "VALORES",
                  "DATA_REALIZACAO",
                  "DATA_LAUDO",
                  "HORA_LAUDO",
                  "DATA_PRAZO",
                  "HORA_PRAZO"
                ]}
                onUpload={handleUploadVolumetria}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Faturamento Incremental
              </CardTitle>
              <CardDescription>
                Upload de dados de faturamento do mês atual para processamento incremental
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                title="Dados de Faturamento"
                description="Arquivo com dados de faturamento do período atual"
                acceptedTypes={['.csv', '.xlsx', '.xls']}
                maxSizeInMB={100}
                expectedFormat={[
                  "omie_id",
                  "cliente_nome",
                  "numero_fatura",
                  "data_emissao",
                  "data_vencimento",
                  "valor",
                  "paciente",
                  "medico",
                  "modalidade",
                  "especialidade",
                  "categoria",
                  "nome_exame",
                  "data_exame",
                  "quantidade",
                  "valor_bruto"
                ]}
                onUpload={handleUploadFaturamento}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dados de Referência */}
        <TabsContent value="referencia">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Arquivo de Referência - De Para
              </CardTitle>
              <CardDescription>
                Upload do arquivo de referência com valores para preenchimento automático dos arquivos fora do padrão
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                title="Tabela De Para (ESTUDO_DESCRICAO x VALORES)"
                description="Arquivo com as colunas ESTUDO_DESCRICAO e VALORES para preenchimento automático dos valores zerados"
                acceptedTypes={['.csv', '.xlsx', '.xls']}
                maxSizeInMB={50}
                expectedFormat={["ESTUDO_DESCRICAO", "VALORES"]}
                onUpload={handleUploadDePara}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}