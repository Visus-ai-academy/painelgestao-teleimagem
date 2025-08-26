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
      console.log('🧹 Iniciando limpeza completa de volumetria...');
      
      // Mostrar toast de progresso
      toast({
        title: "Limpando dados...",
        description: "Aguarde, isso pode levar alguns minutos para bases grandes",
      });
      
      await clearData();
      
      // Recarregar total de registros após limpeza
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
      toast({
        title: "Limpeza completa realizada!",
        description: "Todos os dados de volumetria foram removidos da base",
      });
      
    } catch (error) {
      console.error('Erro na limpeza:', error);
      
      // Melhor tratamento de erro
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      const isTimeoutError = errorMessage.includes('timeout') || errorMessage.includes('statement timeout');
      const isConnectionError = errorMessage.includes('non-2xx status');
      
      let userMessage = errorMessage;
      if (isTimeoutError) {
        userMessage = "A limpeza demorou mais que o esperado devido ao volume de dados. Tente novamente ou contate o suporte.";
      } else if (isConnectionError) {
        userMessage = "Problema de conexão durante a limpeza. Verifique sua internet e tente novamente.";
      }
      
      toast({
        title: "Erro na limpeza",
        description: userMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const limparDadosFaturamento = async () => {
    setIsLoadingFaturamento(true);
    try {
      console.log('🧹 Limpando TODOS os dados de faturamento diretamente...');
      
      // Usar DELETE direto no Supabase ao invés da edge function
      const { error: deleteError, count } = await supabase
        .from('faturamento')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000'); // Remove todos os registros

      if (deleteError) {
        console.error('Erro ao limpar faturamento:', deleteError);
        throw deleteError;
      }

      console.log(`✅ ${count || 0} registros de faturamento removidos`);
      
      // Verificar se realmente limpou
      const { count: verificacao, error: errVerif } = await supabase
        .from('faturamento')
        .select('*', { count: 'exact', head: true });
      
      console.log(`📊 Verificação: ${verificacao || 0} registros restantes na tabela`);
      
      setTotalFaturamento(0);
      
      toast({
        title: "Faturamento limpo!",
        description: `${count || 0} registros de faturamento foram removidos`,
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
              disabled={isLoading || totalRegistros === 0}
              className="w-full"
              variant="destructive"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Limpando... (pode demorar alguns minutos)
                </>
              ) : totalRegistros === 0 ? (
                "Base já está limpa"
              ) : (
                `Limpar Todos os Dados de Volumetria (${totalRegistros.toLocaleString()} registros)`
              )}
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