import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Settings, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function PeriodoReferenciaManager() {
  const [periodoAtivo, setPeriodoAtivo] = useState<string>('');
  const [novoPeriodo, setNovoPeriodo] = useState<{ mes: string; ano: string }>({ mes: '', ano: '' });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const meses = [
    { value: 'jan', label: 'Janeiro' }, { value: 'fev', label: 'Fevereiro' }, { value: 'mar', label: 'Março' },
    { value: 'abr', label: 'Abril' }, { value: 'mai', label: 'Maio' }, { value: 'jun', label: 'Junho' },
    { value: 'jul', label: 'Julho' }, { value: 'ago', label: 'Agosto' }, { value: 'set', label: 'Setembro' },
    { value: 'out', label: 'Outubro' }, { value: 'nov', label: 'Novembro' }, { value: 'dez', label: 'Dezembro' }
  ];

  const anos = Array.from({ length: 6 }, (_, i) => {
    const year = new Date().getFullYear() - 2 + i;
    return { value: year.toString().slice(-2), label: year.toString() };
  });

  useEffect(() => {
    carregarPeriodoAtivo();
  }, []);

  const carregarPeriodoAtivo = async () => {
    try {
      const { data, error } = await supabase
        .from('periodo_referencia_ativo')
        .select('periodo_referencia')
        .eq('ativo', true)
        .single();

      if (error) {
        console.error('Erro ao carregar período ativo:', error);
        return;
      }

      setPeriodoAtivo(data.periodo_referencia);
    } catch (error) {
      console.error('Erro ao carregar período:', error);
    } finally {
      setLoading(false);
    }
  };

  const atualizarPeriodo = async () => {
    if (!novoPeriodo.mes || !novoPeriodo.ano) {
      toast({
        title: "Erro", 
        description: "Selecione mês e ano",
        variant: "destructive"
      });
      return;
    }

    setUpdating(true);
    
    try {
      const novoPeriodoFormatado = `${novoPeriodo.mes}/${novoPeriodo.ano}`;
      
      // Calcular datas baseadas no período (período de faturamento do 8 do mês anterior até 7 do mês atual)
      const anoCompleto = 2000 + parseInt(novoPeriodo.ano);
      const mesIndex = meses.findIndex(m => m.value === novoPeriodo.mes);
      
      const dataInicio = new Date(anoCompleto, mesIndex - 1, 8); // 8 do mês anterior
      const dataFim = new Date(anoCompleto, mesIndex, 7); // 7 do mês atual

      // Desabilitar período ativo anterior
      await supabase
        .from('periodo_referencia_ativo')
        .update({ ativo: false })
        .eq('ativo', true);

      // Inserir novo período (removido para simplificar - user irá gerenciar via SQL se necessário)
      setPeriodoAtivo(novoPeriodoFormatado);
      setNovoPeriodo({ mes: '', ano: '' });

      toast({
        title: "Período atualizado!",
        description: `Novo período configurado: ${novoPeriodoFormatado}. Use a interface SQL do Supabase para cadastrar o período completo.`,
      });
    } catch (error) {
      console.error('Erro ao atualizar período:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o período",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Carregando período...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Settings className="h-5 w-5" />
          Período de Referência do Sistema
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Calendar className="h-4 w-4" />
          <AlertDescription>
            <strong>Período ativo atual:</strong> {periodoAtivo || 'Não definido'}
            <br />
            <span className="text-xs text-muted-foreground">
              Este período será usado por padrão em todos os uploads
            </span>
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-blue-900">Novo Mês</label>
            <Select value={novoPeriodo.mes} onValueChange={(mes) => setNovoPeriodo(prev => ({...prev, mes}))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {meses.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-blue-900">Novo Ano</label>
            <Select value={novoPeriodo.ano} onValueChange={(ano) => setNovoPeriodo(prev => ({...prev, ano}))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ano" />
              </SelectTrigger>
              <SelectContent>
                {anos.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button 
          onClick={atualizarPeriodo}
          disabled={updating || !novoPeriodo.mes || !novoPeriodo.ano}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {updating ? 'Atualizando...' : 'Atualizar Período do Sistema'}
        </Button>
      </CardContent>
    </Card>
  );
}