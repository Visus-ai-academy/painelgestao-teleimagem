import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download, DollarSign, FileText, Wifi, Building } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface DemonstrativoCliente {
  cliente_id: string;
  cliente_nome: string;
  periodo: string;
  total_exames: number;
  valor_exames: number;
  valor_franquia: number;
  valor_portal_laudos: number;
  valor_integracao: number;
  valor_bruto: number;
  valor_impostos: number;
  valor_total: number;
  detalhes_franquia: any;
  detalhes_exames: any[];
  detalhes_tributacao: {
    simples_nacional: boolean;
    percentual_iss?: number;
    valor_iss?: number;
    base_calculo?: number;
  };
  alertas?: string[]; // Alertas de problemas
}

interface Resumo {
  total_clientes: number;
  clientes_processados: number;
  valor_bruto_geral: number;
  valor_impostos_geral: number;
  valor_total_geral: number;
  valor_exames_geral: number;
  valor_franquias_geral: number;
  valor_portal_geral: number;
  valor_integracao_geral: number;
  clientes_simples_nacional: number;
  clientes_regime_normal: number;
}

interface DemonstrativoFaturamentoCompletoProps {
  periodo: string;
  onDemonstrativosGerados?: (dados: { demonstrativos: DemonstrativoCliente[], resumo: Resumo }) => void;
  onResetarStatus?: () => void;
  onStatusChange?: (status: 'pendente' | 'processando' | 'concluido') => void;
  renderMode?: 'full' | 'button-only'; // full = com Card, button-only = apenas botão
}

