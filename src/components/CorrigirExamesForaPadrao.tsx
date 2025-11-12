import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const CorrigirExamesForaPadrao = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [arquivoFonte, setArquivoFonte] = useState<string>("TODOS");
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();

  const handleCorrigir = async () => {
    setIsProcessing(true);
    setResultado(null);

    try {
      console.log('🔧 Iniciando correção de exames fora do padrão...');
      console.log('📂 Arquivo fonte:', arquivoFonte);

      const body = arquivoFonte === "TODOS" ? {} : { arquivo_fonte: arquivoFonte };

      const { data, error } = await supabase.functions.invoke(
        'corrigir-volumetria-fora-padrao',
        { body }
      );

      if (error) throw error;

      setResultado(data);

      if (data.sucesso) {
        toast({
          title: "✅ Correção concluída",
          description: `${data.registros_corrigidos} de ${data.registros_encontrados} registros corrigidos`,
        });
      } else {
        toast({
          title: "⚠️ Erro na correção",
          description: data.erro || "Erro desconhecido",
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('Erro ao executar correção:', error);
      toast({
        title: "Erro ao executar correção",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Corrigir Exames Fora do Padrão
        </CardTitle>
        <CardDescription>
          Aplica correções automáticas nos registros da volumetria consultando o cadastro de exames (categoria, especialidade e modalidade)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Arquivo para processar</label>
          <Select value={arquivoFonte} onValueChange={setArquivoFonte} disabled={isProcessing}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os arquivos</SelectItem>
              <SelectItem value="padrao">Padrão</SelectItem>
              <SelectItem value="fora_padrao">Fora do Padrão</SelectItem>
              <SelectItem value="retroativo">Retroativo</SelectItem>
              <SelectItem value="incremental">Incremental</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={handleCorrigir} 
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Executar Correção
            </>
          )}
        </Button>

        {resultado && resultado.sucesso && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <div className="space-y-1">
                <p className="font-semibold">Correção concluída com sucesso!</p>
                <p className="text-sm">Arquivo: {resultado.arquivo_fonte}</p>
                <p className="text-sm">Registros encontrados: {resultado.registros_encontrados}</p>
                <p className="text-sm">Registros corrigidos: {resultado.registros_corrigidos}</p>
                <p className="text-sm">Mapeamentos utilizados: {resultado.mapeamentos_utilizados}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {resultado.detalhes?.observacao}
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
