import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const CorrigirExamesForaPadrao = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();

  const handleCorrigir = async () => {
    setIsProcessing(true);
    setResultado(null);

    try {
      console.log('🔧 Iniciando correção de exames fora do padrão...');

      const body = { arquivo_fonte: 'fora_padrao' };

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
          Corrige automaticamente os registros de exames fora do padrão aplicando categoria, especialidade e modalidade do cadastro de exames
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Esta correção processa apenas os registros do arquivo <strong>fora_padrao</strong> que não possuem categoria, especialidade ou modalidade corretas.
          </AlertDescription>
        </Alert>

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
