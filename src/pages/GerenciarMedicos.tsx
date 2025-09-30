import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, X, AlertTriangle } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RoleProtectedRoute } from '@/components/RoleProtectedRoute';
import { useMedicoData } from '@/hooks/useMedicoData';
import { DuplicadosRepasseDialog } from '@/components/DuplicadosRepasseDialog';

interface Medico {
  id: string;
  nome: string;
  crm: string;
  modalidades: string[];
  especialidades: string[];
  categoria?: string;
  telefone?: string;
  email?: string;
  ativo: boolean;
  user_id?: string;
  temDuplicadosRepasse?: boolean;
}

export default function GerenciarMedicos() {
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMedico, setEditingMedico] = useState<Medico | null>(null);
  const [duplicadosDialogOpen, setDuplicadosDialogOpen] = useState(false);
  const [selectedMedicoForDuplicados, setSelectedMedicoForDuplicados] = useState<{ id: string; nome: string } | null>(null);
  const { toast } = useToast();
  const { modalidades, especialidades, categoriasMedico, loading: loadingData } = useMedicoData();

  const [formData, setFormData] = useState({
    nome: '',
    crm: '',
    modalidades: [] as string[],
    especialidades: [] as string[],
    categoria: '',
    telefone: '',
    email: '',
    user_id: ''
  });

  const fetchMedicos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('medicos')
        .select('*')
        .order('nome');

      if (error) {
        console.error('Erro ao buscar médicos:', error);
        toast({
          title: "Erro ao carregar médicos",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Buscar duplicados para cada médico
      const { data: duplicados } = await supabase
        .from('duplicados_repasse_medico')
        .select('medico_id');

      const medicosComDuplicados = new Set(duplicados?.map(d => d.medico_id) || []);

      const medicosComIndicador = (data || []).map(medico => ({
        ...medico,
        temDuplicadosRepasse: medicosComDuplicados.has(medico.id)
      }));

      setMedicos(medicosComIndicador);
    } catch (error) {
      console.error('Erro ao buscar médicos:', error);
      toast({
        title: "Erro ao carregar médicos",
        description: "Erro inesperado ao carregar médicos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const dataToSave = {
        nome: formData.nome,
        crm: formData.crm,
        modalidades: formData.modalidades,
        especialidades: formData.especialidades,
        especialidade: formData.especialidades[0] || '', // Campo singular obrigatório (usar primeira especialidade)
        categoria: formData.categoria || null,
        telefone: formData.telefone || null,
        email: formData.email || null,
        user_id: formData.user_id || null
      };

      if (editingMedico) {
        const { error } = await supabase
          .from('medicos')
          .update(dataToSave)
          .eq('id', editingMedico.id);

        if (error) throw error;

        toast({
          title: "Médico atualizado",
          description: "Médico atualizado com sucesso",
        });
      } else {
        const { error } = await supabase
          .from('medicos')
          .insert([dataToSave]);

        if (error) throw error;

        toast({
          title: "Médico cadastrado",
          description: "Médico cadastrado com sucesso",
        });
      }

      setIsDialogOpen(false);
      setEditingMedico(null);
      setFormData({ 
        nome: '', 
        crm: '', 
        modalidades: [], 
        especialidades: [], 
        categoria: '', 
        telefone: '', 
        email: '', 
        user_id: '' 
      });
      await fetchMedicos();
    } catch (error: any) {
      console.error('Erro ao salvar médico:', error);
      toast({
        title: "Erro ao salvar médico",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (medico: Medico) => {
    setEditingMedico(medico);
    setFormData({
      nome: medico.nome,
      crm: medico.crm,
      modalidades: medico.modalidades || [],
      especialidades: medico.especialidades || [],
      categoria: medico.categoria || '',
      telefone: medico.telefone || '',
      email: medico.email || '',
      user_id: medico.user_id || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este médico?')) return;

    try {
      const { error } = await supabase
        .from('medicos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Médico excluído",
        description: "Médico excluído com sucesso",
      });

      await fetchMedicos();
    } catch (error: any) {
      console.error('Erro ao excluir médico:', error);
      toast({
        title: "Erro ao excluir médico",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleStatus = async (medico: Medico) => {
    try {
      const { error } = await supabase
        .from('medicos')
        .update({ ativo: !medico.ativo })
        .eq('id', medico.id);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Médico ${!medico.ativo ? 'ativado' : 'desativado'} com sucesso`,
      });

      await fetchMedicos();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addModalidade = (modalidade: string) => {
    if (modalidade && !formData.modalidades.includes(modalidade)) {
      setFormData({ ...formData, modalidades: [...formData.modalidades, modalidade] });
    }
  };

  const removeModalidade = (modalidade: string) => {
    setFormData({ 
      ...formData, 
      modalidades: formData.modalidades.filter(m => m !== modalidade) 
    });
  };

  const addEspecialidade = (especialidade: string) => {
    if (especialidade && !formData.especialidades.includes(especialidade)) {
      setFormData({ ...formData, especialidades: [...formData.especialidades, especialidade] });
    }
  };

  const removeEspecialidade = (especialidade: string) => {
    setFormData({ 
      ...formData, 
      especialidades: formData.especialidades.filter(e => e !== especialidade) 
    });
  };

  useEffect(() => {
    fetchMedicos();
  }, []);

  return (
    <RoleProtectedRoute requiredRoles={['admin', 'manager']}>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gerenciar Médicos</h1>
            <p className="text-muted-foreground">
              Cadastre e gerencie os médicos do sistema
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingMedico(null);
                setFormData({ 
                  nome: '', 
                  crm: '', 
                  modalidades: [], 
                  especialidades: [], 
                  categoria: '', 
                  telefone: '', 
                  email: '', 
                  user_id: '' 
                });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Médico
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingMedico ? 'Editar Médico' : 'Novo Médico'}
                </DialogTitle>
                <DialogDescription>
                  {editingMedico ? 'Edite as informações do médico' : 'Cadastre um novo médico no sistema'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome">Nome</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="crm">CRM</Label>
                    <Input
                      id="crm"
                      value={formData.crm}
                      onChange={(e) => setFormData({ ...formData, crm: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Modalidades</Label>
                  <Select onValueChange={addModalidade} disabled={loadingData}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione modalidades" />
                    </SelectTrigger>
                    <SelectContent>
                      {modalidades.map((mod) => (
                        <SelectItem key={mod.id} value={mod.nome}>
                          {mod.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.modalidades.map((mod) => (
                      <Badge key={mod} variant="secondary" className="flex items-center gap-1">
                        {mod}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => removeModalidade(mod)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Especialidades</Label>
                  <Select onValueChange={addEspecialidade} disabled={loadingData}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione especialidades" />
                    </SelectTrigger>
                    <SelectContent>
                      {especialidades.map((esp) => (
                        <SelectItem key={esp.id} value={esp.nome}>
                          {esp.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.especialidades.map((esp) => (
                      <Badge key={esp} variant="secondary" className="flex items-center gap-1">
                        {esp}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => removeEspecialidade(esp)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select
                    value={formData.categoria}
                    onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                    disabled={loadingData}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasMedico.map((cat) => (
                        <SelectItem key={cat.id} value={cat.nome}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="user_id">ID do Usuário (opcional)</Label>
                  <Input
                    id="user_id"
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    placeholder="UUID do usuário no sistema de autenticação"
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingMedico ? 'Atualizar' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Médicos Cadastrados</CardTitle>
            <CardDescription>
              {loading ? 'Carregando médicos...' : `${medicos.length} médicos cadastrados`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CRM</TableHead>
                    <TableHead>Modalidades</TableHead>
                    <TableHead>Especialidades</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Repasse</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {medicos.map((medico) => (
                    <TableRow key={medico.id}>
                      <TableCell className="font-medium">{medico.nome}</TableCell>
                      <TableCell>{medico.crm}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {medico.modalidades?.map((mod) => (
                            <Badge key={mod} variant="outline" className="text-xs">
                              {mod}
                            </Badge>
                          )) || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {medico.especialidades?.map((esp) => (
                            <Badge key={esp} variant="outline" className="text-xs">
                              {esp}
                            </Badge>
                          )) || '-'}
                        </div>
                      </TableCell>
                      <TableCell>{medico.categoria || '-'}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {medico.telefone && <div>{medico.telefone}</div>}
                          {medico.email && <div className="text-muted-foreground">{medico.email}</div>}
                          {!medico.telefone && !medico.email && '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={medico.ativo ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() => toggleStatus(medico)}
                        >
                          {medico.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {medico.temDuplicadosRepasse ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              setSelectedMedicoForDuplicados({ id: medico.id, nome: medico.nome });
                              setDuplicadosDialogOpen(true);
                            }}
                          >
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            Duplicados
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(medico)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(medico.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          </Card>
        </div>

        {selectedMedicoForDuplicados && (
          <DuplicadosRepasseDialog
            medicoId={selectedMedicoForDuplicados.id}
            medicoNome={selectedMedicoForDuplicados.nome}
            open={duplicadosDialogOpen}
            onOpenChange={setDuplicadosDialogOpen}
          />
        )}
      </RoleProtectedRoute>
    );
  }
