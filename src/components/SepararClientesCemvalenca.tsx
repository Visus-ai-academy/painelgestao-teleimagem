import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Split } from "lucide-react";

interface ResultadoSeparacao {
  sucesso: boolean;
  periodo_referencia: string;
  total_registros_processados: number;
  CEMVALENCA_PL: number;
  CEMVALENCA_RX: number;
  CEMVALENCA: number;
  erros: number;
}

export const SepararClientesCemvalenca = () => {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSeparacao | null>(null);
  const { toast } = useToast();

  const handleSeparar = async () => {
    setLoading(true);
    setResultado(null);

    try {
      console.log("Chamando função de separação CEMVALENCA...");
      
      const { data, error } = await supabase.functions.invoke(
        'aplicar-separacao-cemvalenca',
        {
          body: { periodo_referencia: '2025-09' }
        }
      );

      if (error) {
        console.error("Erro ao separar clientes:", error);
        throw error;
      }

      console.log("Resultado da separação:", data);
      setResultado(data);

      toast({
        title: "Separação concluída!",
        description: `${data.total_registros_processados} registros processados. CEMVALENCA_PL: ${data.CEMVALENCA_PL}, CEMVALENCA_RX: ${data.CEMVALENCA_RX}, CEMVALENCA: ${data.CEMVALENCA}`,
      });
    } catch (error: any) {
      console.error("Erro:", error);
      toast({
        title: "Erro ao separar clientes",
        description: error.message || "Ocorreu um erro ao processar a separação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Split className="h-5 w-5" />
            Separar Clientes CEMVALENCA
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Aplica a regra de separação automática para CEMVALENCA, CEMVALENCA_PL e CEMVALENCA_RX
          </p>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
          <p className="font-medium">Critérios de separação:</p>
          <ul className="space-y-1 ml-4">
            <li>• <strong>PRIORIDADE = PLANTÃO</strong> → CEMVALENCA_PL</li>
            <li>• <strong>MODALIDADE = RX</strong> (não PLANTÃO) → CEMVALENCA_RX</li>
            <li>• <strong>Demais casos</strong> → CEMVALENCA</li>
          </ul>
        </div>

        <Button
          onClick={handleSeparar}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando separação...
            </>
          ) : (
            <>
              <Split className="mr-2 h-4 w-4" />
              Executar Separação (Período 2025-09)
            </>
          )}
        </Button>

        {resultado && (
          <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
            <p className="font-semibold text-primary">Resultado da Separação:</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Total processado:</span>
                <span className="ml-2 font-medium">{resultado.total_registros_processados}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Erros:</span>
                <span className="ml-2 font-medium">{resultado.erros}</span>
              </div>
              <div className="col-span-2 h-px bg-border my-2"></div>
              <div>
                <span className="text-muted-foreground">CEMVALENCA_PL:</span>
                <span className="ml-2 font-medium text-blue-600">{resultado.CEMVALENCA_PL}</span>
              </div>
              <div>
                <span className="text-muted-foreground">CEMVALENCA_RX:</span>
                <span className="ml-2 font-medium text-green-600">{resultado.CEMVALENCA_RX}</span>
              </div>
              <div>
                <span className="text-muted-foreground">CEMVALENCA:</span>
                <span className="ml-2 font-medium text-purple-600">{resultado.CEMVALENCA}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
