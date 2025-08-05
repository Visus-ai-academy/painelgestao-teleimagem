import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Search, Download, Filter, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { useVolumetria } from "@/contexts/VolumetriaContext";
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
  const { data } = useVolumetria();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('tempoAtrasoHoras');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // CALCULAR LAUDOS ATRASADOS DOS DADOS DISPONÍVEIS
  const laudosAtrasados = useMemo(() => {
    if (!data.detailedData || data.detailedData.length === 0) {
      console.log(`📊 [LaudosAtrasadosDetalhado] Sem dados detalhados disponíveis`);
      return [];
    }

    console.log(`📊 [LaudosAtrasadosDetalhado] Iniciando processamento de ${data.detailedData.length} registros totais`);
    
    const atrasados: LaudoAtrasado[] = [];
    let registrosProcessados = 0;
    let registrosComDatasCompletas = 0;

    data.detailedData.forEach(item => {
      registrosProcessados++;
      
      // USAR MESMA VALIDAÇÃO DO CONTEXTO
      if (!item.DATA_LAUDO || !item.HORA_LAUDO || !item.DATA_PRAZO || !item.HORA_PRAZO) {
        return; // Pular registros sem dados completos
      }
      
      registrosComDatasCompletas++;

      try {
        const dataLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
        const dataPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
        
        // USAR MESMA LÓGICA DE VALIDAÇÃO DE DATA DO CONTEXTO
        if (isNaN(dataLaudo.getTime()) || isNaN(dataPrazo.getTime())) {
          return; // Pular datas inválidas
        }
        
        // VERIFICAR SE ESTÁ ATRASADO (MESMA LÓGICA DO CONTEXTO)
        if (dataLaudo > dataPrazo) {
          const tempoAtrasoMs = dataLaudo.getTime() - dataPrazo.getTime();
          const tempoAtrasoHoras = tempoAtrasoMs / (1000 * 60 * 60);
          
          atrasados.push({
            empresa: item.EMPRESA || '',
            paciente: item.NOME_PACIENTE || 'Não informado', // Campo correto é NOME_PACIENTE
            exame: item.ESTUDO_DESCRICAO || 'Não informado', // Campo correto é ESTUDO_DESCRICAO
            modalidade: item.MODALIDADE || '',
            especialidade: item.ESPECIALIDADE || '',
            categoria: item.CATEGORIA || '',
            prioridade: item.PRIORIDADE || '',
            medico: item.MEDICO || '',
            dataLaudo,
            dataPrazo,
            tempoAtrasoHoras,
            valores: Number(item.VALORES) || 1
          });
        }
      } catch (error) {
        console.log('Erro ao processar data:', error);
      }
    });

    console.log(`📊 [LaudosAtrasadosDetalhado] ESTATÍSTICAS FINAIS:`);
    console.log(`📊 - Total de registros disponíveis: ${data.detailedData.length}`);
    console.log(`📊 - Registros processados: ${registrosProcessados}`);
    console.log(`📊 - Registros com datas completas: ${registrosComDatasCompletas}`);
    console.log(`📊 - Laudos atrasados encontrados: ${atrasados.length}`);
    console.log(`📊 - Dashboard reporta: ${data.dashboardStats?.total_atrasados || 0} laudos atrasados`);
    
    // Se há discrepância significativa, reportar
    if (data.dashboardStats?.total_atrasados && Math.abs(atrasados.length - data.dashboardStats.total_atrasados) > 100) {
      console.warn(`⚠️ DISCREPÂNCIA DETECTADA: Dashboard=${data.dashboardStats.total_atrasados}, Detalhado=${atrasados.length}`);
    }
    
    return atrasados;
  }, [data.detailedData, data.dashboardStats]);

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

  // Paginação
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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

  // Função para categorizar urgência do atraso CORRIGIDA
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

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-red-500" />
          Demonstrativo Detalhado - Laudos em Atraso
          <Badge variant="destructive" className="ml-2">
            {laudosAtrasados.length.toLocaleString()} laudos detalhados
          </Badge>
          {searchTerm && (
            <Badge variant="outline" className="ml-2">
              {filteredAndSortedData.length.toLocaleString()} filtrados
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Informação sobre limitação dos dados */}
        {data.dashboardStats?.total_atrasados && laudosAtrasados.length !== data.dashboardStats.total_atrasados && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                Atenção: Este demonstrativo mostra {laudosAtrasados.length.toLocaleString()} laudos detalhados de um total de {data.dashboardStats.total_atrasados.toLocaleString()} laudos atrasados no sistema.
              </span>
            </div>
            <div className="text-xs text-yellow-700 mt-1">
              Alguns laudos podem não ter dados detalhados suficientes para exibição na tabela.
            </div>
          </div>
        )}
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
                  setCurrentPage(1);
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

        {/* Estatísticas rápidas CORRIGIDAS */}
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

        {/* Tabela de laudos atrasados */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
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
              {paginatedData.map((laudo, index) => {
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

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)} de {filteredAndSortedData.length} laudos
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <span className="text-sm">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}

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