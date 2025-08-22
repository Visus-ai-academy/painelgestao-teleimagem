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

interface AnaliseVolumetria {
  arquivo_fonte: string;
  registros_atuais: number;
  registros_originais: number;
  registros_excluidos: number;
  motivos_exclusao: string[];
}

interface RegistroExcluido {
  cliente: string;
  paciente: string;
  data_exame: string;
  data_laudo: string;
  especialidade: string;
  modalidade: string;
  categoria: string;
  motivo_exclusao: string;
  detalhes_erro?: string;
  linha_original?: number;
}

export function RelatorioExclusoes() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [analiseVolumetria, setAnaliseVolumetria] = useState<AnaliseVolumetria[]>([]);
  const [registrosExcluidos, setRegistrosExcluidos] = useState<RegistroExcluido[]>([]);
  const [totalRejeitados, setTotalRejeitados] = useState(0);
  const [ultimoUpload, setUltimoUpload] = useState<any>(null);
  
  // Estados para filtros e ordenação
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroModalidade, setFiltroModalidade] = useState('');
  const [filtroEspecialidade, setFiltroEspecialidade] = useState('');
  const [filtroMotivo, setFiltroMotivo] = useState('');
  const [ordenacao, setOrdenacao] = useState<{campo: string, direcao: 'asc' | 'desc'}>({
    campo: 'linha_original',
    direcao: 'asc'
  });

  useEffect(() => {
    carregarDadosExclusoes();
    carregarRegistrosExcluidos();
  }, []);

  const carregarDadosExclusoes = async () => {
    try {
      setLoading(true);
      
      // Primeiro, buscar o último lote de upload baseado nos dados da volumetria
      const { data: ultimoLote } = await supabase
        .from('volumetria_mobilemed')
        .select('lote_upload, arquivo_fonte, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      let ultimoUploadInfo = null;
      
      if (ultimoLote && ultimoLote.length > 0) {
        const loteAtual = ultimoLote[0].lote_upload;
        
        // Contar registros do último lote
        const { count: totalLote } = await supabase
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact', head: true })
          .eq('lote_upload', loteAtual);

        // Buscar se existe registro na tabela de uploads para este lote (busca mais ampla)
        const { data: uploadData } = await supabase
          .from('processamento_uploads')
          .select('*')
          .or(`detalhes_erro->>lote_upload.eq.${loteAtual},arquivo_nome.ilike.%${loteAtual.slice(-10)}%`)
          .order('created_at', { ascending: false })
          .limit(1);

        // Contar registros rejeitados do lote atual
        const { count: rejeitadosLote } = await supabase
          .from('registros_rejeitados_processamento')
          .select('*', { count: 'exact', head: true })
          .eq('lote_upload', loteAtual);

        if (uploadData && uploadData.length > 0) {
          // Atualizar dados do upload existente com registros rejeitados corretos
          ultimoUploadInfo = {
            ...uploadData[0],
            registros_erro: rejeitadosLote || 0
          };
        } else {
          // Se não tem registro no processamento_uploads, criar estrutura com dados do lote
          ultimoUploadInfo = {
            id: 'virtual',
            arquivo_nome: `Upload ${new Date(ultimoLote[0].created_at).toLocaleString('pt-BR')}`,
            tipo_arquivo: ultimoLote[0].arquivo_fonte,
            status: 'concluido',
            created_at: ultimoLote[0].created_at,
            registros_processados: totalLote || 0,
            registros_inseridos: totalLote || 0,
            registros_erro: rejeitadosLote || 0,
            detalhes_erro: {}
          };
        }
      }

      setUltimoUpload(ultimoUploadInfo);

      if (ultimoUploadInfo) {
        const detalhesErro = ultimoUploadInfo.detalhes_erro as any;
        
        // Criar análise baseada nos dados reais
        const analise: AnaliseVolumetria[] = [{
          arquivo_fonte: ultimoUploadInfo.tipo_arquivo || 'volumetria_padrao',
          registros_atuais: ultimoUploadInfo.registros_inseridos || 0,
          registros_originais: ultimoUploadInfo.registros_processados || 0,
          registros_excluidos: ultimoUploadInfo.registros_erro || 0,
          motivos_exclusao: detalhesErro?.exclusoes_por_motivo ? 
            Object.keys(detalhesErro.exclusoes_por_motivo) : 
            ['Nenhum registro rejeitado']
        }];
        
        setAnaliseVolumetria(analise);
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

  const carregarRegistrosExcluidos = async () => {
    try {
      setLoadingDetalhes(true);
      
      // Buscar o último upload de processamento para correlacionar
      const { data: ultimoUpload } = await supabase
        .from('processamento_uploads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!ultimoUpload?.[0]) {
        console.log('❌ Nenhum upload encontrado na tabela processamento_uploads');
        setRegistrosExcluidos([]);
        setTotalRejeitados(0);
        return;
      }

      const uploadData = ultimoUpload[0];
      console.log('🔍 Último upload processamento:', {
        id: uploadData.id,
        arquivo: uploadData.arquivo_nome,
        registros_erro: uploadData.registros_erro,
        created_at: uploadData.created_at
      });
      
      // Buscar registros rejeitados usando padrão de lote_upload
      // O padrão é: {arquivo_fonte}_{timestamp}_{upload_id_8chars}
      const uploadIdPattern = `%${uploadData.id.substring(0, 8)}`;
      
      console.log('🔍 Buscando rejeições com padrão:', uploadIdPattern);
      
      const { data: rejeitados, error: rejeitadosError } = await supabase
        .from('registros_rejeitados_processamento')
        .select('*')
        .ilike('lote_upload', uploadIdPattern)
        .order('linha_original');

      if (rejeitadosError) {
        console.error('Erro ao buscar registros rejeitados:', rejeitadosError);
        throw rejeitadosError;
      }

      console.log(`🔍 Registros rejeitados encontrados: ${rejeitados?.length || 0}`);
      setTotalRejeitados(rejeitados?.length || 0);

      if (rejeitados && rejeitados.length > 0) {
        // CASO 1: Sistema novo - registros detalhados disponíveis
        const registrosFormatados = rejeitados.map((r, index) => {
          const dados = r.dados_originais as Record<string, any> || {};
          
          return {
            cliente: dados.EMPRESA || 'N/A',
            paciente: dados.NOME_PACIENTE || 'N/A', 
            data_exame: dados.DATA_REALIZACAO || 'N/A',
            data_laudo: dados.DATA_LAUDO || 'N/A',
            especialidade: dados.ESPECIALIDADE || 'N/A',
            modalidade: dados.MODALIDADE || 'N/A',
            categoria: dados.CATEGORIA || 'N/A',
            motivo_exclusao: r.motivo_rejeicao || 'N/A',
            detalhes_erro: r.detalhes_erro || 'N/A',
            linha_original: r.linha_original || (index + 1)
          };
        });
        
        setRegistrosExcluidos(registrosFormatados);
        
        toast({
          title: "✅ Exclusões Carregadas",
          description: `${registrosFormatados.length.toLocaleString()} registros rejeitados encontrados com detalhes completos`,
        });
      } else {
        // CASO 2: Nenhum registro rejeitado no último lote
        setRegistrosExcluidos([]);
        toast({
          title: "✅ Nenhuma Exclusão",
          description: "Todos os registros do último upload foram processados com sucesso!",
        });
      }

    } catch (error) {
      console.error('Erro:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar registros rejeitados",
        variant: "destructive"
      });
      setRegistrosExcluidos([]);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const exportarParaExcel = async () => {
    try {
      setLoadingExport(true);
      
      toast({
        title: "🔄 Preparando Exportação...",
        description: "Buscando registros rejeitados para exportação",
      });

      // Buscar dados do último upload para o resumo
      const { data: uploadInfo } = await supabase
        .from('processamento_uploads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      const ultimoUploadData = uploadInfo?.[0];

      if (!ultimoUploadData) {
        throw new Error('Nenhum upload encontrado para gerar relatório');
      }

      // Buscar registros rejeitados usando padrão de lote_upload
      const uploadIdPattern = `%${ultimoUploadData.id.substring(0, 8)}`;
      
      console.log('🔍 Exportação - Buscando rejeições com padrão:', uploadIdPattern);
      
      const { data: rejeitados, error: rejeitadosError } = await supabase
        .from('registros_rejeitados_processamento')
        .select('*')
        .ilike('lote_upload', uploadIdPattern)
        .order('linha_original');

      if (rejeitadosError) {
        console.error('Erro ao buscar rejeitados:', rejeitadosError);
        throw new Error(`Erro ao buscar dados: ${rejeitadosError.message}`);
      }

      console.log(`🔍 Total de registros rejeitados encontrados no último lote: ${rejeitados?.length || 0}`);

      let dadosExcel: any[] = [];

      if (rejeitados && rejeitados.length > 0) {
        // CASO 1: Dados detalhados disponíveis (sistema novo com auditoria)
        dadosExcel = rejeitados.map((r, index) => {
          const dados = r.dados_originais as Record<string, any> || {};
          
          return {
            'Nº Linha': r.linha_original || (index + 1),
            'Motivo Exclusão': r.motivo_rejeicao || 'N/A',
            'Detalhes Erro': r.detalhes_erro || 'N/A',
            'Cliente/Empresa': dados.EMPRESA || 'N/A',
            'Nome Paciente': dados.NOME_PACIENTE || 'N/A',
            'Código Paciente': dados.CODIGO_PACIENTE || 'N/A',
            'Exame/Estudo': dados.ESTUDO_DESCRICAO || 'N/A',
            'Accession Number': dados.ACCESSION_NUMBER || 'N/A',
            'Modalidade': dados.MODALIDADE || 'N/A',
            'Prioridade': dados.PRIORIDADE || 'N/A',
            'Valores': dados.VALORES || 'N/A',
            'Especialidade': dados.ESPECIALIDADE || 'N/A',
            'Médico': dados.MEDICO || 'N/A',
            'Data Realização': dados.DATA_REALIZACAO || 'N/A',
            'Hora Realização': dados.HORA_REALIZACAO || 'N/A',
            'Data Laudo': dados.DATA_LAUDO || 'N/A',
            'Hora Laudo': dados.HORA_LAUDO || 'N/A',
            'Data Prazo': dados.DATA_PRAZO || 'N/A',
            'Hora Prazo': dados.HORA_PRAZO || 'N/A',
            'Status': dados.STATUS || 'N/A',
            'Categoria': dados.CATEGORIA || 'N/A',
            'Duplicado': dados.DUPLICADO || 'N/A',
            'Arquivo Fonte': r.arquivo_fonte || 'N/A',
            'Lote Upload': r.lote_upload || 'N/A',
            'Data Rejeição': new Date(r.created_at).toLocaleString('pt-BR')
          };
        });

        // Gerar estatísticas resumidas
        const estatisticas = rejeitados.reduce((acc, r) => {
          const motivo = r.motivo_rejeicao || 'DESCONHECIDO';
          acc[motivo] = (acc[motivo] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const estatisticasFormatadas = Object.entries(estatisticas).map(([motivo, quantidade]) => ({
          'Motivo de Exclusão': motivo,
          'Quantidade': quantidade,
          'Percentual': `${((quantidade / rejeitados.length) * 100).toFixed(1)}%`
        }));

        // Criar workbook Excel com múltiplas abas
        const wb = XLSX.utils.book_new();
        
        // Aba 1: Registros Detalhados
        const ws1 = XLSX.utils.json_to_sheet(dadosExcel);
        // Aplicar formatação nas colunas
        const wsColWidths = [
          { wch: 8 },   // Nº Linha
          { wch: 25 },  // Motivo Exclusão
          { wch: 40 },  // Detalhes Erro
          { wch: 20 },  // Cliente/Empresa
          { wch: 30 },  // Nome Paciente
          { wch: 15 },  // Código Paciente
          { wch: 35 },  // Exame/Estudo
          { wch: 15 },  // Accession Number
          { wch: 12 },  // Modalidade
          { wch: 12 },  // Prioridade
          { wch: 10 },  // Valores
          { wch: 20 },  // Especialidade
          { wch: 25 },  // Médico
          { wch: 12 },  // Data Realização
          { wch: 12 },  // Hora Realização
          { wch: 12 },  // Data Laudo
          { wch: 12 },  // Hora Laudo
          { wch: 12 },  // Data Prazo
          { wch: 12 },  // Hora Prazo
          { wch: 12 },  // Status
          { wch: 12 },  // Categoria
          { wch: 10 },  // Duplicado
          { wch: 20 },  // Arquivo Fonte
          { wch: 25 },  // Lote Upload
          { wch: 20 }   // Data Rejeição
        ];
        ws1['!cols'] = wsColWidths;
        XLSX.utils.book_append_sheet(wb, ws1, "Registros Excluídos");
        
        // Aba 2: Estatísticas por Motivo
        const ws2 = XLSX.utils.json_to_sheet(estatisticasFormatadas);
        ws2['!cols'] = [{ wch: 35 }, { wch: 12 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws2, "Estatísticas");
        
        // Aba 3: Resumo do Upload
        const resumoUpload = [{
          'Total Processado': ultimoUploadData?.registros_processados || 0,
          'Total Inserido': ultimoUploadData?.registros_inseridos || 0,
          'Total Rejeitado': ultimoUploadData?.registros_erro || 0,
          'Taxa Rejeição': ultimoUploadData?.registros_processados ? `${((ultimoUploadData.registros_erro / ultimoUploadData.registros_processados) * 100).toFixed(1)}%` : '0%',
          'Data Processamento': ultimoUploadData?.created_at ? new Date(ultimoUploadData.created_at).toLocaleString('pt-BR') : 'N/A',
          'Nome Arquivo': ultimoUploadData?.arquivo_nome || 'N/A',
          'Status': ultimoUploadData?.status || 'N/A',
          'Registros com Auditoria': rejeitados.length,
          'Sistema Auditoria': rejeitados.length > 0 ? 'Ativo (Detalhes Completos)' : 'Inativo ou Sem Rejeições'
        }];
        
        const ws3 = XLSX.utils.json_to_sheet(resumoUpload);
        ws3['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, ws3, "Resumo Upload");
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:\-]/g, '');
        const nomeArquivo = `relatorio_exclusoes_volumetria_${timestamp}.xlsx`;
        XLSX.writeFile(wb, nomeArquivo);

        toast({
          title: "✅ Excel Exportado com Sucesso!",
          description: `${dadosExcel.length.toLocaleString()} registros rejeitados exportados com análise completa em 3 abas`,
        });

      } else {
        // CASO 2: Nenhuma exclusão encontrada
        dadosExcel = [{
          'Status': 'Nenhuma exclusão encontrada',
          'Registros Processados': ultimoUploadData?.registros_processados || 0,
          'Registros Inseridos': ultimoUploadData?.registros_inseridos || 0,
          'Taxa Sucesso': '100%',
          'Data Verificação': new Date().toLocaleString('pt-BR')
        }];

        const ws = XLSX.utils.json_to_sheet(dadosExcel);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sem Exclusões");
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:\-]/g, '');
        XLSX.writeFile(wb, `status_sem_exclusoes_${timestamp}.xlsx`);

        toast({
          title: "✅ Nenhuma Exclusão para Exportar",
          description: "Todos os registros foram processados com sucesso!",
        });
      }

    } catch (error) {
      console.error('Erro na exportação:', error);
      toast({
        title: "❌ Erro na Exportação",
        description: `Erro ao exportar dados: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive"
      });
    } finally {
      setLoadingExport(false);
    }
  };

  // Dados filtrados e ordenados usando useMemo para performance
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

    if (filtroCliente) {
      dados = dados.filter(registro => registro.cliente === filtroCliente);
    }

    if (filtroModalidade) {
      dados = dados.filter(registro => registro.modalidade === filtroModalidade);
    }

    if (filtroEspecialidade) {
      dados = dados.filter(registro => registro.especialidade === filtroEspecialidade);
    }

    if (filtroMotivo) {
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
    [...new Set(registrosExcluidos.map(r => r.cliente))].filter(c => c !== 'N/A').sort(), 
    [registrosExcluidos]
  );

  const modalidadesUnicas = useMemo(() => 
    [...new Set(registrosExcluidos.map(r => r.modalidade))].filter(m => m !== 'N/A').sort(), 
    [registrosExcluidos]
  );

  const especialidadesUnicas = useMemo(() => 
    [...new Set(registrosExcluidos.map(r => r.especialidade))].filter(e => e !== 'N/A').sort(), 
    [registrosExcluidos]
  );

  const motivosUnicos = useMemo(() => 
    [...new Set(registrosExcluidos.map(r => r.motivo_exclusao))].filter(m => m !== 'N/A').sort(), 
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

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Processado</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ultimoUpload?.registros_processados?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              registros no último upload
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
              {totalRejeitados.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              registros com detalhes de auditoria
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
              {ultimoUpload?.registros_processados 
                ? ((ultimoUpload.registros_inseridos / ultimoUpload.registros_processados) * 100).toFixed(1)
                : 0}%
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
            Lista completa dos registros que foram rejeitados durante o processamento com motivos específicos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDetalhes ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Carregando detalhes...</span>
            </div>
          ) : registrosExcluidos.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="destructive">
                  {registrosExcluidos.length.toLocaleString()} registros rejeitados
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Sistema de auditoria ativo - detalhes completos disponíveis
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
                    placeholder="Buscar em todos os campos..."
                    value={filtroTexto}
                    onChange={(e) => setFiltroTexto(e.target.value)}
                    className="h-8"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Cliente
                  </label>
                  <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos os clientes</SelectItem>
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
                      <SelectItem value="">Todas as modalidades</SelectItem>
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
                      <SelectItem value="">Todas as especialidades</SelectItem>
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
                      <SelectItem value="">Todos os motivos</SelectItem>
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
                      setFiltroCliente('');
                      setFiltroModalidade('');
                      setFiltroEspecialidade('');
                      setFiltroMotivo('');
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
                          Motivo Exclusão {getIconeOrdenacao('motivo_exclusao')}
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
                    Nenhum registro encontrado com os filtros aplicados. Tente ajustar os critérios de busca.
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Sistema de auditoria: <strong>Ativo</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Captura de rejeições: <strong>Habilitada</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Exportação Excel: <strong>Completa</strong></span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                <strong>Última verificação:</strong> {new Date().toLocaleString('pt-BR')}
              </div>
              <div className="text-sm text-muted-foreground">
                <strong>Registros rejeitados captados:</strong> {totalRejeitados.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                <strong>Edge Function:</strong> processar-volumetria-otimizado
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}