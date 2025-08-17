import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function TesteQuebraExames() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const aplicarQuebraExames = async () => {
    setIsProcessing(true);
    try {
      console.log('🔧 Iniciando aplicação de regras de quebra...');
      
      const { data, error } = await supabase.functions.invoke('aplicar-regras-quebra-exames', {
        body: { arquivo_fonte: null } // null = processar todos
      });

      if (error) {
        throw error;
      }

      console.log('✅ Regras de quebra aplicadas:', data);
      setResult(data);
      
      toast({
        title: "Quebra de Exames Aplicada",
        description: `${data.registros_processados} registros processados, ${data.registros_quebrados} registros criados`,
      });
      
    } catch (error: any) {
      console.error('❌ Erro ao aplicar quebra:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao aplicar regras de quebra",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Teste Quebra de Exames</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={aplicarQuebraExames}
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? "Aplicando..." : "Aplicar Quebra de Exames"}
        </Button>
        
        {result && (
          <div className="text-sm space-y-2">
            <p><strong>Processados:</strong> {result.registros_processados}</p>
            <p><strong>Quebrados:</strong> {result.registros_quebrados}</p>
            <p><strong>Tipos:</strong> {result.tipos_exames_quebrados}</p>
            <p><strong>Erros:</strong> {result.erros}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}