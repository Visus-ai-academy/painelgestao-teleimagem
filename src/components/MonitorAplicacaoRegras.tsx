import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StatusRegra {
  id: string;
  edge_function: string;
  aplicada: boolean;
  automatica: boolean;
  timestamp_aplicacao: string | null;
  detalhes: any;
}

interface MonitorData {
  arquivo_fonte: string;
  lote_upload: string;
  timestamp_verificacao: string;
  estatisticas: {
    total_regras: number;
    regras_aplicadas: number;
    regras_nao_aplicadas: number;
    percentual_cobertura: number;
  };
  status_regras: Record<string, StatusRegra>;
  regras_nao_aplicadas: StatusRegra[];
}

// Mapeamento de nomes das regras para exibição
const NOMES_REGRAS: Record<string, string> = {
  'v001': 'Proteção Temporal de Dados',
  'v002': 'Exclusão por DATA_LAUDO fora do período',
  'v003': 'Exclusão por DATA_REALIZACAO >= período',
  'v031': 'Filtro de período atual para arquivos não-retroativos',
  'v032': 'Exclusão de Clientes Específicos',
  'v020': 'Regras de Exclusão Dinâmica',
  'v026': 'Mapeamento De Para - Valores por Estudo',
  'v027': 'Aplicação de Regras de Quebra de Exames',
  'v030': 'Correção de Modalidade para Exames RX',
  'v033': 'Substituição de Especialidade/Categoria por Cadastro',
  'v034': 'ColunasxMusculoxNeuro com Normalização Avançada',
  'v035': 'Mapeamento Nome Cliente - Mobilemed para Nome Fantasia',
  'v021': 'Validação Cliente Volumetria',
  'v013': 'Validação de Formato Excel',
  'v014': 'Mapeamento Dinâmico de Campos',
  'v016': 'Processamento em Lotes',
  'v017': 'Normalização Nome Médico',
  'v018': 'De-Para Prioridades',
  'v019': 'Aplicação Valor Onco',
  'v022': 'Validação e Limpeza de Caracteres Especiais',
  'v023': 'Aplicação Especialidade Automática',
  'v024': 'Definição Data Referência',
  'v028': 'Processamento de Categorias de Exames',
  'v029': 'Tratamento de Exames Fora do Padrão',
  'v008': 'Cache de Performance',
  'f005': 'Tipificação de Faturamento - Clientes NC Originais',
  'f006': 'Tipificação de Faturamento - Clientes NC Adicionais'
};

interface MonitorAplicacaoRegrasProps {
  arquivoFonte?: string;
  loteUpload?: string;
}

export function MonitorAplicacaoRegras({ arquivoFonte, loteUpload }: MonitorAplicacaoRegrasProps) {
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const verificarAplicacaoRegras = async () => {
    if (!arquivoFonte || !loteUpload) {
      toast({
        title: "Parâmetros necessários",
        description: "É necessário informar arquivo_fonte e lote_upload",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mapear-status-regras', {
        body: { arquivo_fonte: arquivoFonte, lote_upload: loteUpload }
      });

      if (error) throw error;

      setMonitorData(data);
      
      toast({
        title: "Mapeamento concluído",
        description: `${data.estatisticas.regras_aplicadas}/${data.estatisticas.total_regras} regras aplicadas (${data.estatisticas.percentual_cobertura}%)`,
        variant: data.estatisticas.percentual_cobertura >= 80 ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Erro ao mapear regras:', error);
      toast({
        title: "Erro no mapeamento",
        description: "Não foi possível verificar o status das regras",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (arquivoFonte && loteUpload) {
      verificarAplicacaoRegras();
    }
  }, [arquivoFonte, loteUpload]);

  const getStatusIcon = (regra: StatusRegra) => {
    if (regra.aplicada) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (regra: StatusRegra) => {
    if (regra.aplicada) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          {regra.automatica ? 'Automática' : 'Aplicada'}
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          Não Aplicada
        </Badge>
      );
    }
  };

  if (!arquivoFonte || !loteUpload) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Monitor de Aplicação de Regras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Aguardando dados de upload para monitorar aplicação das regras...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Monitor de Aplicação de Regras
            </CardTitle>
            <Button 
              onClick={verificarAplicacaoRegras} 
              disabled={loading}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>

        {monitorData && (
          <CardContent className="space-y-6">
            {/* Estatísticas Gerais */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {monitorData.estatisticas.total_regras}
                </div>
                <div className="text-sm text-blue-700">Total de Regras</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {monitorData.estatisticas.regras_aplicadas}
                </div>
                <div className="text-sm text-green-700">Regras Aplicadas</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {monitorData.estatisticas.regras_nao_aplicadas}
                </div>
                <div className="text-sm text-red-700">Não Aplicadas</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {monitorData.estatisticas.percentual_cobertura}%
                </div>
                <div className="text-sm text-purple-700">Cobertura</div>
              </div>
            </div>

            {/* Barra de Progresso */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Cobertura das Regras</span>
                <span>{monitorData.estatisticas.percentual_cobertura}%</span>
              </div>
              <Progress value={monitorData.estatisticas.percentual_cobertura} />
            </div>

            {/* Lista detalhada das regras */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Status Detalhado das Regras</h3>
              
              <div className="grid gap-3">
                {Object.values(monitorData.status_regras).map((regra) => (
                  <div
                    key={regra.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(regra)}
                      <div>
                        <div className="font-medium">{regra.id}: {NOMES_REGRAS[regra.id] || 'Regra não catalogada'}</div>
                        <div className="text-sm text-muted-foreground">
                          Edge Function: {regra.edge_function}
                        </div>
                        {regra.timestamp_aplicacao && (
                          <div className="text-xs text-muted-foreground">
                            Aplicada em: {new Date(regra.timestamp_aplicacao).toLocaleString()}
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
            </div>

            {/* Alertas para regras não aplicadas */}
            {monitorData.regras_nao_aplicadas.length > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle className="text-red-800 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Regras Não Aplicadas ({monitorData.regras_nao_aplicadas.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {monitorData.regras_nao_aplicadas.map((regra) => (
                      <div key={regra.id} className="text-sm text-red-700">
                        • {regra.id}: {NOMES_REGRAS[regra.id] || 'Regra não catalogada'} 
                        <span className="text-red-600"> ({regra.edge_function})</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="text-xs text-muted-foreground">
              Última verificação: {new Date(monitorData.timestamp_verificacao).toLocaleString()}
              <br />
              Arquivo: {monitorData.arquivo_fonte} | Lote: {monitorData.lote_upload}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}