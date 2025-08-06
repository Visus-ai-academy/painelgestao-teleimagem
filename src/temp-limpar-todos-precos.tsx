
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function TempLimparTodosPrecos() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleLimpezaCompleta = async () => {
    if (!confirm("⚠️ ATENÇÃO: Esta ação irá remover TODOS os registros de preços da base de dados. Esta operação é IRREVERSÍVEL. Deseja continuar?")) {
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      console.log('🧹 Iniciando limpeza completa de todos os preços...');
      
      const { data, error } = await supabase.functions.invoke('limpar-todos-precos');

      if (error) {
        throw error;
      }

      setResult(data);
      
      toast({
        title: "✅ Limpeza completa realizada!",
        description: `Todos os ${data.total_removido} registros de preços foram removidos`,
      });

    } catch (error) {
      console.error('Erro na limpeza completa:', error);
      toast({
        title: "❌ Erro na limpeza",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-destructive">🗑️ Limpar TODOS os Preços</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          ⚠️ <strong>ATENÇÃO:</strong> Esta ação irá remover TODOS os registros de preços da base de dados.
          Esta operação é <strong>irreversível</strong>.
        </p>
        
        <Button 
          onClick={handleLimpezaCompleta}
          disabled={isProcessing}
          variant="destructive"
          className="w-full"
        >
          {isProcessing ? "Limpando..." : "🗑️ LIMPAR TODOS OS PREÇOS"}
        </Button>

        {result && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">📊 Resultado da Limpeza:</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Registros antes: <strong>{result.registros_antes}</strong></div>
              <div>Registros depois: <strong>{result.registros_depois}</strong></div>
              <div className="col-span-2">Total removido: <strong className="text-destructive">{result.total_removido}</strong></div>
            </div>
            <p className="text-green-600 font-medium mt-2">{result.mensagem}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
