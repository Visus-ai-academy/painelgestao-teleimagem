import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Upload, CheckCircle, Loader } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PrecosClienteUpload() {
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

      const { data, error } = await supabase.functions.invoke('processar-precos-servicos', {
        body: formData,
      });

      if (error) {
        throw error;
      }

      setResultado(data);
      toast.success(`Processamento concluído! ${data.registros_processados} registros processados.`);
      
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
          <Upload className="h-5 w-5" />
          Upload de Preços Cliente
        </CardTitle>
        <CardDescription>
          Envie um arquivo Excel (.xlsx) com os preços dos serviços por cliente
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
            O arquivo deve conter as colunas: CLIENTE, MODALIDADE, ESPECIALIDADE, PRIORIDADE, CATEGORIA, PREÇO, VOL INICIAL, VOL FINAL, COND. VOLUME, CONSIDERA PLANTAO
            <br />
            <a 
              href="/templates/template_precos_cliente.csv" 
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
          <Alert className={resultado.success ? "border-green-500" : "border-red-500"}>
            {resultado.success ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <AlertDescription>
              {resultado.success ? (
                <div>
                  <p><strong>Processamento concluído com sucesso!</strong></p>
                  <p>Registros processados: {resultado.registros_processados}</p>
                  <p>Registros com erro: {resultado.registros_erro}</p>
                  {resultado.processamento_background > 0 && (
                    <p>Em background: {resultado.processamento_background} registros</p>
                  )}
                  <p className="text-sm mt-2">{resultado.mensagem}</p>
                </div>
              ) : (
                <p>Erro: {resultado.error}</p>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}