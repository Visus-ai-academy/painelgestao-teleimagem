import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, AlertTriangle, FileText } from "lucide-react";

interface ResultadoCorrecao {
  cliente_nome: string;
  acao: string;
  numero_contrato_antigo?: string;
  numero_contrato_novo?: string;
  contratos_removidos?: number;
  detalhes?: string;
}

export function CorrigirContratosDuplicados() {
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<{
    sucesso: boolean;
    total_acoes: number;
    resumo: Record<string, number>;
    detalhes: ResultadoCorrecao[];
  } | null>(null);
  const { toast } = useToast();

  const corrigirContratos = async () => {
    try {
      setProcessando(true);
      setResultado(null);

      console.log('🔧 Iniciando correção de contratos...');

      const { data, error } = await supabase.functions.invoke('corrigir-contratos-duplicados');

      if (error) {
        console.error('Erro ao corrigir contratos:', error);
        toast({
          title: "Erro",
          description: `Erro ao corrigir contratos: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log('✅ Correção concluída:', data);
      setResultado(data);

      if (data.sucesso) {
        toast({
          title: "Correção concluída!",
          description: `${data.total_acoes} ações realizadas com sucesso.`,
        });
      } else {
        toast({
          title: "Erro",
          description: data.erro || "Erro desconhecido ao corrigir contratos.",
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('Erro ao executar correção:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setProcessando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Correção de Contratos Duplicados
        </CardTitle>
        <CardDescription>
          Corrige números de contrato incorretos e remove duplicações baseado nos parâmetros de faturamento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Esta operação irá:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Atualizar números de contrato para usar os valores dos parâmetros de faturamento</li>
              <li>Remover contratos duplicados do mesmo cliente</li>
              <li>Manter apenas o contrato mais recente com parâmetros configurados</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Button 
          onClick={corrigirContratos} 
          disabled={processando}
          className="w-full"
        >
          {processando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Executar Correção
            </>
          )}
        </Button>

        {resultado && (
          <div className="space-y-4 mt-6">
            <Alert variant={resultado.sucesso ? "default" : "destructive"}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Total de ações realizadas: {resultado.total_acoes}</strong>
              </AlertDescription>
            </Alert>

            {resultado.resumo && Object.keys(resultado.resumo).length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Resumo por tipo de ação:</h4>
                <div className="grid gap-2">
                  {Object.entries(resultado.resumo).map(([acao, quantidade]) => (
                    <div key={acao} className="flex justify-between items-center p-2 bg-muted rounded">
                      <span className="capitalize">{acao.replace(/_/g, ' ')}</span>
                      <span className="font-semibold">{quantidade}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resultado.detalhes && resultado.detalhes.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Detalhes das correções:</h4>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {resultado.detalhes.map((detalhe, index) => (
                    <div key={index} className="p-3 bg-muted rounded text-sm">
                      <div className="font-semibold">{detalhe.cliente_nome}</div>
                      <div className="text-muted-foreground capitalize">
                        Ação: {detalhe.acao.replace(/_/g, ' ')}
                      </div>
                      {detalhe.numero_contrato_antigo && (
                        <div className="text-xs">
                          Anterior: <code>{detalhe.numero_contrato_antigo}</code>
                        </div>
                      )}
                      {detalhe.numero_contrato_novo && (
                        <div className="text-xs text-green-600">
                          Novo: <code>{detalhe.numero_contrato_novo}</code>
                        </div>
                      )}
                      {detalhe.contratos_removidos && (
                        <div className="text-xs text-orange-600">
                          Contratos removidos: {detalhe.contratos_removidos}
                        </div>
                      )}
                      {detalhe.detalhes && (
                        <div className="text-xs text-red-600 mt-1">
                          {detalhe.detalhes}
                        </div>
                      )}
                    </div>
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
