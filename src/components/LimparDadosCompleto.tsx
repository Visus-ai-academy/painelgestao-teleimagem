import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function LimparDadosCompleto() {
  const [isLoading, setIsLoading] = useState(false);
  const [dadosAtuais, setDadosAtuais] = useState<any[]>([]);
  const { toast } = useToast();

  const verificarDados = async () => {
    try {
      const { data, error } = await supabase
        .from('volumetria_mobilemed')
        .select('arquivo_fonte, id')
        .in('arquivo_fonte', [
          'volumetria_padrao',
          'volumetria_fora_padrao', 
          'volumetria_padrao_retroativo',
          'volumetria_fora_padrao_retroativo',
          'volumetria_onco_padrao'
        ]);

      if (!error && data) {
        setDadosAtuais(data);
        console.log('Dados encontrados:', data.length);
      }
    } catch (error) {
      console.error('Erro ao verificar dados:', error);
    }
  };

  const limparDiretamente = async () => {
    setIsLoading(true);
    try {
      console.log('Limpando todos os dados de volumetria...');
      
      // Limpar TODOS os dados de volumetria_mobilemed (sem filtro de arquivo_fonte)
      const { error: volumetriaError } = await supabase
        .from('volumetria_mobilemed')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletar todos
        
      if (volumetriaError) {
        throw new Error(`Erro ao limpar volumetria: ${volumetriaError.message}`);
      }

      // Limpar TODOS os status de processamento de volumetria
      const { error: statusError } = await supabase
        .from('processamento_uploads')
        .delete()
        .in('tipo_arquivo', [
          'volumetria_padrao',
          'volumetria_fora_padrao', 
          'volumetria_padrao_retroativo',
          'volumetria_fora_padrao_retroativo',
          'volumetria_onco_padrao',
          'data_laudo',
          'data_exame'
        ]);

      if (statusError) {
        console.warn('Aviso ao limpar status:', statusError.message);
      }

      // Limpar também import_history
      const { error: importError } = await supabase
        .from('import_history')
        .delete()
        .in('file_type', [
          'volumetria_padrao',
          'volumetria_fora_padrao', 
          'volumetria_padrao_retroativo',
          'volumetria_fora_padrao_retroativo',
          'volumetria_onco_padrao'
        ]);

      if (importError) {
        console.warn('Aviso ao limpar import history:', importError.message);
      }

      toast({
        title: "Limpeza completa realizada!",
        description: "Todos os dados duplicados foram removidos da base",
      });

      // Forçar atualização da página para limpar todos os caches
      window.location.reload();
      
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

  useEffect(() => {
    verificarDados();
  }, []);

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Limpeza Completa de Dados de Volumetria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Dados atualmente na base: <strong>{dadosAtuais.length} registros</strong></p>
          
          <Button 
            onClick={limparDiretamente} 
            disabled={isLoading}
            className="w-full"
            variant="destructive"
          >
            {isLoading ? "Limpando..." : "Limpar Todos os Dados de Volumetria"}
          </Button>

          <Button 
            onClick={verificarDados} 
            variant="outline"
            className="w-full"
          >
            Verificar Dados Atuais
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}