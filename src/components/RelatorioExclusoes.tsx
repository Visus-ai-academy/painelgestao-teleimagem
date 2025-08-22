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

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Carregando dados de exclusões...');
      
      // Buscar todos os registros rejeitados
      const { data: rejeitados, error: rejeitadosError } = await supabase
        .from('registros_rejeitados_processamento')
        .select('*')
        .order('created_at', { ascending: false });

      if (rejeitadosError) {
        console.error('❌ Erro ao buscar registros rejeitados:', rejeitadosError);
        throw rejeitadosError;
      }

      console.log(`✅ Encontrados ${rejeitados?.length || 0} registros rejeitados`);

      // Buscar dados de volumetria para calcular estatísticas
      const { count: totalVolumetria } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true });

      const totalRejeitados = rejeitados?.length || 0;
      const totalProcessados = (totalVolumetria || 0) + totalRejeitados;
      const taxaSucesso = totalProcessados > 0 ? 
        Math.round(((totalVolumetria || 0) / totalProcessados) * 100) : 100;

      setEstatisticas({
        totalProcessados,
        totalRejeitados,
        taxaSucesso
      });

      if (rejeitados && rejeitados.length > 0) {
        const registrosFormatados = rejeitados.map((r, index) => {
          const dados = r.dados_originais as Record<string, any> || {};
          
          return {
            linha_original: index + 1,
            cliente: dados.EMPRESA || 'N/I',
            paciente: dados.NOME_PACIENTE || 'N/I',
            modalidade: dados.MODALIDADE || 'N/I',
            especialidade: dados.ESPECIALIDADE || 'N/I',
            exame: dados.ESTUDO_DESCRICAO || 'N/I',
            data_exame: dados.DATA_REALIZACAO || 'N/I',
            motivo_exclusao: r.motivo_rejeicao || 'Não especificado',
            detalhes_erro: r.detalhes_erro || 'Sem detalhes disponíveis'
          };
        });

        setRegistrosExcluidos(registrosFormatados);
        
        toast({
          title: "✅ Dados Carregados",
          description: `${registrosFormatados.length} registros rejeitados encontrados`
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
        // Caso com exclusões
        const dadosExcel = registrosExcluidos.map(r => ({
          'Nº Linha': r.linha_original,
          'Motivo Exclusão': r.motivo_exclusao,
          'Detalhes Erro': r.detalhes_erro,
          'Cliente/Empresa': r.cliente,
          'Nome Paciente': r.paciente,
          'Exame/Estudo': r.exame,
          'Modalidade': r.modalidade,
          'Especialidade': r.especialidade,
          'Data Exame': r.data_exame
        }));

        const ws = XLSX.utils.json_to_sheet(dadosExcel);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Registros Excluídos");
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:\-]/g, '');
        XLSX.writeFile(wb, `relatorio_exclusoes_${timestamp}.xlsx`);

        toast({
          title: "✅ Excel Exportado",
          description: `${dadosExcel.length} registros rejeitados exportados`
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