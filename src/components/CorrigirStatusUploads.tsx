import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { RefreshCw, CheckCircle } from "lucide-react";

export function CorrigirStatusUploads() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleCorrigirStatus = async () => {
    setIsProcessing(true);
    
    try {
      console.log('🔧 Iniciando correção de status dos uploads...');
      
      const { data, error } = await supabase.functions.invoke('corrigir-status-uploads');
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Resultado da correção:', data);
      
      toast({
        title: "Status Corrigido",
        description: `${data.uploads_corrigidos || 0} uploads tiveram o status corrigido de "erro" para "concluído".`,
      });
      
    } catch (error) {
      console.error('❌ Erro ao corrigir status:', error);
      toast({
        title: "Erro na Correção",
        description: "Não foi possível corrigir o status dos uploads. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Correção de Status dos Uploads
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Esta função corrige uploads que foram processados com sucesso mas foram marcados incorretamente como "erro" 
          devido a timeout no processo de finalização.
        </div>
        
        <Button 
          onClick={handleCorrigirStatus}
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Corrigindo Status...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Corrigir Status dos Uploads
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}