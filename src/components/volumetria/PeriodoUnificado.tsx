import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Settings, Lock, AlertTriangle } from 'lucide-react';
import { usePeriodoIntegrityLock } from '@/hooks/usePeriodoIntegrityLock';
import { useToast } from '@/hooks/use-toast';

interface PeriodoUnificadoProps {
  onPeriodoSelected: (periodo: { ano: number; mes: number }) => void;
  periodoSelecionado: { ano: number; mes: number } | null;
}

export function PeriodoUnificado({ onPeriodoSelected, periodoSelecionado }: PeriodoUnificadoProps) {
  const [novoPeriodo, setNovoPeriodo] = useState<{ mes: string; ano: string }>({ mes: '', ano: '' });
  const { periodoAtivo, bloqueado, uploadsAtivos, loading, atualizarPeriodoAtivo } = usePeriodoIntegrityLock();
  const [updatingSystem, setUpdatingSystem] = useState(false);
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

  // Auto-selecionar o período ativo quando carregado
  useEffect(() => {
    if (periodoAtivo && !periodoSelecionado) {
      const [mes, ano] = periodoAtivo.split('/');
      const anoCompleto = 2000 + parseInt(ano);
      const mesIndex = meses.findIndex(m => m.value === mes) + 1;
      
      onPeriodoSelected({ ano: anoCompleto, mes: mesIndex });
    }
  }, [periodoAtivo, periodoSelecionado, onPeriodoSelected]);

  const atualizarSistema = async () => {
    if (!novoPeriodo.mes || !novoPeriodo.ano) {
      toast({
        title: "Erro", 
        description: "Selecione mês e ano",
        variant: "destructive"
      });
      return;
    }

    setUpdatingSystem(true);
    
    try {
      const novoPeriodoFormatado = `${novoPeriodo.mes}/${novoPeriodo.ano}`;
      await atualizarPeriodoAtivo(novoPeriodoFormatado);
      
      // Auto-aplicar o período também para a sessão atual
      const anoCompleto = 2000 + parseInt(novoPeriodo.ano);
      const mesIndex = meses.findIndex(m => m.value === novoPeriodo.mes) + 1;
      onPeriodoSelected({ ano: anoCompleto, mes: mesIndex });
      
      setNovoPeriodo({ mes: '', ano: '' });
      
      toast({
        title: "✅ Período atualizado!",
        description: `Sistema e sessão configurados para: ${novoPeriodoFormatado}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar o período",
        variant: "destructive"
      });
    } finally {
      setUpdatingSystem(false);
    }
  };

  const usarPeriodoAtivo = () => {
    if (periodoAtivo) {
      const [mes, ano] = periodoAtivo.split('/');
      const anoCompleto = 2000 + parseInt(ano);
      const mesIndex = meses.findIndex(m => m.value === mes) + 1;
      
      onPeriodoSelected({ ano: anoCompleto, mes: mesIndex });
      
      toast({
        title: "Período aplicado",
        description: `Usando período ativo: ${periodoAtivo}`,
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Carregando configurações...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const periodoFormatado = periodoSelecionado ? 
    `${meses[periodoSelecionado.mes - 1]?.label} ${periodoSelecionado.ano}` : 
    'Não selecionado';

  return (
    <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Calendar className="h-5 w-5" />
          Configuração de Período
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Status do Sistema */}
        <Alert className={bloqueado ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
          {bloqueado ? <Lock className="h-4 w-4 text-red-600" /> : <Settings className="h-4 w-4 text-green-600" />}
          <AlertDescription>
            <div className="flex justify-between items-center">
              <div>
                <strong>Sistema:</strong> {periodoAtivo || 'Não configurado'}
                {bloqueado && (
                  <div className="text-red-600 text-xs mt-1">
                    🔒 {uploadsAtivos} uploads em processamento - período bloqueado
                  </div>
                )}
              </div>
              {periodoAtivo && !bloqueado && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={usarPeriodoAtivo}
                  className="ml-2"
                >
                  Usar Este Período
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>

        {/* Período da Sessão Atual */}
        <Alert className="border-blue-200 bg-blue-50">
          <Calendar className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <strong>Sessão Atual:</strong> {periodoFormatado}
            <br />
            <span className="text-xs text-muted-foreground">
              Este período será usado para os uploads desta sessão
            </span>
          </AlertDescription>
        </Alert>

        {/* Configurar Novo Período */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-blue-900 mb-3">Alterar Período do Sistema</h4>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-blue-900">Mês</label>
              <Select 
                value={novoPeriodo.mes} 
                onValueChange={(mes) => setNovoPeriodo(prev => ({...prev, mes}))}
                disabled={bloqueado}
              >
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
              <label className="text-sm font-medium text-blue-900">Ano</label>
              <Select 
                value={novoPeriodo.ano} 
                onValueChange={(ano) => setNovoPeriodo(prev => ({...prev, ano}))}
                disabled={bloqueado}
              >
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
            onClick={atualizarSistema}
            disabled={updatingSystem || bloqueado || !novoPeriodo.mes || !novoPeriodo.ano}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {updatingSystem ? 'Atualizando Sistema...' : 
             bloqueado ? `Bloqueado (${uploadsAtivos} uploads ativos)` :
             'Atualizar Sistema + Aplicar na Sessão'}
          </Button>
          
          {bloqueado && (
            <p className="text-xs text-red-600 mt-2 text-center">
              Aguarde os uploads finalizarem para alterar o período
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}