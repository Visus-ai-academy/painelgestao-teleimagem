import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Loader2, Bug } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function TesteLogging() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const { toast } = useToast();

  const executarTeste = async () => {
    try {
      setLoading(true);
      setErro(null);
      setResultado(null);

      console.log("🧪 Iniciando teste de logging das Edge Functions...");
      
      const { data, error } = await supabase.functions.invoke('teste-logging', {
        body: { 
          teste_id: Date.now(),
          origem: 'frontend_teste'
        }
      });

      if (error) {
        throw new Error(`Erro na Edge Function: ${error.message}`);
      }

      setResultado(data);
      
      toast({
        title: "✅ Teste Executado",
        description: "Edge Function de teste executada com sucesso. Verifique os logs no Supabase.",
        variant: "default"
      });

      console.log("✅ Teste concluído:", data);

    } catch (error: any) {
      console.error("❌ Erro no teste:", error);
      setErro(error.message);
      
      toast({
        title: "❌ Erro no Teste",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          <CardTitle>Teste do Sistema de Logging</CardTitle>
        </div>
        <CardDescription>
          Testa se as Edge Functions estão gerando logs corretamente no Supabase Analytics
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-sm font-medium">Status do Sistema</h4>
            <p className="text-sm text-muted-foreground">
              Verifica logs: console.log, console.info, console.warn, console.error
            </p>
          </div>
          
          <Button 
            onClick={executarTeste}
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Bug className="mr-2 h-4 w-4" />
                Executar Teste
              </>
            )}
          </Button>
        </div>

        {resultado && (
          <div className="space-y-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800">Teste Executado com Sucesso</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Timestamp:</span>
                <p className="text-muted-foreground">{resultado.timestamp}</p>
              </div>
              <div>
                <span className="font-medium">Logs Gerados:</span>
                <Badge variant="secondary">{resultado.logs_generated}</Badge>
              </div>
            </div>
            
            <div className="mt-3 p-3 bg-white border rounded text-xs">
              <pre>{JSON.stringify(resultado, null, 2)}</pre>
            </div>
          </div>
        )}

        {erro && (
          <div className="space-y-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="font-medium text-red-800">Erro no Teste</span>
            </div>
            
            <p className="text-sm text-red-700">{erro}</p>
          </div>
        )}

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">🔍 Como Verificar os Logs:</h4>
          <ol className="text-sm text-blue-700 space-y-1 ml-4 list-decimal">
            <li>Execute o teste clicando no botão acima</li>
            <li>Acesse o Supabase Dashboard → Edge Functions</li>
            <li>Clique na função "teste-logging"</li>
            <li>Vá na aba "Logs" para ver os logs gerados</li>
            <li>Deve aparecer 8 logs diferentes (info, warn, error, etc.)</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}