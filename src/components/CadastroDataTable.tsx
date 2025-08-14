import { useState, useMemo, useRef, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, Edit, X } from "lucide-react";
import { format } from "date-fns";

interface CadastroDataTableProps {
  data: any[];
  loading: boolean;
  error: string | null;
  type: 'exames' | 'quebra' | 'precos' | 'regras' | 'repasse' | 'modalidades' | 'especialidades' | 'categorias' | 'prioridades' | 'clientes';
  title: string;
}

export function CadastroDataTable({ data, loading, error, type, title }: CadastroDataTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // Infinite scroll controls
  const INITIAL_BATCH = 200;
  const BATCH_SIZE = 300;
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset when data or filters change
    setVisibleCount(INITIAL_BATCH);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [data, searchTerm, columnFilters, type]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 100;
    if (nearBottom && visibleCount < filteredAndSortedData.length) {
      setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredAndSortedData.length));
    }
  };

  // Definir colunas por tipo
  const getColumns = () => {
    switch (type) {
      case 'exames':
        return [
          { key: 'nome', label: 'Nome', filterable: true },
          { key: 'codigo_exame', label: 'Código', filterable: true },
          { key: 'modalidade', label: 'Modalidade', filterable: true },
          { key: 'especialidade', label: 'Especialidade', filterable: true },
          { key: 'categoria', label: 'Categoria', filterable: true },
          { key: 'permite_quebra', label: 'Permite Quebra', filterable: true },
          { key: 'quantidade_quebras', label: 'Qtd. Quebras', filterable: false },
          { key: 'created_at', label: 'Criado em', filterable: false }
        ];
      case 'quebra':
        return [
          { key: 'exame_original', label: 'Exame Original', filterable: true },
          { key: 'exame_quebrado', label: 'Exame Quebrado', filterable: true },
          { key: 'categoria_quebrada', label: 'Categoria', filterable: true },
          { key: 'ativo', label: 'Status', filterable: true },
          { key: 'created_at', label: 'Criado em', filterable: false }
        ];
      case 'precos':
        return [
          { key: 'cliente_nome', label: 'Cliente', filterable: true },
          { key: 'modalidade', label: 'Modalidade', filterable: true },
          { key: 'especialidade', label: 'Especialidade', filterable: true },
          { key: 'prioridade', label: 'Prioridade', filterable: true },
          { key: 'categoria', label: 'Categoria', filterable: true },
          { key: 'valor_base', label: 'Preço', filterable: false },
          { key: 'volume_inicial', label: 'Vol Inicial', filterable: false },
          { key: 'volume_final', label: 'Vol Final', filterable: false },
          { key: 'volume_total', label: 'Cond. Volume', filterable: false },
          { key: 'considera_prioridade_plantao', label: 'Considera Plantão', filterable: true },
          { key: 'ativo', label: 'Status', filterable: true }
        ];
      case 'regras':
        return [
          { key: 'nome_regra', label: 'Nome', filterable: true },
          { key: 'descricao', label: 'Descrição', filterable: true },
          { key: 'acao', label: 'Ação', filterable: true },
          { key: 'prioridade', label: 'Prioridade', filterable: false },
          { key: 'ativo', label: 'Status', filterable: true },
          { key: 'created_at', label: 'Criado em', filterable: false }
        ];
      case 'repasse':
        return [
          { key: 'medico_nome', label: 'Médico', filterable: true },
          { key: 'medico_crm', label: 'CRM', filterable: true },
          { key: 'modalidade', label: 'Modalidade', filterable: true },
          { key: 'especialidade', label: 'Especialidade', filterable: true },
          { key: 'prioridade', label: 'Prioridade', filterable: true },
          { key: 'valor', label: 'Valor', filterable: false },
          { key: 'created_at', label: 'Criado em', filterable: false }
        ];
      case 'clientes':
        return [
          { key: 'nome_mobilemed', label: 'Nome MobileMed', filterable: true, width: '200px' },
          { key: 'nome', label: 'Nome Fantasia', filterable: true, width: '200px' },
          { key: 'razao_social', label: 'Razão Social', filterable: true, width: '250px' },
          { key: 'cnpj', label: 'CNPJ', filterable: true, width: '150px' },
          { key: 'contato', label: 'Contato', filterable: true, width: '150px' },
          { key: 'telefone', label: 'Telefone', filterable: true, width: '120px' },
          { key: 'cidade', label: 'Cidade', filterable: true, width: '120px' },
          { key: 'estado', label: 'UF', filterable: true, width: '60px' },
          { key: 'endereco', label: 'Endereço', filterable: true, width: '200px' },
          { key: 'bairro', label: 'Bairro', filterable: true, width: '120px' },
          { key: 'cep', label: 'CEP', filterable: true, width: '100px' },
          { key: 'tipo_cliente', label: 'Tipo', filterable: true, width: '80px' },
          { key: 'status', label: 'Status', filterable: true, width: '80px' },
          { key: 'actions', label: 'Ações', filterable: false, width: '100px' }
        ];
      default:
        return [
          { key: 'nome', label: 'Nome', filterable: true },
          { key: 'descricao', label: 'Descrição', filterable: true },
          { key: 'ordem', label: 'Ordem', filterable: false },
          { key: 'ativo', label: 'Status', filterable: true },
          { key: 'created_at', label: 'Criado em', filterable: false }
        ];
    }
  };

  const columns = getColumns();

  // Função para obter valor de uma coluna
  const getCellValue = (item: any, key: string) => {
    switch (key) {
      case 'cliente_nome':
        return item.clientes?.nome || item.cliente_nome || 'Cliente não identificado';
      case 'medico_nome':
        return item.medicos?.nome || 'Regra Geral';
      case 'medico_crm':
        return item.medicos?.crm || '-';
      case 'valor_base':
        return `R$ ${Number(item.valor_base || 0).toFixed(2)}`;
      case 'valor_urgencia':
        return `R$ ${Number(item.valor_urgencia || 0).toFixed(2)}`;
      case 'valor':
        return `R$ ${Number(item.valor || 0).toFixed(2)}`;
      case 'volume_inicial':
        return item.volume_inicial || '-';
      case 'volume_final':
        return item.volume_final || '-';
      case 'volume_total':
        return item.volume_total || '-';
      case 'considera_prioridade_plantao':
        return item.considera_prioridade_plantao ? "Sim" : "Não";
      case 'permite_quebra':
        return item.permite_quebra ? "Sim" : "Não";
      case 'quantidade_quebras':
        return item.quantidade_quebras || 0;
      case 'ativo':
        return item.ativo ? "Ativo" : "Inativo";
      case 'status':
        return item.status || (item.ativo ? "Ativo" : "Inativo");
      case 'data_inicio_contrato':
      case 'data_termino_contrato':
        if (!item[key]) return '';
        try {
          const date = new Date(item[key]);
          // Verificar se é uma data válida e não é a época Unix (1969/1970)
          if (isNaN(date.getTime()) || date.getFullYear() < 1970) return '';
          return format(date, 'dd/MM/yyyy');
        } catch {
          return '';
        }
      case 'cep':
        if (!item[key]) return '';
        const cepNumbers = item[key].toString().replace(/\D/g, '');
        if (cepNumbers.length === 8) {
          return cepNumbers.replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2-$3');
        }
        return item[key];
      case 'created_at':
        return format(new Date(item.created_at), 'dd/MM/yyyy');
      default:
        return item[key] || '';
    }
  };

  // Filtrar e ordenar dados
  const filteredAndSortedData = useMemo(() => {
    if (!data) return [];
    
    let filtered = data;
    
    // Aplicar filtro de pesquisa global
    if (searchTerm) {
      filtered = data.filter((item) => {
        const searchLower = searchTerm.toLowerCase();
        return columns.some(col => {
          const value = getCellValue(item, col.key);
          return value.toString().toLowerCase().includes(searchLower);
        });
      });
    }
    
    // Aplicar filtros por coluna
    Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
      if (filterValue) {
        filtered = filtered.filter(item => {
          const value = getCellValue(item, columnKey);
          return value.toString().toLowerCase().includes(filterValue.toLowerCase());
        });
      }
    });
    
    // Ordenar alfabeticamente pela primeira coluna
    return filtered.sort((a, b) => {
      const aValue = getCellValue(a, columns[0].key);
      const bValue = getCellValue(b, columns[0].key);
      return aValue.toString().localeCompare(bValue.toString(), 'pt-BR', { sensitivity: 'base' });
    });
  }, [data, searchTerm, columnFilters, columns]);

  // Handler para atualizar filtro de coluna
  const updateColumnFilter = (columnKey: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: value
    }));
  };

  // Função para limpar todos os filtros
  const clearAllFilters = () => {
    setSearchTerm('');
    setColumnFilters({});
  };

  // Verificar se há filtros ativos
  const hasActiveFilters = searchTerm || Object.values(columnFilters).some(filter => filter);

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{title}</h3>
        <div className="border rounded-md">
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{title}</h3>
        <div className="text-center py-8 text-destructive">
          Erro ao carregar dados: {error}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{title}</h3>
        <div className="text-center py-8 text-muted-foreground">
          Nenhum item cadastrado ainda.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{title}</h3>
        <Badge variant="outline">
          {filteredAndSortedData.length} itens
        </Badge>
      </div>
      
      {/* Campo de pesquisa global e botão limpar filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Pesquisar em todas as colunas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {hasActiveFilters && (
          <Button
            variant="outline"
            onClick={clearAllFilters}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Limpar Filtros
          </Button>
        )}
      </div>
      
      <div ref={scrollRef} onScroll={handleScroll} className="border rounded-md max-h-[500px] overflow-auto">
        <div className="overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                 {columns.map((col) => (
                   <TableHead 
                     key={col.key} 
                     className="sticky top-0 bg-background whitespace-nowrap"
                     style={{ width: col.width || '150px' }}
                   >
                     <div className="space-y-2">
                       <div className="font-medium">{col.label}</div>
                       {col.filterable && (
                         <div className="relative">
                           <Filter className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3 w-3" />
                           <Input
                             placeholder="Filtrar..."
                             value={columnFilters[col.key] || ''}
                             onChange={(e) => updateColumnFilter(col.key, e.target.value)}
                             className="pl-7 h-7 text-xs"
                             style={{ width: '100%' }}
                             onClick={(e) => e.stopPropagation()}
                           />
                         </div>
                       )}
                     </div>
                   </TableHead>
                 ))}
               </TableRow>
             </TableHeader>
             <TableBody>
               {filteredAndSortedData.slice(0, visibleCount).map((item) => (
                 <TableRow key={item.id}>
                   {columns.map((col) => (
                     <TableCell 
                       key={col.key} 
                       className="whitespace-nowrap"
                       style={{ width: col.width || '150px' }}
                     >
                       {col.key === 'actions' ? (
                         <div className="flex gap-1">
                           <Button
                             size="sm"
                             variant="outline"
                             onClick={() => {
                               // Emit edit event
                               window.dispatchEvent(new CustomEvent('editCliente', { detail: item }));
                             }}
                             className="h-7 px-2"
                           >
                             <Edit className="h-3 w-3" />
                           </Button>
                         </div>
                       ) : (col.key === 'permite_quebra' || col.key === 'ativo' || col.key === 'status') ? (
                         <Badge variant={
                           col.key === 'permite_quebra' 
                             ? (item.permite_quebra ? "default" : "secondary")
                             : col.key === 'status'
                             ? (item.status === 'Ativo' || item.ativo ? "default" : "secondary")
                             : (item.ativo ? "default" : "secondary")
                         }>
                           {getCellValue(item, col.key)}
                         </Badge>
                       ) : (
                         <span className={col.key === columns[0].key ? "font-medium" : ""}>
                           {getCellValue(item, col.key)}
                         </span>
                       )}
                     </TableCell>
                   ))}
                 </TableRow>
               ))}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {filteredAndSortedData.length === 0 && (searchTerm || Object.values(columnFilters).some(f => f)) && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum item encontrado com os filtros aplicados.
        </div>
      )}
      {visibleCount < filteredAndSortedData.length && (
        <div className="text-center py-3 text-muted-foreground text-sm">
          Role para carregar mais... ({Math.min(visibleCount, filteredAndSortedData.length)} de {filteredAndSortedData.length})
        </div>
      )}
    </div>
  );
}