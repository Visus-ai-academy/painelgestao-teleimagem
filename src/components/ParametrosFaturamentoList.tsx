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
  tipo_cliente: string;
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
  simples: boolean;
  ativo: boolean;
  clientes?: {
    nome: string;
    nome_fantasia?: string;
    nome_mobilemed?: string;
    numero_contrato?: string;
    cnpj?: string;
    razao_social?: string;
    dia_faturamento?: number;
    data_inicio_contrato?: string;
    data_termino_contrato?: string;
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
              nome,
              nome_fantasia,
              nome_mobilemed,
              numero_contrato,
              cnpj,
              razao_social,
              dia_faturamento,
              data_inicio_contrato,
              data_termino_contrato
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
      const clienteNome = parametro.clientes?.nome_fantasia || parametro.clientes?.nome || '';
      const clienteMobilemed = parametro.clientes?.nome_mobilemed || '';
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
          aValue = a.clientes?.nome_mobilemed || '';
          bValue = b.clientes?.nome_mobilemed || '';
          break;
        case 'nome_fantasia':
          aValue = a.clientes?.nome_fantasia || a.clientes?.nome || '';
          bValue = b.clientes?.nome_fantasia || b.clientes?.nome || '';
          break;
        case 'contrato':
          aValue = a.clientes?.numero_contrato || '';
          bValue = b.clientes?.numero_contrato || '';
          break;
        case 'cnpj':
          aValue = a.clientes?.cnpj || '';
          bValue = b.clientes?.cnpj || '';
          break;
        case 'razao_social':
          aValue = a.clientes?.razao_social || '';
          bValue = b.clientes?.razao_social || '';
          break;
        case 'tipo_cliente':
          aValue = a.tipo_cliente;
          bValue = b.tipo_cliente;
          break;
        case 'dia_faturamento':
          aValue = a.clientes?.dia_faturamento || 0;
          bValue = b.clientes?.dia_faturamento || 0;
          break;
        case 'data_inicio':
          aValue = a.clientes?.data_inicio_contrato || '';
          bValue = b.clientes?.data_inicio_contrato || '';
          break;
        case 'data_termino':
          aValue = a.clientes?.data_termino_contrato || '';
          bValue = b.clientes?.data_termino_contrato || '';
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
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap min-w-[200px]">NOME_MOBILEMED</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap min-w-[200px]">Nome_Fantasia</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">Contrato</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">CNPJ</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap min-w-[250px]">Razão Social</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">TIPO_CLIENTE</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">DIA_FATURAMENTO</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">DATA_INICIO</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">DATA_TERMINO</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">Criterio de Emissao de NF</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">Criterios de geração do relatório</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">Criterios de aplicação dos parâmetros</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">Criterios de aplicação das franquias</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">TIPO FATURAMENTO</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">STATUS</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">Impostos abMin</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">Simples</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">Integração</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">Portal de Laudos</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">Possui Franquia</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">Valor Franquia</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">Frequencia Contínua</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">Frequência por volume</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">Volume Franquia</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">R$ Valor Franquia Acima Volume</TableHead>
                <TableHead className="sticky top-0 bg-background whitespace-nowrap">INCLUIR MÉDICO SOLICITANTE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parametrosFiltrados.map((parametro) => (
                <TableRow key={parametro.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {parametro.clientes?.nome_mobilemed || 'N/A'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {parametro.clientes?.nome_fantasia || parametro.clientes?.nome || 'N/A'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {parametro.clientes?.numero_contrato || '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {parametro.clientes?.cnpj || '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {parametro.clientes?.razao_social || '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="outline">{parametro.tipo_cliente}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {parametro.clientes?.dia_faturamento || '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(parametro.clientes?.data_inicio_contrato)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(parametro.clientes?.data_termino_contrato)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">-</TableCell>
                  <TableCell className="whitespace-nowrap">-</TableCell>
                  <TableCell className="whitespace-nowrap">-</TableCell>
                  <TableCell className="whitespace-nowrap">-</TableCell>
                  <TableCell className="whitespace-nowrap">-</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={parametro.ativo ? "default" : "secondary"}>
                      {formatBoolean(parametro.ativo)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">-</TableCell>
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