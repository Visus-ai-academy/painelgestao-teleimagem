import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";
import { format } from "date-fns";

interface CadastroDataTableProps {
  data: any[];
  loading: boolean;
  error: string | null;
  type: 'exames' | 'quebra' | 'precos' | 'regras' | 'repasse' | 'modalidades' | 'especialidades' | 'categorias' | 'prioridades';
  title: string;
}

export function CadastroDataTable({ data, loading, error, type, title }: CadastroDataTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

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
          { key: 'ativo', label: 'Status', filterable: true },
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
          { key: 'tipo_preco', label: 'Tipo', filterable: true },
          { key: 'modalidade', label: 'Modalidade', filterable: true },
          { key: 'especialidade', label: 'Especialidade', filterable: true },
          { key: 'categoria', label: 'Categoria', filterable: true },
          { key: 'prioridade', label: 'Prioridade', filterable: true },
          { key: 'valor_base', label: 'Valor Base', filterable: false },
          { key: 'valor_urgencia', label: 'Valor Urgência', filterable: false },
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
      case 'permite_quebra':
        return item.permite_quebra ? "Sim" : "Não";
      case 'ativo':
        return item.ativo ? "Ativo" : "Inativo";
      case 'created_at':
        return format(new Date(item.created_at), 'dd/MM/yyyy');
      default:
        return item[key] || '-';
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
          {data.length} itens
        </Badge>
      </div>
      
      {/* Campo de pesquisa global */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Pesquisar em todas as colunas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <div className="border rounded-md max-h-[500px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className="sticky top-0 bg-background">
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
            {filteredAndSortedData.map((item) => (
              <TableRow key={item.id}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    {(col.key === 'permite_quebra' || col.key === 'ativo') ? (
                      <Badge variant={
                        col.key === 'permite_quebra' 
                          ? (item.permite_quebra ? "default" : "secondary")
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
      
      {filteredAndSortedData.length === 0 && (searchTerm || Object.values(columnFilters).some(f => f)) && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum item encontrado com os filtros aplicados.
        </div>
      )}
    </div>
  );
}