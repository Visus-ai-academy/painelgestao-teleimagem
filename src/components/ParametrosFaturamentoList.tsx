import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  aplicar_adicional_urgencia: boolean;
  percentual_urgencia: number | null;
  cobrar_integracao: boolean;
  valor_integracao: number | null;
  periodicidade_reajuste: string;
  data_aniversario_contrato: string | null;
  indice_reajuste: string;
  percentual_reajuste_fixo: number | null;
  cliente_consolidado: string;
  impostos_ab_min: number | null;
  simples: boolean;
  tipo_metrica_convenio: string;
  tipo_metrica_urgencia: string;
  tipo_desconto_acrescimo: string;
  desconto_acrescimo: number | null;
  data_inicio_integracao: string | null;
  portal_laudos: boolean;
  percentual_iss: number | null;
  cobrar_urgencia_como_rotina: boolean;
  incluir_empresa_origem: boolean;
  incluir_access_number: boolean;
  incluir_medico_solicitante: boolean;
  ativo: boolean;
  clientes?: {
    nome: string;
    nome_fantasia?: string;
  };
}

type SortField = 'cliente_nome' | 'tipo_cliente' | 'aplicar_franquia' | 'valor_franquia' | 'frequencia_continua' | 'frequencia_por_volume' | 'valor_acima_franquia' | 'aplicar_adicional_urgencia' | 'percentual_urgencia' | 'cobrar_integracao' | 'valor_integracao' | 'periodicidade_reajuste' | 'indice_reajuste' | 'percentual_reajuste_fixo' | 'cliente_consolidado' | 'impostos_ab_min' | 'simples' | 'tipo_metrica_convenio' | 'tipo_metrica_urgencia' | 'tipo_desconto_acrescimo' | 'desconto_acrescimo' | 'data_inicio_integracao' | 'portal_laudos' | 'percentual_iss' | 'cobrar_urgencia_como_rotina' | 'incluir_empresa_origem' | 'incluir_access_number' | 'incluir_medico_solicitante';
type SortDirection = 'asc' | 'desc';

