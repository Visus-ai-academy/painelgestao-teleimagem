import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users } from "lucide-react";

export function AplicarAgrupamentoClientes() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAplicar = async () => {
    try {
      setLoading(true);
      
      toast({
        title: "Aplicando agrupamento...",
        description: "Processando agrupamento de clientes nos dados existentes",
      });

      const { data, error } = await supabase.functions.invoke('aplicar-agrupamento-clientes', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "✅ Agrupamento aplicado!",
        description: (
          <div className="space-y-1 text-sm">
            <p>• DIAGNOSTICA agrupados: {data.diagnostica_agrupados}</p>
            <p>• CEMVALENCA_RX movidos: {data.cemvalenca_rx_movidos}</p>
            <p>• CEMVALENCA_PL movidos: {data.cemvalenca_pl_movidos}</p>
            <p>• CEMVALENCA_PL devolvidos: {data.cemvalenca_pl_retorno}</p>
            <p>• CEMVALENCA_RX devolvidos: {data.cemvalenca_rx_retorno}</p>
            <p>• CEMVALENCA restantes: {data.cemvalenca_restantes}</p>
          </div>
        ),
      });

      // Recarregar página após 2 segundos
      setTimeout(() => {
        window.location.reload();
      }, 2000);

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
            <li>Agrupa todos "DIAGNOSTICA PLANTAO_*" como "DIAGNOSTICA"</li>
            <li>Move CEMVALENCA RX PLANTÃO para "CEMVALENCA_RX"</li>
            <li>Move CEMVALENCA não-RX PLANTÃO para "CEMVALENCA_PL"</li>
            <li>Mantém CEMVALENCA com demais registros</li>
          </ul>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleAplicar} 
          disabled={loading}
          className="w-full"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Aplicar Agrupamento aos Dados Existentes
        </Button>
      </CardContent>
    </Card>
  );
}
