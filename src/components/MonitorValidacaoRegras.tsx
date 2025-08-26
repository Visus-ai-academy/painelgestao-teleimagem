import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RegraValidacao {
  id: string;
  nome: string;
  descricao: string;
  regra_aplicada: boolean;
  total_registros: number;
  registros_processados: number;
  registros_pendentes: number;
  percentual_aplicacao: number;
  detalhes_falha?: string;
  exemplos_nao_processados?: string[];
}

interface ValidacaoStats {
  total_regras: number;
  regras_ok: number;
  regras_falha: number;
  regras_parcial: number;
  percentual_geral: number;
}

export const MonitorValidacaoRegras = () => {
  const [regras, setRegras] = useState<RegraValidacao[]>([]);
  const [stats, setStats] = useState<ValidacaoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRule, setSelectedRule] = useState<RegraValidacao | null>(null);
  const { toast } = useToast();

  const verificarRegras = async () => {
    setLoading(true);
    try {
      const resultados: RegraValidacao[] = [];
      
      // Regra v001: Filtro Data Laudo
      const { data: dataLaudo } = await supabase
        .from('volumetria_mobilemed')
        .select('id, "DATA_LAUDO", "EMPRESA"', { count: 'exact' })
        .neq('arquivo_fonte', 'volumetria_onco_padrao');

      const totalRegistros = dataLaudo?.length || 0;
      const semDataLaudo = dataLaudo?.filter(r => !r.DATA_LAUDO || r.DATA_LAUDO === '').length || 0;
      
      resultados.push({
        id: 'v001',
        nome: 'Filtro Data Laudo',
        descricao: 'Exclui registros sem data de laudo ou fora do período',
        regra_aplicada: semDataLaudo === 0,
        total_registros: totalRegistros,
        registros_processados: totalRegistros - semDataLaudo,
        registros_pendentes: semDataLaudo,
        percentual_aplicacao: totalRegistros > 0 ? Math.round(((totalRegistros - semDataLaudo) / totalRegistros) * 100) : 100,
        detalhes_falha: semDataLaudo > 0 ? `${semDataLaudo} registros sem data de laudo` : undefined,
        exemplos_nao_processados: dataLaudo?.filter(r => !r.DATA_LAUDO).slice(0, 5).map(r => r.EMPRESA) || []
      });

      // Regra v003: Mapeamento CEDI
      const { data: cediData } = await supabase
        .from('volumetria_mobilemed')
        .select('"EMPRESA"')
        .neq('arquivo_fonte', 'volumetria_onco_padrao')
        .or('"EMPRESA".like.CEDI-%,"EMPRESA".eq.CEDIDIAG');

      const cediNaoMapeados = cediData?.filter(r => r.EMPRESA?.includes('CEDI-')).length || 0;
      const cediMapeados = cediData?.filter(r => r.EMPRESA === 'CEDIDIAG').length || 0;
      
      resultados.push({
        id: 'v003',
        nome: 'Mapeamento Nome Cliente (CEDI)',
        descricao: 'Aplica mapeamento de nomes de clientes (CEDI-* para CEDIDIAG)',
        regra_aplicada: cediNaoMapeados === 0,
        total_registros: cediNaoMapeados + cediMapeados,
        registros_processados: cediMapeados,
        registros_pendentes: cediNaoMapeados,
        percentual_aplicacao: (cediNaoMapeados + cediMapeados) > 0 ? Math.round((cediMapeados / (cediNaoMapeados + cediMapeados)) * 100) : 100,
        detalhes_falha: cediNaoMapeados > 0 ? `${cediNaoMapeados} registros CEDI-* não mapeados para CEDIDIAG` : undefined
      });

      // Regra v030: Correção Modalidade DX/CR
      const { data: modalidadeData } = await supabase
        .from('volumetria_mobilemed')
        .select('"MODALIDADE"')
        .neq('arquivo_fonte', 'volumetria_onco_padrao')
        .or('"MODALIDADE".eq.DX,"MODALIDADE".eq.CR');

      const modalidadeDX = modalidadeData?.filter(r => r.MODALIDADE === 'DX').length || 0;
      const modalidadeCR = modalidadeData?.filter(r => r.MODALIDADE === 'CR').length || 0;
      
      resultados.push({
        id: 'v030',
        nome: 'Correção Modalidade DX/CR',
        descricao: 'Converte modalidades DX para CR conforme regra de negócio',
        regra_aplicada: modalidadeDX === 0,
        total_registros: modalidadeDX + modalidadeCR,
        registros_processados: modalidadeCR,
        registros_pendentes: modalidadeDX,
        percentual_aplicacao: (modalidadeDX + modalidadeCR) > 0 ? Math.round((modalidadeCR / (modalidadeDX + modalidadeCR)) * 100) : 100,
        detalhes_falha: modalidadeDX > 0 ? `${modalidadeDX} registros com modalidade DX não convertidos para CR` : undefined
      });

      // Regra v034: Especialidade Coluna
      const { data: colunaData } = await supabase
        .from('volumetria_mobilemed')
        .select('"ESPECIALIDADE", "CATEGORIA"')
        .neq('arquivo_fonte', 'volumetria_onco_padrao')
        .ilike('"ESPECIALIDADE"', '%coluna%');

      const especialidadeColuna = colunaData?.length || 0;
      const colunaProcessada = colunaData?.filter(r => r.CATEGORIA?.includes('COLUNA') || r.CATEGORIA?.includes('MUSCULO')).length || 0;
      
      resultados.push({
        id: 'v034',
        nome: 'Tratamento Especialidade Coluna',
        descricao: 'Processa especialidade "Coluna" conforme regras específicas',
        regra_aplicada: especialidadeColuna === colunaProcessada,
        total_registros: especialidadeColuna,
        registros_processados: colunaProcessada,
        registros_pendentes: especialidadeColuna - colunaProcessada,
        percentual_aplicacao: especialidadeColuna > 0 ? Math.round((colunaProcessada / especialidadeColuna) * 100) : 100,
        detalhes_falha: (especialidadeColuna - colunaProcessada) > 0 ? `${especialidadeColuna - colunaProcessada} registros de especialidade Coluna não processados adequadamente` : undefined
      });

      // Regra v005: Aplicação Categorias
      const { data: categoriaData } = await supabase
        .from('volumetria_mobilemed')
        .select('"CATEGORIA"', { count: 'exact' })
        .neq('arquivo_fonte', 'volumetria_onco_padrao');

      const totalCategorias = categoriaData?.length || 0;
      const semCategoria = categoriaData?.filter(r => !r.CATEGORIA || r.CATEGORIA === '').length || 0;
      
      resultados.push({
        id: 'v005',
        nome: 'Aplicação Categorias',
        descricao: 'Define categorias baseadas em modalidade e especialidade',
        regra_aplicada: semCategoria === 0,
        total_registros: totalCategorias,
        registros_processados: totalCategorias - semCategoria,
        registros_pendentes: semCategoria,
        percentual_aplicacao: totalCategorias > 0 ? Math.round(((totalCategorias - semCategoria) / totalCategorias) * 100) : 100,
        detalhes_falha: semCategoria > 0 ? `${semCategoria} registros sem categoria definida` : undefined
      });

      // Regra v007: De-Para Valores
      const { data: valoresData } = await supabase
        .from('volumetria_mobilemed')
        .select('"VALORES"', { count: 'exact' })
        .neq('arquivo_fonte', 'volumetria_onco_padrao');

      const totalValores = valoresData?.length || 0;
      const valoresZerados = valoresData?.filter(r => !r.VALORES || r.VALORES === 0).length || 0;
      
      resultados.push({
        id: 'v007',
        nome: 'De-Para Valores',
        descricao: 'Aplica valores de referência para exames zerados',
        regra_aplicada: valoresZerados === 0,
        total_registros: totalValores,
        registros_processados: totalValores - valoresZerados,
        registros_pendentes: valoresZerados,
        percentual_aplicacao: totalValores > 0 ? Math.round(((totalValores - valoresZerados) / totalValores) * 100) : 100,
        detalhes_falha: valoresZerados > 0 ? `${valoresZerados} registros com valores zerados (não aplicado de-para)` : undefined
      });

      // Regra v008: Tipificação Faturamento
      const { data: tipificacaoData } = await supabase
        .from('volumetria_mobilemed')
        .select('tipo_faturamento', { count: 'exact' })
        .neq('arquivo_fonte', 'volumetria_onco_padrao');

      const totalTipificacao = tipificacaoData?.length || 0;
      const semTipificacao = tipificacaoData?.filter(r => !r.tipo_faturamento || r.tipo_faturamento === '').length || 0;
      
      resultados.push({
        id: 'v008',
        nome: 'Tipificação Faturamento',
        descricao: 'Define tipo de faturamento baseado nas características do exame',
        regra_aplicada: semTipificacao === 0,
        total_registros: totalTipificacao,
        registros_processados: totalTipificacao - semTipificacao,
        registros_pendentes: semTipificacao,
        percentual_aplicacao: totalTipificacao > 0 ? Math.round(((totalTipificacao - semTipificacao) / totalTipificacao) * 100) : 100,
        detalhes_falha: semTipificacao > 0 ? `${semTipificacao} registros sem tipificação de faturamento` : undefined
      });

      setRegras(resultados);
      
      // Calcular estatísticas
      const total_regras = resultados.length;
      const regras_ok = resultados.filter(r => r.percentual_aplicacao === 100).length;
      const regras_falha = resultados.filter(r => r.percentual_aplicacao === 0).length;
      const regras_parcial = resultados.filter(r => r.percentual_aplicacao > 0 && r.percentual_aplicacao < 100).length;
      const percentual_geral = Math.round(resultados.reduce((acc, r) => acc + r.percentual_aplicacao, 0) / total_regras);

      setStats({
        total_regras,
        regras_ok,
        regras_falha,
        regras_parcial,
        percentual_geral
      });

    } catch (error) {
      console.error('Erro ao verificar regras:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao verificar regras de processamento"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (percentual: number) => {
    if (percentual === 100) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (percentual === 0) return <XCircle className="w-4 h-4 text-red-600" />;
    return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
  };

  const getStatusBadge = (percentual: number) => {
    if (percentual === 100) return <Badge variant="default" className="bg-green-100 text-green-800">OK</Badge>;
    if (percentual === 0) return <Badge variant="destructive">FALHA</Badge>;
    return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">PARCIAL</Badge>;
  };

  useEffect(() => {
    verificarRegras();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Monitor de Validação de Regras - Análise Real dos Dados
          </CardTitle>
          <CardDescription>
            Verificação efetiva da aplicação das regras através da análise dos dados processados na volumetria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Button onClick={verificarRegras} disabled={loading} className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Verificando...' : 'Verificar Regras'}
            </Button>
            
            {stats && (
              <div className="flex gap-4 text-sm">
                <span className="text-green-600">✓ {stats.regras_ok} OK</span>
                <span className="text-yellow-600">⚠ {stats.regras_parcial} Parcial</span>
                <span className="text-red-600">✗ {stats.regras_falha} Falha</span>
                <span className="font-semibold">Geral: {stats.percentual_geral}%</span>
              </div>
            )}
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="details">Detalhes por Regra</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4">
              {stats && stats.percentual_geral < 100 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Atenção:</strong> {stats.regras_falha + stats.regras_parcial} regras apresentam problemas na aplicação. 
                    Verifique a aba "Detalhes por Regra" para mais informações.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4">
                {regras.map((regra) => (
                  <Card key={regra.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedRule(regra)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(regra.percentual_aplicacao)}
                          <div>
                            <span className="font-medium">{regra.id} - {regra.nome}</span>
                            <p className="text-sm text-gray-600">{regra.descricao}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(regra.percentual_aplicacao)}
                          <div className="text-sm text-gray-600 mt-1">
                            {regra.registros_processados.toLocaleString()}/{regra.total_registros.toLocaleString()} ({regra.percentual_aplicacao}%)
                          </div>
                        </div>
                      </div>
                      {regra.detalhes_falha && (
                        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                          ⚠️ {regra.detalhes_falha}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              {selectedRule ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedRule.id} - {selectedRule.nome}</CardTitle>
                    <CardDescription>{selectedRule.descricao}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-gray-50 rounded">
                        <div className="text-2xl font-bold">{selectedRule.total_registros.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Total de Registros</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded">
                        <div className="text-2xl font-bold text-green-600">{selectedRule.registros_processados.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Processados OK</div>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded">
                        <div className="text-2xl font-bold text-red-600">{selectedRule.registros_pendentes.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Não Processados</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded">
                        <div className="text-2xl font-bold text-blue-600">{selectedRule.percentual_aplicacao}%</div>
                        <div className="text-sm text-gray-600">Efetividade</div>
                      </div>
                    </div>
                    
                    {selectedRule.detalhes_falha && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Problema Identificado:</strong> {selectedRule.detalhes_falha}
                        </AlertDescription>
                      </Alert>
                    )}

                    {selectedRule.exemplos_nao_processados && selectedRule.exemplos_nao_processados.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Exemplos de registros não processados:</h4>
                        <div className="bg-gray-50 p-3 rounded text-sm">
                          {selectedRule.exemplos_nao_processados.map((exemplo, idx) => (
                            <div key={idx} className="text-gray-700">• {exemplo}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center p-8 text-gray-500">
                  Selecione uma regra na aba "Visão Geral" para ver os detalhes
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};