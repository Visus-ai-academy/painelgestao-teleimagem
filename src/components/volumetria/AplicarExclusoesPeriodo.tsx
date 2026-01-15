import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ResultadoExclusao {
  sucesso: boolean;
  arquivo_fonte: string;
  periodo_referencia: string;
  periodo_parseado?: { ano: number; mes: number };
  registros_inicial: number;
  registros_excluidos: number;
  registros_restantes: number;
  detalhes?: {
    v003_excluidos: number;
    v002_excluidos: number;
    data_limite_realizacao: string;
    janela_laudo_inicio: string;
    janela_laudo_fim: string;
  };
  erro?: string;
}

interface AplicarExclusoesPeriodoProps {
  periodoFaturamento?: { ano: number; mes: number };
}

export function AplicarExclusoesPeriodo({ periodoFaturamento }: AplicarExclusoesPeriodoProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultados, setResultados] = useState<ResultadoExclusao[]>([]);
  const { toast } = useToast();

  const aplicarExclusoes = async () => {
    if (!periodoFaturamento) {
      toast({
        title: "Erro",
        description: "Período de faturamento não definido. Selecione um período primeiro.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setResultados([]);

    const arquivosRetroativos = [
      'volumetria_padrao_retroativo',
      'volumetria_fora_padrao_retroativo'
    ];

    // Formato YYYY-MM - o mais robusto
    const periodoFormatado = `${periodoFaturamento.ano}-${periodoFaturamento.mes.toString().padStart(2, '0')}`;
    
    console.log('========================================');
    console.log('🔧 APLICANDO REGRAS V002/V003 MANUALMENTE');
    console.log(`📅 Período: ${periodoFormatado}`);
    console.log('========================================');

    const resultadosTemp: ResultadoExclusao[] = [];

    for (const arquivo of arquivosRetroativos) {
      try {
        console.log(`🚀 Aplicando exclusões para: ${arquivo}`);
        
        const { data, error } = await supabase.functions.invoke('aplicar-exclusoes-periodo', {
          body: {
            arquivo_fonte: arquivo,
            periodo_referencia: periodoFormatado
          }
        });

        if (error) {
          console.error(`❌ Erro para ${arquivo}:`, error);
          resultadosTemp.push({
            sucesso: false,
            arquivo_fonte: arquivo,
            periodo_referencia: periodoFormatado,
            registros_inicial: 0,
            registros_excluidos: 0,
            registros_restantes: 0,
            erro: error.message
          });
        } else {
          console.log(`✅ Sucesso para ${arquivo}:`, data);
          resultadosTemp.push({
            sucesso: data.sucesso,
            arquivo_fonte: arquivo,
            periodo_referencia: periodoFormatado,
            periodo_parseado: data.periodo_parseado,
            registros_inicial: data.registros_inicial || 0,
            registros_excluidos: data.registros_excluidos || 0,
            registros_restantes: data.registros_restantes || 0,
            detalhes: data.detalhes
          });
        }
      } catch (err) {
        console.error(`💥 Erro crítico para ${arquivo}:`, err);
        resultadosTemp.push({
          sucesso: false,
          arquivo_fonte: arquivo,
          periodo_referencia: periodoFormatado,
          registros_inicial: 0,
          registros_excluidos: 0,
          registros_restantes: 0,
          erro: err instanceof Error ? err.message : 'Erro desconhecido'
        });
      }
    }

    setResultados(resultadosTemp);
    setIsProcessing(false);

    const totalExcluidos = resultadosTemp.reduce((acc, r) => acc + r.registros_excluidos, 0);
    const todosSucesso = resultadosTemp.every(r => r.sucesso);

    toast({
      title: todosSucesso ? "Exclusões Aplicadas" : "Processo Concluído com Alertas",
      description: `Total de ${totalExcluidos} registros excluídos`,
      variant: todosSucesso ? "default" : "destructive"
    });
  };

  const getMesNome = (mes: number) => {
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return meses[mes - 1] || 'Desconhecido';
  };

  return (
    <Card className="border-green-200 bg-green-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-800">
          <CheckCircle2 className="h-5 w-5" />
          Regras V002/V003 - Correção de Dados Antigos
        </CardTitle>
        <CardDescription className="text-green-700">
          <strong>✅ Novos uploads:</strong> As regras V002/V003 são aplicadas automaticamente durante a inserção.
          <br />
          <strong>🔧 Use este botão apenas para corrigir dados antigos</strong> que foram inseridos antes da correção.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {periodoFaturamento ? (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertTitle className="text-blue-800">
              Período selecionado: {getMesNome(periodoFaturamento.mes)}/{periodoFaturamento.ano}
            </AlertTitle>
            <AlertDescription className="text-blue-700 text-sm">
              <strong>V003:</strong> Excluir exames com DATA_REALIZACAO ≥ {periodoFaturamento.ano}-{periodoFaturamento.mes.toString().padStart(2, '0')}-01
              <br />
              <strong>V002:</strong> Manter apenas laudos entre {periodoFaturamento.mes.toString().padStart(2, '0')}/08 e {(periodoFaturamento.mes % 12 + 1).toString().padStart(2, '0')}/07
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Período não definido</AlertTitle>
            <AlertDescription>
              Selecione um período de faturamento antes de aplicar as exclusões.
            </AlertDescription>
          </Alert>
        )}

        <Button 
          onClick={aplicarExclusoes} 
          disabled={isProcessing || !periodoFaturamento}
          className="w-full bg-orange-600 hover:bg-orange-700"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Aplicando Exclusões...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Aplicar Regras V002/V003 nos Retroativos
            </>
          )}
        </Button>

        {resultados.length > 0 && (
          <div className="space-y-3 mt-4">
            <h4 className="font-semibold text-sm">Resultados:</h4>
            {resultados.map((resultado, idx) => (
              <div 
                key={idx} 
                className={`p-3 rounded-lg border ${
                  resultado.sucesso 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {resultado.sucesso ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium text-sm">
                    {resultado.arquivo_fonte.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
                
                {resultado.sucesso ? (
                  <div className="text-xs space-y-1 text-gray-700">
                    <p>
                      <strong>Período aplicado:</strong> {resultado.periodo_parseado?.mes}/{resultado.periodo_parseado?.ano}
                    </p>
                    <p>
                      <strong>Registros iniciais:</strong> {resultado.registros_inicial.toLocaleString()}
                    </p>
                    <p className="text-red-600">
                      <strong>Excluídos:</strong> {resultado.registros_excluidos.toLocaleString()} 
                      {resultado.detalhes && (
                        <span className="text-gray-500">
                          {' '}(V003: {resultado.detalhes.v003_excluidos}, V002: {resultado.detalhes.v002_excluidos})
                        </span>
                      )}
                    </p>
                    <p className="text-green-600">
                      <strong>Registros restantes:</strong> {resultado.registros_restantes.toLocaleString()}
                    </p>
                    {resultado.detalhes && (
                      <p className="text-gray-500 text-xs mt-1">
                        Janela de laudo: {resultado.detalhes.janela_laudo_inicio} a {resultado.detalhes.janela_laudo_fim}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-red-600">
                    Erro: {resultado.erro}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
