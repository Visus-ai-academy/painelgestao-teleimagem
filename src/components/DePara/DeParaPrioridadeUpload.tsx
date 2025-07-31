import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UploadStatus {
  isUploading: boolean;
  uploadedRecords: number;
  totalRecords: number;
  errors: string[];
}

export function DeParaPrioridadeUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>({
    isUploading: false,
    uploadedRecords: 0,
    totalRecords: 0,
    errors: []
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus({
        isUploading: false,
        uploadedRecords: 0,
        totalRecords: 0,
        errors: []
      });
    }
  };

  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/templates/template_de_para_prioridade.csv';
    link.download = 'template_de_para_prioridade.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processFile = async () => {
    if (!file) {
      toast.error("Selecione um arquivo para fazer upload");
      return;
    }

    setStatus(prev => ({ ...prev, isUploading: true, errors: [] }));

    try {
      // Criar FormData para enviar o arquivo
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('processar-prioridades', {
        body: formData
      });

      if (error) {
        throw error;
      }

      setStatus({
        isUploading: false,
        uploadedRecords: data.registros_processados || 0,
        totalRecords: data.total_registros || 0,
        errors: data.erros || []
      });

      if (data.registros_processados > 0) {
        toast.success(`Upload concluído! ${data.registros_processados} registros processados.`);
      } else {
        toast.error("Nenhum registro foi processado. Verifique o formato do arquivo.");
      }

    } catch (error) {
      console.error('Erro no upload:', error);
      setStatus(prev => ({ 
        ...prev, 
        isUploading: false, 
        errors: [`Erro no upload: ${error.message || 'Erro desconhecido'}`] 
      }));
      toast.error("Erro no upload do arquivo");
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Upload De-Para Prioridade
        </CardTitle>
        <CardDescription>
          Faça upload do arquivo Excel de mapeamento de prioridades. Este arquivo será usado para padronizar 
          os valores de prioridade em todos os uploads de volumetria do MobileMed.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription>
            <strong>Importante:</strong> O arquivo deve conter as colunas PRIORIDADE_ORIGINAL e NOME_FINAL.
            Todos os uploads futuros de volumetria aplicarão automaticamente este mapeamento.
          </AlertDescription>
        </Alert>

        <div className="flex gap-4">
          <Button 
            variant="outline" 
            onClick={downloadTemplate}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Baixar Template
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="file-upload" className="block text-sm font-medium mb-2">
              Selecionar Arquivo Excel
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>

          {file && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <Button 
                onClick={processFile}
                disabled={status.isUploading}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {status.isUploading ? "Processando..." : "Fazer Upload"}
              </Button>
            </div>
          )}
        </div>

        {status.isUploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processando arquivo...</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: "60%" }}></div>
            </div>
          </div>
        )}

        {!status.isUploading && status.totalRecords > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {status.uploadedRecords} de {status.totalRecords} registros processados
              </Badge>
            </div>
            
            {status.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Erros encontrados:</p>
                <div className="max-h-32 overflow-y-auto">
                  {status.errors.map((error, index) => (
                    <p key={index} className="text-xs text-destructive">• {error}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}