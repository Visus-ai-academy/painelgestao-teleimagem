import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ParametroFaturamento {
  id: string;
  cliente_id: string;
  nome_mobilemed?: string;
  nome_fantasia?: string;
  numero_contrato?: string;
  cnpj?: string;
  razao_social?: string;
  tipo_cliente: string;
  dia_faturamento?: number;
  data_inicio_contrato?: string;
  data_termino_contrato?: string;
  criterio_emissao_nf?: string;
  criterios_geracao_relatorio?: string;
  criterios_aplicacao_parametros?: string;
  criterios_aplicacao_franquias?: string;
  tipo_faturamento?: string;
  aplicar_franquia: boolean;
  volume_franquia: number | null;
  valor_franquia: number | null;
  frequencia_continua: boolean;
  frequencia_por_volume: boolean;
  valor_acima_franquia: number | null;
  cobrar_integracao: boolean;
  valor_integracao: number | null;
  portal_laudos: boolean;
  incluir_medico_solicitante: boolean;
  impostos_ab_min?: number | null;
  simples: boolean;
  ativo: boolean;
  clientes?: {
    nome: string;
  };
}

type SortField = 'nome_mobilemed' | 'nome_fantasia' | 'contrato' | 'cnpj' | 'razao_social' | 'tipo_cliente' | 'dia_faturamento' | 'data_inicio' | 'data_termino' | 'tipo_faturamento' | 'status' | 'simples' | 'integracao' | 'portal_laudos' | 'possui_franquia' | 'valor_franquia' | 'frequencia_continua' | 'frequencia_por_volume' | 'volume_franquia' | 'valor_franquia_acima_volume' | 'incluir_medico_solicitante';
type SortDirection = 'asc' | 'desc';

