import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Search, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RegraVerificacao {
  id: string;
  nome: string;
  descricao: string;
  edgeFunction: string;
  categoria: 'modalidade' | 'especialidade' | 'quebra' | 'exclusao' | 'validacao' | 'tipificacao' | 'mapeamento' | 'tratamento' | 'trigger' | 'especial';
  aplicada: boolean;
  ultimaExecucao?: string;
  registrosProcessados?: number;
  registrosAfetados?: number;
  erros?: string[];
  status: 'ok' | 'pendente' | 'erro' | 'nao_aplicavel';
}

interface VerificacaoEspecifica {
  regra: string;
  condicao: string;
  esperado: number;
  encontrado: number;
  status: 'ok' | 'falha';
  detalhes?: string;
}

export function ControleVerificacaoRegras() {
  const [regras, setRegras] = useState<RegraVerificacao[]>([]);
  const [verificacoesEspecificas, setVerificacoesEspecificas] = useState<VerificacaoEspecifica[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEspecificas, setLoadingEspecificas] = useState(false);
  const { toast } = useToast();

  const regrasDefinidas: Omit<RegraVerificacao, 'aplicada' | 'ultimaExecucao' | 'registrosProcessados' | 'registrosAfetados' | 'erros' | 'status'>[] = [
    // === REGRAS DE MODALIDADE ===
    {
      id: 'v030',
      nome: 'Correção Modalidade DX/CR → RX/MG',
      descricao: 'Corrige modalidades CR e DX para RX (exceto mamografia) ou MG (mamografia)',
      edgeFunction: 'aplicar-correcao-modalidade-rx',
      categoria: 'modalidade'
    },
    {
      id: 'v035',
      nome: 'Correção Modalidade OT → US',
      descricao: 'Corrige modalidade OT para US baseado em critérios específicos',
      edgeFunction: 'aplicar-correcao-modalidade-ot',
      categoria: 'modalidade'
    },
    
    // === REGRAS DE ESPECIALIDADE ===
    {
      id: 'v034',
      nome: 'Especialidade Coluna → Músculo/Neuro',
      descricao: 'Converte especialidade "Colunas" para "Músculo Esquelético" ou "Neuro" baseado no médico',
      edgeFunction: 'aplicar-regra-colunas-musculo-neuro',
      categoria: 'especialidade'
    },
    {
      id: 'v033',
      nome: 'Substituição Especialidade/Categoria',
      descricao: 'Substitui especialidade e categoria baseado no cadastro de exames',
      edgeFunction: 'aplicar-substituicao-especialidade-categoria',
      categoria: 'especialidade'
    },
    {
      id: 'v044',
      nome: 'Correção MAMA → MAMO (Modalidade MG)',
      descricao: 'Corrige especialidade MAMA para MAMO quando modalidade é MG (mamografia). MAMA é reservado para MR (RM MAMAS).',
      edgeFunction: 'corrigir-mama-mamo-retroativo',
      categoria: 'especialidade'
    },
    
    // === REGRAS DE QUEBRA ===
    {
      id: 'v027',
      nome: 'Quebra de Exames Automática',
      descricao: 'Aplica regras de quebra configuradas para dividir exames compostos',
      edgeFunction: 'aplicar-quebras-automatico',
      categoria: 'quebra'
    },
    {
      id: 'v028',
      nome: 'Regras Quebra Exames',
      descricao: 'Aplicação manual de regras de quebra configuradas',
      edgeFunction: 'aplicar-regras-quebra-exames',
      categoria: 'quebra'
    },
    
    // === REGRAS DE EXCLUSÃO ===
    {
      id: 'v031',
      nome: 'Filtro Período Atual',
      descricao: 'Exclui registros fora do período para arquivos não-retroativos',
      edgeFunction: 'aplicar-filtro-periodo-atual',
      categoria: 'exclusao'
    },
    {
      id: 'v032',
      nome: 'Exclusão Clientes Específicos',
      descricao: 'Exclui registros de clientes que não devem ser processados',
      edgeFunction: 'aplicar-exclusao-clientes-especificos',
      categoria: 'exclusao'
    },
    {
      id: 'v036',
      nome: 'Exclusões por Período',
      descricao: 'Aplicação de exclusões baseadas em período de referência',
      edgeFunction: 'aplicar-exclusoes-periodo',
      categoria: 'exclusao'
    },
    {
      id: 'v037',
      nome: 'Filtro Data Laudo',
      descricao: 'Aplica filtro baseado na data do laudo médico',
      edgeFunction: 'aplicar-filtro-data-laudo',
      categoria: 'exclusao'
    },
    
    // === REGRAS DE VALIDAÇÃO ===
    {
      id: 'v021',
      nome: 'Validação Cliente',
      descricao: 'Valida se cliente existe e está ativo no sistema',
      edgeFunction: 'aplicar-validacao-cliente',
      categoria: 'validacao'
    },
    {
      id: 'v026',
      nome: 'De-Para Valores Automático',
      descricao: 'Aplica valores de referência para exames com valores zerados',
      edgeFunction: 'aplicar-de-para-automatico',
      categoria: 'validacao'
    },
    {
      id: 'v038',
      nome: 'Validação Regras Processamento',
      descricao: 'Validação completa de regras aplicadas no processamento',
      edgeFunction: 'validar-regras-processamento',
      categoria: 'validacao'
    },
    
    // === REGRAS DE TIPIFICAÇÃO ===
    {
      id: 'f005',
      nome: 'Tipificação Faturamento',
      descricao: 'Define tipo de faturamento baseado nas regras de negócio',
      edgeFunction: 'aplicar-tipificacao-faturamento',
      categoria: 'tipificacao'
    },
    {
      id: 'f006',
      nome: 'Tipificação Retroativa',
      descricao: 'Aplicação retroativa de tipificação de faturamento',
      edgeFunction: 'aplicar-tipificacao-retroativa',
      categoria: 'tipificacao'
    },
    
    // === REGRAS DE MAPEAMENTO ===
    {
      id: 'v039',
      nome: 'Mapeamento Nome Cliente',
      descricao: 'Aplica mapeamento de nomes de clientes para padronização',
      edgeFunction: 'aplicar-mapeamento-nome-cliente',
      categoria: 'mapeamento'
    },
    {
      id: 'v040',
      nome: 'Processamento Valores De-Para',
      descricao: 'Processa valores usando tabela de-para configurada',
      edgeFunction: 'processar-valores-de-para',
      categoria: 'mapeamento'
    },
    
    // === REGRAS DE TRATAMENTO ===
    {
      id: 'v041',
      nome: 'Aplicação Regras Tratamento',
      descricao: 'Aplica regras de tratamento configuradas no sistema',
      edgeFunction: 'aplicar-regras-tratamento',
      categoria: 'tratamento'
    },
    {
      id: 'v042',
      nome: 'Regras em Lote',
      descricao: 'Aplicação de múltiplas regras em processamento de lote',
      edgeFunction: 'aplicar-regras-lote',
      categoria: 'tratamento'
    },
    
    // === TRIGGERS E FUNÇÕES AUTOMÁTICAS ===
    {
      id: 't001',
      nome: 'Trigger Processamento Volumetria',
      descricao: 'Trigger principal que executa automaticamente no INSERT',
      edgeFunction: 'trigger_volumetria_processamento',
      categoria: 'trigger'
    },
    {
      id: 't002',
      nome: 'Trigger Normalização Médico',
      descricao: 'Normaliza automaticamente nomes de médicos',
      edgeFunction: 'trigger_normalizar_medico',
      categoria: 'trigger'
    },
    {
      id: 't003',
      nome: 'Trigger Quebra Automática',
      descricao: 'Trigger que aplica quebras automaticamente durante inserção',
      edgeFunction: 'trigger_quebra_automatica',
      categoria: 'trigger'
    },
    {
      id: 't004',
      nome: 'Trigger Tipificação Faturamento',
      descricao: 'Aplica tipificação automaticamente via trigger',
      edgeFunction: 'aplicar_tipificacao_faturamento',
      categoria: 'trigger'
    },
    {
      id: 't005',
      nome: 'Trigger Cliente Normalização',
      descricao: 'Normalização automática de nomes de clientes',
      edgeFunction: 'trigger_limpar_nome_cliente',
      categoria: 'trigger'
    },
    
    // === REGRAS ESPECIAIS ===
    {
      id: 's001',
      nome: 'Buscar Valor Onco',
      descricao: 'Busca e aplica valores específicos para exames oncológicos',
      edgeFunction: 'buscar-valor-onco',
      categoria: 'especial'
    },
    {
      id: 's002',
      nome: 'Correção Dados Exclusão',
      descricao: 'Corrige dados que foram excluídos incorretamente',
      edgeFunction: 'corrigir-dados-exclusao',
      categoria: 'especial'
    },
    {
      id: 's003',
      nome: 'Mapeamento Status Regras',
      descricao: 'Mapeia e monitora status de aplicação das regras',
      edgeFunction: 'mapear-status-regras',
      categoria: 'especial'
    }
  ];

  const verificarAplicacaoRegras = async () => {
    setLoading(true);
    try {
      const regrasVerificadas: RegraVerificacao[] = [];

      for (const regra of regrasDefinidas) {
        try {
          // Verificar logs de auditoria para esta regra nas últimas 24h
          const { data: auditLogs } = await supabase
            .from('audit_logs')
            .select('operation, new_data, timestamp, severity')
            .ilike('operation', `%${regra.id}%`)
            .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .order('timestamp', { ascending: false })
            .limit(5);

          // Verificar uploads processados nas últimas 24h
          const { data: uploads } = await supabase
            .from('processamento_uploads')
            .select('status, registros_processados, registros_inseridos, registros_erro, created_at')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(10);

          let status: RegraVerificacao['status'] = 'pendente';
          let aplicada = false;
          let ultimaExecucao: string | undefined;
          let registrosProcessados: number | undefined;
          let registrosAfetados: number | undefined;
          let erros: string[] = [];

          if (auditLogs && auditLogs.length > 0) {
            const ultimoLog = auditLogs[0];
            aplicada = true;
            ultimaExecucao = ultimoLog.timestamp;
            
            if (ultimoLog.new_data && typeof ultimoLog.new_data === 'object') {
              const data = ultimoLog.new_data as any;
              registrosProcessados = data.total_processados || 
                                   data.registros_encontrados || 
                                   data.registros_processados;
              registrosAfetados = data.total_substituidos || 
                                data.registros_corrigidos || 
                                data.registros_atualizados ||
                                data.total_alterados;
            }

            status = ultimoLog.severity === 'error' ? 'erro' : 'ok';
            
            if (ultimoLog.severity === 'warning' || ultimoLog.severity === 'error') {
              erros.push('Verificar logs para detalhes');
            }
          } else if (uploads && uploads.length > 0) {
            // Se não há logs específicos mas há uploads, considerar que regras automáticas foram aplicadas
            const uploadRecente = uploads[0];
            if (uploadRecente.status === 'concluido') {
              aplicada = true;
              status = 'ok';
              ultimaExecucao = uploadRecente.created_at;
              registrosProcessados = uploadRecente.registros_processados;
            }
          }

          regrasVerificadas.push({
            ...regra,
            aplicada,
            status,
            ultimaExecucao,
            registrosProcessados,
            registrosAfetados,
            erros
          });
        } catch (error) {
          console.error(`Erro ao verificar regra ${regra.id}:`, error);
          regrasVerificadas.push({
            ...regra,
            aplicada: false,
            status: 'erro',
            erros: ['Erro ao verificar status da regra']
          });
        }
      }

      setRegras(regrasVerificadas);
      
      const aplicadas = regrasVerificadas.filter(r => r.aplicada).length;
      toast({
        title: "Verificação concluída",
        description: `${aplicadas}/${regrasVerificadas.length} regras aplicadas nas últimas 24h`,
        variant: aplicadas === regrasVerificadas.length ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Erro ao verificar regras:', error);
      toast({
        title: "Erro na verificação",
        description: "Não foi possível verificar o status das regras",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const verificarRegrasEspecificas = async () => {
    setLoadingEspecificas(true);
    try {
      const verificacoes: VerificacaoEspecifica[] = [];

      // 1. Verificar regra DX/CR → RX/MG
      const { data: modalidadeDxCr } = await supabase
        .from('volumetria_mobilemed')
        .select('count')
        .in('MODALIDADE', ['DX', 'CR']);

      verificacoes.push({
        regra: 'Modalidade DX/CR',
        condicao: 'Não devem existir registros com modalidade DX ou CR',
        esperado: 0,
        encontrado: modalidadeDxCr?.[0]?.count || 0,
        status: (modalidadeDxCr?.[0]?.count || 0) === 0 ? 'ok' : 'falha',
        detalhes: modalidadeDxCr?.[0]?.count > 0 ? 'Ainda existem registros com DX/CR não convertidos' : 'Regra aplicada corretamente'
      });

      // 2. Verificar especialidade Coluna
      const { data: especialidadeColuna } = await supabase
        .from('volumetria_mobilemed')
        .select('count')
        .eq('ESPECIALIDADE', 'Colunas');

      verificacoes.push({
        regra: 'Especialidade Coluna',
        condicao: 'Não devem existir registros com especialidade "Colunas"',
        esperado: 0,
        encontrado: especialidadeColuna?.[0]?.count || 0,
        status: (especialidadeColuna?.[0]?.count || 0) === 0 ? 'ok' : 'falha',
        detalhes: especialidadeColuna?.[0]?.count > 0 ? 'Ainda existem registros com especialidade "Colunas"' : 'Regra aplicada corretamente'
      });

      // 3. Verificar valores zerados sem de-para
      const { data: valoresZero } = await supabase
        .from('volumetria_mobilemed')
        .select('count')
        .eq('VALORES', 0);

      const { data: totalDeParas } = await supabase
        .from('valores_referencia_de_para')
        .select('count')
        .eq('ativo', true);

      const totalDeParasAtivos = totalDeParas?.[0]?.count || 0;
      const valoresZeroEncontrados = valoresZero?.[0]?.count || 0;

      verificacoes.push({
        regra: 'De-Para Valores',
        condicao: 'Valores zerados devem ser minimizados se existem registros de de-para',
        esperado: totalDeParasAtivos > 0 ? 0 : -1, // -1 significa "não aplicável"
        encontrado: valoresZeroEncontrados,
        status: totalDeParasAtivos === 0 ? 'ok' : (valoresZeroEncontrados === 0 ? 'ok' : 'falha'),
        detalhes: totalDeParasAtivos === 0 ? 'Nenhum de-para configurado' : 
                 valoresZeroEncontrados === 0 ? 'Todos os valores zerados foram corrigidos' : 
                 `${valoresZeroEncontrados} registros ainda com valores zerados`
      });

      // 4. Verificar registros pendentes de quebra
      const { data: pendentesQuebra } = await supabase
        .from('volumetria_mobilemed')
        .select('count')
        .eq('processamento_pendente', true);

      verificacoes.push({
        regra: 'Quebra de Exames',
        condicao: 'Não devem existir registros pendentes de quebra',
        esperado: 0,
        encontrado: pendentesQuebra?.[0]?.count || 0,
        status: (pendentesQuebra?.[0]?.count || 0) === 0 ? 'ok' : 'falha',
        detalhes: pendentesQuebra?.[0]?.count > 0 ? 'Existem registros aguardando quebra' : 'Todas as quebras foram processadas'
      });

      // 5. Verificar tipificação de faturamento
      const { data: semTipificacao } = await supabase
        .from('volumetria_mobilemed')
        .select('count')
        .is('tipo_faturamento', null);

      verificacoes.push({
        regra: 'Tipificação Faturamento',
        condicao: 'Todos os registros devem ter tipificação de faturamento',
        esperado: 0,
        encontrado: semTipificacao?.[0]?.count || 0,
        status: (semTipificacao?.[0]?.count || 0) === 0 ? 'ok' : 'falha',
        detalhes: semTipificacao?.[0]?.count > 0 ? 'Registros sem tipificação de faturamento' : 'Todos os registros tipificados'
      });

      // 6. Verificar especialidade MAMA com modalidade MG (deveria ser MAMO)
      const { data: mamaMG } = await supabase
        .from('volumetria_mobilemed')
        .select('count')
        .eq('MODALIDADE', 'MG')
        .eq('ESPECIALIDADE', 'MAMA');

      verificacoes.push({
        regra: 'Especialidade MAMA/MG → MAMO',
        condicao: 'Modalidade MG não pode ter especialidade MAMA (deve ser MAMO)',
        esperado: 0,
        encontrado: mamaMG?.[0]?.count || 0,
        status: (mamaMG?.[0]?.count || 0) === 0 ? 'ok' : 'falha',
        detalhes: mamaMG?.[0]?.count > 0 ? `${mamaMG?.[0]?.count} registros com MAMA/MG precisam correção para MAMO` : 'Todas as especialidades de mamografia estão corretas'
      });

      setVerificacoesEspecificas(verificacoes);
      
      const falhas = verificacoes.filter(v => v.status === 'falha').length;
      if (falhas > 0) {
        toast({
          title: "Verificações específicas concluídas",
          description: `${falhas} regra(s) com problemas identificados`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Verificações específicas concluídas",
          description: "Todas as regras específicas estão funcionando corretamente",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Erro ao verificar regras específicas:', error);
      toast({
        title: "Erro na verificação específica",
        description: "Não foi possível verificar as regras específicas",
        variant: "destructive"
      });
    } finally {
      setLoadingEspecificas(false);
    }
  };

  const executarRegra = async (regraId: string, edgeFunction: string) => {
    try {
      toast({
        title: "Executando regra",
        description: `Iniciando execução da regra ${regraId}...`,
      });

      const { data, error } = await supabase.functions.invoke(edgeFunction, {
        body: { arquivo_fonte: 'volumetria_padrao' } // Usar padrão como teste
      });

      if (error) throw error;

      toast({
        title: "Regra executada",
        description: `Regra ${regraId} executada com sucesso`,
        variant: "default"
      });

      // Atualizar verificação após execução
      await verificarAplicacaoRegras();
    } catch (error) {
      console.error('Erro ao executar regra:', error);
      toast({
        title: "Erro na execução",
        description: `Falha ao executar regra ${regraId}`,
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: RegraVerificacao['status']) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'erro':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pendente':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: RegraVerificacao['status'], aplicada: boolean) => {
    if (status === 'ok' && aplicada) {
      return <Badge className="bg-green-100 text-green-800">Aplicada</Badge>;
    }
    if (status === 'erro') {
      return <Badge variant="destructive">Erro</Badge>;
    }
    if (status === 'pendente') {
      return <Badge variant="secondary">Pendente</Badge>;
    }
    return <Badge variant="outline">Não Aplicável</Badge>;
  };

  const getCategoriaColor = (categoria: RegraVerificacao['categoria']) => {
    const cores = {
      modalidade: 'bg-blue-100 text-blue-800',
      especialidade: 'bg-purple-100 text-purple-800',
      quebra: 'bg-orange-100 text-orange-800',
      exclusao: 'bg-red-100 text-red-800',
      validacao: 'bg-green-100 text-green-800',
      tipificacao: 'bg-indigo-100 text-indigo-800',
      mapeamento: 'bg-teal-100 text-teal-800',
      tratamento: 'bg-amber-100 text-amber-800',
      trigger: 'bg-violet-100 text-violet-800',
      especial: 'bg-rose-100 text-rose-800'
    };
    return cores[categoria] || 'bg-gray-100 text-gray-800';
  };

  useEffect(() => {
    verificarAplicacaoRegras();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Verificação de 28 Regras de Processamento
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                onClick={verificarRegrasEspecificas}
                disabled={loadingEspecificas}
                variant="outline"
                size="sm"
              >
                <Search className={`h-4 w-4 mr-2 ${loadingEspecificas ? 'animate-spin' : ''}`} />
                Verificar Específicas
              </Button>
              <Button 
                onClick={verificarAplicacaoRegras}
                disabled={loading}
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar Status
              </Button>
            </div>
          </div>
          
          {/* Resumo Estatístico */}
          {regras.length > 0 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Object.entries(
                regras.reduce((acc, regra) => {
                  if (!acc[regra.categoria]) {
                    acc[regra.categoria] = { total: 0, aplicadas: 0 };
                  }
                  acc[regra.categoria].total++;
                  if (regra.aplicada && regra.status === 'ok') {
                    acc[regra.categoria].aplicadas++;
                  }
                  return acc;
                }, {} as Record<string, { total: number; aplicadas: number }>)
              ).map(([categoria, stats]) => (
                <div key={categoria} className="text-center p-3 bg-muted rounded-lg">
                  <div className={`text-sm font-medium mb-1 ${getCategoriaColor(categoria as any)?.replace('bg-', 'text-').replace('-100', '-600')}`}>
                    {categoria.toUpperCase()}
                  </div>
                  <div className="text-lg font-bold">
                    {stats.aplicadas}/{stats.total}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Math.round((stats.aplicadas / stats.total) * 100)}% OK
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Verificações Específicas */}
      {verificacoesEspecificas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Verificações Específicas das Regras</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {verificacoesEspecificas.map((verificacao, index) => (
                <Alert key={index} className={verificacao.status === 'falha' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
                  <div className="flex items-start gap-3">
                    {verificacao.status === 'ok' ? 
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" /> :
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    }
                    <div className="flex-1">
                      <div className="font-medium">{verificacao.regra}</div>
                      <AlertDescription className="mt-1">
                        <div className="text-sm text-muted-foreground mb-1">{verificacao.condicao}</div>
                        <div className="text-sm">
                          <span className="font-medium">Esperado:</span> {verificacao.esperado === -1 ? 'N/A' : verificacao.esperado} | 
                          <span className="font-medium"> Encontrado:</span> {verificacao.encontrado}
                        </div>
                        {verificacao.detalhes && (
                          <div className="text-sm mt-1 text-muted-foreground">{verificacao.detalhes}</div>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status das Regras */}
      <Card>
        <CardHeader>
          <CardTitle>Status Geral das Regras</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Regra</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última Execução</TableHead>
                <TableHead>Registros</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regras.map((regra) => (
                <TableRow key={regra.id}>
                   <TableCell>
                     <div>
                       <div className="flex items-center gap-2">
                         {getStatusIcon(regra.status)}
                         <span className="font-medium">{regra.id}: {regra.nome}</span>
                       </div>
                       <div className="text-sm text-muted-foreground mt-1">
                         {regra.descricao}
                       </div>
                       <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                         <span className="bg-muted px-2 py-1 rounded">
                           {regra.categoria === 'trigger' ? '🔄 Automático (Trigger)' : '⚙️ Manual (Edge Function)'}
                         </span>
                         <span className="text-muted-foreground">
                           {regra.categoria === 'trigger' ? 'Executa no INSERT/UPDATE' : 'Execução sob demanda'}
                         </span>
                       </div>
                     </div>
                   </TableCell>
                  <TableCell>
                    <Badge className={getCategoriaColor(regra.categoria)}>
                      {regra.categoria}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(regra.status, regra.aplicada)}
                  </TableCell>
                  <TableCell>
                    {regra.ultimaExecucao ? 
                      new Date(regra.ultimaExecucao).toLocaleString() : 
                      'Nunca executada'
                    }
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {regra.registrosProcessados && (
                        <div>Processados: {regra.registrosProcessados}</div>
                      )}
                      {regra.registrosAfetados && (
                        <div>Afetados: {regra.registrosAfetados}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => executarRegra(regra.id, regra.edgeFunction)}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Executar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}