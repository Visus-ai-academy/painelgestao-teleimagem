import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { RoleProtectedRoute } from "@/components/RoleProtectedRoute";

interface ListItem {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

interface ListConfig {
  tableName: string;
  title: string;
  description: string;
}

const listConfigs: ListConfig[] = [
  { tableName: "modalidades", title: "Modalidades", description: "Tipos de exames médicos" },
  { tableName: "especialidades", title: "Especialidades", description: "Especialidades médicas" },
  { tableName: "categorias_exame", title: "Categorias de Exame", description: "Classificação dos exames" },
  { tableName: "prioridades", title: "Prioridades", description: "Níveis de prioridade" },
  { tableName: "categorias_medico", title: "Categorias de Médico", description: "Classificação dos médicos" }
];

export default function GerenciarListas() {
  const [activeTab, setActiveTab] = useState("modalidades");
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ListItem | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    ativo: true,
    ordem: 0
  });

  const currentConfig = listConfigs.find(config => config.tableName === activeTab)!;

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(activeTab as any)
        .select("*")
        .order("ordem", { ascending: true });

      if (error) throw error;
      setItems((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [activeTab]);

  const resetForm = () => {
    setFormData({
      nome: "",
      descricao: "",
      ativo: true,
      ordem: items.length > 0 ? Math.max(...items.map(item => item.ordem)) + 1 : 1
    });
    setEditingItem(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingItem) {
        const { error } = await supabase
          .from(activeTab as any)
          .update(formData)
          .eq("id", editingItem.id);

        if (error) throw error;
        toast({ title: "Item atualizado com sucesso!" });
      } else {
        const { error } = await supabase
          .from(activeTab as any)
          .insert([formData]);

        if (error) throw error;
        toast({ title: "Item criado com sucesso!" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchItems();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleEdit = (item: ListItem) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome,
      descricao: item.descricao || "",
      ativo: item.ativo,
      ordem: item.ordem
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este item?")) return;

    try {
      const { error } = await supabase
        .from(activeTab as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Item excluído com sucesso!" });
      fetchItems();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const toggleStatus = async (item: ListItem) => {
    try {
      const { error } = await supabase
        .from(activeTab as any)
        .update({ ativo: !item.ativo })
        .eq("id", item.id);

      if (error) throw error;
      toast({ title: `Item ${!item.ativo ? 'ativado' : 'desativado'} com sucesso!` });
      fetchItems();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <RoleProtectedRoute requiredRoles={['admin']}>
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Gerenciar Listas</h1>
          <p className="text-muted-foreground">
            Gerencie as listas de referência utilizadas no sistema
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            {listConfigs.map((config) => (
              <TabsTrigger key={config.tableName} value={config.tableName}>
                {config.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {listConfigs.map((config) => (
            <TabsContent key={config.tableName} value={config.tableName}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{config.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {config.description}
                    </p>
                  </div>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={resetForm}>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingItem ? "Editar" : "Adicionar"} {config.title.slice(0, -1)}
                        </DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="nome">Nome *</Label>
                          <Input
                            id="nome"
                            value={formData.nome}
                            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="descricao">Descrição</Label>
                          <Textarea
                            id="descricao"
                            value={formData.descricao}
                            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="ordem">Ordem</Label>
                          <Input
                            id="ordem"
                            type="number"
                            value={formData.ordem}
                            onChange={(e) => setFormData({ ...formData, ordem: parseInt(e.target.value) })}
                            min="0"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="ativo"
                            checked={formData.ativo}
                            onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                          />
                          <Label htmlFor="ativo">Ativo</Label>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsDialogOpen(false)}
                          >
                            Cancelar
                          </Button>
                          <Button type="submit">
                            {editingItem ? "Atualizar" : "Criar"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-4">Carregando...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center">
                                <GripVertical className="h-4 w-4 text-muted-foreground mr-2" />
                                {item.ordem}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{item.nome}</TableCell>
                            <TableCell>
                              {item.descricao && (
                                <span className="text-sm text-muted-foreground">
                                  {item.descricao.substring(0, 50)}
                                  {item.descricao.length > 50 && "..."}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={item.ativo ? "default" : "secondary"}
                                className="cursor-pointer"
                                onClick={() => toggleStatus(item)}
                              >
                                {item.ativo ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(item)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(item.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {items.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                              Nenhum item encontrado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </RoleProtectedRoute>
  );
}