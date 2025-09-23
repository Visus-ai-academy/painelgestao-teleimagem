import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, RefreshCw, Database, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DemonstrativoCliente {
  id?: string;
  cliente_id?: string;
  cliente_nome: string;
  total_exames: number;
  total_registros: number;
  volume_referencia: number;
  condicao_volume: string;
  valor_exames: number;
  valor_franquia: number;
  valor_portal_laudos: number;
  valor_integracao: number;
  valor_bruto_total: number;
  percentual_iss: number;
  valor_iss: number;
  impostos_ab_min: number;
  valor_impostos_federais: number;
  valor_total_impostos: number;
  valor_liquido: number;
  valor_total_faturamento: number;
  detalhes_franquia: any;
  detalhes_exames: any[];
  parametros_utilizados: any;
  calculado_em?: string;
}

interface Resumo {
  total_clientes: number;
  clientes_processados: number;
  total_exames_geral: number;
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

interface DemonstrativoFaturamentoOtimizadoProps {
  periodo: string;
  onDemonstrativosGerados?: (demonstrativos: DemonstrativoCliente[], resumo: Resumo) => void;
}

export default function DemonstrativoFaturamentoOtimizado({ periodo, onDemonstrativosGerados }: DemonstrativoFaturamentoOtimizadoProps) {
  const [loading, setLoading] = useState(false);
  const [demonstrativos, setDemonstrativos] = useState<DemonstrativoCliente[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [fonteDados, setFonteDados] = useState<'cache_calculado' | 'recalculado' | null>(null);
  const [calculadoEm, setCalculadoEm] = useState<string | null>(null);

  // Carregar dados do localStorage na inicialização
  useEffect(() => {
    const loadStoredData = () => {
      const stored = localStorage.getItem(`demonstrativos_otimizados_${periodo}`);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setDemonstrativos(data.demonstrativos || []);
          setResumo(data.resumo || null);
          setFonteDados(data.fonte_dados || null);
          setCalculadoEm(data.calculado_em || null);
        } catch (error) {
          console.error('Erro ao carregar dados do localStorage:', error);
        }
      }
    };

    loadStoredData();
  }, [periodo]);

  // Salvar dados no localStorage quando demonstrativos mudarem
  useEffect(() => {
    if (demonstrativos.length > 0 && resumo) {
      const dataToStore = {
        demonstrativos,
        resumo,
        fonte_dados: fonteDados,
        calculado_em: calculadoEm,
        periodo
      };
      localStorage.setItem(`demonstrativos_otimizados_${periodo}`, JSON.stringify(dataToStore));
    }
  }, [demonstrativos, resumo, periodo, fonteDados, calculadoEm]);

  // Limpar dados quando período mudar
  useEffect(() => {
    if (periodo) {
      setDemonstrativos([]);
      setResumo(null);
      setExpandedClients(new Set());
      setFonteDados(null);
      setCalculadoEm(null);
    }
  }, [periodo]);

