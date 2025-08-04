import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RegraValidacao {
  campo: string;
  tipo: string;
  valor: any;
  arquivo_fonte: string;
  aplicada: boolean;
  total_registros: number;
  registros_aprovados: number;
  registros_rejeitados: number;
  ultima_aplicacao?: string;
}

interface ValidacaoMonitor {
  arquivo_fonte: string;
  total_regras: number;
  regras_aplicadas: number;
  registros_processados: number;
  registros_validos: number;
  registros_rejeitados: number;
  percentual_aprovacao: number;
  status: 'processando' | 'concluido' | 'erro';
  detalhes_erro?: string[];
}

export function MonitorValidacaoRegras() {
  const [monitores, setMonitores] = useState<ValidacaoMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const buscarStatusValidacoes = async () => {
    try {
      // Buscar logs de processamento recente
      const { data: logs, error: logsError } = await supabase
        .from('processamento_uploads')
        .select('*')
        .eq('tipo_dados', 'volumetria')
        .order('created_at', { ascending: false })
        .limit(10);

      if (logsError) throw logsError;

      const monitoresAtualizados: ValidacaoMonitor[] = [];

      for (const log of logs || []) {
        const detalhes = typeof log.detalhes_erro === 'string' 
          ? JSON.parse(log.detalhes_erro || '{}')
          : log.detalhes_erro || {};

        const monitor: ValidacaoMonitor = {
          arquivo_fonte: log.tipo_arquivo || 'Desconhecido',
          total_regras: getRegrasPeloArquivo(log.tipo_arquivo || ''),
          regras_aplicadas: log.registros_atualizados || 0,
          registros_processados: log.registros_processados || 0,
          registros_validos: log.registros_inseridos || 0,
          registros_rejeitados: log.registros_erro || 0,
          percentual_aprovacao: log.registros_processados > 0 
            ? Math.round((log.registros_inseridos / log.registros_processados) * 100)
            : 0,
          status: log.status === 'concluido' ? 'concluido' : 
                 log.status === 'erro' ? 'erro' : 'processando',
          detalhes_erro: detalhes.erros_validacao || []
        };

        monitoresAtualizados.push(monitor);
      }

      setMonitores(monitoresAtualizados);
    } catch (error) {
      console.error('Erro ao buscar status de validações:', error);
      toast.error('Erro ao carregar monitor de validações');
    } finally {
      setLoading(false);
    }
  };

  const getRegrasPeloArquivo = (arquivo: string): number => {
    const regrasMap: Record<string, number> = {
      'volumetria_padrao': 2,
      'volumetria_fora_padrao': 1,
      'volumetria_padrao_retroativo': 5,
      'volumetria_fora_padrao_retroativo': 6,
      'data_laudo': 2,
      'data_exame': 2,
      'volumetria_onco_padrao': 2 // Categoria + Busca De-Para/Quebra
    };
    return regrasMap[arquivo] || 0;
  };

  const testarValidacoes = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('validar-regras-processamento', {
        body: {
          registros: [{
            EMPRESA: 'TESTE',
            NOME_PACIENTE: 'PACIENTE TESTE',
            ESTUDO_DESCRICAO: 'EXAME TESTE',
            DATA_REALIZACAO: '2022-12-31', // Data anterior ao limite
            VALORES: 0
          }],
          arquivo_fonte: 'volumetria_padrao_retroativo'
        }
      });

      if (error) throw error;

      const resultado = data.resultados;
      toast.success(`Teste concluído: ${resultado.total_valido} válidos, ${resultado.total_rejeitado} rejeitados`);
      
      // Atualizar monitores após teste
      await buscarStatusValidacoes();
    } catch (error) {
      console.error('Erro no teste:', error);
      toast.error('Erro ao executar teste de validações');
    }
  };

  useEffect(() => {
    buscarStatusValidacoes();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(buscarStatusValidacoes, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'concluido': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'erro': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processando': return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (percentual: number) => {
    if (percentual >= 95) return 'bg-green-500';
    if (percentual >= 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Monitor de Validação de Regras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Monitor de Validação de Regras
        </CardTitle>
        <CardDescription>
          Acompanhamento em tempo real das validações automáticas aplicadas durante o processamento
        </CardDescription>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={testarValidacoes}
          >
            Testar Validações
          </Button>
          <Button 
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {monitores.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum processamento recente encontrado
          </div>
        ) : (
          monitores.map((monitor, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(monitor.status)}
                  <span className="font-medium">{monitor.arquivo_fonte}</span>
                  <Badge variant="outline">
                    {monitor.total_regras} regras
                  </Badge>
                </div>
                <Badge 
                  variant={monitor.percentual_aprovacao >= 95 ? "default" : "destructive"}
                >
                  {monitor.percentual_aprovacao}% aprovação
                </Badge>
              </div>

              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Processados</div>
                  <div className="font-medium">{monitor.registros_processados}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Válidos</div>
                  <div className="font-medium text-green-600">{monitor.registros_validos}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Rejeitados</div>
                  <div className="font-medium text-red-600">{monitor.registros_rejeitados}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Regras Aplicadas</div>
                  <div className="font-medium">{monitor.regras_aplicadas}</div>
                </div>
              </div>

              <Progress 
                value={monitor.percentual_aprovacao} 
                className="h-2"
              />

              {monitor.detalhes_erro && monitor.detalhes_erro.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-2">
                  <div className="text-sm font-medium text-red-800 mb-1">
                    Erros de Validação:
                  </div>
                  <ul className="text-xs text-red-700 space-y-1">
                    {monitor.detalhes_erro.slice(0, 3).map((erro, i) => (
                      <li key={i}>• {erro}</li>
                    ))}
                    {monitor.detalhes_erro.length > 3 && (
                      <li>• ... e mais {monitor.detalhes_erro.length - 3} erros</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}