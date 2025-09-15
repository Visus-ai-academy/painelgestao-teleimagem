import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Edit2, Trash2, RefreshCw, Filter, FileText, Calendar } from "lucide-react";

interface FaturamentoRow {
  id: string;
  cliente_id?: string | null;
  cliente_nome?: string | null;
  nome_exame?: string | null;
  modalidade?: string | null;
  especialidade?: string | null;
  prioridade?: string | null;
  categoria?: string | null;
  quantidade?: number | null;
  valor?: number | null;
  valor_bruto?: number | null;
  data_exame?: string | null;
  data_emissao?: string | null;
  periodo_referencia?: string | null;
  numero_fatura?: string | null;
}

// Função auxiliar para formatar período YYYY-MM para formato abreviado
const formatarPeriodoAbreviado = (periodo: string): string => {
  try {
    const [ano, mes] = periodo.split('-');
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const mesAbrev = meses[parseInt(mes) - 1] || mes;
    return `${mesAbrev}/${ano.slice(2)}`;
  } catch {
    return periodo;
  }
};

export default function ListaExamesPeriodo() {
  const { toast } = useToast();
  const [periodo, setPeriodo] = useState("2025-07");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FaturamentoRow[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string; quantidade: number } | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("faturamento")
        .select(
          "id, cliente_id, cliente_nome, nome_exame, modalidade, especialidade, prioridade, categoria, quantidade, valor, valor_bruto, data_exame, data_emissao, periodo_referencia, numero_fatura"
        )
        .like("periodo_referencia", `%${periodo}%`)
        .order("cliente_nome", { ascending: true })
        .order("nome_exame", { ascending: true })
        .limit(50000);

      if (error) throw error;
      setRows(data || []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar", description: err.message || "Falha ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [periodo]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.cliente_nome, r.nome_exame, r.modalidade, r.especialidade, r.categoria, r.prioridade]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const totais = useMemo(() => {
    const exames = filtrados.reduce((acc, r) => acc + (r.quantidade || 0), 0);
    const valorBruto = filtrados.reduce((acc, r) => acc + (r.valor_bruto || 0), 0);
    const valor = filtrados.reduce((acc, r) => acc + (r.valor || 0), 0);
    return { exames, valorBruto, valor };
  }, [filtrados]);

  const salvarQuantidade = async () => {
    if (!editing) return;
    try {
      const { error } = await supabase
        .from("faturamento")
        .update({ quantidade: editing.quantidade })
        .eq("id", editing.id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === editing.id ? { ...r, quantidade: editing.quantidade } : r)));
      toast({ title: "Quantidade atualizada", description: "O registro foi atualizado com sucesso." });
      setEditing(null);
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message || "Falha ao editar quantidade", variant: "destructive" });
    }
  };

  const excluirRegistro = async (id: string) => {
    try {
      const { error } = await supabase.from("faturamento").delete().eq("id", id);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Exame excluído", description: "O registro foi removido da base de dados." });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message || "Falha ao excluir registro", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold">Exames do Período</h3>
        <p className="text-muted-foreground text-sm">Gerencie exames processados no faturamento. Edite a quantidade ou exclua registros.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" /> Controles
          </CardTitle>
          <CardDescription>Selecione o período de referência e filtre os registros.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025-07">{formatarPeriodoAbreviado("2025-07")}</SelectItem>
                <SelectItem value="2025-06">{formatarPeriodoAbreviado("2025-06")}</SelectItem>
                <SelectItem value="2025-05">{formatarPeriodoAbreviado("2025-05")}</SelectItem>
                <SelectItem value="2025-04">{formatarPeriodoAbreviado("2025-04")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Buscar</Label>
            <div className="flex gap-2">
              <Input placeholder="Cliente, exame, modalidade, especialidade..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button variant="secondary" onClick={carregar} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Resumo</Label>
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><FileText className="h-4 w-4" />Exames</span><strong>{totais.exames.toLocaleString()}</strong></div>
              <div className="flex items-center justify-between text-sm mt-1"><span className="flex items-center gap-2"><Calendar className="h-4 w-4" />Registros</span><strong>{filtrados.length.toLocaleString()}</strong></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registros do Faturamento</CardTitle>
          <CardDescription>
            {filtrados.length} registros encontrados para {periodo}. Somente administradores conseguem editar/excluir, conforme as regras de segurança.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Exame</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Valor Bruto</TableHead>
                  <TableHead>Data Exame</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center">Nenhum registro encontrado.</TableCell>
                  </TableRow>
                ) : (
                  filtrados.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.cliente_nome || "-"}</TableCell>
                      <TableCell>{r.nome_exame || "-"}</TableCell>
                      <TableCell>{r.modalidade || "-"}</TableCell>
                      <TableCell>{r.especialidade || "-"}</TableCell>
                      <TableCell>{r.categoria || "-"}</TableCell>
                      <TableCell>{r.prioridade || "-"}</TableCell>
                      <TableCell className="text-right">{r.quantidade ?? 0}</TableCell>
                      <TableCell className="text-right">{r.valor?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{r.valor_bruto?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{r.data_exame ? new Date(r.data_exame).toLocaleDateString("pt-BR") : "-"}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" onClick={() => setEditing({ id: r.id, quantidade: r.quantidade ?? 0 })}>
                                <Edit2 className="h-4 w-4 mr-1" /> Editar
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Editar quantidade</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-2">
                                <Label>Quantidade</Label>
                                <Input type="number" min={0} value={editing?.quantidade ?? 0} onChange={(e) => setEditing((prev) => prev ? { ...prev, quantidade: Number(e.target.value) } : prev)} />
                              </div>
                              <DialogFooter>
                                <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
                                <Button onClick={salvarQuantidade}>Salvar</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                <Trash2 className="h-4 w-4 mr-1" /> Excluir
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir exame?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação removerá o registro do faturamento. Não poderá ser desfeita. Deseja continuar?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => excluirRegistro(r.id)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
