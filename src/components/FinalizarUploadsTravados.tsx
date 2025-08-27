import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function FinalizarUploadsTravados() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();

  const finalizarUploadsTravados = async () => {
    setLoading(true);
    setResultado(null);

    try {
      console.log('🔄 Iniciando finalização de uploads travados...');

      const { data, error } = await supabase.functions.invoke('finalizar-uploads-travados');

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro desconhecido');
      }

      setResultado(data);

      toast({
        title: "✅ Uploads Finalizados",
        description: `${data.uploads_finalizados} uploads foram finalizados com sucesso`,
        variant: "default",
      });

      console.log('✅ Finalização concluída:', data);

    } catch (error: any) {
      console.error('❌ Erro na finalização:', error);
      toast({
        title: "❌ Erro na Finalização",
        description: error.message || "Erro desconhecido ao finalizar uploads",
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
          <Clock className="h-5 w-5 text-amber-500" />
          Finalizar Uploads Travados
        </CardTitle>
        <CardDescription>
          Finaliza uploads que ficaram travados no status "processando" há mais de 10 minutos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={finalizarUploadsTravados}
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
              Finalizar Uploads Travados
            </>
          )}
        </Button>

        {resultado && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="font-medium">Resultado da Finalização</span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div>
                <strong>Uploads Finalizados:</strong> {resultado.uploads_finalizados}
              </div>
              {resultado.uploads_com_erro > 0 && (
                <div className="text-red-600">
                  <strong>Uploads com Erro:</strong> {resultado.uploads_com_erro}
                </div>
              )}
              
              {resultado.resultados?.length > 0 && (
                <div className="mt-3">
                  <strong>Detalhes:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {resultado.resultados.map((item: any, index: number) => (
                      <li key={index} className={item.status === 'finalizado' ? 'text-green-600' : 'text-red-600'}>
                        <strong>{item.arquivo_nome}</strong> - {item.status === 'finalizado' ? 'Finalizado' : 'Erro'}
                        {item.status === 'finalizado' && (
                          <span className="text-muted-foreground ml-2">
                            ({item.registros_inseridos} registros inseridos)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Quando usar:</strong> Esta função deve ser usada quando uploads ficam 
            travados no status "processando" mesmo após terem inserido os dados na base. 
            Isso pode acontecer quando a edge function é interrompida antes de finalizar.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}