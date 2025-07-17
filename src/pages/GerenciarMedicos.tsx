import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, User } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RoleProtectedRoute } from '@/components/RoleProtectedRoute';

interface Medico {
  id: string;
  nome: string;
  crm: string;
  especialidade: string;
  telefone?: string;
  email?: string;
  ativo: boolean;
  user_id: string;
}

export default function GerenciarMedicos() {
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMedico, setEditingMedico] = useState<Medico | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: '',
    crm: '',
    especialidade: '',
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

      setMedicos(data || []);
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
      if (editingMedico) {
        const { error } = await supabase
          .from('medicos')
          .update(formData)
          .eq('id', editingMedico.id);

        if (error) throw error;

        toast({
          title: "Médico atualizado",
          description: "Médico atualizado com sucesso",
        });
      } else {
        const { error } = await supabase
          .from('medicos')
          .insert([formData]);

        if (error) throw error;

        toast({
          title: "Médico cadastrado",
          description: "Médico cadastrado com sucesso",
        });
      }

      setIsDialogOpen(false);
      setEditingMedico(null);
      setFormData({ nome: '', crm: '', especialidade: '', telefone: '', email: '', user_id: '' });
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
      especialidade: medico.especialidade,
      telefone: medico.telefone || '',
      email: medico.email || '',
      user_id: medico.user_id
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
                setFormData({ nome: '', crm: '', especialidade: '', telefone: '', email: '', user_id: '' });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Médico
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
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
                  <Label htmlFor="especialidade">Especialidade</Label>
                  <Input
                    id="especialidade"
                    value={formData.especialidade}
                    onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })}
                    required
                  />
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
                  <Label htmlFor="user_id">ID do Usuário</Label>
                  <Input
                    id="user_id"
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    placeholder="UUID do usuário no sistema de autenticação"
                    required
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
                    <TableHead>Especialidade</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {medicos.map((medico) => (
                    <TableRow key={medico.id}>
                      <TableCell className="font-medium">{medico.nome}</TableCell>
                      <TableCell>{medico.crm}</TableCell>
                      <TableCell>{medico.especialidade}</TableCell>
                      <TableCell>{medico.telefone || '-'}</TableCell>
                      <TableCell>{medico.email || '-'}</TableCell>
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
    </RoleProtectedRoute>
  );
}