import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useVolumetria } from "@/contexts/VolumetriaContext";

export default function LimparDadosCompleto() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { data, clearData } = useVolumetria();

  const totalRegistros = Object.values(data.stats).reduce((sum, stat) => sum + stat.totalRecords, 0);

  const limparDadosCentralizado = async () => {
    setIsLoading(true);
    try {
      await clearData();
      
      toast({
        title: "Limpeza completa realizada!",
        description: "Todos os dados duplicados foram removidos da base",
      });
      
    } catch (error) {
      console.error('Erro na limpeza:', error);
      toast({
        title: "Erro na limpeza",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Limpeza Completa de Dados de Volumetria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Dados atualmente na base: <strong>{totalRegistros} registros</strong></p>
          
          <Button 
            onClick={limparDadosCentralizado}
            disabled={isLoading}
            className="w-full"
            variant="destructive"
          >
            {isLoading ? "Limpando..." : "Limpar Todos os Dados de Volumetria"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}