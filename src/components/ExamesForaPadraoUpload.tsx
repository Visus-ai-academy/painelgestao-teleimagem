import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Upload, File, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ExamesForaPadraoUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar arquivo Excel
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Upload do arquivo para storage
      const fileName = `exames_fora_padrao_${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      setProgress(50);

      // Processar arquivo De-Para
      const { data, error } = await supabase.functions.invoke('processar-valores-de-para', {
        body: { fileName: fileName }
      });

      if (error) {
        throw error;
      }

      setProgress(100);
      
      toast.success(`Arquivo De-Para processado com sucesso! ${data.registros_processados} registros processados.`);
      
      // Reset
      event.target.value = '';
      
    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error('Erro ao processar arquivo De-Para');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <File className="h-5 w-5" />
          Upload Arquivo De-Para - Exames Fora de Padrão
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Faça upload do arquivo Excel com os valores de referência para exames fora de padrão.
            O arquivo deve conter as colunas: ESTUDO_DESCRICAO e VALORES.
          </div>
          
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={uploading}
              className="flex-1"
            />
            <Button disabled={uploading}>
              {uploading ? (
                <>
                  <Upload className="h-4 w-4 animate-pulse mr-2" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </div>

          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <div className="text-sm text-muted-foreground text-center">
                {progress < 50 ? 'Fazendo upload...' : 'Processando arquivo...'}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Formato do arquivo: Excel (.xlsx ou .xls) com colunas ESTUDO_DESCRICAO e VALORES
          </div>
        </div>
      </CardContent>
    </Card>
  );
}