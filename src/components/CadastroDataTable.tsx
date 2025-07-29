import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
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

  // Filtrar e ordenar dados
  const filteredAndSortedData = useMemo(() => {
    if (!data) return [];
    
    let filtered = data;
    
    // Aplicar filtro de pesquisa
    if (searchTerm) {
      filtered = data.filter((item) => {
        const searchLower = searchTerm.toLowerCase();
        
        switch (type) {
          case 'exames':
            return (
              item.nome?.toLowerCase().includes(searchLower) ||
              item.codigo_exame?.toLowerCase().includes(searchLower) ||
              item.modalidade?.toLowerCase().includes(searchLower) ||
              item.especialidade?.toLowerCase().includes(searchLower) ||
              item.categoria?.toLowerCase().includes(searchLower)
            );
          case 'quebra':
            return (
              item.exame_original?.toLowerCase().includes(searchLower) ||
              item.exame_quebrado?.toLowerCase().includes(searchLower) ||
              item.categoria_quebrada?.toLowerCase().includes(searchLower)
            );
          case 'precos':
            return (
              item.modalidade?.toLowerCase().includes(searchLower) ||
              item.especialidade?.toLowerCase().includes(searchLower) ||
              item.categoria?.toLowerCase().includes(searchLower) ||
              item.prioridade?.toLowerCase().includes(searchLower) ||
              item.tipo_preco?.toLowerCase().includes(searchLower)
            );
          case 'regras':
            return (
              item.nome_regra?.toLowerCase().includes(searchLower) ||
              item.descricao?.toLowerCase().includes(searchLower) ||
              item.acao?.toLowerCase().includes(searchLower)
            );
          case 'repasse':
            return (
              item.medicos?.nome?.toLowerCase().includes(searchLower) ||
              item.medicos?.crm?.toLowerCase().includes(searchLower) ||
              item.modalidade?.toLowerCase().includes(searchLower) ||
              item.especialidade?.toLowerCase().includes(searchLower) ||
              item.prioridade?.toLowerCase().includes(searchLower)
            );
          case 'modalidades':
          case 'especialidades':
          case 'categorias':
          case 'prioridades':
            return (
              item.nome?.toLowerCase().includes(searchLower) ||
              item.descricao?.toLowerCase().includes(searchLower)
            );
          default:
            return true;
        }
      });
    }
    
    // Ordenar alfabeticamente
    return filtered.sort((a, b) => {
      let aValue = '';
      let bValue = '';
      
      switch (type) {
        case 'exames':
          aValue = a.nome || '';
          bValue = b.nome || '';
          break;
        case 'quebra':
          aValue = a.exame_original || '';
          bValue = b.exame_original || '';
          break;
        case 'precos':
          aValue = `${a.modalidade || ''} ${a.especialidade || ''}`;
          bValue = `${b.modalidade || ''} ${b.especialidade || ''}`;
          break;
        case 'regras':
          aValue = a.nome_regra || '';
          bValue = b.nome_regra || '';
          break;
        case 'repasse':
          aValue = a.medicos?.nome || 'Regra Geral';
          bValue = b.medicos?.nome || 'Regra Geral';
          break;
        case 'modalidades':
        case 'especialidades':
        case 'categorias':
        case 'prioridades':
          aValue = a.nome || '';
          bValue = b.nome || '';
          break;
        default:
          return 0;
      }
      
      return aValue.localeCompare(bValue, 'pt-BR', { sensitivity: 'base' });
    });
  }, [data, searchTerm, type]);
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

  const renderTableContent = () => {
    switch (type) {
      case 'exames':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Permite Quebra</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nome}</TableCell>
                  <TableCell>{item.codigo_exame || '-'}</TableCell>
                  <TableCell>{item.modalidade}</TableCell>
                  <TableCell>{item.especialidade}</TableCell>
                  <TableCell>{item.categoria}</TableCell>
                  <TableCell>
                    <Badge variant={item.permite_quebra ? "default" : "secondary"}>
                      {item.permite_quebra ? "Sim" : "Não"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.ativo ? "default" : "secondary"}>
                      {item.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(item.created_at), 'dd/MM/yyyy')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'quebra':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exame Original</TableHead>
                <TableHead>Exame Quebrado</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.exame_original}</TableCell>
                  <TableCell>{item.exame_quebrado}</TableCell>
                  <TableCell>{item.categoria_quebrada}</TableCell>
                  <TableCell>
                    <Badge variant={item.ativo ? "default" : "secondary"}>
                      {item.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(item.created_at), 'dd/MM/yyyy')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'precos':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Valor Base</TableHead>
                <TableHead>Valor Urgência</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.tipo_preco}</TableCell>
                  <TableCell>{item.modalidade}</TableCell>
                  <TableCell>{item.especialidade}</TableCell>
                  <TableCell>{item.categoria}</TableCell>
                  <TableCell>{item.prioridade}</TableCell>
                  <TableCell>R$ {Number(item.valor_base).toFixed(2)}</TableCell>
                  <TableCell>R$ {Number(item.valor_urgencia).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={item.ativo ? "default" : "secondary"}>
                      {item.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'regras':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nome_regra}</TableCell>
                  <TableCell>{item.descricao || '-'}</TableCell>
                  <TableCell>{item.acao}</TableCell>
                  <TableCell>{item.prioridade}</TableCell>
                  <TableCell>
                    <Badge variant={item.ativo ? "default" : "secondary"}>
                      {item.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(item.created_at), 'dd/MM/yyyy')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'repasse':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Médico</TableHead>
                <TableHead>CRM</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.medicos?.nome || 'Regra Geral'}
                  </TableCell>
                  <TableCell>{item.medicos?.crm || '-'}</TableCell>
                  <TableCell>{item.modalidade}</TableCell>
                  <TableCell>{item.especialidade}</TableCell>
                  <TableCell>{item.prioridade}</TableCell>
                  <TableCell>R$ {Number(item.valor).toFixed(2)}</TableCell>
                  <TableCell>{format(new Date(item.created_at), 'dd/MM/yyyy')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'modalidades':
      case 'especialidades':
      case 'categorias':
      case 'prioridades':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Ordem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nome}</TableCell>
                  <TableCell>{item.descricao || '-'}</TableCell>
                  <TableCell>{item.ordem || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={item.ativo ? "default" : "secondary"}>
                      {item.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(item.created_at), 'dd/MM/yyyy')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{title}</h3>
        <Badge variant="outline">{filteredAndSortedData.length} de {data.length} itens</Badge>
      </div>
      
      {/* Campo de pesquisa */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Pesquisar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <div className="border rounded-md max-h-96 overflow-auto">
        {renderTableContent()}
      </div>
    </div>
  );
}