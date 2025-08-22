import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TestTube, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface TesteResultado {
  sucesso: boolean;
  registros_testados: number;
  exclusoes_detectadas: number;
  exclusoes_por_trigger: number;
  sistema_exclusoes: string;
  mensagem: string;
  resultados_detalhados: {
    registro: number;
    empresa: string;
    resultado: string;
    motivo: string;
  }[];
  registros_rejeitados_criados: {
    motivo: string;
    detalhes: string;
    dados: any;
  }[];
}

export function TesteExclusoes() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<TesteResultado | null>(null);

  const executarTeste = async () => {
    try {
      setLoading(true);
      setResultado(null);

      toast({
        title: "🧪 Teste Iniciado",
        description: "Executando teste do sistema de exclusões...",
      });

      const { data, error } = await supabase.functions.invoke('testar-sistema-exclusoes');

      if (error) {
        console.error('❌ Erro no teste:', error);
        toast({
          title: "Erro no Teste",
          description: error.message || "Erro ao executar teste",
          variant: "destructive"
        });
        return;
      }

      console.log('📊 Resultado do teste:', data);
      setResultado(data);
      
      if (data.sistema_exclusoes === 'FUNCIONANDO') {
        toast({
          title: "✅ Teste Concluído",
          description: `Sistema funcionando! ${data.exclusoes_detectadas} exclusões detectadas`,
        });
      } else {
        toast({
          title: "⚠️ Problemas Detectados",
          description: data.mensagem,
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('Erro no teste:', error);
      toast({
        title: "Erro",
        description: "Erro ao executar teste do sistema",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Teste do Sistema de Exclusões
        </CardTitle>
        <CardDescription>
          Execute um teste controlado para verificar se o sistema está registrando exclusões corretamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button 
            onClick={executarTeste} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Executando Teste...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4" />
                Executar Teste
              </>
            )}
          </Button>
          
          <div className="text-sm text-muted-foreground">
            O teste criará registros temporários para verificar as regras de exclusão
          </div>
        </div>

        {resultado && (
          <div className="space-y-4">
            <Alert className={resultado.sistema_exclusoes === 'FUNCIONANDO' ? 'border-green-200' : 'border-red-200'}>
              {resultado.sistema_exclusoes === 'FUNCIONANDO' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription>
                <strong>Status:</strong> {resultado.sistema_exclusoes === 'FUNCIONANDO' ? 'Sistema Funcionando' : 'Problemas Detectados'}
                <br />
                <strong>Resultado:</strong> {resultado.mensagem}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{resultado.registros_testados}</div>
                <div className="text-sm text-muted-foreground">Registros Testados</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{resultado.exclusoes_detectadas}</div>
                <div className="text-sm text-muted-foreground">Exclusões Detectadas</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{resultado.exclusoes_por_trigger}</div>
                <div className="text-sm text-muted-foreground">Por Triggers</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {resultado.registros_rejeitados_criados?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Registros Salvos</div>
              </div>
            </div>

            {/* Detalhes dos Resultados */}
            <div className="space-y-3">
              <h4 className="font-medium">Detalhes dos Testes:</h4>
              {resultado.resultados_detalhados?.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="font-medium">{item.empresa}</div>
                    <div className="text-sm text-muted-foreground">{item.motivo}</div>
                  </div>
                  <Badge 
                    variant={
                      item.resultado === 'excluido_trigger' ? 'destructive' :
                      item.resultado === 'inserido' ? 'default' : 'secondary'
                    }
                  >
                    {item.resultado === 'excluido_trigger' ? 'Excluído' :
                     item.resultado === 'inserido' ? 'Inserido' : 'Erro'}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Registros Rejeitados Criados */}
            {resultado.registros_rejeitados_criados && resultado.registros_rejeitados_criados.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Registros de Exclusão Criados:</h4>
                {resultado.registros_rejeitados_criados.map((item, index) => (
                  <div key={index} className="p-3 rounded-lg bg-muted">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="destructive">{item.motivo}</Badge>
                    </div>
                    <div className="text-sm">{item.detalhes}</div>
                  </div>
                ))}
              </div>
            )}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Interpretação:</strong> {resultado.exclusoes_detectadas > 0 
                  ? 'O sistema está funcionando corretamente, registrando exclusões quando necessário.'
                  : 'Possível problema: o sistema pode não estar aplicando as regras de exclusão ou não salvando os registros rejeitados.'
                }
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}