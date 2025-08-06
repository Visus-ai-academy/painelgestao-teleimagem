import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Search, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from 'xlsx';

interface LaudoAtrasado {
  empresa: string;
  paciente: string;
  exame: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade: string;
  medico: string;
  dataLaudo: Date;
  dataPrazo: Date;
  tempoAtrasoHoras: number;
  valores: number;
}

type SortField = keyof LaudoAtrasado | 'tempoAtraso';
type SortDirection = 'asc' | 'desc';

export const LaudosAtrasadosDetalhado = () => {
  const [laudosAtrasados, setLaudosAtrasados] = useState<LaudoAtrasado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('tempoAtrasoHoras');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // CARREGAR TODOS OS LAUDOS ATRASADOS DIRETAMENTE DA FUNÇÃO RPC
  useEffect(() => {
    const carregarLaudosAtrasados = async () => {
      try {
        console.log('🚀 [LaudosAtrasados] Carregando TODOS os laudos atrasados via RPC...');
        
        const { data: laudosAtrasadosData, error } = await supabase.rpc('get_laudos_atrasados_completos');
        
        if (error) {
          throw new Error(`Erro ao carregar laudos atrasados: ${error.message}`);
        }
        
        console.log(`✅ [LaudosAtrasados] ${laudosAtrasadosData?.length || 0} registros de laudos atrasados carregados via RPC`);
        
        // Calcular soma total dos valores
        const totalLaudos = laudosAtrasadosData?.reduce((sum: number, item: any) => sum + (Number(item.VALORES) || 0), 0) || 0;
        console.log(`🔥 [LaudosAtrasados] TOTAL DE LAUDOS (soma valores): ${totalLaudos.toLocaleString()}`);
        console.log(`📊 [LaudosAtrasados] Distribuição: ${laudosAtrasadosData?.length || 0} registros = ${totalLaudos.toLocaleString()} laudos`);
        
        const laudosProcessados: LaudoAtrasado[] = laudosAtrasadosData.map((item: any) => {
          const dataLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
          const dataPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
          const tempoAtrasoMs = dataLaudo.getTime() - dataPrazo.getTime();
          const tempoAtrasoHoras = tempoAtrasoMs / (1000 * 60 * 60);
          
          return {
            empresa: item.EMPRESA || '',
            paciente: item.NOME_PACIENTE || 'Não informado',
            exame: item.ESTUDO_DESCRICAO || 'Não informado',
            modalidade: item.MODALIDADE || '',
            especialidade: item.ESPECIALIDADE || '',
            categoria: item.CATEGORIA || '',
            prioridade: item.PRIORIDADE || '',
            medico: item.MEDICO || '',
            dataLaudo,
            dataPrazo,
            tempoAtrasoHoras,
            valores: Number(item.VALORES) || 1
          };
        });
        
        setLaudosAtrasados(laudosProcessados);
        console.log(`📊 Total de laudos atrasados processados: ${laudosProcessados.length}`);
      } catch (error) {
        console.error('❌ Erro ao carregar laudos atrasados:', error);
        setLaudosAtrasados([]);
      } finally {
        setLoading(false);
      }
    };
    
    carregarLaudosAtrasados();
  }, []);

  // Filtrar e ordenar dados
  const filteredAndSortedData = useMemo(() => {
    let filtered = laudosAtrasados;

    // Aplicar filtro de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(laudo => 
        laudo.empresa.toLowerCase().includes(term) ||
        laudo.paciente.toLowerCase().includes(term) ||
        laudo.exame.toLowerCase().includes(term) ||
        laudo.modalidade.toLowerCase().includes(term) ||
        laudo.especialidade.toLowerCase().includes(term) ||
        laudo.medico.toLowerCase().includes(term)
      );
    }

    // Aplicar ordenação
    filtered.sort((a, b) => {
      let valueA: any = a[sortField];
      let valueB: any = b[sortField];

      if (sortField === 'dataLaudo' || sortField === 'dataPrazo') {
        valueA = valueA.getTime();
        valueB = valueB.getTime();
      }

      if (typeof valueA === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });

    return filtered;
  }, [laudosAtrasados, searchTerm, sortField, sortDirection]);

  // EXIBIR TODOS OS REGISTROS - SEM LIMITAÇÃO
  const displayData = filteredAndSortedData;

  // Função para alterar ordenação
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Função para renderizar ícone de ordenação
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-blue-600" />
      : <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  // Função para categorizar urgência do atraso
  const categorizarUrgencia = (horas: number) => {
    if (horas > 3) return { label: 'Emergencial', color: 'destructive' as const };
    if (horas >= 2) return { label: 'Crítico', color: 'secondary' as const };
    if (horas >= 1) return { label: 'Moderado', color: 'outline' as const };
    return { label: 'Baixo', color: 'default' as const };
  };

  // Função para formatar tempo de atraso
  const formatarTempoAtraso = (horas: number) => {
    if (horas >= 24) {
      const dias = Math.floor(horas / 24);
      const horasRestantes = Math.floor(horas % 24);
      return `${dias}d ${horasRestantes}h`;
    }
    return `${Math.floor(horas)}h ${Math.floor((horas % 1) * 60)}min`;
  };

  // Função para exportar para Excel
  const exportarExcel = () => {
    const dadosExport = filteredAndSortedData.map(laudo => ({
      'Cliente': laudo.empresa,
      'Paciente': laudo.paciente,
      'Exame': laudo.exame,
      'Modalidade': laudo.modalidade,
      'Especialidade': laudo.especialidade,
      'Categoria': laudo.categoria,
      'Prioridade': laudo.prioridade,
      'Médico': laudo.medico,
      'Data Prazo': format(laudo.dataPrazo, 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      'Data Laudo': format(laudo.dataLaudo, 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      'Tempo Atraso': formatarTempoAtraso(laudo.tempoAtrasoHoras),
      'Urgência': categorizarUrgencia(laudo.tempoAtrasoHoras).label,
      'Valores': laudo.valores
    }));

    const worksheet = XLSX.utils.json_to_sheet(dadosExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laudos Atrasados');
    
    const fileName = `laudos_atrasados_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  if (loading) {
    return (
      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="text-center">Carregando laudos atrasados...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-red-500" />
          Demonstrativo Detalhado - Laudos em Atraso
          <Badge variant="destructive" className="ml-2">
            {laudosAtrasados.reduce((sum, laudo) => sum + laudo.valores, 0).toLocaleString()} laudos
          </Badge>
          {searchTerm && (
            <Badge variant="outline" className="ml-2">
              {filteredAndSortedData.reduce((sum, laudo) => sum + laudo.valores, 0).toLocaleString()} laudos filtrados
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Controles de filtro e busca */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, paciente, exame, modalidade, especialidade ou médico..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                }}
                className="pl-8"
              />
            </div>
          </div>
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={exportarExcel}
            disabled={filteredAndSortedData.length === 0}
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>

        {/* Estatísticas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {filteredAndSortedData.filter(l => l.tempoAtrasoHoras > 3).length}
            </div>
            <div className="text-sm text-muted-foreground">Emergencial (&gt;3h)</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {filteredAndSortedData.filter(l => l.tempoAtrasoHoras >= 2 && l.tempoAtrasoHoras <= 3).length}
            </div>
            <div className="text-sm text-muted-foreground">Crítico (2-3h)</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">
              {filteredAndSortedData.filter(l => l.tempoAtrasoHoras >= 1 && l.tempoAtrasoHoras < 2).length}
            </div>
            <div className="text-sm text-muted-foreground">Moderado (1-2h)</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {filteredAndSortedData.filter(l => l.tempoAtrasoHoras < 1).length}
            </div>
            <div className="text-sm text-muted-foreground">Baixo (&lt;1h)</div>
          </div>
        </div>

        {/* Tabela de laudos atrasados - SEM LIMITAÇÃO DE ALTURA */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-y-auto" style={{ maxHeight: 'none' }}>
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow className="bg-muted/50">
                  <TableHead className="cursor-pointer" onClick={() => handleSort('empresa')}>
                    <div className="flex items-center gap-1">
                      Cliente {renderSortIcon('empresa')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('paciente')}>
                    <div className="flex items-center gap-1">
                      Paciente {renderSortIcon('paciente')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('exame')}>
                    <div className="flex items-center gap-1">
                      Exame {renderSortIcon('exame')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('valores')}>
                    <div className="flex items-center gap-1">
                      Qtd {renderSortIcon('valores')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('modalidade')}>
                    <div className="flex items-center gap-1">
                      Modalidade {renderSortIcon('modalidade')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('especialidade')}>
                    <div className="flex items-center gap-1">
                      Especialidade {renderSortIcon('especialidade')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('medico')}>
                    <div className="flex items-center gap-1">
                      Médico {renderSortIcon('medico')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('dataPrazo')}>
                    <div className="flex items-center gap-1">
                      Prazo {renderSortIcon('dataPrazo')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('dataLaudo')}>
                    <div className="flex items-center gap-1">
                      Laudo {renderSortIcon('dataLaudo')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('tempoAtrasoHoras')}>
                    <div className="flex items-center gap-1">
                      Atraso {renderSortIcon('tempoAtrasoHoras')}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.map((laudo, index) => {
                  const urgencia = categorizarUrgencia(laudo.tempoAtrasoHoras);
                  return (
                    <TableRow key={index} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{laudo.empresa}</TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate" title={laudo.paciente}>
                            {laudo.paciente || 'Não informado'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate" title={laudo.exame}>
                            {laudo.exame || 'Não informado'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-semibold text-blue-600">
                          {laudo.valores.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{laudo.modalidade || 'Não informado'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{laudo.especialidade || 'Não informado'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{laudo.medico || 'Não informado'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(laudo.dataPrazo, 'dd/MM/yyyy', { locale: ptBR })}
                          <div className="text-xs text-muted-foreground">
                            {format(laudo.dataPrazo, 'HH:mm')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(laudo.dataLaudo, 'dd/MM/yyyy', { locale: ptBR })}
                          <div className="text-xs text-muted-foreground">
                            {format(laudo.dataLaudo, 'HH:mm')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={urgencia.color} className="text-xs">
                            {formatarTempoAtraso(laudo.tempoAtrasoHoras)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {urgencia.label}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Informação de total de registros */}
        <div className="mt-6 text-center">
          <div className="text-sm text-muted-foreground">
            Total: <strong>{filteredAndSortedData.reduce((sum, laudo) => sum + laudo.valores, 0).toLocaleString()} laudos atrasados</strong>
            {searchTerm && ` (filtrados de ${laudosAtrasados.reduce((sum, laudo) => sum + laudo.valores, 0).toLocaleString()} laudos)`}
          </div>
        </div>

        {laudosAtrasados.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhum laudo em atraso encontrado</h3>
            <p>Todos os laudos estão dentro do prazo estabelecido.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};