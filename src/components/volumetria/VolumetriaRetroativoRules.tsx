
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle, Clock, Calendar } from 'lucide-react';

interface RetroativoRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  conditions: string[];
  actions: string[];
}

interface ProcessedData {
  total_registros: number;
  registros_com_data_referencia: number;
  registros_periodo_correto: number;
  registros_excluidos: number;
  periodo_inicio: string;
  periodo_fim: string;
}

export function VolumetriaRetroativoRules() {
  const [rules, setRules] = useState<RetroativoRule[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [loading, setLoading] = useState(false);

  const defaultRules: RetroativoRule[] = [
    {
      id: 'data-referencia-retroativo',
      name: 'Definição de Data de Referência (Retroativo)',
      description: 'Para arquivos retroativos, a data_referencia é definida baseada no tipo de arquivo',
      isActive: true,
      conditions: [
        'arquivo_fonte LIKE \'%retroativo%\'',
        'DATA_LAUDO existe e é válida'
      ],
      actions: [
        'data_referencia = DATA_LAUDO (prioritário)',
        'Se DATA_LAUDO não existe: data_referencia = DATA_REALIZACAO',
        'Se nenhuma existe: registro é descartado'
      ]
    },
    {
      id: 'exclusao-periodo-retroativo',
      name: 'Exclusão por Período de Referência',
      description: 'Exclusão de registros fora do período especificado para arquivos retroativos',
      isActive: true,
      conditions: [
        'arquivo_fonte CONTAINS \'retroativo\'',
        'periodo_referencia definido (ex: janeiro/25)'
      ],
      actions: [
        'Busca regras de exclusão na tabela regras_exclusao_periodo',
        'Aplica filtros de data baseados no período',
        'Remove registros fora do intervalo definido'
      ]
    },
    {
      id: 'limpeza-dados-anteriores',
      name: 'Limpeza de Dados Anteriores',
      description: 'Remove dados anteriores do mesmo tipo e período antes da inserção',
      isActive: true,
      conditions: [
        'Mesmo arquivo_fonte',
        'Mesmo periodo_referencia'
      ],
      actions: [
        'DELETE FROM volumetria_mobilemed WHERE arquivo_fonte = ? AND periodo_referencia = ?'
      ]
    },
    {
      id: 'validacao-datas-brasil',
      name: 'Validação de Datas Brasileiras',
      description: 'Conversão e validação de datas no formato brasileiro',
      isActive: true,
      conditions: [
        'Formato DD/MM/AAAA ou DD-MM-AAAA',
        'Ano com 2 ou 4 dígitos'
      ],
      actions: [
        'Converte formato brasileiro para ISO',
        'Anos de 2 dígitos: adiciona século atual',
        'Valida se a data é válida'
      ]
    },
    {
      id: 'aplicacao-regras-negocio',
      name: 'Aplicação de Regras de Negócio',
      description: 'Aplica mapeamentos e regras após inserção dos dados',
      isActive: true,
      conditions: [
        'Dados inseridos com sucesso',
        'arquivo_fonte contém \'volumetria\''
      ],
      actions: [
        'Executa aplicar_de_para_automatico()',
        'Executa aplicar_de_para_prioridade()',
        'Atualiza registros com mapeamentos'
      ]
    }
  ];

  useEffect(() => {
    setRules(defaultRules);
    loadProcessedData();
  }, []);

  const loadProcessedData = async () => {
    try {
      // Buscar dados de arquivos retroativos processados
      const { data: volumetriaData, error } = await supabase
        .from('volumetria_mobilemed')
        .select('arquivo_fonte, data_referencia, periodo_referencia, created_at')
        .like('arquivo_fonte', '%retroativo%')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        console.error('Erro ao carregar dados:', error);
        return;
      }

      if (volumetriaData && volumetriaData.length > 0) {
        const total = volumetriaData.length;
        const comDataReferencia = volumetriaData.filter(item => item.data_referencia).length;
        
        // Calcular período de dados
        const datas = volumetriaData
          .map(item => item.data_referencia)
          .filter(Boolean)
          .sort();
        
        setProcessedData({
          total_registros: total,
          registros_com_data_referencia: comDataReferencia,
          registros_periodo_correto: comDataReferencia,
          registros_excluidos: total - comDataReferencia,
          periodo_inicio: datas[0] || 'N/A',
          periodo_fim: datas[datas.length - 1] || 'N/A'
        });
      }
    } catch (error) {
      console.error('Erro ao processar dados:', error);
    }
  };

  const testRules = async () => {
    setLoading(true);
    try {
      // Executar função de validação de regras
      const { data, error } = await supabase.rpc('validar_regras_retroativo');
      
      if (error) {
        console.error('Erro ao validar regras:', error);
        return;
      }
      
      console.log('Resultado da validação:', data);
      await loadProcessedData();
    } catch (error) {
      console.error('Erro ao testar regras:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Regras de Data - Exames Retroativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {rules.map((rule) => (
              <Card key={rule.id} className="border-l-4 border-l-blue-500">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-sm">{rule.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {rule.description}
                      </p>
                    </div>
                    <Badge variant={rule.isActive ? "default" : "secondary"}>
                      {rule.isActive ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      )}
                      {rule.isActive ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Condições
                      </h5>
                      <ul className="text-sm mt-1 space-y-1">
                        {rule.conditions.map((condition, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-orange-500 mt-1.5 block w-1 h-1 bg-current rounded-full flex-shrink-0" />
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {condition}
                            </code>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Ações
                      </h5>
                      <ul className="text-sm mt-1 space-y-1">
                        {rule.actions.map((action, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-green-500 mt-1.5 block w-1 h-1 bg-current rounded-full flex-shrink-0" />
                            <span className="text-xs">{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {processedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Dados Processados (Últimos Retroativos)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{processedData.total_registros.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total de Registros</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {processedData.registros_com_data_referencia.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Com Data Referência</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {processedData.registros_excluidos.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Excluídos</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round((processedData.registros_com_data_referencia / processedData.total_registros) * 100)}%
                </div>
                <div className="text-sm text-muted-foreground">Taxa de Sucesso</div>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-muted/30 rounded-lg">
              <h4 className="font-medium mb-2">Período dos Dados</h4>
              <div className="flex items-center gap-4 text-sm">
                <span><strong>Início:</strong> {processedData.periodo_inicio}</span>
                <span><strong>Fim:</strong> {processedData.periodo_fim}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Importante:</strong> As regras de data para exames retroativos são aplicadas automaticamente 
          durante o processamento. A data de referência é sempre baseada na DATA_LAUDO quando disponível, 
          e filtros de período são aplicados conforme configurado na tabela de exclusões.
        </AlertDescription>
      </Alert>

      <div className="flex gap-2">
        <Button 
          onClick={testRules}
          disabled={loading}
          variant="outline"
        >
          {loading ? 'Validando...' : 'Validar Regras Ativas'}
        </Button>
        <Button 
          onClick={loadProcessedData}
          variant="outline"
        >
          Atualizar Dados
        </Button>
      </div>
    </div>
  );
}
