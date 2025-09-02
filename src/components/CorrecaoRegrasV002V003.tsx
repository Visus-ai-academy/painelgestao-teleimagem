import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Play, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { corrigirRegrasV002V003Existentes } from '@/lib/correcaoRegrasV002V003';

export function CorrecaoRegrasV002V003() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const executarCorrecao = async () => {
    if (isExecuting) return;
    
    setIsExecuting(true);
    setResult(null);
    
    try {
      toast({
        title: "Iniciando Correção",
        description: "Aplicando regras v002/v003 nos uploads retroativos...",
      });
      
      const resultado = await corrigirRegrasV002V003Existentes();
      setResult(resultado);
      
      if (resultado.success) {
        toast({
          title: "Correção Aplicada com Sucesso",
          description: resultado.message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro na Correção",
          description: resultado.message,
        });
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: "destructive",
        title: "Erro Crítico",
        description: errorMessage,
      });
      setResult({ success: false, message: errorMessage, detalhes: null });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Correção Emergencial: Regras v002/v003
        </CardTitle>
        <CardDescription>
          Aplica as regras v002/v003 nos uploads retroativos que não tiveram as regras aplicadas devido ao problema de formato de período.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-orange-800">Problema Identificado:</p>
              <p className="text-orange-700">
                Os uploads retroativos estão salvando período no formato "2025-06" (YYYY-MM), mas as edge functions esperam "jun/25" (mmm/YY).
              </p>
              <p className="text-orange-700 mt-1">
                <strong>Esta correção:</strong> Converte os períodos e aplica as regras v002/v003 nos uploads existentes.
              </p>
            </div>
          </div>
        </div>

        <Button 
          onClick={executarCorrecao}
          disabled={isExecuting}
          className="w-full"
          size="lg"
        >
          <Play className="h-4 w-4 mr-2" />
          {isExecuting ? "Executando Correção..." : "Executar Correção Emergencial"}
        </Button>

        {result && (
          <Card className={result.success ? "border-green-200" : "border-red-200"}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 text-sm ${result.success ? "text-green-700" : "text-red-700"}`}>
                {result.success ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Correção Executada com Sucesso
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    Erro na Correção
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">{result.message}</p>
              
              {result.detalhes && Array.isArray(result.detalhes) && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Detalhes por Upload:</h4>
                  <div className="space-y-2">
                    {result.detalhes.map((detalhe: any, index: number) => (
                      <div key={index} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{detalhe.arquivo}</span>
                          <Badge 
                            variant={detalhe.status === 'SUCESSO' ? 'default' : 
                                   detalhe.status === 'SEM_REGISTROS' ? 'secondary' : 'destructive'}
                          >
                            {detalhe.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <p><strong>Tipo:</strong> {detalhe.tipo}</p>
                          <p><strong>Período original:</strong> {detalhe.periodo_original}</p>
                          <p><strong>Período convertido:</strong> {detalhe.periodo_convertido}</p>
                          {detalhe.status === 'SUCESSO' && (
                            <>
                              <p><strong>Antes:</strong> {detalhe.registros_antes} registros</p>
                              <p><strong>Depois:</strong> {detalhe.registros_depois} registros</p>
                              <p className="text-orange-600"><strong>Excluídos:</strong> {detalhe.excluidos} registros</p>
                            </>
                          )}
                          {detalhe.erro && (
                            <p className="text-red-600"><strong>Erro:</strong> {detalhe.erro}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}