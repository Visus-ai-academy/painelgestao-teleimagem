import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Calendar, Upload, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PeriodoFaturamento {
  ano: number;
  mes: number;
}

interface VolumetriaPeriodoSelectorProps {
  onPeriodoSelected: (periodo: PeriodoFaturamento) => void;
  onClearPeriodo: () => void;
  periodoSelecionado: PeriodoFaturamento | null;
}

const MESES = [
  { value: '1', label: 'Janeiro', abrev: 'jan' },
  { value: '2', label: 'Fevereiro', abrev: 'fev' },
  { value: '3', label: 'Março', abrev: 'mar' },
  { value: '4', label: 'Abril', abrev: 'abr' },
  { value: '5', label: 'Maio', abrev: 'mai' },
  { value: '6', label: 'Junho', abrev: 'jun' },
  { value: '7', label: 'Julho', abrev: 'jul' },
  { value: '8', label: 'Agosto', abrev: 'ago' },
  { value: '9', label: 'Setembro', abrev: 'set' },
  { value: '10', label: 'Outubro', abrev: 'out' },
  { value: '11', label: 'Novembro', abrev: 'nov' },
  { value: '12', label: 'Dezembro', abrev: 'dez' }
];

export function VolumetriaPeriodoSelector({ 
  onPeriodoSelected, 
  onClearPeriodo, 
  periodoSelecionado 
}: VolumetriaPeriodoSelectorProps) {
  // Inicializar com o período já selecionado (se existir)
  const [ano, setAno] = useState<string>(periodoSelecionado?.ano?.toString() || '');
  const [mes, setMes] = useState<string>(periodoSelecionado?.mes?.toString() || '');
  const [modoEdicao, setModoEdicao] = useState(false);

  // Atualizar estados internos quando o período selecionado mudar
  useEffect(() => {
    if (periodoSelecionado) {
      setAno(periodoSelecionado.ano.toString());
      setMes(periodoSelecionado.mes.toString());
    }
  }, [periodoSelecionado]);

  const anos = Array.from({ length: 6 }, (_, i) => {
    const year = new Date().getFullYear() - 2 + i;
    return { value: year.toString(), label: year.toString() };
  });

  const handleDefinirPeriodo = () => {
    if (ano && mes) {
      const novoPeriodo = {
        ano: parseInt(ano),
        mes: parseInt(mes)
      };
      console.log('🗓️ PERÍODO DEFINIDO PELO USUÁRIO:', novoPeriodo);
      console.log(`📅 Formato DB: ${novoPeriodo.ano}-${novoPeriodo.mes.toString().padStart(2, '0')}`);
      onPeriodoSelected(novoPeriodo);
      setModoEdicao(false);
    }
  };

  const handleAlterarPeriodo = () => {
    // Manter os valores atuais nos selects ao entrar em modo de edição
    if (periodoSelecionado) {
      setAno(periodoSelecionado.ano.toString());
      setMes(periodoSelecionado.mes.toString());
    }
    setModoEdicao(true);
  };

  const handleCancelarEdicao = () => {
    // Restaurar valores do período selecionado
    if (periodoSelecionado) {
      setAno(periodoSelecionado.ano.toString());
      setMes(periodoSelecionado.mes.toString());
    }
    setModoEdicao(false);
  };

  const mesLabel = mes ? MESES.find(m => m.value === mes)?.label : '';
  const periodoFormatado = periodoSelecionado 
    ? `${MESES.find(m => m.value === periodoSelecionado.mes.toString())?.label}/${periodoSelecionado.ano}`
    : '';
  const periodoDb = periodoSelecionado 
    ? `${periodoSelecionado.ano}-${periodoSelecionado.mes.toString().padStart(2, '0')}`
    : '';

  // Modo de seleção (sem período definido ou em edição)
  if (!periodoSelecionado || modoEdicao) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <Calendar className="h-5 w-5" />
            {modoEdicao ? 'Alterar Período de Faturamento' : 'Definir Período de Faturamento'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Atenção:</strong> O período selecionado será usado para TODOS os uploads. 
              Verifique se corresponde ao período dos seus arquivos.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-orange-900">Mês</label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-orange-900">Ano</label>
              <Select value={ano} onValueChange={setAno}>
                <SelectTrigger className="bg-white">
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

          {/* Preview do período selecionado */}
          {ano && mes && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Período que será usado:</strong> {mesLabel}/{ano}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Formato interno: {ano}-{mes.padStart(2, '0')}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={handleDefinirPeriodo}
              disabled={!ano || !mes}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              {modoEdicao ? 'Confirmar Alteração' : 'Definir Período e Habilitar Uploads'}
            </Button>
            
            {modoEdicao && (
              <Button 
                variant="outline" 
                onClick={handleCancelarEdicao}
              >
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Modo de exibição (período já definido)
  return (
    <Card className="border-green-300 bg-green-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-green-800">
          <CheckCircle className="h-5 w-5" />
          Período de Faturamento Ativo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-white border-2 border-green-400 rounded-lg">
          <div className="text-center">
            <p className="text-3xl font-bold text-green-700">{periodoFormatado}</p>
            <p className="text-sm text-green-600 mt-1">
              Todos os uploads usarão este período
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Formato DB: {periodoDb}
            </p>
          </div>
        </div>

        <Button 
          variant="outline" 
          onClick={handleAlterarPeriodo}
          className="w-full border-green-400 text-green-700 hover:bg-green-100"
        >
          <Calendar className="w-4 h-4 mr-2" />
          Alterar Período
        </Button>
      </CardContent>
    </Card>
  );
}