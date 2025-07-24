import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileUpload } from '@/components/FileUpload';
import { FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function UploadDados() {
  const { toast } = useToast();

  const handleUploadSuccess = () => {
    console.log('Upload realizado com sucesso');
  };

  const handleUploadDePara = async (file: File) => {
    console.log('🔄 Iniciando upload do arquivo De Para:', file.name);
    
    try {
      // Upload do arquivo para storage
      const nomeArquivo = `valores_de_para_${Date.now()}_${file.name}`;
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload de Dados</h1>
        <p className="text-muted-foreground mt-2">
          Upload do arquivo de referência para preenchimento automático de valores
        </p>
      </div>

      {/* Seção Arquivo de Referência - De Para */}
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
            description="Arquivo com as colunas ESTUDO_DESCRICAO e VALORES para preenchimento automático dos valores zerados nos arquivos 1, 2, 3 e 4"
            acceptedTypes={['.csv', '.xlsx', '.xls']}
            maxSizeInMB={50}
            expectedFormat={["ESTUDO_DESCRICAO", "VALORES"]}
            onUpload={handleUploadDePara}
          />
        </CardContent>
      </Card>
    </div>
  );
}