  const handleGerarDemonstrativos = async (forcarRecalculo = false) => {
    if (!periodo) {
      toast.error('Período é obrigatório');
      return;
    }

    setLoading(true);
    try {
      console.log(`Chamando edge function para ${periodo} (forçar: ${forcarRecalculo})`);
      
      const { data, error } = await supabase.functions.invoke('gerar-demonstrativos-faturamento-otimizado', {
        body: { 
          periodo,
          forcar_recalculo: forcarRecalculo
        }
      });

      if (error) throw error;

      if (data.success) {
        setDemonstrativos(data.demonstrativos || []);
        setResumo(data.resumo || null);
        setFonteDados(data.fonte_dados || 'recalculado');
        setCalculadoEm(data.calculado_em || new Date().toISOString());

        const mensagem = data.fonte_dados === 'cache_calculado' 
          ? `Demonstrativos carregados do cache (${data.demonstrativos?.length || 0} clientes)`
          : `Demonstrativos gerados com sucesso! (${data.demonstrativos?.length || 0} clientes processados)`;
        
        toast.success(mensagem);

        if (onDemonstrativosGerados) {
          onDemonstrativosGerados(data.demonstrativos || [], data.resumo || {});
        }
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro ao gerar demonstrativos:', error);
      toast.error(`Erro ao gerar demonstrativos: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleClientExpansion = (clienteNome: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clienteNome)) {
      newExpanded.delete(clienteNome);
    } else {
      newExpanded.add(clienteNome);
    }
    setExpandedClients(newExpanded);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
  };

  const getStatusBadge = (status: any) => {
    if (!status) return null;
    
    const variant = status === 'ativo' ? 'default' : 'secondary';
    return <Badge variant={variant}>{status}</Badge>;
  };

  const getFonteDadosBadge = () => {
    if (!fonteDados) return null;
    
    if (fonteDados === 'cache_calculado') {
      return (
        <Badge variant="outline" className="gap-2">
          <Database className="h-3 w-3" />
          Cache
        </Badge>
      );
    } else {
      return (
        <Badge variant="default" className="gap-2">
          <RefreshCw className="h-3 w-3" />
          Recalculado
        </Badge>
      );
    }
  };

  const formatDataCalculado = (data: string) => {
    if (!data) return '';
    try {
      return new Date(data).toLocaleString('pt-BR');
    } catch {
      return data;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center flex-wrap">
        <Button
          onClick={() => handleGerarDemonstrativos(false)}
          disabled={loading || !periodo}
          className="gap-2"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          {loading ? 'Processando...' : 'Gerar Demonstrativos'}
        </Button>

        {demonstrativos.length > 0 && (
          <Button
            onClick={() => handleGerarDemonstrativos(true)}
            disabled={loading}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerar
          </Button>
        )}

        {getFonteDadosBadge()}

        {calculadoEm && (
          <Badge variant="outline" className="gap-2">
            <Clock className="h-3 w-3" />
            {formatDataCalculado(calculadoEm)}
          </Badge>
        )}
      </div>

      {resumo && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo Geral</CardTitle>
            <CardDescription>
              Consolidado dos demonstrativos para o período {periodo}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="font-medium">Clientes Processados</p>
                <p className="text-2xl font-bold">{resumo.clientes_processados}/{resumo.total_clientes}</p>
              </div>
              <div>
                <p className="font-medium">Total de Exames</p>
                <p className="text-2xl font-bold">{formatNumber(resumo.total_exames_geral)}</p>
              </div>
              <div>
                <p className="font-medium">Valor Bruto Total</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(resumo.valor_bruto_geral)}</p>
              </div>
              <div>
                <p className="font-medium">Valor Líquido</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(resumo.valor_total_geral - resumo.valor_impostos_geral)}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
              <div>
                <p className="text-muted-foreground">Valor Exames</p>
                <p className="font-semibold">{formatCurrency(resumo.valor_exames_geral)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Franquias</p>
                <p className="font-semibold">{formatCurrency(resumo.valor_franquias_geral)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Portal/Integração</p>
                <p className="font-semibold">{formatCurrency(resumo.valor_portal_geral + resumo.valor_integracao_geral)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Impostos</p>
                <p className="font-semibold text-red-600">{formatCurrency(resumo.valor_impostos_geral)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {demonstrativos.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Demonstrativos por Cliente ({demonstrativos.length})</h3>
          
          {demonstrativos.map((demonstrativo) => {
            const isExpanded = expandedClients.has(demonstrativo.cliente_nome);
            
            return (
              <Card key={demonstrativo.cliente_nome} className="overflow-hidden">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <div 
                      className="w-full p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => toggleClientExpansion(demonstrativo.cliente_nome)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div>
                            <p className="font-semibold">{demonstrativo.cliente_nome}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatNumber(demonstrativo.total_exames)} exames • {demonstrativo.condicao_volume}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">
                            {formatCurrency(demonstrativo.valor_total_faturamento)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Líquido: {formatCurrency(demonstrativo.valor_liquido)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="px-4 pb-4 border-t">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 text-sm">
                        <div>
                          <p className="font-medium text-muted-foreground">Valores Principais</p>
                          <div className="space-y-1 mt-2">
                            <div className="flex justify-between">
                              <span>Exames:</span>
                              <span>{formatCurrency(demonstrativo.valor_exames)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Franquia:</span>
                              <span>{formatCurrency(demonstrativo.valor_franquia)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Portal:</span>
                              <span>{formatCurrency(demonstrativo.valor_portal_laudos)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Integração:</span>
                              <span>{formatCurrency(demonstrativo.valor_integracao)}</span>
                            </div>
                            <div className="flex justify-between font-semibold border-t pt-1">
                              <span>Valor Bruto:</span>
                              <span>{formatCurrency(demonstrativo.valor_bruto_total)}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <p className="font-medium text-muted-foreground">Impostos</p>
                          <div className="space-y-1 mt-2">
                            <div className="flex justify-between">
                              <span>ISS ({demonstrativo.percentual_iss}%):</span>
                              <span className="text-red-600">{formatCurrency(demonstrativo.valor_iss)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Federais:</span>
                              <span className="text-red-600">{formatCurrency(demonstrativo.valor_impostos_federais)}</span>
                            </div>
                            <div className="flex justify-between font-semibold border-t pt-1">
                              <span>Total Impostos:</span>
                              <span className="text-red-600">{formatCurrency(demonstrativo.valor_total_impostos)}</span>
                            </div>
                            <div className="flex justify-between font-semibold text-green-600">
                              <span>Valor Líquido:</span>
                              <span>{formatCurrency(demonstrativo.valor_liquido)}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <p className="font-medium text-muted-foreground">Detalhes</p>
                          <div className="space-y-1 mt-2">
                            <div className="flex justify-between">
                              <span>Registros:</span>
                              <span>{formatNumber(demonstrativo.total_registros)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Vol. Ref:</span>
                              <span>{formatNumber(demonstrativo.volume_referencia)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Condição:</span>
                              <span>{demonstrativo.condicao_volume}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {demonstrativo.detalhes_exames && demonstrativo.detalhes_exames.length > 0 && (
                        <div className="mt-4">
                          <p className="font-medium text-muted-foreground mb-2">Detalhes dos Exames</p>
                          <div className="bg-muted/30 rounded-md p-3">
                            <div className="space-y-2 text-xs">
                              {demonstrativo.detalhes_exames.map((detalhe, index) => (
                                <div key={index} className="flex justify-between items-center">
                                  <span className="font-mono">
                                    {detalhe.modalidade}/{detalhe.especialidade}/{detalhe.categoria}/{detalhe.prioridade}
                                  </span>
                                  <span>
                                    {formatNumber(detalhe.quantidade)} × {formatCurrency(detalhe.valor_unitario)} = {formatCurrency(detalhe.valor_total)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      {demonstrativos.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Nenhum demonstrativo encontrado para o período {periodo}.
              <br />
              Clique em "Gerar Demonstrativos" para processar os dados.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}