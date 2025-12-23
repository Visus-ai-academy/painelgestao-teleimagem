import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, AlertTriangle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AplicarAgrupamentoClientesProps {
  periodoReferencia?: string;
}

export function AplicarAgrupamentoClientes({ periodoReferencia }: AplicarAgrupamentoClientesProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAplicar = async () => {
    // CRÍTICO: Validar período antes de processar
    if (!periodoReferencia) {
      toast({
        title: "Período não selecionado",
        description: "Selecione um período de referência na aba 'Upload de Dados' antes de aplicar o agrupamento",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      toast({
        title: "Aplicando agrupamento...",
        description: `Processando agrupamento de clientes para período ${periodoReferencia}`,
      });

      const { data, error } = await supabase.functions.invoke('aplicar-agrupamento-clientes', {
        body: {
          periodo_referencia: periodoReferencia
        }
      });

      if (error) throw error;

      toast({
        title: "✅ Agrupamento aplicado!",
        description: (
          <div className="space-y-1 text-sm">
            <p>• Nomes mapeados: {data.total_mapeados}</p>
            <p>• DIAGNOSTICA agrupados: {data.diagnostica_agrupados}</p>
            <p>• CEMVALENCA_RX movidos: {data.cemvalenca_rx_movidos}</p>
            <p>• CEMVALENCA_PL movidos: {data.cemvalenca_pl_movidos}</p>
            <p>• CEMVALENCA_PL devolvidos: {data.cemvalenca_pl_retorno}</p>
            <p>• CEMVALENCA_RX devolvidos: {data.cemvalenca_rx_retorno}</p>
            <p>• CEMVALENCA restantes: {data.cemvalenca_restantes}</p>
          </div>
        ),
      });

    } catch (error) {
      console.error('Erro ao aplicar agrupamento:', error);
      toast({
        title: "Erro ao aplicar agrupamento",
        description: error.message || "Ocorreu um erro ao processar o agrupamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Aplicar Agrupamento de Clientes
        </CardTitle>
        <CardDescription>
          Aplica regras de agrupamento aos dados já existentes na volumetria:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Preserva nome original em "unidade_origem" para relatórios de faturamento</li>
            <li>Aplica mapeamento nome_mobilemed → nome_fantasia (ex: CLIMAGEM → CLIMAGEM1)</li>
            <li>Agrupa todos "DIAGNOSTICA PLANTAO_*" como "DIAGNOSTICA"</li>
            <li>Move CEMVALENCA RX PLANTÃO para "CEMVALENCA_RX"</li>
            <li>Move CEMVALENCA não-RX PLANTÃO para "CEMVALENCA_PL"</li>
            <li>Retorna registros sem PLANTÃO de volta para "CEMVALENCA"</li>
          </ul>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alerta se período não selecionado */}
        {!periodoReferencia && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Período não selecionado!</strong> Volte à aba "Upload de Dados" e selecione o período de faturamento antes de aplicar o agrupamento.
            </AlertDescription>
          </Alert>
        )}

        {/* Período selecionado */}
        {periodoReferencia && (
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              Período selecionado: <strong>{periodoReferencia}</strong>
            </AlertDescription>
          </Alert>
        )}

        <Button 
          onClick={handleAplicar} 
          disabled={loading || !periodoReferencia}
          className="w-full"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Aplicar Agrupamento aos Dados Existentes
        </Button>
      </CardContent>
    </Card>
  );
}