export function DemonstrativoFaturamentoCompleto({ 
  periodo, 
  onDemonstrativosGerados, 
  onResetarStatus,
  onStatusChange,
  renderMode = 'full'
}: DemonstrativoFaturamentoCompletoProps) {
  const [loading, setLoading] = useState(false);
  const [demonstrativos, setDemonstrativos] = useState<DemonstrativoCliente[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [timeoutIdRef, setTimeoutIdRef] = useState<number | null>(null);
  const { toast } = useToast();

  // Função para cancelar processamento
  const cancelarProcessamento = () => {
    console.log('🛑 Cancelando processamento...');
    setLoading(false);
    if (timeoutIdRef) {
      clearTimeout(timeoutIdRef);
      setTimeoutIdRef(null);
    }
    if (onStatusChange) {
      onStatusChange('pendente');
    }
    toast({
      title: 'Processamento cancelado',
      description: 'O processamento foi cancelado pelo usuário.',
    });
  };

  // Chave para localStorage baseada no período
  const storageKey = `demonstrativos_${periodo}`;

  // Carregar dados do localStorage ao montar o componente
  useEffect(() => {
    if (periodo) {
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        try {
          const { demonstrativos: savedDemonstrativos, resumo: savedResumo } = JSON.parse(savedData);
          setDemonstrativos(savedDemonstrativos || []);
          setResumo(savedResumo || null);
        } catch (error) {
          console.error('Erro ao carregar dados do localStorage:', error);
        }
      }
    }
  }, [periodo, storageKey]);

  // Salvar dados no localStorage sempre que demonstrativos ou resumo mudarem
  useEffect(() => {
    if (periodo && (demonstrativos.length > 0 || resumo)) {
      const dataToSave = { demonstrativos, resumo };
      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    }
  }, [demonstrativos, resumo, periodo, storageKey]);

  // Limpar dados quando o período mudar
  useEffect(() => {
    if (periodo) {
      setDemonstrativos([]);
      setResumo(null);
      setExpandedClients(new Set());
    }
  }, [periodo]);

  const handleGerarDemonstrativos = async () => {
    if (!periodo) {
      toast({
        title: "Período obrigatório",
        description: "Por favor, informe o período no formato YYYY-MM",
        variant: "destructive"
      });
      return;
    }

    // ✅ VALIDAÇÃO CRÍTICA: Verificar se há registros sem tipificação
    console.log('🔍 Validando tipificação dos registros...');
    const { count: registrosSemTipificacao, error: validacaoError } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('periodo_referencia', periodo)
      .is('tipo_faturamento', null);

    if (validacaoError) {
      console.error('❌ Erro ao validar tipificação:', validacaoError);
      toast({
        title: "Erro na validação",
        description: "Não foi possível verificar a tipificação dos registros.",
        variant: "destructive"
      });
      return;
    }

    if (registrosSemTipificacao && registrosSemTipificacao > 0) {
      toast({
        title: "Tipificação incompleta",
        description: `Existem ${registrosSemTipificacao.toLocaleString('pt-BR')} registros sem tipo_faturamento. Execute a correção de tipificação antes de gerar os demonstrativos.`,
        variant: "destructive"
      });
      return;
    }

    console.log('✅ Todos os registros estão tipificados. Iniciando geração de demonstrativos...');

    // Reset todos os status para "Pendente"
    if (onResetarStatus) {
      onResetarStatus();
    }

    // Marcar como processando
    if (onStatusChange) {
      onStatusChange('processando');
    }

    setLoading(true);
    
    // Timeout geral de 15 minutos para todo o processamento
    const timeoutId = setTimeout(() => {
      console.error('⏰ Timeout geral atingido (15 minutos)');
      if (onStatusChange) {
        onStatusChange('pendente');
      }
      setLoading(false);
      setTimeoutIdRef(null);
      toast({
        title: 'Timeout excedido',
        description: 'O processamento excedeu 15 minutos. Verifique se os demonstrativos foram gerados no banco de dados.',
        variant: 'destructive'
      });
    }, 900000); // 15 minutos
    
    setTimeoutIdRef(timeoutId as unknown as number);
    
    try {
      console.log('🔄 Iniciando geração em lotes para o período:', periodo);

      // Buscar clientes ativos para processar em lotes (evita timeout na Edge Function)
      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('id')
        .eq('ativo', true)
        .order('nome');

      // Caso não consiga carregar clientes, usar fallback: uma chamada única (comportamento anterior)
      const processarComChamadaUnica = async () => {
        const { data, error } = await supabase.functions.invoke('gerar-demonstrativos-faturamento', {
          body: { periodo }
        });
        return { data, error } as { data: any; error: any };
      };

      if (clientesError || !clientes || clientes.length === 0) {
        console.warn('⚠️ Falha ao carregar clientes ou lista vazia. Usando chamada única.', clientesError);
        const { data, error } = await processarComChamadaUnica();
        if (error) throw new Error(`Erro na edge function: ${error.message || JSON.stringify(error)}`);
        if (!data?.success) throw new Error(data?.message || data?.error || 'Erro desconhecido na geração dos demonstrativos');

        setDemonstrativos(Array.isArray(data.demonstrativos) ? data.demonstrativos : []);
        setResumo(data.resumo || null);

        // 💾 Gravar demonstrativos no banco de dados (fallback path)
        try {
          const recordsToInsert = (data.demonstrativos || []).map((demo: DemonstrativoCliente) => ({
            cliente_id: demo.cliente_id,
            cliente_nome: demo.cliente_nome,
            periodo_referencia: periodo,
            total_exames: demo.total_exames || 0,
            valor_exames: demo.valor_exames || 0,
            valor_franquia: demo.valor_franquia || 0,
            valor_portal_laudos: demo.valor_portal_laudos || 0,
            valor_integracao: demo.valor_integracao || 0,
            valor_bruto_total: demo.valor_bruto || 0,
            valor_total_impostos: demo.valor_impostos || 0,
            valor_liquido: demo.valor_total || 0,
            detalhes_exames: demo.detalhes_exames || [],
            detalhes_franquia: demo.detalhes_franquia || {},
            parametros_utilizados: demo.detalhes_tributacao || {},
            status: 'calculado'
          }));

          const { error: insertError } = await supabase
            .from('demonstrativos_faturamento_calculados')
            .upsert(recordsToInsert, {
              onConflict: 'cliente_nome,periodo_referencia',
              ignoreDuplicates: false
            });

          if (insertError) {
            console.error('❌ Erro ao gravar demonstrativos no banco (fallback):', insertError);
          } else {
            console.log('✅ Demonstrativos gravados no banco (fallback)');
          }
        } catch (dbError: any) {
          console.error('❌ Erro ao gravar no banco (fallback):', dbError);
        }

        // Cache local
        try {
          const dadosParaSalvar = {
            demonstrativos: data.demonstrativos,
            resumo: data.resumo,
            periodo,
            timestamp: new Date().toISOString()
          };
          localStorage.setItem(`demonstrativos_completos_${periodo}`, JSON.stringify(dadosParaSalvar));
        } catch (e) {
          console.warn('Não foi possível salvar demonstrativos completos no localStorage (fallback):', e);
        }

        if (onStatusChange) onStatusChange('concluido');
        if (onDemonstrativosGerados) onDemonstrativosGerados({ demonstrativos: data.demonstrativos, resumo: data.resumo });
        toast({ title: 'Demonstrativos gerados!', description: `${data.resumo?.clientes_processados || 0} clientes processados` });
        return;
      }

      // Processar em lotes
      const chunkSize = 6; // reduzido para evitar WORKER_LIMIT (CPU/Memory exceeded)
      const allDemonstrativos: any[] = [];
      const allAlertas: string[] = [];
      let resumoAgregado: any = {
        total_clientes: 0,
        clientes_processados: 0,
        valor_bruto_geral: 0,
        valor_impostos_geral: 0,
        valor_total_geral: 0,
        valor_exames_geral: 0,
        valor_franquias_geral: 0,
        valor_portal_geral: 0,
        valor_integracao_geral: 0,
        clientes_simples_nacional: 0,
        clientes_regime_normal: 0,
      };

      const somarResumo = (r: any) => {
        if (!r) return;
        resumoAgregado.total_clientes += Number(r.total_clientes || 0);
        resumoAgregado.clientes_processados += Number(r.clientes_processados || 0);
        resumoAgregado.valor_bruto_geral += Number(r.valor_bruto_geral || 0);
        resumoAgregado.valor_impostos_geral += Number(r.valor_impostos_geral || 0);
        resumoAgregado.valor_total_geral += Number(r.valor_total_geral || 0);
        resumoAgregado.valor_exames_geral += Number(r.valor_exames_geral || 0);
        resumoAgregado.valor_franquias_geral += Number(r.valor_franquias_geral || 0);
        resumoAgregado.valor_portal_geral += Number(r.valor_portal_geral || 0);
        resumoAgregado.valor_integracao_geral += Number(r.valor_integracao_geral || 0);
        resumoAgregado.clientes_simples_nacional += Number(r.clientes_simples_nacional || 0);
        resumoAgregado.clientes_regime_normal += Number(r.clientes_regime_normal || 0);
      };

      const totalLotes = Math.ceil(clientes.length / chunkSize);
      console.log(`📦 Total de ${clientes.length} clientes será processado em ${totalLotes} lote(s)`);
      
      for (let i = 0; i < clientes.length; i += chunkSize) {
        const chunk = clientes.slice(i, i + chunkSize);
        const ids = chunk.map(c => c.id);
        const loteNumero = Math.floor(i / chunkSize) + 1;
        console.log(`🚚 Processando lote ${loteNumero}/${totalLotes} (${ids.length} clientes)`);

        let data: any, error: any;
        try {
          const resp: any = await Promise.race([
            supabase.functions.invoke('gerar-demonstrativos-faturamento', { body: { periodo, clientes: ids } }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao processar lote')), 120000))
          ]);
          data = (resp as any)?.data;
          error = (resp as any)?.error;
        } catch (e: any) {
          error = e;
          console.error(`❌ Erro ao processar lote ${loteNumero}:`, e);
        }

        if (error) {
          console.error(`❌ Erro no lote ${loteNumero}/${totalLotes}:`, error);
          console.error('📋 IDs do lote com erro:', ids);
          
          // Tentar extrair mais detalhes do erro
          const errorMessage = error.message || error.msg || 'Erro desconhecido';
          const errorDetails = error.details || error.hint || '';
          
          toast({ 
            title: `Lote ${loteNumero}/${totalLotes} com erro`, 
            description: `${errorMessage}${errorDetails ? ` - ${errorDetails}` : ''}`, 
            variant: 'destructive' 
          });
          continue;
        }
        if (!data?.success) {
          console.warn(`⚠️ Lote ${loteNumero}/${totalLotes} sem sucesso:`, data);
          continue;
        }

        console.log(`✅ Lote ${loteNumero}/${totalLotes} processado com sucesso`);
        
        if (Array.isArray(data.demonstrativos)) {
          allDemonstrativos.push(...data.demonstrativos);
        }
        if (Array.isArray(data.alertas)) {
          allAlertas.push(...data.alertas);
        }
        somarResumo(data.resumo);
      }
      
      console.log(`🎯 Processamento de lotes concluído. Total de demonstrativos: ${allDemonstrativos.length}`);

      // Remover duplicados por cliente_id preservando o último
      const mapByCliente = new Map<string, any>();
      for (const d of allDemonstrativos) {
        mapByCliente.set(d.cliente_id, d);
      }
      const dedupedDemonstrativos = Array.from(mapByCliente.values());
      
      // Se não houver demonstrativos, lançar erro
      if (dedupedDemonstrativos.length === 0) {
        throw new Error('Nenhum demonstrativo foi gerado. Verifique os erros nos lotes processados.');
      }

      setDemonstrativos(dedupedDemonstrativos);
      setResumo(resumoAgregado);

      // Cache local imediato (não bloqueia UI)
      try {
        const dadosParaSalvar = {
          demonstrativos: dedupedDemonstrativos,
          resumo: resumoAgregado,
          periodo,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem(`demonstrativos_completos_${periodo}`, JSON.stringify(dadosParaSalvar));
        console.log('💾 demonstrativos_completos salvos no localStorage (cache)');
      } catch (e) {
        console.warn('Não foi possível salvar demonstrativos completos no localStorage:', e);
      }

      // Atualizar status/parent e exibir sucesso antes de gravar no banco
      console.log('🏁 Finalizando processamento...');
      if (onStatusChange) {
        console.log('✅ Mudando status para: concluido');
        onStatusChange('concluido');
      }
      if (onDemonstrativosGerados) {
        console.log('📤 Enviando callback onDemonstrativosGerados');
        onDemonstrativosGerados({ demonstrativos: dedupedDemonstrativos, resumo: resumoAgregado });
      }

      toast({
        title: 'Demonstrativos gerados com sucesso!',
        description: `${dedupedDemonstrativos.length} clientes processados em ${totalLotes} lote(s)`
      });

      // Limpar timeout
      clearTimeout(timeoutId);

      // 💾 Gravar demonstrativos no banco de dados em segundo plano (chunked)
      (async () => {
        try {
          const records = dedupedDemonstrativos.map((demo: DemonstrativoCliente) => ({
            cliente_id: demo.cliente_id,
            cliente_nome: demo.cliente_nome,
            periodo_referencia: periodo,
            total_exames: demo.total_exames || 0,
            valor_exames: demo.valor_exames || 0,
            valor_franquia: demo.valor_franquia || 0,
            valor_portal_laudos: demo.valor_portal_laudos || 0,
            valor_integracao: demo.valor_integracao || 0,
            valor_bruto_total: demo.valor_bruto || 0,
            valor_total_impostos: demo.valor_impostos || 0,
            valor_liquido: demo.valor_total || 0,
            detalhes_exames: demo.detalhes_exames || [],
            detalhes_franquia: demo.detalhes_franquia || {},
            parametros_utilizados: demo.detalhes_tributacao || {},
            status: 'calculado'
          }));

          const batchSize = 50;
          for (let i = 0; i < records.length; i += batchSize) {
            const slice = records.slice(i, i + batchSize);
            const { error: insertError } = await supabase
              .from('demonstrativos_faturamento_calculados')
              .upsert(slice, {
                onConflict: 'cliente_nome,periodo_referencia',
                ignoreDuplicates: false
              });

            if (insertError) {
              console.error(`❌ Erro ao gravar demonstrativos no banco (lote ${i / batchSize + 1}):`, insertError);
            }
          }

          console.log('✅ Demonstrativos gravados no banco com sucesso (em lotes)');
        } catch (dbError: any) {
          console.error('❌ Erro ao gravar no banco:', dbError);
        }
      })();

      if (allAlertas.length > 0) {
        setTimeout(() => {
          toast({
            title: '⚠️ Alertas de Segurança',
            description: `${allAlertas.length} alerta(s) detectado(s). Verifique os detalhes.`,
            variant: 'destructive',
          });
        }, 800);
      }
    } catch (error: any) {
      console.error('❌ Erro completo:', error);
      console.error('❌ Stack trace:', error.stack);
      
      // Limpar timeout
      clearTimeout(timeoutId);
      
      if (onStatusChange) {
        console.log('⚠️ Mudando status para: pendente (devido a erro)');
        onStatusChange('pendente');
      }
      toast({
        title: 'Erro ao gerar demonstrativos',
        description: `${error.message || 'Erro desconhecido'}. Verifique o console para mais detalhes.`,
        variant: 'destructive'
      });
    } finally {
      console.log('🔚 Finalizando função handleGerarDemonstrativos');
      setLoading(false);
      
      // Garantir que o timeout seja limpo mesmo em caso de erro
      if (timeoutIdRef) {
        try {
          clearTimeout(timeoutIdRef);
          setTimeoutIdRef(null);
        } catch (e) {
          // Ignorar erro ao limpar timeout
        }
      }
    }
  };

  const toggleClientExpansion = (clienteId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clienteId)) {
      newExpanded.delete(clienteId);
    } else {
      newExpanded.add(clienteId);
    }
    setExpandedClients(newExpanded);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (detalhes: any) => {
    if (!detalhes || detalhes.tipo === 'nao_aplica') {
      return <Badge variant="secondary">Não Aplica</Badge>;
    }
    if (detalhes.tipo === 'sem_volume') {
      return <Badge variant="outline">Sem Volume</Badge>;
    }
    return <Badge variant="default">Aplicada</Badge>;
  };

  // Renderizar apenas o botão se renderMode = 'button-only'
  if (renderMode === 'button-only') {
    return (
      <div className="flex gap-2 items-center">
        <Button 
          onClick={handleGerarDemonstrativos}
          disabled={loading || !periodo}
          size="lg"
          className="min-w-[280px] bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <FileText className="h-5 w-5 mr-2" />
              📊 Gerar Demonstrativos
            </>
          )}
        </Button>
        {loading && (
          <Button 
            onClick={cancelarProcessamento}
            variant="outline"
            size="lg"
            className="text-destructive border-destructive hover:bg-destructive/10"
          >
            Forçar Cancelamento
          </Button>
        )}
      </div>
    );
  }

  // Renderização completa com Card (padrão)
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Demonstrativos de Faturamento Completo
          </CardTitle>
          <CardDescription>
            Gere demonstrativos incluindo valores de exames, franquias, portal de laudos e integração
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button 
              onClick={handleGerarDemonstrativos}
              disabled={loading || !periodo}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Gerar Demonstrativos
                </>
              )}
            </Button>
            <div className="text-sm text-muted-foreground">
              Período selecionado: <strong>{periodo || 'Nenhum período selecionado'}</strong>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ✅ MOVER PARA ABA DEMONSTRATIVOS: Remover daqui */}
      {false && resumo && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo Geral - {periodo}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {resumo.clientes_processados}
                </div>
                <div className="text-sm text-muted-foreground">Clientes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(resumo.valor_exames_geral)}
                </div>
                <div className="text-sm text-muted-foreground">Exames</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(resumo.valor_franquias_geral + resumo.valor_portal_geral + resumo.valor_integracao_geral)}
                </div>
                <div className="text-sm text-muted-foreground">Adicionais</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(resumo.valor_impostos_geral)}
                </div>
                <div className="text-sm text-muted-foreground">Impostos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(resumo.valor_total_geral)}
                </div>
                <div className="text-sm text-muted-foreground">Líquido</div>
              </div>
            </div>
            
            {/* Informação sobre regime tributário */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-center gap-6 text-sm">
                <div className="text-center">
                  <div className="font-medium text-blue-600">{resumo.clientes_simples_nacional}</div>
                  <div className="text-muted-foreground">Simples Nacional</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-gray-600">{resumo.clientes_regime_normal}</div>
                  <div className="text-muted-foreground">Regime Normal</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ✅ MOVER PARA ABA DEMONSTRATIVOS: Remover daqui */}
      {false && demonstrativos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Demonstrativos por Cliente</CardTitle>
            <CardDescription>
              Clique em um cliente para ver os detalhes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {demonstrativos.map((demo) => (
                <Collapsible key={demo.cliente_id}>
                  <CollapsibleTrigger 
                    className="w-full"
                    onClick={() => toggleClientExpansion(demo.cliente_id)}
                  >
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        {expandedClients.has(demo.cliente_id) ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRight className="h-4 w-4" />
                        }
                        <Building className="h-4 w-4" />
                         <span className="font-medium">{demo.cliente_nome}</span>
                         {demo.alertas && demo.alertas.length > 0 && (
                           <div className="flex flex-col gap-1 ml-2">
                             {demo.alertas.map((alerta, alertaIndex) => (
                               <span key={alertaIndex} className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                                 {alerta}
                               </span>
                             ))}
                           </div>
                         )}
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-medium">{demo.total_exames}</div>
                          <div className="text-muted-foreground">Exames</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-green-600">
                            {formatCurrency(demo.valor_exames)}
                          </div>
                          <div className="text-muted-foreground">Valor Exames</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-blue-600">
                            {formatCurrency(demo.valor_franquia)}
                          </div>
                          <div className="text-muted-foreground">Franquia</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-purple-600">
                            {formatCurrency(demo.valor_portal_laudos)}
                          </div>
                          <div className="text-muted-foreground">Portal</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-orange-600">
                            {formatCurrency(demo.valor_integracao)}
                          </div>
                          <div className="text-muted-foreground">Integração</div>
                        </div>
                        {demo.valor_impostos > 0 && (
                          <div className="text-center">
                            <div className="font-medium text-red-600">
                              -{formatCurrency(demo.valor_impostos)}
                            </div>
                            <div className="text-muted-foreground">Impostos</div>
                          </div>
                        )}
                        <div className="text-center">
                          <div className="font-bold text-lg">
                            {formatCurrency(demo.valor_total)}
                          </div>
                          <div className="text-muted-foreground">Líquido</div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="p-4 border-l border-r border-b rounded-b-lg bg-muted/25 space-y-4">
                      {/* Detalhes da Franquia */}
                      {demo.valor_franquia > 0 && demo.detalhes_franquia && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Detalhes da Franquia
                          </h4>
                          <div className="bg-background p-3 rounded border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Status:</span>
                              {getStatusBadge(demo.detalhes_franquia)}
                            </div>
                            <div className="text-sm">
                              <strong>Motivo:</strong> {demo.detalhes_franquia.motivo || 'N/A'}
                            </div>
                            {demo.detalhes_franquia.volume_atual !== undefined && (
                              <div className="text-sm">
                                <strong>Volume:</strong> {demo.detalhes_franquia.volume_atual} exames
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Detalhes da Tributação */}
                      {demo.detalhes_tributacao && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Informações Tributárias
                          </h4>
                          <div className="bg-background p-3 rounded border space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Regime Tributário:</span>
                              <Badge variant={demo.detalhes_tributacao.simples_nacional ? "default" : "secondary"}>
                                {demo.detalhes_tributacao.simples_nacional ? "Simples Nacional" : "Regime Normal"}
                              </Badge>
                            </div>
                            
                            {!demo.detalhes_tributacao.simples_nacional && demo.detalhes_tributacao.percentual_iss && (
                              <>
                                <div className="text-sm">
                                  <strong>Base de Cálculo:</strong> {formatCurrency(demo.detalhes_tributacao.base_calculo || 0)}
                                </div>
                                <div className="text-sm">
                                  <strong>ISS ({demo.detalhes_tributacao.percentual_iss}%):</strong> {formatCurrency(demo.detalhes_tributacao.valor_iss || 0)}
                                </div>
                                <div className="text-sm font-medium text-green-600">
                                  <strong>Valor Líquido:</strong> {formatCurrency(demo.valor_total)}
                                </div>
                              </>
                            )}
                            
                            {demo.detalhes_tributacao.simples_nacional && (
                              <div className="text-sm text-blue-600">
                                <strong>Obs:</strong> Empresa enquadrada no Simples Nacional - sem retenção de ISS
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Detalhes dos Exames */}
                      {demo.detalhes_exames.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Detalhamento por Modalidade/Especialidade
                          </h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Modalidade</TableHead>
                                <TableHead>Especialidade</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Prioridade</TableHead>
                                <TableHead className="text-right">Qtd</TableHead>
                                <TableHead className="text-right">Valor Unit.</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {demo.detalhes_exames.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell>{item.modalidade}</TableCell>
                                  <TableCell>{item.especialidade}</TableCell>
                                  <TableCell>{item.categoria}</TableCell>
                                  <TableCell>{item.prioridade}</TableCell>
                                  <TableCell className="text-right">{item.quantidade}</TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(item.valor_unitario)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(item.valor_total)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}