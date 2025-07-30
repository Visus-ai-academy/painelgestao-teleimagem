import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Calendar, Upload, Lock } from 'lucide-react';
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

export function VolumetriaPeriodoSelector({ 
  onPeriodoSelected, 
  onClearPeriodo, 
  periodoSelecionado 
}: VolumetriaPeriodoSelectorProps) {
  const [ano, setAno] = useState<string>('');
  const [mes, setMes] = useState<string>('');

  const meses = [
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
  ];

  const anos = Array.from({ length: 6 }, (_, i) => {
    const year = new Date().getFullYear() - 2 + i;
    return { value: year.toString(), label: year.toString() };
  });

  const handleDefinirPeriodo = () => {
    if (ano && mes) {
      onPeriodoSelected({
        ano: parseInt(ano),
        mes: parseInt(mes)
      });
    }
  };

  const getDataLimite = (periodo: PeriodoFaturamento) => {
    // Período de faturamento: dia 8 do mês anterior até dia 7 do mês atual
    const anoLimite = periodo.mes === 1 ? periodo.ano - 1 : periodo.ano;
    const mesLimite = periodo.mes === 1 ? 12 : periodo.mes - 1;
    
    const dataInicio = `08/${mesLimite.toString().padStart(2, '0')}/${anoLimite}`;
    const dataFim = `07/${periodo.mes.toString().padStart(2, '0')}/${periodo.ano}`;
    
    return { dataInicio, dataFim };
  };

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-900">
          <Calendar className="h-5 w-5" />
          Definir Período de Faturamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!periodoSelecionado ? (
          <>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Obrigatório:</strong> Defina o período de faturamento antes de fazer uploads dos arquivos.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-orange-900">Mês</label>
                <Select value={mes} onValueChange={setMes}>
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
                <label className="text-sm font-medium text-orange-900">Ano</label>
                <Select value={ano} onValueChange={setAno}>
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
              onClick={handleDefinirPeriodo}
              disabled={!ano || !mes}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Definir Período e Habilitar Uploads
            </Button>
          </>
        ) : (
          <>
            <Alert className="border-green-200 bg-green-50">
              <Calendar className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Período definido:</strong> {meses.find(m => m.value === periodoSelecionado.mes.toString())?.label}/{periodoSelecionado.ano}
              </AlertDescription>
            </Alert>


            <Button 
              variant="outline" 
              onClick={onClearPeriodo}
              className="w-full"
            >
              Alterar Período
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}