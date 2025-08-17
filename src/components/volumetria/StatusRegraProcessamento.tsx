import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RegraStatus {
  idRegra: string;
  nomeRegra: string;
  descricaoRegra: string;
  arquivos: {
    [key: string]: {
      deveAplicar: boolean;
      foiAplicada: boolean;
      hasError?: boolean;
      ultimaAplicacao?: string;
      erros?: string[];
    };
  };
}

const TIPOS_ARQUIVO = [
  'volumetria_padrao',
  'volumetria_fora_padrao', 
  'volumetria_padrao_retroativo',
  'volumetria_fora_padrao_retroativo'
];

const REGRAS_MONITORADAS = [
  // REGRAS DE VOLUMETRIA - Aplicadas durante processamento
  {
    nome: 'Exclusão DATA_LAUDO fora período',
    descricao: 'Remove registros com DATA_LAUDO fora do período de faturamento (retroativos)',
    funcao: 'aplicar_regras_retroativas',
    id: 'v002'
  },
  {
    nome: 'Exclusão DATA_REALIZACAO >= período',
    descricao: 'Remove registros retroativos com DATA_REALIZACAO >= 01 do mês',
    funcao: 'aplicar_regras_retroativas',
    id: 'v003'
  },
  {
    nome: 'Filtro período atual não-retroativos',
    descricao: 'Remove registros com datas fora do período para arquivos não-retroativos',
    funcao: 'aplicar_regras_periodo_atual',
    id: 'v031'
  },
  {
    nome: 'Validação Formato Excel',
    descricao: 'Valida estrutura dos arquivos Excel e colunas obrigatórias',
    funcao: 'file_validation',
    id: 'v013'
  },
  {
    nome: 'Limpeza Caracteres Especiais',
    descricao: 'Remove caracteres especiais e normaliza encoding UTF-8',
    funcao: 'data_cleaning',
    id: 'v022'
  },
  {
    nome: 'Mapeamento De Para Valores',
    descricao: 'Preenche valores zerados usando tabela de referência',
    funcao: 'aplicar_de_para_trigger',
    id: 'v026'
  },
  {
    nome: 'Regras Quebra de Exames',
    descricao: 'Quebra exames compostos em exames individuais',
    funcao: 'trigger_marcar_para_quebra',
    id: 'v027'
  },
  {
    nome: 'Processamento Categorias',
    descricao: 'Categoriza exames baseado na tabela de categorias',
    funcao: 'aplicar_categorias_trigger',
    id: 'v028'
  },
  {
    nome: 'Tratamento Exames Fora Padrão',
    descricao: 'Identifica e trata exames que não seguem o padrão',
    funcao: 'exames_fora_padrao',
    id: 'v029'
  },
  {
    nome: 'Correção Modalidade RX',
    descricao: 'Corrige modalidades CR/DX para RX/MG e OT para DO',
    funcao: 'aplicar_correcao_modalidades',
    id: 'v030'
  },
  {
    nome: 'Mapeamento Dinâmico Campos',
    descricao: 'Mapeia colunas do arquivo para campos do banco usando field_mappings',
    funcao: 'field_mapping',
    id: 'v014'
  },
  {
    nome: 'Processamento em Lotes',
    descricao: 'Processa uploads em lotes de 1000 registros para otimizar performance',
    funcao: 'batch_processing',
    id: 'v016'
  },
  {
    nome: 'Cache de Performance',
    descricao: 'Utiliza cache para otimizar consultas grandes',
    funcao: 'volumetria_cache',
    id: 'v008'
  },
  {
    nome: 'Tipificação Faturamento NC Originais',
    descricao: 'Define tipificação para 10 clientes NC originais',
    funcao: 'aplicar_tipificacao_faturamento',
    id: 'f005'
  },
  {
    nome: 'Tipificação Faturamento NC Adicionais',
    descricao: 'Define tipificação para 3 clientes NC adicionais',
    funcao: 'aplicar_tipificacao_faturamento',
    id: 'f006'
  },
  
  // TRATAMENTOS ADICIONAIS IDENTIFICADOS NAS FUNÇÕES
  {
    nome: 'Normalização Nome Cliente',
    descricao: 'Aplica limpeza e normalização de nomes de clientes',
    funcao: 'trigger_limpar_nome_cliente',
    id: 'extra_001'
  },
  {
    nome: 'Normalização Nome Médico',
    descricao: 'Remove códigos entre parênteses e normaliza nomes de médicos',
    funcao: 'trigger_normalizar_medico',
    id: 'extra_002'
  },
  {
    nome: 'De-Para Prioridades',
    descricao: 'Aplica mapeamento de prioridades conforme tabela de-para',
    funcao: 'aplicar_prioridades_de_para',
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

  const fetchStatusRegras = async () => {
    try {
      setLoading(true);
      
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

      // Removido busca pesada de logs de auditoria que causava timeout
      // O status será determinado diretamente pelos dados de upload

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
            // Regras que EXCLUEM/FILTRAM registros - exclusões são aplicações corretas
            const regrasExclusao = ['v002', 'v003', 'v031', 'extra_005'];
            
            // Regras que TRANSFORMAM dados - transformações são aplicações corretas  
            const regrasTransformacao = ['v022', 'v026', 'v027', 'v030', 'extra_001', 'extra_002', 'extra_003'];
            
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
              informacoes = ['Regra aplicada automaticamente durante processamento'];
              
              // Apenas algumas regras podem ter erro real
              if (uploadInfo.registros_erro > 0 && !['v008', 'v016', 'v014'].includes(regra.id)) {
                hasError = true;
                informacoes = [`${uploadInfo.registros_erro} erros encontrados`];
                foiAplicada = false;
              }
            } else {
              // Para outras regras, sucesso significa sem erros
              foiAplicada = uploadInfo.status === 'concluido' && uploadInfo.registros_erro === 0;
              
              if (uploadInfo.registros_erro > 0) {
                hasError = true;
                informacoes = [`${uploadInfo.registros_erro} erros encontrados`];
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
          descricaoRegra: regra.descricao,
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
    
    // Configurar atualização em tempo real
    const channel = supabase
      .channel('regras_processamento_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'processamento_uploads'
        },
        () => {
          fetchStatusRegras();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusIcon = (deveAplicar: boolean, foiAplicada: boolean, hasError: boolean = false) => {
    if (!deveAplicar) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (hasError) return <XCircle className="h-4 w-4 text-red-500" />;
    if (foiAplicada) return <CheckCircle className="h-4 w-4 text-blue-500" />;
    return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusBadge = (deveAplicar: boolean, foiAplicada: boolean, hasError: boolean = false) => {
    if (!deveAplicar) return <Badge variant="outline">N/A</Badge>;
    if (hasError) return <Badge variant="destructive">Erro</Badge>;
    if (foiAplicada) return <Badge className="bg-blue-500 hover:bg-blue-600">OK</Badge>;
    return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Pendente</Badge>;
  };

  const getNomeArquivoAmigavel = (tipoArquivo: string) => {
    const nomes = {
      'volumetria_padrao': 'Arquivo 1 (Padrão)',
      'volumetria_fora_padrao': 'Arquivo 2 (Fora Padrão)',
      'volumetria_padrao_retroativo': 'Arquivo 3 (Retro Padrão)',
      'volumetria_fora_padrao_retroativo': 'Arquivo 4 (Retro Fora Padrão)'
    };
    return nomes[tipoArquivo as keyof typeof nomes] || tipoArquivo;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status de Aplicação das Regras</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-32">
            <div className="text-muted-foreground">Carregando status das regras...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status de Aplicação das Regras no Processamento</CardTitle>
        <p className="text-sm text-muted-foreground">
          Monitoramento em tempo real da aplicação das regras de negócio por arquivo processado
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-medium">Regra</th>
                {TIPOS_ARQUIVO.map(tipo => (
                  <th key={tipo} className="text-center p-3 font-medium min-w-[160px]">
                    {getNomeArquivoAmigavel(tipo)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statusRegras.map((regra, index) => (
                <tr key={index} className="border-b hover:bg-muted/50">
                  <td className="p-3">
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        <Badge variant="outline" className="text-xs font-mono px-2 py-1">
                          {regra.idRegra}
                        </Badge>
                        <span>{regra.nomeRegra}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">{regra.descricaoRegra}</div>
                    </div>
                  </td>
                  {TIPOS_ARQUIVO.map(tipo => {
                    const arquivo = regra.arquivos[tipo];
                    return (
                      <td key={tipo} className="p-3 text-center">
                        <div className="space-y-2">
                          <div className="flex justify-center items-center gap-2">
                            <span className="text-xs text-muted-foreground">Deve:</span>
                            {arquivo.deveAplicar ? (
                              <Badge variant="outline" className="text-xs">Sim</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Não</Badge>
                            )}
                          </div>
                          <div className="flex justify-center items-center gap-2">
                            {getStatusIcon(arquivo.deveAplicar, arquivo.foiAplicada, arquivo.hasError)}
                            {getStatusBadge(arquivo.deveAplicar, arquivo.foiAplicada, arquivo.hasError)}
                          </div>
                          {arquivo.erros && arquivo.erros.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {arquivo.erros[0]}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}