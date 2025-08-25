import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, Download, Search, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface RegistroExcluido {
  id: string;
  arquivo_fonte: string;
  lote_upload: string;
  linha_original: number;
  dados_originais: any;
  motivo_rejeicao: string;
  detalhes_erro: string;
  created_at: string;
}

interface AnaliseExclusao {
  motivo: string;
  quantidade: number;
  exemplos: any[];
}

export function AnaliseRegistrosExcluidos() {
  const [registrosExcluidos, setRegistrosExcluidos] = useState<RegistroExcluido[]>([]);
  const [analiseMotivos, setAnaliseMotivos] = useState<AnaliseExclusao[]>([]);
  const [loading, setLoading] = useState(false);
  const [ultimoUpload, setUltimoUpload] = useState<any>(null);
  const { toast } = useToast();

  const fetchUltimoUpload = async () => {
    try {
      const { data, error } = await supabase
        .from('processamento_uploads')
        .select('*')
        .eq('tipo_arquivo', 'volumetria_padrao')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar último upload:', error);
        return;
      }

      setUltimoUpload(data);
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const fetchRegistrosExcluidos = async () => {
    setLoading(true);
    try {
      // Buscar registros rejeitados diretamente
      const { data: rejeitados, error: errorRejeitados } = await supabase
        .from('registros_rejeitados_processamento')
        .select('*')
        .eq('arquivo_fonte', 'volumetria_padrao')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (errorRejeitados) {
        console.error('Erro ao buscar rejeitados:', errorRejeitados);
      } else {
        setRegistrosExcluidos(rejeitados || []);
      }

      // Se não há registros rejeitados, tentar buscar no staging com erro
      if (!rejeitados || rejeitados.length === 0) {
        const { data: stagingErros, error: errorStaging } = await supabase
          .from('volumetria_staging')
          .select('*')
          .eq('status_processamento', 'erro')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false });

        if (errorStaging) {
          console.error('Erro ao buscar staging:', errorStaging);
        } else if (stagingErros && stagingErros.length > 0) {
          // Converter formato do staging para o formato esperado
          const registrosConvertidos = stagingErros.map((registro: any) => ({
            id: registro.id,
            arquivo_fonte: registro.arquivo_fonte || 'volumetria_padrao',
            lote_upload: registro.lote_upload || 'unknown',
            linha_original: 0,
            dados_originais: {
              EMPRESA: registro.EMPRESA,
              NOME_PACIENTE: registro.NOME_PACIENTE,
              CODIGO_PACIENTE: registro.CODIGO_PACIENTE,
              ESTUDO_DESCRICAO: registro.ESTUDO_DESCRICAO,
              ACCESSION_NUMBER: registro.ACCESSION_NUMBER,
              MODALIDADE: registro.MODALIDADE,
              PRIORIDADE: registro.PRIORIDADE,
              VALORES: registro.VALORES,
              ESPECIALIDADE: registro.ESPECIALIDADE,
              MEDICO: registro.MEDICO,
              DATA_REALIZACAO: registro.DATA_REALIZACAO,
              DATA_LAUDO: registro.DATA_LAUDO,
              CATEGORIA: registro.CATEGORIA
            },
            motivo_rejeicao: 'ERRO_PROCESSAMENTO',
            detalhes_erro: registro.erro_processamento || 'Erro durante processamento',
            created_at: registro.created_at
          }));
          setRegistrosExcluidos(registrosConvertidos);
        }
      }

    } catch (error) {
      console.error('Erro ao buscar registros excluídos:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar registros excluídos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const analisarMotivos = () => {
    const motivosMap = new Map<string, { quantidade: number; exemplos: any[] }>();

    registrosExcluidos.forEach(registro => {
      const motivo = registro.motivo_rejeicao || 'MOTIVO_NAO_ESPECIFICADO';
      if (!motivosMap.has(motivo)) {
        motivosMap.set(motivo, { quantidade: 0, exemplos: [] });
      }
      
      const item = motivosMap.get(motivo)!;
      item.quantidade++;
      
      // Guardar alguns exemplos (máximo 5)
      if (item.exemplos.length < 5) {
        item.exemplos.push(registro.dados_originais);
      }
    });

    const analise = Array.from(motivosMap.entries()).map(([motivo, data]) => ({
      motivo,
      quantidade: data.quantidade,
      exemplos: data.exemplos
    }));

    analise.sort((a, b) => b.quantidade - a.quantidade);
    setAnaliseMotivos(analise);
  };

  const investigarProblemasSilenciosos = async () => {
    setLoading(true);
    try {
      // Invocar função para investigar registros que podem ter sido excluídos silenciosamente
      const { data, error } = await supabase.functions.invoke('corrigir-dados-exclusao');

      if (error) {
        console.error('Erro ao investigar:', error);
        toast({
          title: "Erro",
          description: "Erro ao investigar exclusões silenciosas",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Investigação Concluída",
          description: `Encontrados ${data?.registros_processados || 0} registros com problemas`,
        });
        
        // Recarregar dados após investigação
        await fetchRegistrosExcluidos();
      }
    } catch (error) {
      console.error('Erro:', error);
      toast({
        title: "Erro",
        description: "Erro durante investigação",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportarRegistros = () => {
    if (registrosExcluidos.length === 0) {
      toast({
        title: "Nenhum Registro",
        description: "Não há registros excluídos para exportar",
        variant: "destructive"
      });
      return;
    }

    // Preparar dados para Excel
    const dadosExcel = registrosExcluidos.map(registro => {
      const dados = registro.dados_originais || {};
      return {
        'Linha': registro.linha_original,
        'Motivo': registro.motivo_rejeicao,
        'Detalhes': registro.detalhes_erro || '',
        'Empresa': dados.EMPRESA || '',
        'Paciente': dados.NOME_PACIENTE || '',
        'Código Paciente': dados.CODIGO_PACIENTE || '',
        'Estudo': dados.ESTUDO_DESCRICAO || '',
        'Accession Number': dados.ACCESSION_NUMBER || '',
        'Modalidade': dados.MODALIDADE || '',
        'Prioridade': dados.PRIORIDADE || '',
        'Especialidade': dados.ESPECIALIDADE || '',
        'Médico': dados.MEDICO || '',
        'Valores': dados.VALORES || '',
        'Data Realização': dados.DATA_REALIZACAO || '',
        'Data Laudo': dados.DATA_LAUDO || '',
        'Categoria': dados.CATEGORIA || '',
        'Data Exclusão': new Date(registro.created_at).toLocaleString('pt-BR')
      };
    });

    // Criar workbook
    const wb = XLSX.utils.book_new();
    
    // Criar worksheet com os dados
    const ws = XLSX.utils.json_to_sheet(dadosExcel);
    
    // Ajustar largura das colunas
    const colWidths = [
      { wch: 8 },   // Linha
      { wch: 20 },  // Motivo
      { wch: 30 },  // Detalhes
      { wch: 15 },  // Empresa
      { wch: 25 },  // Paciente
      { wch: 15 },  // Código Paciente
      { wch: 40 },  // Estudo
      { wch: 15 },  // Accession Number
      { wch: 12 },  // Modalidade
      { wch: 12 },  // Prioridade
      { wch: 15 },  // Especialidade
      { wch: 25 },  // Médico
      { wch: 10 },  // Valores
      { wch: 15 },  // Data Realização
      { wch: 15 },  // Data Laudo
      { wch: 15 },  // Categoria
      { wch: 18 }   // Data Exclusão
    ];
    ws['!cols'] = colWidths;

    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(wb, ws, "Registros Excluídos");

    // Criar segunda aba com resumo por motivos
    if (analiseMotivos.length > 0) {
      const resumoMotivos = analiseMotivos.map(analise => ({
        'Motivo': analise.motivo,
        'Quantidade': analise.quantidade,
        'Percentual': ((analise.quantidade / registrosExcluidos.length) * 100).toFixed(2) + '%'
      }));
      
      const wsResumo = XLSX.utils.json_to_sheet(resumoMotivos);
      wsResumo['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo por Motivos");
    }

    // Exportar arquivo
    const fileName = `registros_excluidos_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({
      title: "Exportação Concluída",
      description: `Arquivo ${fileName} baixado com sucesso`,
    });
  };

  useEffect(() => {
    fetchUltimoUpload();
    fetchRegistrosExcluidos();
  }, []);

  useEffect(() => {
    if (registrosExcluidos.length > 0) {
      analisarMotivos();
    }
  }, [registrosExcluidos]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Análise de Registros Excluídos - Arquivo 1
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ultimoUpload && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-sm text-muted-foreground">Processados</div>
                <div className="text-2xl font-bold">{ultimoUpload.registros_processados?.toLocaleString()}</div>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <div className="text-sm text-muted-foreground">Inseridos</div>
                <div className="text-2xl font-bold text-green-600">{ultimoUpload.registros_inseridos?.toLocaleString()}</div>
              </div>
              <div className="bg-red-50 p-3 rounded">
                <div className="text-sm text-muted-foreground">Excluídos</div>
                <div className="text-2xl font-bold text-red-600">{ultimoUpload.registros_erro?.toLocaleString()}</div>
              </div>
              <div className="bg-amber-50 p-3 rounded">
                <div className="text-sm text-muted-foreground">Taxa Exclusão</div>
                <div className="text-2xl font-bold text-amber-600">
                  {ultimoUpload.registros_processados > 0 
                    ? ((ultimoUpload.registros_erro / ultimoUpload.registros_processados) * 100).toFixed(1) 
                    : 0}%
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 mb-4">
            <Button 
              onClick={fetchRegistrosExcluidos} 
              disabled={loading}
              variant="outline"
            >
              <Search className="h-4 w-4 mr-2" />
              {loading ? 'Buscando...' : 'Buscar Registros'}
            </Button>
            
            <Button 
              onClick={investigarProblemasSilenciosos} 
              disabled={loading}
              variant="outline"
            >
              <FileText className="h-4 w-4 mr-2" />
              Investigar Exclusões
            </Button>

            {registrosExcluidos.length > 0 && (
              <Button onClick={exportarRegistros} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            )}
          </div>

          {registrosExcluidos.length === 0 && !loading && (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Nenhum registro excluído encontrado na tabela de rejeitados.
              </p>
              <p className="text-sm text-muted-foreground">
                Isso pode indicar que as exclusões foram feitas por filtros automáticos sem registro detalhado.
                Use o botão "Investigar Exclusões" para analisar possíveis exclusões silenciosas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {registrosExcluidos.length > 0 && (
        <Tabs defaultValue="motivos" className="w-full">
          <TabsList>
            <TabsTrigger value="motivos">Análise por Motivos</TabsTrigger>
            <TabsTrigger value="detalhes">Registros Detalhados</TabsTrigger>
          </TabsList>
          
          <TabsContent value="motivos">
            <Card>
              <CardHeader>
                <CardTitle>Motivos das Exclusões</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analiseMotivos.map((analise, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Badge variant="destructive">
                            {analise.quantidade} registros
                          </Badge>
                          <span className="font-medium">{analise.motivo}</span>
                        </div>
                      </div>
                      
                      {analise.exemplos.length > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Exemplos:</p>
                          <div className="space-y-2">
                            {analise.exemplos.slice(0, 3).map((exemplo, idx) => (
                              <div key={idx} className="bg-muted p-2 rounded text-xs">
                                <div><strong>Empresa:</strong> {exemplo.EMPRESA}</div>
                                <div><strong>Estudo:</strong> {exemplo.ESTUDO_DESCRICAO}</div>
                                <div><strong>Modalidade:</strong> {exemplo.MODALIDADE}</div>
                                <div><strong>Valores:</strong> {exemplo.VALORES}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detalhes">
            <Card>
              <CardHeader>
                <CardTitle>Registros Excluídos - Detalhes Completos</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Estudo</TableHead>
                        <TableHead>Modalidade</TableHead>
                        <TableHead>Especialidade</TableHead>
                        <TableHead>Valores</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registrosExcluidos.slice(0, 100).map((registro) => {
                        const dados = registro.dados_originais || {};
                        return (
                          <TableRow key={registro.id}>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {registro.motivo_rejeicao}
                              </Badge>
                            </TableCell>
                            <TableCell>{dados.EMPRESA}</TableCell>
                            <TableCell>{dados.NOME_PACIENTE}</TableCell>
                            <TableCell>{dados.ESTUDO_DESCRICAO}</TableCell>
                            <TableCell>{dados.MODALIDADE}</TableCell>
                            <TableCell>{dados.ESPECIALIDADE}</TableCell>
                            <TableCell>{dados.VALORES}</TableCell>
                            <TableCell>{dados.DATA_REALIZACAO}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
                
                {registrosExcluidos.length > 100 && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Mostrando primeiros 100 registros de {registrosExcluidos.length.toLocaleString()} total.
                    Use a exportação Excel para ver todos os dados.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}