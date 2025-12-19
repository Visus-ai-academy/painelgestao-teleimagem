import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Play, CheckCircle, AlertTriangle, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function CorrecaoRegrasV002V003() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const { toast } = useToast();

  const arquivosRetroativos = [
    { value: 'volumetria_padrao_retroativo', label: 'Volumetria Padrão Retroativo' },
    { value: 'volumetria_fora_padrao_retroativo', label: 'Volumetria Fora Padrão Retroativo' },
  ];

  const meses = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];

  const anos = ['2024', '2025', '2026'];

  const executarCorrecao = async () => {
    if (isExecuting) return;
    
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "Arquivo não selecionado",
        description: "Selecione o arquivo retroativo para aplicar as regras",
      });
      return;
    }

    if (!selectedMonth || !selectedYear) {
      toast({
        variant: "destructive",
        title: "Período não selecionado",
        description: "Selecione o mês e ano do período de faturamento",
      });
      return;
    }
    
    setIsExecuting(true);
    setResult(null);
    
    try {
      const periodoFormatado = `${selectedYear}-${selectedMonth}`;
      
      toast({
        title: "Iniciando Correção",
        description: `Aplicando regras v002/v003 para ${selectedFile} no período ${periodoFormatado}...`,
      });
      
      // Chamar edge function diretamente
      const { data, error } = await supabase.functions.invoke('aplicar-exclusoes-periodo', {
        body: {
          arquivo_fonte: selectedFile,
          periodo_referencia: periodoFormatado
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      setResult(data);
      
      if (data?.sucesso) {
        toast({
          title: "Correção Aplicada com Sucesso",
          description: `${data.registros_excluidos || 0} registros excluídos. ${data.registros_restantes || 0} registros restantes.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro na Correção",
          description: data?.erro || 'Erro desconhecido',
        });
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: "destructive",
        title: "Erro Crítico",
        description: errorMessage,
      });
      setResult({ sucesso: false, erro: errorMessage });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Aplicação Manual: Regras v002/v003
        </CardTitle>
        <CardDescription>
          Aplica as regras v002/v003 nos arquivos retroativos. <strong>ATENÇÃO:</strong> Esta ação exclui registros permanentemente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-orange-800">Regras que serão aplicadas:</p>
              <ul className="text-orange-700 mt-1 space-y-1">
                <li><strong>v003:</strong> Exclui registros com DATA_REALIZACAO maior ou igual ao primeiro dia do mês selecionado</li>
                <li><strong>v002:</strong> Exclui registros com DATA_LAUDO fora da janela (dia 8 do mês até dia 7 do mês seguinte)</li>
              </ul>
              <p className="text-red-600 mt-2 font-medium">
                ⚠️ Esta operação é IRREVERSÍVEL. Verifique o período antes de executar.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Arquivo Retroativo</label>
            <Select value={selectedFile} onValueChange={setSelectedFile}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o arquivo" />
              </SelectTrigger>
              <SelectContent>
                {arquivosRetroativos.map(arquivo => (
                  <SelectItem key={arquivo.value} value={arquivo.value}>
                    {arquivo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Mês de Faturamento</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {meses.map(mes => (
                  <SelectItem key={mes.value} value={mes.value}>
                    {mes.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Ano de Faturamento</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ano" />
              </SelectTrigger>
              <SelectContent>
                {anos.map(ano => (
                  <SelectItem key={ano} value={ano}>
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedFile && selectedMonth && selectedYear && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-800">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Configuração selecionada:</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              Arquivo: <strong>{arquivosRetroativos.find(a => a.value === selectedFile)?.label}</strong>
              <br />
              Período: <strong>{selectedYear}-{selectedMonth}</strong>
            </p>
          </div>
        )}

        <Button 
          onClick={executarCorrecao}
          disabled={isExecuting || !selectedFile || !selectedMonth || !selectedYear}
          className="w-full"
          size="lg"
          variant={selectedFile && selectedMonth && selectedYear ? "destructive" : "default"}
        >
          <Play className="h-4 w-4 mr-2" />
          {isExecuting ? "Executando..." : "Aplicar Regras v002/v003"}
        </Button>

        {result && (
          <Card className={result.sucesso ? "border-green-200" : "border-red-200"}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 text-sm ${result.sucesso ? "text-green-700" : "text-red-700"}`}>
                {result.sucesso ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Regras Aplicadas com Sucesso
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    Erro na Aplicação
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.sucesso ? (
                <div className="space-y-2 text-sm">
                  <p><strong>Arquivo:</strong> {result.arquivo_fonte}</p>
                  <p><strong>Período:</strong> {result.periodo_referencia}</p>
                  <p><strong>Registros iniciais:</strong> {result.registros_inicial}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-red-50 p-2 rounded">
                      <p className="text-red-700 font-medium">v003 excluídos:</p>
                      <p className="text-red-600">{result.detalhes?.v003_excluidos || 0}</p>
                    </div>
                    <div className="bg-red-50 p-2 rounded">
                      <p className="text-red-700 font-medium">v002 excluídos:</p>
                      <p className="text-red-600">{result.detalhes?.v002_excluidos || 0}</p>
                    </div>
                  </div>
                  <p className="mt-2"><strong>Total excluídos:</strong> <span className="text-red-600 font-bold">{result.registros_excluidos}</span></p>
                  <p><strong>Registros restantes:</strong> <span className="text-green-600 font-bold">{result.registros_restantes}</span></p>
                  {result.observacao && (
                    <p className="text-gray-600 text-xs mt-2">{result.observacao}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-red-600">{result.erro || 'Erro desconhecido'}</p>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
