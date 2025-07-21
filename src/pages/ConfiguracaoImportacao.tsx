import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Eye, Download, Upload, Save, X, Edit, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface FieldMapping {
  id: string;
  template_name: string;
  file_type: string;
  source_field: string;
  target_field: string;
  target_table: string;
  field_type: string;
  is_required: boolean;
  default_value?: string;
  order_index: number;
  active: boolean;
}

interface ImportTemplate {
  id: string;
  name: string;
  file_type: string;
  description?: string;
  is_default: boolean;
  auto_detect_columns: any;
  active: boolean;
}

interface ImportHistory {
  id: string;
  template_id?: string;
  filename: string;
  file_type: string;
  records_imported: number;
  records_failed: number;
  status: string;
  created_at: string;
  import_summary?: any;
}

export default function ConfiguracaoImportacao() {
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedFileType, setSelectedFileType] = useState<string>("exames");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<Partial<FieldMapping>>({});
  const [isNewTemplate, setIsNewTemplate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const fileTypes = [
    { value: "exames", label: "Exames" },
    { value: "medicos", label: "Médicos" },
    { value: "clientes", label: "Clientes" },
    { value: "escalas", label: "Escalas" },
    { value: "faturamento", label: "Faturamento" }
  ];

  const fieldTypes = [
    { value: "text", label: "Texto" },
    { value: "number", label: "Número" },
    { value: "date", label: "Data" },
    { value: "boolean", label: "Booleano" }
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      loadFieldMappings(selectedTemplate);
    }
  }, [selectedTemplate, selectedFileType]);

  const loadData = async () => {
    try {
      // Carregar templates
      const { data: templatesData, error: templatesError } = await supabase
        .from("import_templates")
        .select("*")
        .eq("active", true)
        .order("name");

      if (templatesError) throw templatesError;
      setTemplates((templatesData || []).map(t => ({
        ...t,
        auto_detect_columns: Array.isArray(t.auto_detect_columns) ? t.auto_detect_columns : 
          typeof t.auto_detect_columns === 'string' ? JSON.parse(t.auto_detect_columns) : []
      })));

      // Selecionar primeiro template por padrão
      if (templatesData && templatesData.length > 0) {
        setSelectedTemplate(templatesData[0].name);
      }

      // Carregar histórico
      const { data: historyData, error: historyError } = await supabase
        .from("import_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (historyError) throw historyError;
      setImportHistory(historyData || []);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const loadFieldMappings = async (templateName: string) => {
    try {
      const { data, error } = await supabase
        .from("field_mappings")
        .select("*")
        .eq("template_name", templateName)
        .eq("file_type", selectedFileType)
        .eq("active", true)
        .order("order_index");

      if (error) throw error;
      setFieldMappings(data || []);
    } catch (error) {
      console.error("Erro ao carregar mapeamentos:", error);
      toast.error("Erro ao carregar mapeamentos");
    }
  };

  const saveFieldMapping = async () => {
    try {
      if (!editingMapping.source_field || !editingMapping.target_field || !editingMapping.target_table) {
        toast.error("Campos obrigatórios não preenchidos");
        return;
      }

      const mappingData = {
        template_name: selectedTemplate,
        file_type: selectedFileType,
        source_field: editingMapping.source_field,
        target_field: editingMapping.target_field,
        target_table: editingMapping.target_table,
        field_type: editingMapping.field_type || "text",
        is_required: editingMapping.is_required || false,
        default_value: editingMapping.default_value,
        order_index: editingMapping.order_index || fieldMappings.length + 1,
        active: editingMapping.active !== false
      };

      if (editingMapping.id) {
        // Atualizar
        const { error } = await supabase
          .from("field_mappings")
          .update(mappingData)
          .eq("id", editingMapping.id);

        if (error) throw error;
        toast.success("Mapeamento atualizado com sucesso");
      } else {
        // Criar novo
        const { error } = await supabase
          .from("field_mappings")
          .insert(mappingData);

        if (error) throw error;
        toast.success("Mapeamento criado com sucesso");
      }

      setIsEditDialogOpen(false);
      setEditingMapping({});
      loadFieldMappings(selectedTemplate);
    } catch (error) {
      console.error("Erro ao salvar mapeamento:", error);
      toast.error("Erro ao salvar mapeamento");
    }
  };

  const deleteFieldMapping = async (id: string) => {
    try {
      const { error } = await supabase
        .from("field_mappings")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Mapeamento removido com sucesso");
      loadFieldMappings(selectedTemplate);
    } catch (error) {
      console.error("Erro ao remover mapeamento:", error);
      toast.error("Erro ao remover mapeamento");
    }
  };

  const syncTemplate = async () => {
    if (!selectedTemplate || !selectedFileType) {
      toast.error('Selecione um template e tipo de arquivo')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('sincronizar-template', {
        body: {
          templateName: selectedTemplate,
          fileType: selectedFileType
        }
      })

      if (error) throw error

      if (data?.success) {
        toast.success(`Template sincronizado! Arquivo: ${data.fileName}`)
      } else {
        throw new Error(data?.error || 'Erro desconhecido')
      }
    } catch (error) {
      console.error('Erro ao sincronizar template:', error)
      toast.error('Erro ao sincronizar template')
    } finally {
      setLoading(false)
    }
  }

  const saveTemplate = async () => {
    try {
      setLoading(true);
      // Aqui você pode adicionar lógica adicional para salvar o template
      // Por enquanto, apenas desabilita o modo de edição
      setIsEditingTemplate(false);
      setHasUnsavedChanges(false);
      toast.success("Template salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar template:", error);
      toast.error("Erro ao salvar template");
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    if (hasUnsavedChanges) {
      if (confirm("Tem certeza que deseja cancelar? As alterações não salvas serão perdidas.")) {
        setIsEditingTemplate(false);
        setHasUnsavedChanges(false);
        loadFieldMappings(selectedTemplate);
      }
    } else {
      setIsEditingTemplate(false);
    }
  };

  const enableEdit = () => {
    setIsEditingTemplate(true);
  };

  const openEditDialog = (mapping?: FieldMapping) => {
    if (mapping) {
      setEditingMapping(mapping);
    } else {
      setEditingMapping({
        template_name: selectedTemplate,
        file_type: selectedFileType,
        field_type: "text",
        is_required: false,
        active: true
      });
    }
    setIsEditDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'completed': { variant: 'default' as const, label: 'Concluído' },
      'processing': { variant: 'secondary' as const, label: 'Processando' },
      'failed': { variant: 'destructive' as const, label: 'Falhou' },
      'partial': { variant: 'outline' as const, label: 'Parcial' }
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || { variant: 'outline' as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuração de Importação</h1>
          <p className="text-muted-foreground">
            Configure os mapeamentos de campos para importação automática do MobileMed
          </p>
        </div>
      </div>

      {/* Card de acesso ao Mapeamento Visual */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-purple-600 text-xl">🎯</div>
              <div>
                <h3 className="font-semibold text-purple-900">Mapeamento Visual</h3>
                <p className="text-sm text-purple-700">
                  Interface visual para conectar campos arrastando linhas - tipo mapa mental
                </p>
              </div>
            </div>
            <Link to="/mapeamento-visual">
              <Button variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-100">
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir Mapeamento
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>


      <Tabs defaultValue="mappings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="mappings">Mapeamentos de Campos</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="mappings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mapeamentos de Campos</CardTitle>
              <CardDescription>
                Configure como os campos dos arquivos do MobileMed são mapeados para o banco de dados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="template-select">Template</Label>
                  <Select 
                    value={selectedTemplate} 
                    onValueChange={setSelectedTemplate}
                    disabled={isEditingTemplate}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.name}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label htmlFor="filetype-select">Tipo de Arquivo</Label>
                  <Select 
                    value={selectedFileType} 
                    onValueChange={setSelectedFileType}
                    disabled={isEditingTemplate}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fileTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {!isEditingTemplate ? (
                  <>
                    <Button
                      onClick={syncTemplate}
                      disabled={!selectedTemplate || !selectedFileType || loading}
                      className="mt-6"
                      variant="outline"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Sincronizar Template
                    </Button>
                    <Button onClick={enableEdit} className="mt-6" variant="secondary">
                      <Edit className="w-4 h-4 mr-2" />
                      Editar Template
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={saveTemplate}
                      disabled={loading}
                      className="mt-6"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Template
                    </Button>
                    <Button
                      onClick={cancelEdit}
                      className="mt-6"
                      variant="outline"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                    <Button 
                      onClick={() => openEditDialog()} 
                      className="mt-6"
                      disabled={!isEditingTemplate}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Mapeamento
                    </Button>
                  </>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Campo Origem</TableHead>
                    <TableHead>Campo Destino</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Obrigatório</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fieldMappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell>{mapping.order_index}</TableCell>
                      <TableCell className="font-medium">{mapping.source_field}</TableCell>
                      <TableCell>{mapping.target_field}</TableCell>
                      <TableCell>{mapping.target_table}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{mapping.field_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {mapping.is_required ? (
                          <Badge variant="destructive">Sim</Badge>
                        ) : (
                          <Badge variant="secondary">Não</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(mapping)}
                            disabled={!isEditingTemplate}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteFieldMapping(mapping.id)}
                            disabled={!isEditingTemplate}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Templates de Importação</CardTitle>
              <CardDescription>
                Gerencie os templates disponíveis para importação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Padrão</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{template.file_type}</Badge>
                      </TableCell>
                      <TableCell>{template.description}</TableCell>
                      <TableCell>
                        {template.is_default && <Badge>Padrão</Badge>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.active ? "default" : "secondary"}>
                          {template.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Importações</CardTitle>
              <CardDescription>
                Visualize o histórico das últimas importações realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Importados</TableHead>
                    <TableHead>Falharam</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importHistory.map((history) => (
                    <TableRow key={history.id}>
                      <TableCell className="font-medium">{history.filename}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{history.file_type}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(history.status)}</TableCell>
                      <TableCell>{history.records_imported}</TableCell>
                      <TableCell>{history.records_failed}</TableCell>
                      <TableCell>
                        {new Date(history.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMapping.id ? "Editar Mapeamento" : "Novo Mapeamento"}
            </DialogTitle>
            <DialogDescription>
              Configure como o campo será mapeado na importação
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="source_field">Campo no Arquivo (Origem)</Label>
              <Input
                id="source_field"
                value={editingMapping.source_field || ""}
                onChange={(e) => setEditingMapping({ ...editingMapping, source_field: e.target.value })}
                placeholder="ex: Data do Exame"
              />
            </div>

            <div>
              <Label htmlFor="target_field">Campo no Banco (Destino)</Label>
              <Input
                id="target_field"
                value={editingMapping.target_field || ""}
                onChange={(e) => setEditingMapping({ ...editingMapping, target_field: e.target.value })}
                placeholder="ex: data_exame"
              />
            </div>

            <div>
              <Label htmlFor="target_table">Tabela Destino</Label>
              <Input
                id="target_table"
                value={editingMapping.target_table || ""}
                onChange={(e) => setEditingMapping({ ...editingMapping, target_table: e.target.value })}
                placeholder="ex: exames"
              />
            </div>

            <div>
              <Label htmlFor="field_type">Tipo do Campo</Label>
              <Select
                value={editingMapping.field_type || "text"}
                onValueChange={(value) => setEditingMapping({ ...editingMapping, field_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="order_index">Ordem</Label>
              <Input
                id="order_index"
                type="number"
                value={editingMapping.order_index || ""}
                onChange={(e) => setEditingMapping({ ...editingMapping, order_index: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label htmlFor="default_value">Valor Padrão (opcional)</Label>
              <Input
                id="default_value"
                value={editingMapping.default_value || ""}
                onChange={(e) => setEditingMapping({ ...editingMapping, default_value: e.target.value })}
                placeholder="Valor padrão se campo estiver vazio"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_required"
                checked={editingMapping.is_required || false}
                onCheckedChange={(checked) => setEditingMapping({ ...editingMapping, is_required: checked })}
              />
              <Label htmlFor="is_required">Campo obrigatório</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveFieldMapping}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}