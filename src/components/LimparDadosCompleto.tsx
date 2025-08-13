import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useVolumetria } from "@/contexts/VolumetriaContext";
import { supabase } from "@/integrations/supabase/client";
import { Separator } from "@/components/ui/separator";

export default function LimparDadosCompleto() {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFaturamento, setIsLoadingFaturamento] = useState(false);
  const [totalFaturamento, setTotalFaturamento] = useState(0);
  const { toast } = useToast();
  const { data, clearData } = useVolumetria();

  const totalRegistros = Object.values(data.stats).reduce((sum, stat) => sum + stat.totalRecords, 0);

  // Carregar quantidade de registros de faturamento
  useEffect(() => {
    const carregarTotalFaturamento = async () => {
      try {
        const { count, error } = await supabase
          .from('faturamento')
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          setTotalFaturamento(count || 0);
        }
      } catch (error) {
        console.error('Erro ao carregar total de faturamento:', error);
      }
    };

    carregarTotalFaturamento();
  }, []);

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

  const limparDadosFaturamento = async () => {
    setIsLoadingFaturamento(true);
    try {
      console.log('🧹 Limpando TODOS os dados de faturamento...');
      
      const { data: limparData, error: limparError } = await supabase.functions.invoke('limpar-faturamento-periodo', {
        body: { periodo_referencia: 'all' } // Sinal para limpar tudo
      });

      if (limparError || !limparData?.success) {
        throw new Error(limparError?.message || limparData?.error || 'Erro ao limpar faturamento');
      }

      setTotalFaturamento(0);
      
      toast({
        title: "Faturamento limpo!",
        description: `${limparData.registros_removidos || 0} registros de faturamento foram removidos`,
      });
      
    } catch (error) {
      console.error('Erro na limpeza de faturamento:', error);
      toast({
        title: "Erro na limpeza",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoadingFaturamento(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Limpeza de Dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Limpeza de Volumetria */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Dados de Volumetria</h3>
            <p>Dados atualmente na base: <strong>{totalRegistros} registros</strong></p>
            
            <Button 
              onClick={limparDadosCentralizado}
              disabled={isLoading}
              className="w-full"
              variant="destructive"
            >
              {isLoading ? "Limpando..." : "Limpar Todos os Dados de Volumetria"}
            </Button>
          </div>

          <Separator />

          {/* Limpeza de Faturamento */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Dados de Faturamento</h3>
            <p>Dados atualmente na base: <strong>{totalFaturamento} registros</strong></p>
            
            <Button 
              onClick={limparDadosFaturamento}
              disabled={isLoadingFaturamento}
              className="w-full"
              variant="destructive"
            >
              {isLoadingFaturamento ? "Limpando..." : "Limpar Todos os Dados de Faturamento"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}