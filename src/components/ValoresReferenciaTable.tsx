import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Pencil, Trash2, FileText, Link2, Link2Off, Search, CheckCircle2 } from "lucide-react";
import { useValoresReferencia } from '@/hooks/useValoresReferencia';

export function ValoresReferenciaTable() {
  const { 
    data, 
    loading, 
    error, 
    addValor, 
    updateValor, 
    deleteValor, 
    toggleAtivo,
    buscarSugestoes,
    vincularExame,
    desvincularExame
  } = useValoresReferencia();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [vinculandoItem, setVinculandoItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    estudo_descricao: '',
    valores: ''
  });

  const resetForm = () => {
    setFormData({ estudo_descricao: '', valores: '' });
    setEditingItem(null);
  };

  const handleAdd = async () => {
    if (!formData.estudo_descricao.trim() || !formData.valores.trim()) return;
    
    await addValor(formData.estudo_descricao.trim(), parseFloat(formData.valores));
    setShowAddDialog(false);
    resetForm();
  };

  const handleEdit = async () => {
    if (!formData.estudo_descricao.trim() || !formData.valores.trim() || !editingItem) return;
    
    await updateValor(editingItem.id, formData.estudo_descricao.trim(), parseFloat(formData.valores));
    setEditingItem(null);
    resetForm();
  };

  const openEditDialog = (item: any) => {
    setEditingItem(item);
    setFormData({
      estudo_descricao: item.estudo_descricao,
      valores: item.valores.toString()
    });
  };

  const handleVincular = async (cadastroExameId: string) => {
    if (!vinculandoItem) return;
    await vincularExame(vinculandoItem.id, cadastroExameId);
    setVinculandoItem(null);
  };

  // Calcular estatísticas
  const totalVinculados = data.filter(d => d.cadastro_exame_id).length;
  const totalNaoVinculados = data.filter(d => !d.cadastro_exame_id).length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Valores De-Para Exames</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Valores De-Para Exames</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-500 py-4">
            Erro ao carregar dados: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Exames Fora Padrão ({data.length} registros)
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Tabela de referência para aplicação automática de valores em exames fora de padrão
          </p>
          <div className="flex gap-4 mt-2 text-sm">
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {totalVinculados} Vinculados
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Link2Off className="h-3 w-3" />
              {totalNaoVinculados} Não Vinculados
            </Badge>
          </div>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Valor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Valor de Referência</DialogTitle>
              <DialogDescription>
                Adicione um novo exame com seu valor de referência para aplicação automática do De-Para.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="estudo_descricao">Nome do Exame</Label>
                <Input
                  id="estudo_descricao"
                  value={formData.estudo_descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, estudo_descricao: e.target.value }))}
                  placeholder="Ex: RM ABDOME SUPERIOR"
                />
              </div>
              <div>
                <Label htmlFor="valores">Valor de Referência</Label>
                <Input
                  id="valores"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valores}
                  onChange={(e) => setFormData(prev => ({ ...prev, valores: e.target.value }))}
                  placeholder="Ex: 1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAdd}>
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum valor de referência cadastrado</p>
            <p className="text-sm">Faça upload de um arquivo De-Para ou adicione valores manualmente</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Exame (Fora Padrão)</TableHead>
                  <TableHead className="w-24">Valor</TableHead>
                  <TableHead>Vinculado a (Cadastro)</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="w-40">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow key={item.id} className={!item.cadastro_exame_id ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}>
                    <TableCell className="font-medium">
                      {item.estudo_descricao}
                    </TableCell>
                    <TableCell>{item.valores}</TableCell>
                    <TableCell>
                      {item.cadastro_exame ? (
                        <div className="space-y-1">
                          <div className="font-medium text-green-700 dark:text-green-400">
                            {item.cadastro_exame.nome}
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {item.cadastro_exame.modalidade}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {item.cadastro_exame.especialidade}
                            </Badge>
                            {item.cadastro_exame.categoria && (
                              <Badge variant="outline" className="text-xs">
                                {item.cadastro_exame.categoria}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 text-sm">
                          Não vinculado - clique em "Vincular"
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={item.ativo}
                          onCheckedChange={(checked) => toggleAtivo(item.id, checked)}
                        />
                        <Badge variant={item.ativo ? 'default' : 'secondary'}>
                          {item.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* Botão Vincular */}
                        <Dialog open={vinculandoItem?.id === item.id} onOpenChange={(open) => !open && setVinculandoItem(null)}>
                          <DialogTrigger asChild>
                            <Button
                              variant={item.cadastro_exame_id ? "ghost" : "default"}
                              size="sm"
                              onClick={() => setVinculandoItem(item)}
                              title={item.cadastro_exame_id ? "Alterar vinculação" : "Vincular a exame do cadastro"}
                            >
                              <Link2 className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <Search className="h-5 w-5" />
                                Vincular Exame ao Cadastro
                              </DialogTitle>
                              <DialogDescription>
                                Selecione o exame do cadastro que corresponde a "{item.estudo_descricao}"
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="py-4">
                              <Label className="text-sm font-medium">Sugestões (ordenadas por similaridade):</Label>
                              <ScrollArea className="h-[300px] mt-2 border rounded-lg">
                                <div className="p-2 space-y-2">
                                  {buscarSugestoes(item.estudo_descricao, 10).map((sugestao, idx) => (
                                    <div 
                                      key={sugestao.exame.id}
                                      className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-primary/5 ${
                                        idx === 0 ? 'border-green-500 bg-green-50/50 dark:bg-green-950/20' : ''
                                      }`}
                                      onClick={() => handleVincular(sugestao.exame.id)}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="font-medium">{sugestao.exame.nome}</div>
                                          <div className="flex gap-1 mt-1 flex-wrap">
                                            <Badge variant="outline" className="text-xs">
                                              {sugestao.exame.modalidade}
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                              {sugestao.exame.especialidade}
                                            </Badge>
                                            {sugestao.exame.categoria && (
                                              <Badge variant="outline" className="text-xs">
                                                {sugestao.exame.categoria}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        <Badge 
                                          variant={sugestao.similaridade >= 80 ? "default" : sugestao.similaridade >= 50 ? "secondary" : "outline"}
                                          className="ml-2"
                                        >
                                          {sugestao.similaridade}%
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                  {buscarSugestoes(item.estudo_descricao, 10).length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                      Nenhuma sugestão encontrada com similaridade ≥ 30%
                                    </div>
                                  )}
                                </div>
                              </ScrollArea>
                            </div>

                            <DialogFooter>
                              <Button variant="outline" onClick={() => setVinculandoItem(null)}>
                                Cancelar
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        {/* Botão Desvincular */}
                        {item.cadastro_exame_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => desvincularExame(item.id)}
                            title="Remover vinculação"
                          >
                            <Link2Off className="h-3 w-3 text-red-500" />
                          </Button>
                        )}

                        {/* Botão Editar */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(item)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar Valor de Referência</DialogTitle>
                              <DialogDescription>
                                Modifique o nome do exame ou seu valor de referência.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="edit_estudo_descricao">Nome do Exame</Label>
                                <Input
                                  id="edit_estudo_descricao"
                                  value={formData.estudo_descricao}
                                  onChange={(e) => setFormData(prev => ({ ...prev, estudo_descricao: e.target.value }))}
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit_valores">Valor de Referência</Label>
                                <Input
                                  id="edit_valores"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={formData.valores}
                                  onChange={(e) => setFormData(prev => ({ ...prev, valores: e.target.value }))}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setEditingItem(null)}>
                                Cancelar
                              </Button>
                              <Button onClick={handleEdit}>
                                Salvar
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        {/* Botão Excluir */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover o valor de referência para "{item.estudo_descricao}"?
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteValor(item.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
