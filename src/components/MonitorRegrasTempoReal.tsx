import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, XCircle, Loader2, Settings, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RegraStatus {
  id: string;
  nome: string;
  aplicada: boolean;
  timestamp: string | null;
  registros_afetados?: number;
  em_execucao: boolean;
}

interface MonitorRegrasTempoRealProps {
  loteUpload: string;
  arquivoFonte: string;
  isProcessing: boolean;
  onRegrasCompletas?: (totalRegras: number, regrasAplicadas: number) => void;
}

// Lista das regras esperadas por tipo de arquivo
const REGRAS_POR_ARQUIVO = {
  'volumetria_padrao': [
    { id: 'v001', nome: 'Proteção Temporal de Dados' },
    { id: 'v031', nome: 'Filtro de Período Atual' },
    { id: 'v032', nome: 'Exclusão Clientes Específicos' },
    { id: 'v030', nome: 'Correção Modalidade RX' },
    { id: 'v033', nome: 'Substituição Especialidade/Categoria' },
    { id: 'v034', nome: 'Colunas→Músculo/Neuro' },
    { id: 'v035', nome: 'Mapeamento Nome Cliente' },
    { id: 'v026', nome: 'De-Para Valores' },
    { id: 'v027', nome: 'Quebra de Exames' },
    { id: 'v021', nome: 'Validação Cliente' },
    { id: 'f005', nome: 'Tipificação Faturamento NC' },
    { id: 'f006', nome: 'Tipificação Faturamento Adicional' }
  ],
  'volumetria_fora_padrao': [
    { id: 'v001', nome: 'Proteção Temporal de Dados' },
    { id: 'v031', nome: 'Filtro de Período Atual' },
    { id: 'v032', nome: 'Exclusão Clientes Específicos' },
    { id: 'v030', nome: 'Correção Modalidade RX' },
    { id: 'v035', nome: 'Mapeamento Nome Cliente' },
    { id: 'v021', nome: 'Validação Cliente' },
    { id: 'f005', nome: 'Tipificação Faturamento NC' }
  ],
  'volumetria_padrao_retroativo': [
    { id: 'v001', nome: 'Proteção Temporal de Dados' },
    { id: 'v002', nome: 'Exclusão por DATA_LAUDO' },
    { id: 'v003', nome: 'Exclusão por DATA_REALIZACAO' },
    { id: 'v032', nome: 'Exclusão Clientes Específicos' },
    { id: 'v030', nome: 'Correção Modalidade RX' },
    { id: 'v033', nome: 'Substituição Especialidade/Categoria' },
    { id: 'v034', nome: 'Colunas→Músculo/Neuro' },
    { id: 'v035', nome: 'Mapeamento Nome Cliente' },
    { id: 'v026', nome: 'De-Para Valores' },
    { id: 'v027', nome: 'Quebra de Exames' },
    { id: 'v021', nome: 'Validação Cliente' },
    { id: 'f005', nome: 'Tipificação Faturamento NC' }
  ],
  'volumetria_fora_padrao_retroativo': [
    { id: 'v001', nome: 'Proteção Temporal de Dados' },
    { id: 'v002', nome: 'Exclusão por DATA_LAUDO' },
    { id: 'v003', nome: 'Exclusão por DATA_REALIZACAO' },
    { id: 'v032', nome: 'Exclusão Clientes Específicos' },
    { id: 'v030', nome: 'Correção Modalidade RX' },
    { id: 'v035', nome: 'Mapeamento Nome Cliente' },
    { id: 'v021', nome: 'Validação Cliente' }
  ],
  'volumetria_onco_padrao': [
    { id: 'v001', nome: 'Proteção Temporal de Dados' },
    { id: 'v031', nome: 'Filtro de Período Atual' },
    { id: 'v019', nome: 'Aplicação Valor Onco' },
    { id: 'v035', nome: 'Mapeamento Nome Cliente' },
    { id: 'v021', nome: 'Validação Cliente' }
  ]
};

