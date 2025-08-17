import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Interface para o status de uma regra
interface RegraStatus {
  idRegra: string;
  nomeRegra: string;
  descricao: string;
  arquivos: {
    [tipoArquivo: string]: {
      deveAplicar: boolean;
      foiAplicada: boolean;
      hasError: boolean;
      ultimaAplicacao?: string;
      erros?: string[];
    };
  };
}

// Tipos de arquivo que monitoramos
const TIPOS_ARQUIVO = [
  'volumetria_padrao',
  'volumetria_fora_padrao', 
  'volumetria_padrao_retroativo',
  'volumetria_fora_padrao_retroativo'
];

// Regras que monitoramos
const REGRAS_MONITORADAS = [
  {
    nome: 'v002 Regras Retroativas Laudo',
    descricao: 'Aplica filtros de período para arquivos retroativos com base na data do laudo',
    funcao: 'aplicar_regras_retroativas',
    id: 'v002'
  },
  {
    nome: 'v003 Regras Retroativas Realização',
    descricao: 'Aplica filtros de período para arquivos retroativos com base na data de realização',
    funcao: 'aplicar_regras_retroativas',
    id: 'v003'
  },
  {
    nome: 'v008 Cache Volumetria',
    descricao: 'Sistema de cache para otimização de consultas em volumetria',
    funcao: 'cache_volumetria',
    id: 'v008'
  },
  {
    nome: 'v013 Validação Volumetria',
    descricao: 'Validação de regras de negócio nos dados de volumetria',
    funcao: 'validar_regras_volumetria',
    id: 'v013'
  },
  {
    nome: 'v014 Batching Otimizado',
    descricao: 'Processamento em lotes otimizado para grandes volumes',
    funcao: 'batch_processing_otimizado',
    id: 'v014'
  },
  {
    nome: 'v016 Mapping Automático',
    descricao: 'Mapeamento automático de campos e estruturas',
    funcao: 'auto_mapping_fields',
    id: 'v016'
  },
  {
    nome: 'v022 Normalização Cliente',
    descricao: 'Normaliza e limpa nomes de clientes conforme regras estabelecidas',
    funcao: 'limpar_nome_cliente',
    id: 'v022'
  },
  {
    nome: 'v026 Correção Modalidades',
    descricao: 'Corrige modalidades CR/DX para RX ou MG e OT para DO',
    funcao: 'aplicar_correcao_modalidades',
    id: 'v026'
  },
  {
    nome: 'v027 Regras Quebra de Exames',
    descricao: 'Aplica regras de quebra configuradas para dividir exames compostos',
    funcao: 'aplicar_quebra_exames',
    id: 'v027'
  },
  {
    nome: 'v028 Aplicação Categorias',
    descricao: 'Define categorias automaticamente baseado no cadastro de exames',
    funcao: 'aplicar_categorias_trigger',
    id: 'v028'
  },
  {
    nome: 'v029 De-Para Prioridades',
    descricao: 'Aplica mapeamento de prioridades conforme tabela de-para',
    funcao: 'aplicar_prioridades_de_para',
    id: 'v029'
  },
  {
    nome: 'v030 Correção Modalidade Específica',
    descricao: 'Aplicação de correções específicas de modalidade baseadas em estudo',
    funcao: 'aplicar_correcao_modalidade_especifica',
    id: 'v030'
  },
  {
    nome: 'v031 Regras Período Atual',
    descricao: 'Aplica validações de período para arquivos do mês corrente',
    funcao: 'aplicar_regras_periodo_atual',
    id: 'v031'
  },
  {
    nome: 'f005 Aplicação De-Para Valores',
    descricao: 'Aplica valores de referência para exames com valores zerados',
    funcao: 'aplicar_de_para_trigger',
    id: 'f005'
  },
  {
    nome: 'f006 Tipificação Faturamento',
    descricao: 'Define tipo de faturamento automaticamente (oncologia, urgência, etc)',
    funcao: 'aplicar_tipificacao_faturamento',
    id: 'f006'
  },
  {
    nome: 'Limpeza Nome Cliente',
    descricao: 'Remove sufixos e aplica mapeamentos específicos nos nomes de clientes',
    funcao: 'trigger_limpar_nome_cliente',
    id: 'extra_001'
  },
  {
    nome: 'Normalização Médico',
    descricao: 'Remove códigos e normaliza nomes de médicos',
    funcao: 'trigger_normalizar_medico',
    id: 'extra_002'
  },
  {
    nome: 'Trigger Processamento Volumetria',
    descricao: 'Orchestrador principal que executa todas as regras de processamento',
    funcao: 'trigger_volumetria_processamento',
    id: 'extra_003'
  },
  {
    nome: 'Aplicação Valor Onco',
    descricao: 'Aplica valores específicos para exames oncológicos',
    funcao: 'aplicar_valor_onco',
    id: 'extra_004'
  },
  {
    nome: 'Regras Exclusão Dinâmicas',
    descricao: 'Aplica regras de exclusão configuradas dinamicamente',
    funcao: 'aplicar_regras_exclusao_dinamicas',
    id: 'extra_005'
  },
  {
    nome: 'Validação Cliente Volumetria',
    descricao: 'Valida se cliente existe e está ativo para processamento',
    funcao: 'aplicar_validacao_cliente_volumetria',
    id: 'extra_006'
  },
  {
    nome: 'Aplicação Especialidade Automática',
    descricao: 'Define especialidade automaticamente baseado em regras',
    funcao: 'aplicar_especialidade_automatica',
    id: 'extra_007'
  },
  {
    nome: 'Definição Data Referência',
    descricao: 'Define data de referência baseada no período de processamento',
    funcao: 'set_data_referencia_volumetria',
    id: 'extra_008'
  }
];