export function ParametrosFaturamentoList() {
  const [parametros, setParametros] = useState<ParametroFaturamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('cliente_nome');
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
              nome_fantasia
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
      return clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
             parametro.tipo_cliente.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Ordenação
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'cliente_nome':
          aValue = a.clientes?.nome_fantasia || a.clientes?.nome || '';
          bValue = b.clientes?.nome_fantasia || b.clientes?.nome || '';
          break;
        case 'tipo_cliente':
          aValue = a.tipo_cliente;
          bValue = b.tipo_cliente;
          break;
        case 'aplicar_franquia':
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
        case 'valor_acima_franquia':
          aValue = a.valor_acima_franquia || 0;
          bValue = b.valor_acima_franquia || 0;
          break;
        case 'aplicar_adicional_urgencia':
          aValue = a.aplicar_adicional_urgencia ? 1 : 0;
          bValue = b.aplicar_adicional_urgencia ? 1 : 0;
          break;
        case 'percentual_urgencia':
          aValue = a.percentual_urgencia || 0;
          bValue = b.percentual_urgencia || 0;
          break;
        case 'cobrar_integracao':
          aValue = a.cobrar_integracao ? 1 : 0;
          bValue = b.cobrar_integracao ? 1 : 0;
          break;
        case 'valor_integracao':
          aValue = a.valor_integracao || 0;
          bValue = b.valor_integracao || 0;
          break;
        case 'periodicidade_reajuste':
          aValue = a.periodicidade_reajuste;
          bValue = b.periodicidade_reajuste;
          break;
        case 'indice_reajuste':
          aValue = a.indice_reajuste;
          bValue = b.indice_reajuste;
          break;
        case 'percentual_reajuste_fixo':
          aValue = a.percentual_reajuste_fixo || 0;
          bValue = b.percentual_reajuste_fixo || 0;
          break;
        case 'cliente_consolidado':
          aValue = a.cliente_consolidado;
          bValue = b.cliente_consolidado;
          break;
        case 'impostos_ab_min':
          aValue = a.impostos_ab_min || 0;
          bValue = b.impostos_ab_min || 0;
          break;
        case 'simples':
          aValue = a.simples ? 1 : 0;
          bValue = b.simples ? 1 : 0;
          break;
        case 'tipo_metrica_convenio':
          aValue = a.tipo_metrica_convenio;
          bValue = b.tipo_metrica_convenio;
          break;
        case 'tipo_metrica_urgencia':
          aValue = a.tipo_metrica_urgencia;
          bValue = b.tipo_metrica_urgencia;
          break;
        case 'tipo_desconto_acrescimo':
          aValue = a.tipo_desconto_acrescimo;
          bValue = b.tipo_desconto_acrescimo;
          break;
        case 'desconto_acrescimo':
          aValue = a.desconto_acrescimo || 0;
          bValue = b.desconto_acrescimo || 0;
          break;
        case 'data_inicio_integracao':
          aValue = a.data_inicio_integracao || '';
          bValue = b.data_inicio_integracao || '';
          break;
        case 'portal_laudos':
          aValue = a.portal_laudos ? 1 : 0;
          bValue = b.portal_laudos ? 1 : 0;
          break;
        case 'percentual_iss':
          aValue = a.percentual_iss || 0;
          bValue = b.percentual_iss || 0;
          break;
        case 'cobrar_urgencia_como_rotina':
          aValue = a.cobrar_urgencia_como_rotina ? 1 : 0;
          bValue = b.cobrar_urgencia_como_rotina ? 1 : 0;
          break;
        case 'incluir_empresa_origem':
          aValue = a.incluir_empresa_origem ? 1 : 0;
          bValue = b.incluir_empresa_origem ? 1 : 0;
          break;
        case 'incluir_access_number':
          aValue = a.incluir_access_number ? 1 : 0;
          bValue = b.incluir_access_number ? 1 : 0;
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
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Nenhum parâmetro de faturamento encontrado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle>Parâmetros de Faturamento Cadastrados ({parametrosFiltrados.length})</CardTitle>
          </div>
          
          {/* Campo de busca */}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por cliente ou tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <ScrollArea className="h-[600px] w-full">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 border-b">
                <TableRow>
                  <TableHead className="min-w-[200px]">
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('cliente_nome')}
                    >
                      Cliente
                      {getSortIcon('cliente_nome')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('tipo_cliente')}
                    >
                      Tipo Cliente
                      {getSortIcon('tipo_cliente')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('aplicar_franquia')}
                    >
                      Aplicar Franquia
                      {getSortIcon('aplicar_franquia')}
                    </Button>
                  </TableHead>
                  <TableHead>Volume Franquia</TableHead>
                  <TableHead className="min-w-[120px]">
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('valor_franquia')}
                    >
                      Valor Franquia
                      {getSortIcon('valor_franquia')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('frequencia_continua')}
                    >
                      Frequência Contínua
                      {getSortIcon('frequencia_continua')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('frequencia_por_volume')}
                    >
                      Frequência Por Volume
                      {getSortIcon('frequencia_por_volume')}
                    </Button>
                  </TableHead>
                  <TableHead className="min-w-[140px]">
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('valor_acima_franquia')}
                    >
                      Valor Acima Franquia
                      {getSortIcon('valor_acima_franquia')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('aplicar_adicional_urgencia')}
                    >
                      Aplicar Adicional Urgência
                      {getSortIcon('aplicar_adicional_urgencia')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('percentual_urgencia')}
                    >
                      % Adicional Urgência
                      {getSortIcon('percentual_urgencia')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('cobrar_integracao')}
                    >
                      Cobrar Integração
                      {getSortIcon('cobrar_integracao')}
                    </Button>
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('valor_integracao')}
                    >
                      Valor Integração
                      {getSortIcon('valor_integracao')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('periodicidade_reajuste')}
                    >
                      Periodicidade Reajuste
                      {getSortIcon('periodicidade_reajuste')}
                    </Button>
                  </TableHead>
                  <TableHead>Data Aniversário</TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('indice_reajuste')}
                    >
                      Índice Reajuste
                      {getSortIcon('indice_reajuste')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('percentual_reajuste_fixo')}
                    >
                      % Reajuste Fixo
                      {getSortIcon('percentual_reajuste_fixo')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('cliente_consolidado')}
                    >
                      Cliente Consolidado
                      {getSortIcon('cliente_consolidado')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('impostos_ab_min')}
                    >
                      Impostos AB Min
                      {getSortIcon('impostos_ab_min')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('simples')}
                    >
                      Simples
                      {getSortIcon('simples')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('tipo_metrica_convenio')}
                    >
                      Tipo Métrica Convênio
                      {getSortIcon('tipo_metrica_convenio')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('tipo_metrica_urgencia')}
                    >
                      Tipo Métrica Urgência
                      {getSortIcon('tipo_metrica_urgencia')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('tipo_desconto_acrescimo')}
                    >
                      Tipo Desconto/Acréscimo
                      {getSortIcon('tipo_desconto_acrescimo')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('desconto_acrescimo')}
                    >
                      % Desconto/Acréscimo
                      {getSortIcon('desconto_acrescimo')}
                    </Button>
                  </TableHead>
                  <TableHead>Data Início Integração</TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('portal_laudos')}
                    >
                      Portal Laudos
                      {getSortIcon('portal_laudos')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('percentual_iss')}
                    >
                      % ISS
                      {getSortIcon('percentual_iss')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('cobrar_urgencia_como_rotina')}
                    >
                      Urgência Como Rotina
                      {getSortIcon('cobrar_urgencia_como_rotina')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('incluir_empresa_origem')}
                    >
                      Incluir Empresa Origem
                      {getSortIcon('incluir_empresa_origem')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('incluir_access_number')}
                    >
                      Incluir Access Number
                      {getSortIcon('incluir_access_number')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('incluir_medico_solicitante')}
                    >
                      Incluir Médico Solicitante
                      {getSortIcon('incluir_medico_solicitante')}
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parametrosFiltrados.map((parametro) => (
                  <TableRow key={parametro.id}>
                    <TableCell className="font-medium">
                      {parametro.clientes?.nome_fantasia || parametro.clientes?.nome || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{parametro.tipo_cliente}</Badge>
                    </TableCell>
                    <TableCell>{formatBoolean(parametro.aplicar_franquia)}</TableCell>
                    <TableCell>{parametro.volume_franquia || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatCurrency(parametro.valor_franquia)}</TableCell>
                    <TableCell>{formatBoolean(parametro.frequencia_continua)}</TableCell>
                    <TableCell>{formatBoolean(parametro.frequencia_por_volume)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatCurrency(parametro.valor_acima_franquia)}</TableCell>
                    <TableCell>{formatBoolean(parametro.aplicar_adicional_urgencia)}</TableCell>
                    <TableCell>{parametro.percentual_urgencia ? `${parametro.percentual_urgencia}%` : '-'}</TableCell>
                    <TableCell>{formatBoolean(parametro.cobrar_integracao)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatCurrency(parametro.valor_integracao)}</TableCell>
                    <TableCell>{parametro.periodicidade_reajuste || '-'}</TableCell>
                    <TableCell>{formatDate(parametro.data_aniversario_contrato)}</TableCell>
                    <TableCell>{parametro.indice_reajuste || '-'}</TableCell>
                    <TableCell>{parametro.percentual_reajuste_fixo ? `${parametro.percentual_reajuste_fixo}%` : '-'}</TableCell>
                    <TableCell>{parametro.cliente_consolidado || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatCurrency(parametro.impostos_ab_min)}</TableCell>
                    <TableCell>{formatBoolean(parametro.simples)}</TableCell>
                    <TableCell>{parametro.tipo_metrica_convenio || '-'}</TableCell>
                    <TableCell>{parametro.tipo_metrica_urgencia || '-'}</TableCell>
                    <TableCell>{parametro.tipo_desconto_acrescimo || '-'}</TableCell>
                    <TableCell>{parametro.desconto_acrescimo ? `${parametro.desconto_acrescimo}%` : '-'}</TableCell>
                    <TableCell>{formatDate(parametro.data_inicio_integracao)}</TableCell>
                    <TableCell>{formatBoolean(parametro.portal_laudos)}</TableCell>
                    <TableCell>{parametro.percentual_iss ? `${parametro.percentual_iss}%` : '-'}</TableCell>
                    <TableCell>{formatBoolean(parametro.cobrar_urgencia_como_rotina)}</TableCell>
                    <TableCell>{formatBoolean(parametro.incluir_empresa_origem)}</TableCell>
                    <TableCell>{formatBoolean(parametro.incluir_access_number)}</TableCell>
                    <TableCell>{formatBoolean(parametro.incluir_medico_solicitante)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}