export function MonitorRegrasTempoReal({ 
  loteUpload, 
  arquivoFonte, 
  isProcessing, 
  onRegrasCompletas 
}: MonitorRegrasTempoRealProps) {
  const [regrasStatus, setRegrasStatus] = useState<RegraStatus[]>([]);
  const [ultimaVerificacao, setUltimaVerificacao] = useState<string | null>(null);

  // Inicializar regras baseadas no tipo de arquivo
  useEffect(() => {
    const regrasEsperadas = REGRAS_POR_ARQUIVO[arquivoFonte as keyof typeof REGRAS_POR_ARQUIVO] || [];
    const statusInicial = regrasEsperadas.map(regra => ({
      id: regra.id,
      nome: regra.nome,
      aplicada: false,
      timestamp: null,
      em_execucao: false
    }));
    setRegrasStatus(statusInicial);
  }, [arquivoFonte]);

  // Monitorar logs de auditoria em tempo real
  useEffect(() => {
    if (!isProcessing || !loteUpload) return;

    const monitorarRegras = async () => {
      try {
        // Buscar logs de auditoria recentes
        const { data: logs, error } = await supabase
          .from('audit_logs')
          .select('operation, timestamp, new_data')
          .eq('table_name', 'volumetria_mobilemed')
          .gte('timestamp', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Últimos 5 minutos
          .order('timestamp', { ascending: false });

        if (error) {
          console.error('Erro ao buscar logs:', error);
          return;
        }

        // Mapear operações para regras
        const operacaoParaRegra: Record<string, string> = {
          'aplicar-exclusoes-periodo': 'v002,v003,v031',
          'aplicar-exclusao-clientes-especificos': 'v032',
          'aplicar-correcao-modalidade-rx': 'v030',
          'aplicar-substituicao-especialidade-categoria': 'v033',
          'aplicar-regra-colunas-musculo-neuro': 'v034',
          'aplicar-mapeamento-nome-cliente': 'v035',
          'aplicar-regras-tratamento': 'v026',
          'aplicar-regras-quebra-exames': 'v027',
          'aplicar-validacao-cliente': 'v021',
          'aplicar-tipificacao-faturamento': 'f005,f006',
          'aplicar-valor-onco': 'v019'
        };

        // Atualizar status das regras
        setRegrasStatus(prevStatus => {
          const novoStatus = [...prevStatus];
          
          logs?.forEach(log => {
            const regrasIds = operacaoParaRegra[log.operation];
            if (regrasIds) {
              regrasIds.split(',').forEach(regraId => {
                const index = novoStatus.findIndex(r => r.id === regraId);
                if (index !== -1) {
                  novoStatus[index] = {
                    ...novoStatus[index],
                    aplicada: true,
                    timestamp: log.timestamp,
                    registros_afetados: (log.new_data as any)?.registros_processados || (log.new_data as any)?.total_processado,
                    em_execucao: false
                  };
                }
              });
            }
          });

          return novoStatus;
        });

        setUltimaVerificacao(new Date().toLocaleTimeString());

      } catch (error) {
        console.error('Erro ao monitorar regras:', error);
      }
    };

    // Monitorar a cada 2 segundos durante o processamento
    const interval = setInterval(monitorarRegras, 2000);
    
    // Executar imediatamente
    monitorarRegras();

    return () => clearInterval(interval);
  }, [isProcessing, loteUpload]);

  // Notificar quando regras forem completadas
  useEffect(() => {
    const regrasAplicadas = regrasStatus.filter(r => r.aplicada).length;
    const totalRegras = regrasStatus.length;
    
    if (onRegrasCompletas) {
      onRegrasCompletas(totalRegras, regrasAplicadas);
    }
  }, [regrasStatus, onRegrasCompletas]);

  const getStatusIcon = (regra: RegraStatus) => {
    if (regra.em_execucao) {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    } else if (regra.aplicada) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (isProcessing) {
      return <Clock className="h-4 w-4 text-yellow-500" />;
    } else {
      return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (regra: RegraStatus) => {
    if (regra.em_execucao) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Executando</Badge>;
    } else if (regra.aplicada) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Aplicada</Badge>;
    } else if (isProcessing) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Aguardando</Badge>;
    } else {
      return <Badge variant="outline">Pendente</Badge>;
    }
  };

  const regrasAplicadas = regrasStatus.filter(r => r.aplicada).length;
  const totalRegras = regrasStatus.length;
  const percentualCompleto = totalRegras > 0 ? Math.round((regrasAplicadas / totalRegras) * 100) : 0;

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <Activity className="h-5 w-5" />
          Monitor de Regras em Tempo Real
          {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progresso Geral */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Regras Aplicadas: {regrasAplicadas}/{totalRegras}</span>
            <span className="font-medium">{percentualCompleto}%</span>
          </div>
          <Progress value={percentualCompleto} className="h-2" />
        </div>

        {/* Lista de Regras */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {regrasStatus.map((regra) => (
            <div
              key={regra.id}
              className="flex items-center justify-between p-3 bg-white rounded-lg border"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(regra)}
                <div>
                  <div className="font-medium text-sm">{regra.id}: {regra.nome}</div>
                  {regra.timestamp && (
                    <div className="text-xs text-gray-500">
                      Aplicada às {new Date(regra.timestamp).toLocaleTimeString()}
                    </div>
                  )}
                  {regra.registros_afetados && (
                    <div className="text-xs text-blue-600">
                      {regra.registros_afetados} registros processados
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {getStatusBadge(regra)}
              </div>
            </div>
          ))}
        </div>

        {/* Informações Adicionais */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          <div>Arquivo: {arquivoFonte}</div>
          <div>Lote: {loteUpload}</div>
          {ultimaVerificacao && (
            <div>Última verificação: {ultimaVerificacao}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}