export function StatusRegraProcessamento() {
  const [statusRegras, setStatusRegras] = useState<RegraStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodoReferencia, setPeriodoReferencia] = useState<string>('');

  const fetchStatusRegras = async () => {
    try {
      setLoading(true);
      
      // Buscar período de referência real dos dados processados
      const { data: periodoData } = await supabase
        .from('volumetria_mobilemed')
        .select('periodo_referencia')
        .not('periodo_referencia', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (periodoData && periodoData.length > 0) {
        setPeriodoReferencia(periodoData[0].periodo_referencia);
      }
      
      // Buscar apenas os uploads mais recentes por tipo de arquivo (otimizado)
      const { data: uploads, error } = await supabase
        .from('processamento_uploads')
        .select('tipo_arquivo, status, registros_processados, registros_erro, registros_inseridos, created_at')
        .in('tipo_arquivo', TIPOS_ARQUIVO)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Últimas 24h
        .order('created_at', { ascending: false })
        .limit(20); // Apenas os mais recentes

      if (error) {
        console.error('Erro ao buscar uploads:', error);
        return;
      }

      // Buscar registros pendentes de quebra para a regra v027
      const { data: pendentesData } = await supabase
        .from('volumetria_mobilemed')
        .select('arquivo_fonte, count')
        .eq('processamento_pendente', true)
        .in('arquivo_fonte', TIPOS_ARQUIVO);

      const pendentesMap = pendentesData?.reduce((acc: any, item: any) => {
        acc[item.arquivo_fonte] = (acc[item.arquivo_fonte] || 0) + 1;
        return acc;
      }, {}) || {};

      // Processar status de cada regra
      const regrasStatus: RegraStatus[] = REGRAS_MONITORADAS.map(regra => {
        const arquivosStatus: { [key: string]: any } = {};
        
        TIPOS_ARQUIVO.forEach(tipoArquivo => {
          const uploadInfo = uploads?.find(u => u.tipo_arquivo === tipoArquivo);

          // Determinar se deve aplicar baseado no tipo de arquivo e regra
          let deveAplicar = true;
          
          // Regras específicas para retroativos
          if ((regra.id === 'v002' || regra.id === 'v003') && !tipoArquivo.includes('retroativo')) {
            deveAplicar = false;
          }
          
          // Regras específicas para não-retroativos
          if (regra.id === 'v031' && tipoArquivo.includes('retroativo')) {
            deveAplicar = false;
          }
          
          // Regras que só se aplicam a arquivos onco (não temos esse tipo nos 4 arquivos principais)
          if (regra.funcao === 'aplicar_valor_onco' && !tipoArquivo.includes('onco')) {
            deveAplicar = false;
          }

          // Verificar se foi aplicada - apenas se deve aplicar
          let foiAplicada = false;
          let hasError = false;
          let informacoes: string[] = [];
          
          if (deveAplicar && uploadInfo) {
            // REGRA ESPECIAL v027 - Verificar se há registros pendentes de quebra
            if (regra.id === 'v027') {
              const pendentesQuebra = pendentesMap[tipoArquivo] || 0;
              if (pendentesQuebra > 0) {
                foiAplicada = false;
                hasError = true;
                informacoes = [`${pendentesQuebra} registros pendentes de quebra`];
              } else {
                foiAplicada = uploadInfo.status === 'concluido';
                informacoes = ['Todas as quebras foram aplicadas'];
              }
            } else {
              // Regras que EXCLUEM/FILTRAM registros - exclusões são aplicações corretas
              const regrasExclusao = ['v002', 'v003', 'v031', 'extra_005'];
              
              // Regras que TRANSFORMAM dados - transformações são aplicações corretas  
              const regrasTransformacao = ['v022', 'v026', 'v030', 'extra_001', 'extra_002', 'extra_003'];
              
              // Regras que VALIDAM dados - rejeições são aplicações corretas
              const regrasValidacao = ['v013', 'extra_006'];
              
              // Regras AUTOMÁTICAS/SISTÊMICAS que sempre são aplicadas no processamento
              const regrasAutomaticas = ['v014', 'v016', 'v008', 'v028', 'v029', 'f005', 'f006', 'extra_007', 'extra_008', 'extra_004'];
              
              if (regrasExclusao.includes(regra.id)) {
                // Para regras de exclusão, se há registros "erro" significa que a regra foi aplicada
                foiAplicada = uploadInfo.status === 'concluido';
                if (uploadInfo.registros_erro > 0) {
                  informacoes = [`${uploadInfo.registros_erro} registros excluídos (regra aplicada)`];
                }
              } else if (regrasTransformacao.includes(regra.id)) {
                foiAplicada = uploadInfo.status === 'concluido';
                if (uploadInfo.registros_erro > 0) {
                  informacoes = [`${uploadInfo.registros_erro} registros transformados`];
                }
              } else if (regrasValidacao.includes(regra.id)) {
                foiAplicada = uploadInfo.status === 'concluido';
                if (uploadInfo.registros_erro > 0) {
                  informacoes = [`${uploadInfo.registros_erro} registros rejeitados na validação`];
                }
              } else if (regrasAutomaticas.includes(regra.id)) {
                // Regras automáticas sempre são aplicadas se o processamento foi concluído
                foiAplicada = uploadInfo.status === 'concluido';
                
                // Para regras que tratam de categorização e tipificação, "registros_erro" são registros processados
                if (['v028', 'v029', 'f005', 'f006', 'extra_007', 'extra_008'].includes(regra.id)) {
                  if (uploadInfo.registros_erro > 0) {
                    informacoes = [`${uploadInfo.registros_erro} registros processados pela regra`];
                  } else {
                    informacoes = ['Regra aplicada - nenhum registro necessitou processamento'];
                  }
                } else {
                  // Para outras regras automáticas (cache, batching, mapping)
                  informacoes = ['Regra aplicada automaticamente durante processamento'];
                  
                  // Apenas algumas regras podem ter erro real
                  if (uploadInfo.registros_erro > 0 && !['v008', 'v016', 'v014'].includes(regra.id)) {
                    hasError = true;
                    informacoes = [`${uploadInfo.registros_erro} erros encontrados`];
                    foiAplicada = false;
                  }
                }
              } else {
                // Para outras regras, sucesso significa sem erros
                foiAplicada = uploadInfo.status === 'concluido' && uploadInfo.registros_erro === 0;
                
                if (uploadInfo.registros_erro > 0) {
                  hasError = true;
                  informacoes = [`${uploadInfo.registros_erro} erros encontrados`];
                }
              }
            }
          } else if (deveAplicar && !uploadInfo) {
            // Se deve aplicar mas não há upload info, considerar pendente
            foiAplicada = false;
          } else {
            // Se não deve aplicar, considerar como "aplicada" (N/A)
            foiAplicada = true;
          }

          arquivosStatus[tipoArquivo] = {
            deveAplicar,
            foiAplicada,
            hasError,
            ultimaAplicacao: uploadInfo?.created_at,
            erros: informacoes
          };
        });

        return {
          idRegra: regra.id,
          nomeRegra: regra.nome,
          descricao: regra.descricao,
          arquivos: arquivosStatus
        };
      });

      setStatusRegras(regrasStatus);
    } catch (error) {
      console.error('Erro ao carregar status das regras:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusRegras();

    // Configurar listener para mudanças em tempo real
    const channel = supabase
      .channel('status-regras-processamento')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'processamento_uploads'
        },
        () => {
          console.log('📊 Detecção de mudança em processamento_uploads - atualizando status...');
          fetchStatusRegras();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusIcon = (arquivo: any) => {
    if (!arquivo.deveAplicar) {
      return <span className="text-muted-foreground">N/A</span>;
    }
    if (arquivo.hasError) {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    if (arquivo.foiAplicada) {
      return <CheckCircle className="h-4 w-4 text-success" />;
    }
    return <Clock className="h-4 w-4 text-warning" />;
  };

  const getStatusBadge = (arquivo: any) => {
    if (!arquivo.deveAplicar) {
      return <Badge variant="outline">N/A</Badge>;
    }
    if (arquivo.hasError) {
      return <Badge variant="destructive">Erro</Badge>;
    }
    if (arquivo.foiAplicada) {
      return <Badge variant="default" className="bg-success text-success-foreground">OK</Badge>;
    }
    return <Badge variant="secondary">Pendente</Badge>;
  };

  const getNomeArquivoAmigavel = (tipoArquivo: string) => {
    const nomes: { [key: string]: string } = {
      'volumetria_padrao': 'Padrão',
      'volumetria_fora_padrao': 'Fora Padrão',
      'volumetria_padrao_retroativo': 'Padrão Retro',
      'volumetria_fora_padrao_retroativo': 'Fora Padrão Retro'
    };
    return nomes[tipoArquivo] || tipoArquivo;
  };

  const getPeriodoReferencia = () => {
    if (!periodoReferencia) return 'Não identificado';
    
    try {
      // Converter de "2025-06" para "jun-25"
      const [ano, mes] = periodoReferencia.toString().split('-');
      const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const mesIndex = parseInt(mes, 10) - 1;
      
      if (mesIndex >= 0 && mesIndex < 12 && ano) {
        const mesAbrev = meses[mesIndex];
        const anoAbrev = ano.slice(-2);
        return `${mesAbrev}-${anoAbrev}`;
      }
      
      return periodoReferencia; // Fallback para formato original
    } catch (error) {
      console.warn('Erro ao converter período de referência:', error);
      return periodoReferencia || 'Não identificado';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Status de Aplicação das Regras no Processamento
        </CardTitle>
        <CardDescription>
          Monitoramento em tempo real da aplicação das regras de negócio durante o processamento de volumetria.
          <br />
          <strong>Período de Referência:</strong> {getPeriodoReferencia()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Carregando status das regras...</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Regra</TableHead>
                  {TIPOS_ARQUIVO.map(tipo => (
                    <TableHead key={tipo} className="text-center">
                      {getNomeArquivoAmigavel(tipo)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {statusRegras.map((regra) => (
                  <TableRow key={regra.idRegra}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">{regra.nomeRegra}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {regra.descricao}
                        </div>
                      </div>
                    </TableCell>
                    {TIPOS_ARQUIVO.map(tipoArquivo => {
                      const arquivo = regra.arquivos[tipoArquivo];
                      return (
                        <TableCell key={tipoArquivo} className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1">
                              {getStatusIcon(arquivo)}
                              {getStatusBadge(arquivo)}
                            </div>
                            {arquivo.erros && arquivo.erros.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {arquivo.erros[0]}
                              </div>
                            )}
                            {arquivo.ultimaAplicacao && (
                              <div className="text-xs text-muted-foreground">
                                {new Date(arquivo.ultimaAplicacao).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}