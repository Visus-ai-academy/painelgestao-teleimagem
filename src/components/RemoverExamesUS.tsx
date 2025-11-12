import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function RemoverExamesUS() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();

  const handleRemover = async () => {
    setIsProcessing(true);
    setResultado(null);

    try {
      console.log('🗑️ Invocando função de remoção de exames US...');
      
      const { data, error } = await supabase.functions.invoke('remover-exames-us', {
        body: {}
      });

      if (error) {
        throw error;
      }

      console.log('✅ Resultado da remoção:', data);
      setResultado(data);

      toast({
        title: "Remoção concluída!",
        description: data.mensagem,
      });

    } catch (error: any) {
      console.error('❌ Erro ao remover exames US:', error);
      toast({
        title: "Erro ao remover exames",
        description: error.message,
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
          <Trash2 className="h-5 w-5" />
          Remover Exames com Modalidade US
        </CardTitle>
        <CardDescription>
          Remove todos os exames existentes com modalidade US da base de dados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Esta ação irá remover permanentemente todos os registros com modalidade "US" da tabela volumetria_mobilemed.
          </AlertDescription>
        </Alert>

        <Button
          onClick={handleRemover}
          disabled={isProcessing}
          variant="destructive"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Removendo...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Remover Exames US
            </>
          )}
        </Button>

        {resultado && resultado.sucesso && (
          <Alert className="border-green-500">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">{resultado.mensagem}</p>
                <p className="text-sm text-muted-foreground">
                  Total de exames removidos: {resultado.total_removidos}
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
