import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Upload, CheckCircle, Loader, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ParametrosClienteUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResultado(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecione um arquivo primeiro");
      return;
    }

    setUploading(true);
    setResultado(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('processar-parametros-faturamento', {
        body: formData,
      });

      if (error) {
        throw error;
      }

      setResultado(data);
      toast.success(`Processamento concluído! ${data.processados} registros processados.`);
      
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast.error(`Erro no processamento: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Upload de Parâmetros Cliente
        </CardTitle>
        <CardDescription>
          Envie um arquivo Excel (.xlsx) com os parâmetros de faturamento por cliente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file">Arquivo Excel</Label>
          <Input
            id="file"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          {file && (
            <p className="text-sm text-muted-foreground">
              Arquivo selecionado: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            O arquivo deve conter as colunas: Nome Empresa, Status, Valor convênio, Valor URGÊNCIA, Possui Franquia, Valor Franquia, Volume, etc.
            <br />
            <a 
              href="/templates/template_parametros_cliente.csv" 
              download 
              className="text-blue-600 hover:text-blue-800 underline mt-1 inline-block"
            >
              📥 Baixar template de exemplo
            </a>
          </AlertDescription>
        </Alert>

        <Button 
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Enviar Arquivo
            </>
          )}
        </Button>

        {resultado && (
          <Alert className={resultado.sucesso ? "border-green-500" : "border-red-500"}>
            {resultado.sucesso ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <AlertDescription>
              {resultado.sucesso ? (
                <div>
                  <p><strong>Processamento concluído com sucesso!</strong></p>
                  <p>Registros processados: {resultado.processados}</p>
                  <p>Registros inseridos: {resultado.inseridos}</p>
                  <p>Registros atualizados: {resultado.atualizados}</p>
                  <p>Registros com erro: {resultado.erros}</p>
                </div>
              ) : (
                <p>Erro: {resultado.erro}</p>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}