export function ParametrosFaturamentoList() {
  const [parametros, setParametros] = useState<ParametroFaturamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('nome_fantasia');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    const fetchParametros = async () => {
      try {
        const { data, error } = await supabase
          .from('parametros_faturamento')
          .select(`
            *,
            clientes (
              nome
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setParametros(data || []);
      } catch (error) {
        console.error('Erro ao carregar parâmetros:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchParametros();
  }, []);

  // Filtrar e ordenar parâmetros
  const parametrosFiltrados = useMemo(() => {
    let filtered = parametros.filter(parametro => {
      const clienteNome = parametro.nome_fantasia || parametro.clientes?.nome || '';
      const clienteMobilemed = parametro.nome_mobilemed || '';
      return clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
             clienteMobilemed.toLowerCase().includes(searchTerm.toLowerCase()) ||
             parametro.tipo_cliente.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Ordenação
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'nome_mobilemed':
          aValue = a.nome_mobilemed || '';
          bValue = b.nome_mobilemed || '';
          break;
        case 'nome_fantasia':
          aValue = a.nome_fantasia || a.clientes?.nome || '';
          bValue = b.nome_fantasia || b.clientes?.nome || '';
          break;
        case 'contrato':
          aValue = a.numero_contrato || '';
          bValue = b.numero_contrato || '';
          break;
        case 'cnpj':
          aValue = a.cnpj || '';
          bValue = b.cnpj || '';
          break;
        case 'razao_social':
          aValue = a.razao_social || '';
          bValue = b.razao_social || '';
          break;
        case 'tipo_cliente':
          aValue = a.tipo_cliente;
          bValue = b.tipo_cliente;
          break;
        case 'dia_faturamento':
          aValue = a.dia_faturamento || 0;
          bValue = b.dia_faturamento || 0;
          break;
        case 'data_inicio':
          aValue = a.data_inicio_contrato || '';
          bValue = b.data_inicio_contrato || '';
          break;
        case 'data_termino':
          aValue = a.data_termino_contrato || '';
          bValue = b.data_termino_contrato || '';
          break;
        case 'status':
          aValue = a.ativo ? 1 : 0;
          bValue = b.ativo ? 1 : 0;
          break;
        case 'simples':
          aValue = a.simples ? 1 : 0;
          bValue = b.simples ? 1 : 0;
          break;
        case 'integracao':
          aValue = a.cobrar_integracao ? 1 : 0;
          bValue = b.cobrar_integracao ? 1 : 0;
          break;
        case 'portal_laudos':
          aValue = a.portal_laudos ? 1 : 0;
          bValue = b.portal_laudos ? 1 : 0;
          break;
        case 'possui_franquia':
          aValue = a.aplicar_franquia ? 1 : 0;
          bValue = b.aplicar_franquia ? 1 : 0;
          break;
        case 'valor_franquia':
          aValue = a.valor_franquia || 0;
          bValue = b.valor_franquia || 0;
          break;
        case 'frequencia_continua':
          aValue = a.frequencia_continua ? 1 : 0;
          bValue = b.frequencia_continua ? 1 : 0;
          break;
        case 'frequencia_por_volume':
          aValue = a.frequencia_por_volume ? 1 : 0;
          bValue = b.frequencia_por_volume ? 1 : 0;
          break;
        case 'volume_franquia':
          aValue = a.volume_franquia || 0;
          bValue = b.volume_franquia || 0;
          break;
        case 'valor_franquia_acima_volume':
          aValue = a.valor_acima_franquia || 0;
          bValue = b.valor_acima_franquia || 0;
          break;
        case 'incluir_medico_solicitante':
          aValue = a.incluir_medico_solicitante ? 1 : 0;
          bValue = b.incluir_medico_solicitante ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [parametros, searchTerm, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 opacity-50" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  const formatCurrency = (value: number | null) => {
    return value ? `R$ ${value.toFixed(2).replace('.', ',')}` : '-';
  };

  const formatBoolean = (value: boolean) => {
    return value ? 'Sim' : 'Não';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString || dateString === '1970-01-01') return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return <div className="text-center py-4">Carregando parâmetros...</div>;
  }

  if (parametros.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum parâmetro de faturamento encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Badge variant="outline">
          {parametrosFiltrados.length} itens
        </Badge>
      </div>
      
      {/* Campo de busca */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente ou tipo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <div className="border rounded-md max-h-[600px] overflow-auto">
        <div className="overflow-x-auto">
          <Table className="min-w-max relative">
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="bg-background">
                <TableHead className="bg-background border-b whitespace-nowrap min-w-[200px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('nome_mobilemed')} className="flex items-center gap-1 font-semibold">
                    NOME_MOBILEMED {getSortIcon('nome_mobilemed')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap min-w-[200px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('nome_fantasia')} className="flex items-center gap-1 font-semibold">
                    Nome_Fantasia {getSortIcon('nome_fantasia')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('contrato')} className="flex items-center gap-1 font-semibold">
                    Contrato {getSortIcon('contrato')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('cnpj')} className="flex items-center gap-1 font-semibold">
                    CNPJ {getSortIcon('cnpj')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap min-w-[250px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('razao_social')} className="flex items-center gap-1 font-semibold">
                    Razão Social {getSortIcon('razao_social')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('tipo_cliente')} className="flex items-center gap-1 font-semibold">
                    TIPO_CLIENTE {getSortIcon('tipo_cliente')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('dia_faturamento')} className="flex items-center gap-1 font-semibold">
                    DIA_FATURAMENTO {getSortIcon('dia_faturamento')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('data_inicio')} className="flex items-center gap-1 font-semibold">
                    DATA_INICIO {getSortIcon('data_inicio')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('data_termino')} className="flex items-center gap-1 font-semibold">
                    DATA_TERMINO {getSortIcon('data_termino')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap font-semibold">Criterio de Emissao de NF</TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap font-semibold">Criterios de geração do relatório</TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap font-semibold">Criterios de aplicação dos parâmetros</TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap font-semibold">Criterios de aplicação das franquias</TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap font-semibold">TIPO FATURAMENTO</TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('status')} className="flex items-center gap-1 font-semibold">
                    STATUS {getSortIcon('status')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap font-semibold">Impostos abMin</TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('simples')} className="flex items-center gap-1 font-semibold">
                    Simples {getSortIcon('simples')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('integracao')} className="flex items-center gap-1 font-semibold">
                    Integração {getSortIcon('integracao')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('portal_laudos')} className="flex items-center gap-1 font-semibold">
                    Portal de Laudos {getSortIcon('portal_laudos')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('possui_franquia')} className="flex items-center gap-1 font-semibold">
                    Possui Franquia {getSortIcon('possui_franquia')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('valor_franquia')} className="flex items-center gap-1 font-semibold">
                    Valor Franquia {getSortIcon('valor_franquia')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('frequencia_continua')} className="flex items-center gap-1 font-semibold">
                    Frequencia Contínua {getSortIcon('frequencia_continua')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('frequencia_por_volume')} className="flex items-center gap-1 font-semibold">
                    Frequência por volume {getSortIcon('frequencia_por_volume')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('volume_franquia')} className="flex items-center gap-1 font-semibold">
                    Volume Franquia {getSortIcon('volume_franquia')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('valor_franquia_acima_volume')} className="flex items-center gap-1 font-semibold">
                    R$ Valor Franquia Acima Volume {getSortIcon('valor_franquia_acima_volume')}
                  </Button>
                </TableHead>
                <TableHead className="bg-background border-b whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('incluir_medico_solicitante')} className="flex items-center gap-1 font-semibold">
                    INCLUIR MÉDICO SOLICITANTE {getSortIcon('incluir_medico_solicitante')}
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parametrosFiltrados.map((parametro) => (
                <TableRow key={parametro.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {parametro.nome_mobilemed || 'N/A'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {parametro.nome_fantasia || parametro.clientes?.nome || 'N/A'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {parametro.numero_contrato || '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {parametro.cnpj || '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {parametro.razao_social || '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="outline">{parametro.tipo_cliente}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {parametro.dia_faturamento || '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(parametro.data_inicio_contrato || null)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(parametro.data_termino_contrato || null)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {parametro.criterio_emissao_nf || '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {parametro.criterios_geracao_relatorio || '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {parametro.criterios_aplicacao_parametros || '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {parametro.criterios_aplicacao_franquias || '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {parametro.tipo_faturamento || '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={parametro.ativo ? "default" : "secondary"}>
                      {formatBoolean(parametro.ativo)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{parametro.impostos_ab_min || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatBoolean(parametro.simples || false)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatBoolean(parametro.cobrar_integracao)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatBoolean(parametro.portal_laudos)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatBoolean(parametro.aplicar_franquia)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatCurrency(parametro.valor_franquia)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatBoolean(parametro.frequencia_continua)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatBoolean(parametro.frequencia_por_volume)}</TableCell>
                  <TableCell className="whitespace-nowrap">{parametro.volume_franquia || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatCurrency(parametro.valor_acima_franquia)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatBoolean(parametro.incluir_medico_solicitante)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}