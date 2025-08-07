import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Trash2, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LimpezaResult {
  sucesso: boolean;
  clientes_removidos: number;
  contratos_removidos: number;
  precos_removidos: number;
  exames_removidos: number;
  medicos_removidos: number;
  escalas_removidas: number;
  faturamento_removido: number;
  cadastro_exames_removidos: number;
  especialidades_removidas: number;
  categorias_removidas: number;
  total_removido: number;
  data_limpeza: string;
  observacao: string;
}

export const LimparDadosFicticios = () => {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<LimpezaResult | null>(null);
  const { toast } = useToast();

  const executarLimpeza = async () => {
    if (!confirm("⚠️ ATENÇÃO: Esta ação irá remover TODOS os dados fictícios do sistema (dados que não vieram de uploads). Esta operação é IRREVERSÍVEL. Deseja continuar?")) {
      return;
    }

    try {
      setLoading(true);
      setResultado(null);
      
      console.log('🧹 Iniciando limpeza de dados fictícios...');
      
      const { data, error } = await supabase.functions.invoke('limpar-dados-ficticios');
      
      if (error) {
        throw error;
      }
      
      setResultado(data);
      
      toast({
        title: "✅ Limpeza concluída!",
        description: `${data.total_removido} registros fictícios foram removidos`,
      });
      
    } catch (error: any) {
      console.error('Erro na limpeza:', error);
      toast({
        title: "❌ Erro na limpeza",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          Limpar Dados Fictícios
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>ATENÇÃO:</strong> Esta ação remove todos os dados fictícios do sistema 
            (dados que não foram inseridos via upload). Inclui: clientes, contratos, preços, 
            médicos, escalas, exames, faturamento e cadastros sem origem de upload válida.
            <br /><br />
            <strong>Esta operação é irreversível!</strong>
          </AlertDescription>
        </Alert>

        <Button 
          onClick={executarLimpeza}
          disabled={loading}
          variant="destructive"
          className="w-full"
        >
          {loading ? "Limpando..." : "🗑️ Limpar Todos os Dados Fictícios"}
        </Button>

        {resultado && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold text-green-800">✅ Limpeza concluída com sucesso!</p>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Clientes: <strong>{resultado.clientes_removidos}</strong></div>
                  <div>Contratos: <strong>{resultado.contratos_removidos}</strong></div>
                  <div>Preços: <strong>{resultado.precos_removidos}</strong></div>
                  <div>Médicos: <strong>{resultado.medicos_removidos}</strong></div>
                  <div>Escalas: <strong>{resultado.escalas_removidas}</strong></div>
                  <div>Exames: <strong>{resultado.exames_removidos}</strong></div>
                  <div>Faturamento: <strong>{resultado.faturamento_removido}</strong></div>
                  <div>Cadastros: <strong>{resultado.cadastro_exames_removidos}</strong></div>
                  <div>Especialidades: <strong>{resultado.especialidades_removidas}</strong></div>
                  <div>Categorias: <strong>{resultado.categorias_removidas}</strong></div>
                </div>
                
                <div className="pt-2 border-t border-green-200">
                  <p><strong>Total removido: {resultado.total_removido} registros</strong></p>
                  <p className="text-xs text-green-600 mt-1">{resultado.observacao}</p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};