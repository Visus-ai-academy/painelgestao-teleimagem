import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface DuplicadoPreco {
  cliente_id: string | null;
  cliente_nome: string;
  modalidade: string;
  especialidade: string;
  prioridade: string;
  categoria: string;
  volume_inicial: number;
  volume_final: number;
  total_duplicados: number;
  valores_diferentes: number[];
}

interface DuplicadosPrecosListProps {
  duplicados: DuplicadoPreco[];
}

export function DuplicadosPrecosList({ duplicados }: DuplicadosPrecosListProps) {
  if (!duplicados || duplicados.length === 0) {
    return null;
  }

  const totalDuplicados = duplicados.reduce((sum, dup) => sum + dup.total_duplicados, 0);

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-destructive">Preços Duplicados Detectados</CardTitle>
        </div>
        <CardDescription>
          {duplicados.length} grupos de preços duplicados encontrados ({totalDuplicados} registros totais)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Vol. Inicial</TableHead>
                <TableHead className="text-right">Vol. Final</TableHead>
                <TableHead className="text-right">Qtd Duplicados</TableHead>
                <TableHead className="text-right">Valores</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {duplicados.map((dup, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">
                    {dup.cliente_nome}
                    {!dup.cliente_id && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        Sem Cliente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{dup.modalidade}</TableCell>
                  <TableCell>{dup.especialidade}</TableCell>
                  <TableCell>{dup.prioridade}</TableCell>
                  <TableCell>{dup.categoria || 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    {dup.volume_inicial === -1 ? 'N/A' : dup.volume_inicial}
                  </TableCell>
                  <TableCell className="text-right">
                    {dup.volume_final === -1 ? 'N/A' : dup.volume_final}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{dup.total_duplicados}x</Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {dup.valores_diferentes.length > 1 ? (
                      <span className="text-destructive font-semibold">
                        {dup.valores_diferentes.map(v => `R$ ${v.toFixed(2)}`).join(', ')}
                      </span>
                    ) : (
                      <span>R$ {dup.valores_diferentes[0].toFixed(2)}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
