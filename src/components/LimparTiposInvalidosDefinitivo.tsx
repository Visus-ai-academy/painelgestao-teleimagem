import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Trash2, RefreshCw, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LimparTiposInvalidosDefinitivo() {
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();

  const limparTiposInvalidos = async () => {
    setProcessando(true);
    setResultado(null);

    try {
      console.log('🗑️ Chamando edge function para limpar tipos inválidos...');
      
      const { data, error } = await supabase.functions.invoke('limpar-tipos-invalidos-definitivo', {
        body: {}
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.sucesso) {
        throw new Error(data?.erro || 'Erro ao limpar tipos inválidos');
      }

      setResultado(data);

      toast({
        title: "✅ Tipos inválidos removidos!",
        description: `${data.registros_limpos} registro(s) com tipos inválidos foram limpos`,
        variant: "default",
      });

    } catch (error) {
      console.error('❌ Erro ao limpar tipos inválidos:', error);
      toast({
        title: "Erro ao limpar tipos inválidos",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setProcessando(false);
    }
  };

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-5 w-5" />
          Limpar Tipos de Faturamento Inválidos
        </CardTitle>
        <CardDescription>
          Remove DEFINITIVAMENTE os tipos inválidos: alta_complexidade, padrao, oncologia, urgencia
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-white border-red-300">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-sm">
            <strong>ATENÇÃO:</strong> Esta ação irá LIMPAR permanentemente todos os registros com tipos de faturamento inválidos.
            <br />
            <br />
            <strong>Tipos válidos de faturamento:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>CO-FT (Consolidado Faturado)</li>
              <li>CO-NF (Consolidado Não Faturado)</li>
              <li>NC-FT (Não Consolidado Faturado)</li>
              <li>NC-NF (Não Consolidado Não Faturado)</li>
              <li>NC1-NF (Não Consolidado1 Não Faturado)</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Button
          onClick={limparTiposInvalidos}
          disabled={processando}
          className="w-full bg-red-600 hover:bg-red-700"
          size="lg"
        >
          {processando ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Limpando tipos inválidos...
            </>
          ) : (
            <>
              <Trash2 className="h-5 w-5 mr-2" />
              🗑️ Limpar Tipos Inválidos AGORA
            </>
          )}
        </Button>

        {resultado && (
          <Alert className="bg-green-50 border-green-300">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <strong>✅ Limpeza concluída!</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><strong>{resultado.registros_limpos}</strong> registros limpos</li>
                <li><strong>{resultado.registros_restantes}</strong> registros restantes com tipos inválidos</li>
                <li>Tipos removidos: {resultado.tipos_removidos?.join(', ')}</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
