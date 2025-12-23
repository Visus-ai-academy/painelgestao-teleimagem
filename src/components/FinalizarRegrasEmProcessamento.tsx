import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function FinalizarRegrasEmProcessamento() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();

  const finalizarRegras = async () => {
    setLoading(true);
    setResultado(null);

    try {
      console.log('🔄 Buscando regras travadas em processamento...');

      // Buscar registros travados (mais de 10 minutos em processamento)
      const dezMinutosAtras = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      
      const { data: travados, error: selectError } = await supabase
        .from('processamento_regras_log')
        .select('*')
        .eq('status', 'processando')
        .lt('created_at', dezMinutosAtras);

      if (selectError) {
        throw new Error(selectError.message);
      }

      if (!travados || travados.length === 0) {
        setResultado({ finalizados: 0, mensagem: 'Nenhum registro travado encontrado' });
        toast({
          title: "✅ Nenhum registro travado",
          description: "Não há processamentos travados para finalizar",
        });
        return;
      }

      console.log(`📊 Encontrados ${travados.length} registros travados`);

      // Atualizar cada registro para concluído
      let finalizados = 0;
      let erros = 0;
      const detalhes: any[] = [];

      for (const registro of travados) {
        const { error: updateError } = await supabase
          .from('processamento_regras_log')
          .update({
            status: 'concluido',
            completed_at: new Date().toISOString(),
            mensagem: 'Finalizado manualmente (detectado como travado)'
          })
          .eq('id', registro.id);

        if (updateError) {
          console.error(`❌ Erro ao finalizar ${registro.arquivo_fonte}:`, updateError);
          erros++;
          detalhes.push({ arquivo: registro.arquivo_fonte, status: 'erro', erro: updateError.message });
        } else {
          finalizados++;
          detalhes.push({ arquivo: registro.arquivo_fonte, status: 'finalizado' });
        }
      }

      setResultado({ finalizados, erros, detalhes });

      toast({
        title: finalizados > 0 ? "✅ Registros Finalizados" : "⚠️ Nenhum registro atualizado",
        description: `${finalizados} registros finalizados${erros > 0 ? `, ${erros} com erro` : ''}`,
        variant: finalizados > 0 ? "default" : "destructive",
      });

      console.log('✅ Finalização concluída:', { finalizados, erros });

    } catch (error: any) {
      console.error('❌ Erro na finalização:', error);
      toast({
        title: "❌ Erro na Finalização",
        description: error.message || "Erro desconhecido ao finalizar regras",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-orange-500" />
          Finalizar Regras Travadas
        </CardTitle>
        <CardDescription>
          Finaliza processamentos de regras que ficaram travados no status "processando" há mais de 10 minutos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={finalizarRegras}
          disabled={loading}
          className="w-full"
          variant="outline"
        >
          {loading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Finalizando...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Finalizar Regras Travadas
            </>
          )}
        </Button>

        {resultado && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="font-medium">Resultado</span>
            </div>
            
            <div className="space-y-2 text-sm">
              {resultado.mensagem ? (
                <div>{resultado.mensagem}</div>
              ) : (
                <>
                  <div>
                    <strong>Finalizados:</strong> {resultado.finalizados}
                  </div>
                  {resultado.erros > 0 && (
                    <div className="text-red-600">
                      <strong>Com Erro:</strong> {resultado.erros}
                    </div>
                  )}
                  
                  {resultado.detalhes?.length > 0 && (
                    <div className="mt-3">
                      <strong>Detalhes:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {resultado.detalhes.map((item: any, index: number) => (
                          <li key={index} className={item.status === 'finalizado' ? 'text-green-600' : 'text-red-600'}>
                            {item.arquivo} - {item.status === 'finalizado' ? '✅ Finalizado' : `❌ ${item.erro}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
          <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-orange-800 dark:text-orange-200">
            <strong>Quando usar:</strong> Quando os processamentos de regras ficam 
            travados mostrando "Em processamento..." mesmo após terem sido concluídos.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
