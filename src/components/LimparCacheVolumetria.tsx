import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const LimparCacheVolumetria = () => {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const handleLimparCache = async () => {
    try {
      setLoading(true);
      setResultado(null);
      
      console.log('🧹 Iniciando limpeza de cache...');
      
      const { data, error } = await supabase.functions.invoke('limpar-cache-volumetria');
      
      if (error) {
        console.error('❌ Erro ao limpar cache:', error);
        toast.error('Erro ao limpar cache', {
          description: error.message
        });
        return;
      }
      
      console.log('✅ Cache limpo com sucesso:', data);
      setResultado(data);
      
      toast.success('Cache limpo com sucesso!', {
        description: `${data?.total_limpo || 0} registros removidos`
      });
      
    } catch (error) {
      console.error('💥 Erro inesperado:', error);
      toast.error('Erro inesperado ao limpar cache');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Trash2 className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <CardTitle className="text-orange-900">
              Limpar Cache de Volumetria
            </CardTitle>
            <CardDescription className="text-orange-700">
              Remove dados temporários e cache do sistema de volumetria e relatório de exclusões
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="bg-orange-100/50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-orange-800">
              <p className="font-medium mb-2">Esta operação irá limpar:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Registros rejeitados antigos (histórico de exclusões)</li>
                <li>Dados de staging processados</li>
                <li>Contadores de erro em uploads</li>
                <li>Logs de auditoria antigos de volumetria</li>
              </ul>
              <p className="mt-2 text-xs opacity-75">
                Apenas dados temporários e cache serão removidos. Os dados principais de volumetria não serão afetados.
              </p>
            </div>
          </div>
        </div>

        {resultado && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-green-800">
                <p className="font-medium mb-2">Limpeza concluída!</p>
                <p className="mb-2">Total de registros removidos: <strong>{resultado.total_limpo}</strong></p>
                
                {resultado.detalhes && resultado.detalhes.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium mb-1">Detalhes:</p>
                    <ul className="space-y-1">
                      {resultado.detalhes.map((detalhe: string, index: number) => (
                        <li key={index} className="text-xs">• {detalhe}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <p className="mt-2 text-xs opacity-75">
                  Processado em: {new Date(resultado.timestamp).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button 
            onClick={handleLimparCache}
            disabled={loading}
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-100 hover:text-orange-800"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {loading ? "Limpando cache..." : "🧹 Limpar Cache"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};