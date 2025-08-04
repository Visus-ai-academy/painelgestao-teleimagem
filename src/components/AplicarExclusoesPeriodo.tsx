import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Calendar, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useVolumetria } from '@/contexts/VolumetriaContext';
import { toast } from 'sonner';

export function AplicarExclusoesPeriodo() {
  const [periodoReferencia, setPeriodoReferencia] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const { refreshData } = useVolumetria();

  const handleAplicarExclusoes = async () => {
    if (!periodoReferencia) {
      toast.error('Por favor, informe o período de referência');
      return;
    }

    setLoading(true);
    setResultado(null);

    try {
      console.log('🔧 Aplicando exclusões por período:', periodoReferencia);

      const { data, error } = await supabase.functions.invoke('aplicar-exclusoes-periodo', {
        body: { periodo_referencia: periodoReferencia }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        setResultado(data);
        toast.success(`Exclusões aplicadas! ${data.total_excluidos} registros removidos`);
        
        // Forçar atualização do painel de análise dos uploads
        await refreshData();
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('❌ Erro ao aplicar exclusões:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Aplicar Exclusões por Período
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Esta função aplica as regras de exclusão por período nos <strong>Arquivos 3 e 4</strong> já processados.
            Remove registros com DATA_REALIZACAO posterior ao período e DATA_LAUDO fora do período de faturamento.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="periodo">Período de Referência</Label>
          <Input
            id="periodo"
            placeholder="Ex: junho/2025 ou jun/25"
            value={periodoReferencia}
            onChange={(e) => setPeriodoReferencia(e.target.value)}
            disabled={loading}
          />
        </div>

        <Button 
          onClick={handleAplicarExclusoes} 
          disabled={loading || !periodoReferencia}
          className="w-full"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {loading ? 'Aplicando Exclusões...' : 'Aplicar Exclusões por Período'}
        </Button>

        {resultado && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Resultado das Exclusões</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <strong>Período:</strong> {resultado.periodo_referencia}
                </div>
                <div>
                  <strong>Total Excluído:</strong> {resultado.total_excluidos} registros
                </div>
                
                <div>
                  <strong>Datas Aplicadas:</strong>
                  <ul className="list-disc list-inside ml-4 mt-1 text-sm">
                    <li>Data limite DATA_REALIZACAO: {resultado.datas_aplicadas?.data_limite_realizacao}</li>
                    <li>Período DATA_LAUDO: {resultado.datas_aplicadas?.inicio_faturamento} a {resultado.datas_aplicadas?.fim_faturamento}</li>
                  </ul>
                </div>

                {resultado.detalhes && resultado.detalhes.length > 0 && (
                  <div>
                    <strong>Detalhes:</strong>
                    <ul className="list-disc list-inside ml-4 mt-1 text-sm">
                      {resultado.detalhes.map((detalhe: string, index: number) => (
                        <li key={index}>{detalhe}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}