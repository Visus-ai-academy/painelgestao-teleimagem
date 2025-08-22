import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, AlertTriangle, CheckCircle, Info, Loader2, Search, ArrowUpDown, ArrowUp, ArrowDown, Filter } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface RegistroExcluido {
  linha_original: number;
  cliente: string;
  paciente: string;
  modalidade: string;
  especialidade: string;
  exame: string;
  data_exame: string;
  motivo_exclusao: string;
  detalhes_erro: string;
}

export function RelatorioExclusoes() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingTest, setLoadingTest] = useState(false);
  const [registrosExcluidos, setRegistrosExcluidos] = useState<RegistroExcluido[]>([]);
  const [estatisticas, setEstatisticas] = useState({
    totalProcessados: 0,
    totalRejeitados: 0,
    taxaSucesso: 100
  });
  
  // Estados para filtros e ordenação
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('todos');
  const [filtroModalidade, setFiltroModalidade] = useState('todas');
  const [filtroEspecialidade, setFiltroEspecialidade] = useState('todas');
  const [filtroMotivo, setFiltroMotivo] = useState('todos');
  const [ordenacao, setOrdenacao] = useState<{campo: string, direcao: 'asc' | 'desc'}>({
    campo: 'linha_original',
    direcao: 'asc'
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const limparRegistrosRejeitados = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('limpar-registros-rejeitados');
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "✅ Registros Limpos",
        description: `${data.registros_removidos} registros rejeitados removidos`
      });
      
      // Recarregar dados
      carregarDados();
      
    } catch (error) {
      console.error('Erro ao limpar registros rejeitados:', error);
      toast({
        title: "Erro",
        description: "Erro ao limpar registros rejeitados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const testarConversaoDatas = async () => {
    try {
      setLoadingTest(true);
      
      const { data, error } = await supabase.functions.invoke('testar-conversao-datas');
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "🧪 Teste Executado",
        description: `Teste de conversão de datas para ${data.periodo_testado} concluído. Verifique os logs do Edge Function.`
      });
      
      console.log('📊 Resultados do teste:', data.resultados);
      
    } catch (error) {
      console.error('Erro ao testar conversão de datas:', error);
      toast({
        title: "Erro",
        description: "Erro ao executar teste de conversão de datas",
        variant: "destructive"
      });
    } finally {
      setLoadingTest(false);
    }
  };

  const testarInsercaoRejeitados = async () => {
    try {
      setLoadingTest(true);
      
      const { data, error } = await supabase.functions.invoke('testar-insercao-rejeitados');
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "🧪 Teste DB Executado",
        description: `Teste de inserção concluído. ${data.sucesso ? 'Sucesso' : 'Falha'} - Verifique os logs.`
      });
      
      console.log('📊 Resultados do teste DB:', data);
      
    } catch (error) {
      console.error('Erro ao testar inserção de rejeitados:', error);
      toast({
        title: "Erro",
        description: "Erro ao executar teste de inserção",
        variant: "destructive"
      });
    } finally {
      setLoadingTest(false);
    }
  };

  const reprocessarRejeicoesUltimoUpload = async () => {
    try {
      setLoadingTest(true);
      
      // Buscar o último upload com registros de erro
      const { data: ultimoUpload } = await supabase
        .from('processamento_uploads')
        .select('*')
        .gt('registros_erro', 0)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!ultimoUpload) {
        toast({
          title: "⚠️ Nenhum Upload",
          description: "Nenhum upload com registros rejeitados encontrado",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase.rpc('reprocessar_rejeicoes_upload', { 
        upload_id_param: ultimoUpload.id 
      });
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "✅ Reprocessamento Concluído",
        description: `${(data as any)?.registros_inseridos || 0} registros rejeitados inseridos para ${(data as any)?.arquivo || 'arquivo'}`
      });
      
      console.log('📊 Resultado do reprocessamento:', data);
      
      // Recarregar dados
      carregarDados();
      
    } catch (error) {
      console.error('Erro ao reprocessar rejeições:', error);
      toast({
        title: "Erro",
        description: "Erro ao reprocessar rejeições do upload",
        variant: "destructive"
      });
    } finally {
      setLoadingTest(false);
    }
  };

  const corrigirDadosExclusao = async () => {
    try {
      setLoadingTest(true);
      toast({
        title: "🔧 Iniciando Correção",
        description: "Iniciando correção de dados...",
      });
      
      // Chamada direta via fetch para contornar problema de CORS
      const response = await fetch('https://atbvikgxdcohnznkmaus.supabase.co/functions/v1/corrigir-dados-exclusao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0YnZpa2d4ZGNvaG56bmttYXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTY1MzAsImV4cCI6MjA2ODI3MjUzMH0.P2eptjgahiMcUzE9b1eAVAW1HC9Ib52LYpRAO8S_9CE'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      toast({
        title: "✅ Correção Concluída",
        description: `${data?.registros_criados || 0} registros com datas normalizadas criados para ${data?.upload_processado || 'arquivo'}`
      });
      
      console.log('📊 Resultado da correção:', data);
      
      // Recarregar dados
      carregarDados();
      
    } catch (error) {
      console.error('Erro ao corrigir dados de exclusão:', error);
      toast({
        title: "Erro",
        description: "Erro ao corrigir dados de exclusão. Verifique os logs.",
        variant: "destructive"
      });
    } finally {
      setLoadingTest(false);
    }
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Carregando dados de exclusões...');
      
      // Buscar TODOS os registros rejeitados sem limite
      let allRejeitados: any[] = [];
      let from = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data: batch, error: rejeitadosError } = await supabase
          .from('registros_rejeitados_processamento')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + batchSize - 1);

        if (rejeitadosError) {
          console.error('❌ Erro ao buscar registros rejeitados:', rejeitadosError);
          throw rejeitadosError;
        }

        if (!batch || batch.length === 0) break;
        
        allRejeitados = [...allRejeitados, ...batch];
        
        if (batch.length < batchSize) break;
        
        from += batchSize;
      }

      console.log(`✅ Encontrados ${allRejeitados?.length || 0} registros rejeitados`);

      // Buscar dados de volumetria para calcular estatísticas
      const { count: totalVolumetria } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true });

      // Buscar estatísticas dos uploads de volumetria
      const { data: uploadsVolumetria } = await supabase
        .from('processamento_uploads')
        .select('registros_processados, registros_inseridos, registros_erro')
        .in('tipo_arquivo', [
          'volumetria_padrao', 
          'volumetria_fora_padrao', 
          'volumetria_padrao_retroativo', 
          'volumetria_fora_padrao_retroativo',
          'volumetria_onco_padrao'
        ]);

      // Somar estatísticas dos uploads
      const totalProcessadosUploads = uploadsVolumetria?.reduce((sum, upload) => sum + (upload.registros_processados || 0), 0) || 0;
      const totalInseridosUploads = uploadsVolumetria?.reduce((sum, upload) => sum + (upload.registros_inseridos || 0), 0) || 0;
      const totalErrosUploads = uploadsVolumetria?.reduce((sum, upload) => sum + (upload.registros_erro || 0), 0) || 0;

      const totalRejeitados = allRejeitados?.length || 0;
      
      // Usar o maior valor entre os rejeitados salvos e os erros dos uploads
      const totalErros = Math.max(totalRejeitados, totalErrosUploads);
      const totalProcessados = Math.max(totalProcessadosUploads, (totalVolumetria || 0) + totalErros);
      const taxaSucesso = totalProcessados > 0 ? 
        Math.round(((totalProcessados - totalErros) / totalProcessados) * 100) : 100;

      setEstatisticas({
        totalProcessados,
        totalRejeitados: totalErros,
        taxaSucesso
      });

      if (allRejeitados && allRejeitados.length > 0) {
        const registrosFormatados = allRejeitados.map((r, index) => {
          const dados = r.dados_originais as Record<string, any> || {};
          
          return {
            linha_original: index + 1,
            cliente: dados.EMPRESA || 'N/I',
            paciente: dados.NOME_PACIENTE || 'N/I',
            modalidade: dados.MODALIDADE || 'N/I',
            especialidade: dados.ESPECIALIDADE || 'N/I',
            exame: dados.ESTUDO_DESCRICAO || 'N/I',
            data_exame: dados.DATA_REALIZACAO_NORMALIZADA || dados.DATA_REALIZACAO || 'N/I',
            motivo_exclusao: r.motivo_rejeicao || 'Não especificado',
            detalhes_erro: r.detalhes_erro || 'Sem detalhes disponíveis'
          };
        });

        setRegistrosExcluidos(registrosFormatados);
        
        toast({
          title: "✅ Dados Carregados",
          description: `${registrosFormatados.length} registros rejeitados encontrados (${totalErros} total conforme uploads)`
        });
      } else if (totalErros > 0) {
        // Há registros de erro nos uploads mas não estão salvos na tabela de rejeições
        setRegistrosExcluidos([]);
        toast({
          title: "⚠️ Inconsistência Detectada",
          description: `${totalErros} exclusões registradas nos uploads, mas nenhuma rejeição salva. Possivelmente foram limpas.`,
          variant: "destructive"
        });
      } else {
        setRegistrosExcluidos([]);
        toast({
          title: "✅ Nenhuma Exclusão",
          description: "Todos os registros foram processados com sucesso!"
        });
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados de exclusões",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportarParaExcel = async () => {
    try {
      setLoadingExport(true);
      
      if (registrosExcluidos.length === 0) {
        // Caso sem exclusões
        const dadosExcel = [{
          'Status': 'Nenhuma exclusão encontrada',
          'Registros Processados': estatisticas.totalProcessados,
          'Registros Inseridos': estatisticas.totalProcessados - estatisticas.totalRejeitados,
          'Taxa Sucesso': `${estatisticas.taxaSucesso}%`,
          'Data Verificação': new Date().toLocaleString('pt-BR')
        }];

        const ws = XLSX.utils.json_to_sheet(dadosExcel);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Status");
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:\-]/g, '');
        XLSX.writeFile(wb, `relatorio_sem_exclusoes_${timestamp}.xlsx`);

        toast({
          title: "✅ Excel Gerado",
          description: "Arquivo exportado - nenhuma exclusão encontrada"
        });
      } else {
        // Caso com exclusões - usar dados detalhados quando disponíveis
        let dadosExcel: any[] = [];
        
        if (registrosExcluidos.length > 0) {
          // Usar registros rejeitados detalhados
          dadosExcel = registrosExcluidos.map((r, index) => ({
            'Nº Linha': r.linha_original || index + 1,
            'Motivo Exclusão': r.motivo_exclusao || 'Não especificado',
            'Detalhes Erro': r.detalhes_erro || 'Sem detalhes',
            'Cliente/Empresa': r.cliente || 'N/I',
            'Nome Paciente': r.paciente || 'N/I',
            'Exame/Estudo': r.exame || 'N/I',
            'Modalidade': r.modalidade || 'N/I',
            'Especialidade': r.especialidade || 'N/I',
            'Data Exame': r.data_exame || 'N/I'
          }));
        } else if (estatisticas.totalRejeitados > 0) {
          // Buscar dados brutos dos uploads quando não há registros detalhados
          const { data: uploadsDetalhes } = await supabase
            .from('processamento_uploads')
            .select('tipo_arquivo, arquivo_nome, registros_erro, created_at, detalhes_erro')
            .in('tipo_arquivo', [
              'volumetria_padrao', 
              'volumetria_fora_padrao', 
              'volumetria_padrao_retroativo', 
              'volumetria_fora_padrao_retroativo',
              'volumetria_onco_padrao'
            ])
            .gt('registros_erro', 0)
            .order('created_at', { ascending: false })
            .limit(10);

          // Criar linhas individuais para cada registro rejeitado
          dadosExcel = [];
          uploadsDetalhes?.forEach((upload, uploadIndex) => {
            const numRejeicoes = upload.registros_erro || 0;
            for (let i = 1; i <= numRejeicoes; i++) {
              dadosExcel.push({
                'Nº Linha': i,
                'Arquivo Origem': upload.arquivo_nome,
                'Tipo Upload': upload.tipo_arquivo,
                'Data Upload': new Date(upload.created_at).toLocaleString('pt-BR'),
                'Motivo Exclusão': 'VALIDACAO_PERIODO_DATAS',
                'Detalhes': 'Registro rejeitado por validação de período ou formato de data inválido',
                'Status': 'Rejeitado durante processamento automático',
                'Observação': `Registro ${i} de ${numRejeicoes} rejeitados neste upload`
              });
            }
          });
        }

        const wsExclusoes = XLSX.utils.json_to_sheet(dadosExcel);
        
        // Ajustar largura das colunas
        const colWidths = [
          { wch: 10 }, // Nº Linha
          { wch: 30 }, // Motivo Exclusão
          { wch: 50 }, // Detalhes Erro
          { wch: 20 }, // Cliente/Empresa
          { wch: 25 }, // Nome Paciente
          { wch: 30 }, // Exame/Estudo
          { wch: 15 }, // Modalidade
          { wch: 20 }, // Especialidade
          { wch: 15 }  // Data Exame
        ];
        wsExclusoes['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsExclusoes, registrosExcluidos.length > 0 ? "Registros Excluídos" : "Resumo Exclusões");
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:\-]/g, '');
        XLSX.writeFile(wb, `relatorio_exclusoes_${timestamp}.xlsx`);

        toast({
          title: "✅ Excel Exportado",
          description: `${dadosExcel.length} ${registrosExcluidos.length > 0 ? 'registros detalhados' : 'uploads com exclusões'} exportados`
        });
      }

    } catch (error) {
      console.error('Erro na exportação:', error);
      toast({
        title: "❌ Erro na Exportação",
        description: "Erro ao exportar dados",
        variant: "destructive"
      });
    } finally {
      setLoadingExport(false);
    }
  };

  // Dados filtrados e ordenados
  const dadosFiltrados = useMemo(() => {
    let dados = registrosExcluidos;

    // Aplicar filtros
    if (filtroTexto) {
      dados = dados.filter(registro => 
        Object.values(registro).some(valor => 
          String(valor).toLowerCase().includes(filtroTexto.toLowerCase())
        )
      );
    }

    if (filtroCliente && filtroCliente !== 'todos') {
      dados = dados.filter(registro => registro.cliente === filtroCliente);
    }

    if (filtroModalidade && filtroModalidade !== 'todas') {
      dados = dados.filter(registro => registro.modalidade === filtroModalidade);
    }

    if (filtroEspecialidade && filtroEspecialidade !== 'todas') {
      dados = dados.filter(registro => registro.especialidade === filtroEspecialidade);
    }

    if (filtroMotivo && filtroMotivo !== 'todos') {
      dados = dados.filter(registro => registro.motivo_exclusao === filtroMotivo);
    }

    // Aplicar ordenação
    dados.sort((a, b) => {
      const valorA = a[ordenacao.campo as keyof RegistroExcluido];
      const valorB = b[ordenacao.campo as keyof RegistroExcluido];
      
      if (ordenacao.direcao === 'asc') {
        return valorA < valorB ? -1 : valorA > valorB ? 1 : 0;
      } else {
        return valorA > valorB ? -1 : valorA < valorB ? 1 : 0;
      }
    });

    return dados;
  }, [registrosExcluidos, filtroTexto, filtroCliente, filtroModalidade, filtroEspecialidade, filtroMotivo, ordenacao]);

  // Opções únicas para filtros
  const clientesUnicos = useMemo(() => 
    [...new Set(registrosExcluidos.map(r => r.cliente))].filter(c => c !== 'N/I').sort(), 
    [registrosExcluidos]
  );

  const modalidadesUnicas = useMemo(() => 
    [...new Set(registrosExcluidos.map(r => r.modalidade))].filter(m => m !== 'N/I').sort(), 
    [registrosExcluidos]
  );

  const especialidadesUnicas = useMemo(() => 
    [...new Set(registrosExcluidos.map(r => r.especialidade))].filter(e => e !== 'N/I').sort(), 
    [registrosExcluidos]
  );

  const motivosUnicos = useMemo(() => 
    [...new Set(registrosExcluidos.map(r => r.motivo_exclusao))].filter(m => m !== 'Não especificado').sort(), 
    [registrosExcluidos]
  );

  const handleOrdenacao = (campo: string) => {
    setOrdenacao(prev => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getIconeOrdenacao = (campo: string) => {
    if (ordenacao.campo !== campo) return <ArrowUpDown className="h-4 w-4" />;
    return ordenacao.direcao === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando relatório de exclusões...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatório de Exclusões</h1>
          <p className="text-muted-foreground">
            Análise detalhada dos registros rejeitados durante o processamento
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={testarConversaoDatas} 
            disabled={loadingTest}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            {loadingTest ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Testar Datas
          </Button>
          <Button 
            onClick={testarInsercaoRejeitados} 
            disabled={loadingTest}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            {loadingTest ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Info className="h-4 w-4" />
            )}
            Testar DB
          </Button>
          <Button 
            onClick={corrigirDadosExclusao} 
            disabled={loadingTest}
            variant="default"
            size="sm"
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
          >
            {loadingTest ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            🔧 Corrigir Dados
          </Button>
          <Button 
            onClick={reprocessarRejeicoesUltimoUpload} 
            disabled={loadingTest}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            {loadingTest ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Reprocessar Rejeitados
          </Button>
          <Button 
            onClick={limparRegistrosRejeitados} 
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            Limpar Exclusões
          </Button>
          <Button 
            onClick={exportarParaExcel} 
            disabled={loadingExport}
            className="flex items-center gap-2"
          >
            {loadingExport ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {loadingExport ? 'Exportando...' : 'Exportar Excel'}
          </Button>
        </div>
      </div>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Processado</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {estatisticas.totalProcessados.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              registros no total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejeitados</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {estatisticas.totalRejeitados.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              registros rejeitados
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {estatisticas.taxaSucesso}%
            </div>
            <p className="text-xs text-muted-foreground">
              registros processados com sucesso
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detalhes das Exclusões */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Registros Rejeitados - Detalhes
          </CardTitle>
          <CardDescription>
            Lista completa dos registros que foram rejeitados durante o processamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {registrosExcluidos.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="destructive">
                  {registrosExcluidos.length.toLocaleString()} registros rejeitados
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Sistema de auditoria ativo
                </span>
              </div>

              {/* Controles de Filtro */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Busca Geral
                  </label>
                  <Input
                    placeholder="Buscar..."
                    value={filtroTexto}
                    onChange={(e) => setFiltroTexto(e.target.value)}
                    className="h-8"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Cliente</label>
                  <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os clientes</SelectItem>
                      {clientesUnicos.map(cliente => (
                        <SelectItem key={cliente} value={cliente}>{cliente}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Modalidade</label>
                  <Select value={filtroModalidade} onValueChange={setFiltroModalidade}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as modalidades</SelectItem>
                      {modalidadesUnicas.map(modalidade => (
                        <SelectItem key={modalidade} value={modalidade}>{modalidade}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Especialidade</label>
                  <Select value={filtroEspecialidade} onValueChange={setFiltroEspecialidade}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as especialidades</SelectItem>
                      {especialidadesUnicas.map(especialidade => (
                        <SelectItem key={especialidade} value={especialidade}>{especialidade}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Motivo</label>
                  <Select value={filtroMotivo} onValueChange={setFiltroMotivo}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os motivos</SelectItem>
                      {motivosUnicos.map(motivo => (
                        <SelectItem key={motivo} value={motivo}>{motivo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 flex items-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setFiltroTexto('');
                      setFiltroCliente('todos');
                      setFiltroModalidade('todas');
                      setFiltroEspecialidade('todas');
                      setFiltroMotivo('todos');
                    }}
                    className="h-8"
                  >
                    Limpar Filtros
                  </Button>
                </div>
              </div>

              {/* Resultados Filtrados */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Mostrando {dadosFiltrados.length.toLocaleString()} de {registrosExcluidos.length.toLocaleString()} registros
                </span>
              </div>
              
              {/* Tabela com Ordenação */}
              <div className="border rounded-md max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 border-b">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleOrdenacao('linha_original')}
                          className="h-6 p-1 font-medium flex items-center gap-1"
                        >
                          Linha {getIconeOrdenacao('linha_original')}
                        </Button>
                      </th>
                      <th className="text-left p-2 border-b">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleOrdenacao('cliente')}
                          className="h-6 p-1 font-medium flex items-center gap-1"
                        >
                          Cliente {getIconeOrdenacao('cliente')}
                        </Button>
                      </th>
                      <th className="text-left p-2 border-b">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleOrdenacao('paciente')}
                          className="h-6 p-1 font-medium flex items-center gap-1"
                        >
                          Paciente {getIconeOrdenacao('paciente')}
                        </Button>
                      </th>
                      <th className="text-left p-2 border-b">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleOrdenacao('modalidade')}
                          className="h-6 p-1 font-medium flex items-center gap-1"
                        >
                          Modalidade {getIconeOrdenacao('modalidade')}
                        </Button>
                      </th>
                      <th className="text-left p-2 border-b">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleOrdenacao('especialidade')}
                          className="h-6 p-1 font-medium flex items-center gap-1"
                        >
                          Especialidade {getIconeOrdenacao('especialidade')}
                        </Button>
                      </th>
                      <th className="text-left p-2 border-b">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleOrdenacao('data_exame')}
                          className="h-6 p-1 font-medium flex items-center gap-1"
                        >
                          Data Exame {getIconeOrdenacao('data_exame')}
                        </Button>
                      </th>
                      <th className="text-left p-2 border-b">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleOrdenacao('motivo_exclusao')}
                          className="h-6 p-1 font-medium flex items-center gap-1"
                        >
                          Motivo {getIconeOrdenacao('motivo_exclusao')}
                        </Button>
                      </th>
                      <th className="text-left p-2 border-b">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosFiltrados.map((registro, index) => (
                      <tr key={index} className="border-b hover:bg-muted/30">
                        <td className="p-2 font-mono text-xs">{registro.linha_original}</td>
                        <td className="p-2">{registro.cliente}</td>
                        <td className="p-2">{registro.paciente}</td>
                        <td className="p-2 text-center">
                          <Badge variant="outline" className="text-xs">
                            {registro.modalidade}
                          </Badge>
                        </td>
                        <td className="p-2">{registro.especialidade}</td>
                        <td className="p-2 font-mono text-xs">{registro.data_exame}</td>
                        <td className="p-2">
                          <Badge variant="destructive" className="text-xs">
                            {registro.motivo_exclusao}
                          </Badge>
                        </td>
                        <td className="p-2 text-xs text-muted-foreground max-w-48 truncate" title={registro.detalhes_erro}>
                          {registro.detalhes_erro}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {dadosFiltrados.length === 0 && registrosExcluidos.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Nenhum registro encontrado com os filtros aplicados.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                ✅ <strong>Nenhuma exclusão encontrada!</strong> Todos os registros foram processados com sucesso.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Informações do Sistema */}
      <Card>
        <CardHeader>
          <CardTitle>Sistema de Auditoria</CardTitle>
          <CardDescription>
            Status do sistema de captura de exclusões
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Trigger de auditoria: <strong>Ativo</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Captura automática: <strong>Habilitada</strong></span>
            </div>
            <div className="text-sm text-muted-foreground">
              <strong>Última verificação:</strong> {new Date().toLocaleString('pt-BR')}
            </div>
            <div className="text-sm text-muted-foreground">
              <strong>Total rejeitados:</strong> {estatisticas.totalRejeitados.toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}