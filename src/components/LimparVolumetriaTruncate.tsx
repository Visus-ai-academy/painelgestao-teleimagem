import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useVolumetria } from "@/contexts/VolumetriaContext";

export function LimparVolumetriaTruncate() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();
  const { refreshData } = useVolumetria();

  const handleLimparVolumetria = async () => {
    if (!confirm('⚠️ ATENÇÃO: Esta ação irá apagar TODOS os dados de volumetria permanentemente. Deseja continuar?')) {
      return;
    }

    if (!confirm('🚨 CONFIRMAÇÃO FINAL: Todos os dados de volumetria serão perdidos. Tem certeza?')) {
      return;
    }

    setLoading(true);
    setResultado(null);

    try {
      console.log('🚀 Iniciando limpeza com TRUNCATE...');
      
      // Usar a função TRUNCATE que é muito mais eficiente
      const { error: truncateError } = await supabase.rpc('truncate_volumetria_table');

      if (truncateError) {
        console.error('❌ Erro no TRUNCATE:', truncateError);
        throw new Error(`Erro na limpeza: ${truncateError.message}`);
      }

      console.log('✅ TRUNCATE concluído com sucesso!');

      // Limpar tabelas relacionadas
      console.log('🧹 Limpando tabelas relacionadas...');
      
      const tiposArquivo = [
        'volumetria_padrao',
        'volumetria_fora_padrao', 
        'volumetria_padrao_retroativo',
        'volumetria_fora_padrao_retroativo',
        'volumetria_onco_padrao'
      ];

      // Limpar processamento_uploads
      const { error: uploadsError } = await supabase
        .from('processamento_uploads')
        .delete()
        .in('tipo_arquivo', tiposArquivo);

      if (uploadsError) {
        console.warn('⚠️ Erro ao limpar uploads:', uploadsError);
      }

      // ❗ REMOVIDO: Não devemos limpar valores_referencia_de_para
      // Esta tabela contém dados do cadastro base (aba "Fora Padrão")
      // que são configurações permanentes e não dados temporários de volumetria

      // Limpar registros_rejeitados_processamento
      const { error: rejeitadosError } = await supabase
        .from('registros_rejeitados_processamento')
        .delete()
        .in('arquivo_fonte', tiposArquivo);

      if (rejeitadosError) {
        console.warn('⚠️ Erro ao limpar rejeitados:', rejeitadosError);
      }

      // Atualizar view materializada
      console.log('🔄 Atualizando view materializada...');
      const { error: refreshError } = await supabase.rpc('refresh_volumetria_dashboard');
      
      if (refreshError) {
        console.error('⚠️ Erro ao atualizar view:', refreshError);
      }

      setResultado({
        success: true,
        message: 'Limpeza concluída com sucesso usando TRUNCATE TABLE!',
        timestamp: new Date().toISOString()
      });

      toast({
        title: "Limpeza Concluída",
        description: "Todos os dados de volumetria foram removidos com sucesso.",
        duration: 5000
      });

      // Forçar refresh dos dados do contexto
      await refreshData();

    } catch (error) {
      console.error('❌ Erro na limpeza:', error);
      setResultado({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });

      toast({
        title: "Erro na Limpeza",
        description: error instanceof Error ? error.message : "Erro desconhecido na limpeza",
        variant: "destructive",
        duration: 8000
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <CardTitle className="text-red-700 dark:text-red-300">
            Limpeza Definitiva - Volumetria (TRUNCATE)
          </CardTitle>
        </div>
        <CardDescription>
          Remove TODOS os dados de volumetria usando TRUNCATE TABLE (ultra-rápido). 
          Esta operação é irreversível e muito mais eficiente que DELETE.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-red-100 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-700 dark:text-red-300">
              <div className="font-semibold mb-1">⚠️ ATENÇÃO - Operação Irreversível</div>
              <ul className="list-disc list-inside space-y-1">
                <li>Remove TODOS os dados da tabela volumetria_mobilemed</li>
                <li>Limpa histórico de processamento e uploads de volumetria</li>
                <li>Usa TRUNCATE TABLE para máxima eficiência</li>
                <li>⚠️ PRESERVA dados do Cadastro Base (templates/configurações)</li>
                <li>Não há como recuperar os dados de volumetria após esta operação</li>
              </ul>
            </div>
          </div>
        </div>

        {resultado && (
          <div className={`p-4 rounded-lg ${
            resultado.success 
              ? 'bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
              : 'bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <div className={`text-sm ${
              resultado.success 
                ? 'text-green-700 dark:text-green-300' 
                : 'text-red-700 dark:text-red-300'
            }`}>
              <div className="font-semibold">
                {resultado.success ? '✅ Sucesso' : '❌ Erro'}
              </div>
              <div className="mt-1">
                {resultado.message || resultado.error}
              </div>
              {resultado.timestamp && (
                <div className="text-xs mt-1 opacity-75">
                  {new Date(resultado.timestamp).toLocaleString('pt-BR')}
                </div>
              )}
            </div>
          </div>
        )}

        <Button
          onClick={handleLimparVolumetria}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 text-white"
          size="lg"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {loading ? '🔄 Limpando...' : '🗑️ Limpar TODOS os Dados (TRUNCATE)'}
        </Button>
      </CardContent>
    </Card>
  );
}