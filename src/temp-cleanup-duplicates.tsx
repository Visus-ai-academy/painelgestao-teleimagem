import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export const TempCleanupDuplicates = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleCleanup = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('remover-duplicatas-precos');
      
      if (error) {
        throw error;
      }

      setResult(data);
      toast({
        title: "Limpeza concluída",
        description: `${data.duplicatas_removidas} duplicatas removidas`,
      });
    } catch (error: any) {
      console.error('Erro ao limpar duplicatas:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao limpar duplicatas",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Limpar Duplicatas de Preços</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleCleanup}
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? 'Processando...' : 'Remover Duplicatas'}
        </Button>
        
        {result && (
          <div className="mt-4 space-y-2 text-sm">
            <div><strong>Antes:</strong> {result.registros_antes}</div>
            <div><strong>Depois:</strong> {result.registros_depois}</div>
            <div><strong>Removidos:</strong> {result.duplicatas_removidas}</div>
            <div><strong>Preços positivos:</strong> {result.precos_positivos}</div>
            <div><strong>Preços zero:</strong> {result.precos_zero}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};