import { AlertTriangle, X, Download, CheckCircle, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as XLSX from 'xlsx';

export interface PrecoFaltante {
  cliente_nome: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade: string;
  quantidade: number;
}

interface AlertasPrecosFaltantesProps {
  alertas: PrecoFaltante[];
  onClose?: () => void;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
}

export function AlertasPrecosFaltantes({ alertas, onClose, onRefresh, isLoading }: AlertasPrecosFaltantesProps) {
  // Componente sempre visível - se não houver alertas, mostra mensagem de sucesso
  const temAlertas = alertas && alertas.length > 0;

  // Agrupar por cliente (só se houver alertas)
  const porCliente = temAlertas 
    ? alertas.reduce((acc, alerta) => {
        if (!acc[alerta.cliente_nome]) {
          acc[alerta.cliente_nome] = [];
        }
        acc[alerta.cliente_nome].push(alerta);
        return acc;
      }, {} as Record<string, PrecoFaltante[]>)
    : {};

  const clientesAfetados = Object.keys(porCliente).length;
  const totalArranjos = alertas?.length || 0;
  const totalExamesSemPreco = alertas?.reduce((sum, a) => sum + (a.quantidade || 0), 0) || 0;

  const exportarParaExcel = () => {
    if (!temAlertas) return;
    
    const dados = alertas.map(a => ({
      'Cliente': a.cliente_nome,
      'Modalidade': a.modalidade,
      'Especialidade': a.especialidade,
      'Categoria': a.categoria,
      'Prioridade': a.prioridade,
      'Quantidade Exames': a.quantidade
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Preços Faltantes');
    XLSX.writeFile(wb, `precos_faltantes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Estado: SEM ALERTAS - tudo OK
  if (!temAlertas) {
    return (
      <Card className="border-green-500/50 bg-green-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg text-green-600">
                Preços - Status
              </CardTitle>
            </div>
            {onRefresh && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="gap-1"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Atualizar
              </Button>
            )}
          </div>
          <CardDescription>
            Verificação de preços cadastrados para o período selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-sm border-green-500/50 text-green-600 px-3 py-1">
              ✓ Todos os preços cadastrados
            </Badge>
            <span className="text-sm text-muted-foreground">
              Nenhum arranjo de exame sem preço encontrado nos demonstrativos.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado: COM ALERTAS - preços faltantes
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-lg text-destructive">
              Preços Não Cadastrados
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="gap-1"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Atualizar
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={exportarParaExcel}
              className="gap-1"
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            {onClose && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-4 mt-2">
          <Badge variant="destructive" className="text-sm">
            {clientesAfetados} cliente(s)
          </Badge>
          <Badge variant="outline" className="text-sm border-destructive/50 text-destructive">
            {totalArranjos} arranjo(s) sem preço
          </Badge>
          <Badge variant="secondary" className="text-sm">
            {totalExamesSemPreco.toLocaleString('pt-BR')} exame(s) afetados
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead className="text-right">Qtd Exames</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertas.map((alerta, idx) => (
                <TableRow key={idx} className="hover:bg-destructive/10">
                  <TableCell className="font-medium">{alerta.cliente_nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{alerta.modalidade}</Badge>
                  </TableCell>
                  <TableCell>{alerta.especialidade}</TableCell>
                  <TableCell>{alerta.categoria}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={alerta.prioridade === 'PLANTÃO' ? 'destructive' : 
                               alerta.prioridade === 'URGÊNCIA' ? 'default' : 'secondary'}
                    >
                      {alerta.prioridade}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {alerta.quantidade.toLocaleString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            <strong>Ação necessária:</strong> Cadastre os preços faltantes na tabela de preços 
            (Modalidade + Especialidade + Categoria + Prioridade) para que os exames sejam 
            calculados corretamente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
