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
      console.log('Limpando dados diretamente...');
      
      // Limpar volumetria_mobilemed
      const { error: volumetriaError } = await supabase
        .from('volumetria_mobilemed')
        .delete()
        .in('arquivo_fonte', [
          'volumetria_padrao',
          'volumetria_fora_padrao', 
          'volumetria_padrao_retroativo',
          'volumetria_fora_padrao_retroativo',
          'volumetria_onco_padrao'
        ]);

      if (volumetriaError) {
        throw new Error(`Erro ao limpar volumetria: ${volumetriaError.message}`);
      }

      // Limpar processamento_uploads
      const { error: statusError } = await supabase
        .from('processamento_uploads')
        .delete()
        .in('tipo_arquivo', [
          'volumetria_padrao',
          'volumetria_fora_padrao', 
          'volumetria_padrao_retroativo',
          'volumetria_fora_padrao_retroativo',
          'volumetria_onco_padrao'
        ]);

      if (statusError) {
        console.warn('Aviso ao limpar status:', statusError.message);
      }

      toast({
        title: "Limpeza completa realizada!",
        description: "Todos os dados e status de volumetria foram removidos",
      });

      // Verificar novamente
      await verificarDados();
      
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