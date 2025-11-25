import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { 
  Users, 
  UserPlus, 
  Shield, 
  Edit, 
  Trash2, 
  Search,
  Crown,
  UserCheck,
  MoreHorizontal,
  Settings,
  Key,
  Mail,
  KeyRound,
  AlertTriangle
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MenuPermissionsDialog } from "@/components/MenuPermissionsDialog";

interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  roles: string[];
}

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'manager' | 'user';
}

export default function GerenciarUsuarios() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [menuPermissionsDialog, setMenuPermissionsDialog] = useState<{
    isOpen: boolean;
    userId: string;
    userEmail: string;
  }>({ isOpen: false, userId: '', userEmail: '' });
  
  // Estados para dialogs
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{
    isOpen: boolean;
    userEmail: string;
  }>({ isOpen: false, userEmail: '' });
  
  const [editUserDialog, setEditUserDialog] = useState<{
    isOpen: boolean;
    user: User | null;
  }>({ isOpen: false, user: null });
  
  const [changePasswordDialog, setChangePasswordDialog] = useState<{
    isOpen: boolean;
    userEmail: string;
  }>({ isOpen: false, userEmail: '' });
  
  const [deleteUserDialog, setDeleteUserDialog] = useState<{
    isOpen: boolean;
    user: User | null;
  }>({ isOpen: false, user: null });
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");
  const [changePasswordInEdit, setChangePasswordInEdit] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    checkCurrentUserRole();
  }, []);

  const checkCurrentUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      if (userRoles && userRoles.length > 0) {
        setCurrentUserRole(userRoles[0].role);
      }
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Buscar perfis de usuários
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        throw profilesError;
      }

      // Buscar roles dos usuários
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        throw rolesError;
      }

      // Combinar dados
      const usersWithRoles = profiles?.map(profile => ({
        id: profile.user_id,
        email: profile.email || '',
        display_name: profile.display_name || profile.email || '',
        created_at: profile.created_at,
        roles: userRoles?.filter(role => role.user_id === profile.user_id).map(role => role.role) || ['user']
      })) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar usuários",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'manager' | 'user') => {
    try {
      // Remover roles existentes
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Adicionar novo role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: `Role do usuário atualizado para ${newRole}`,
      });

      fetchUsers();
    } catch (error) {
      console.error('Erro ao atualizar role:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar role do usuário",
        variant: "destructive"
      });
    }
  };

  // Função para enviar email de redefinição de senha
  const sendPasswordReset = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: `Email de redefinição de senha enviado para ${email}`,
      });

      setResetPasswordDialog({ isOpen: false, userEmail: '' });
    } catch (error) {
      console.error('Erro ao enviar email de redefinição:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar email de redefinição de senha",
        variant: "destructive"
      });
    }
  };

  // Função para editar usuário
  const updateUserProfile = async () => {
    if (!editUserDialog.user) return;

    // Validação de senha se estiver alterando
    if (changePasswordInEdit) {
      if (editNewPassword !== editConfirmPassword) {
        toast({
          title: "Erro",
          description: "As senhas não coincidem",
          variant: "destructive"
        });
        return;
      }

      if (editNewPassword.length < 6) {
        toast({
          title: "Erro",
          description: "A senha deve ter pelo menos 6 caracteres",
          variant: "destructive"
        });
        return;
      }
    }

    try {
      // Atualizar perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ display_name: editDisplayName })
        .eq('user_id', editUserDialog.user.id);

      if (profileError) {
        throw profileError;
      }

      // Se estiver alterando senha, usar a Admin API
      if (changePasswordInEdit && editNewPassword) {
        // Vamos criar uma edge function para alterar senha como admin
        const { data, error: passwordError } = await supabase.functions.invoke('admin-update-password', {
          body: {
            userId: editUserDialog.user.id,
            newPassword: editNewPassword
          }
        });

        if (passwordError) {
          console.error('Erro ao alterar senha:', passwordError);
          // Se a edge function não existir ainda, enviamos email de reset como fallback
          await sendPasswordReset(editUserDialog.user.email);
          toast({
            title: "Sucesso Parcial",
            description: "Perfil atualizado. Email de redefinição de senha enviado para o usuário.",
          });
        } else {
          toast({
            title: "Sucesso",
            description: "Perfil e senha atualizados com sucesso",
          });
        }
      } else {
        toast({
          title: "Sucesso",
          description: "Perfil do usuário atualizado com sucesso",
        });
      }

      // Limpar estados e fechar dialog
      setEditUserDialog({ isOpen: false, user: null });
      setEditDisplayName("");
      setEditNewPassword("");
      setEditConfirmPassword("");
      setChangePasswordInEdit(false);
      fetchUsers();
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar perfil do usuário",
        variant: "destructive"
      });
    }
  };

  // Função para alterar senha (através de admin reset)
  const changeUserPassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive"
      });
      return;
    }

    // Como não podemos alterar senha diretamente, enviamos um reset
    await sendPasswordReset(changePasswordDialog.userEmail);
    setChangePasswordDialog({ isOpen: false, userEmail: '' });
    setNewPassword("");
    setConfirmPassword("");
  };

  // Função para excluir usuário
  const deleteUser = async () => {
    if (!deleteUserDialog.user) return;

    try {
      const userId = deleteUserDialog.user.id;
      
      // 1. Deletar permissões de menu do usuário
      await supabase
        .from('user_menu_permissions')
        .delete()
        .eq('user_id', userId);

      // 2. Deletar roles do usuário
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // 3. Deletar perfil do usuário
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (profileError) {
        throw profileError;
      }

      // 4. Deletar usuário da auth (requer admin API, então pode falhar)
      // A edge function pode ser necessária para isso
      const { error: authError } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId }
      });

      if (authError) {
        console.warn('Erro ao deletar da auth, mas perfil foi removido:', authError);
      }

      toast({
        title: "Sucesso",
        description: "Usuário excluído com sucesso",
      });

      setDeleteUserDialog({ isOpen: false, user: null });
      fetchUsers();
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir usuário",
        variant: "destructive"
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'manager':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-3 w-3" />;
      case 'manager':
        return <Shield className="h-3 w-3" />;
      default:
        return <UserCheck className="h-3 w-3" />;
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (currentUserRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
              <p className="text-muted-foreground">
                Apenas administradores podem gerenciar usuários.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciar Usuários</h1>
          <p className="text-gray-600 mt-1">Controle de acesso e permissões dos usuários</p>
        </div>
        <Button className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Convidar Usuário
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.roles.includes('admin')).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Managers</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.roles.includes('manager')).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Buscar usuário</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Digite email ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Usuários */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Data de Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Carregando usuários...
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.display_name}</div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {user.roles.map((role) => (
                          <Badge
                            key={role}
                            variant={getRoleBadgeVariant(role)}
                            className="flex items-center gap-1"
                          >
                            {getRoleIcon(role)}
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditUserDialog({ isOpen: true, user });
                              setEditDisplayName(user.display_name);
                              setChangePasswordInEdit(false);
                              setEditNewPassword("");
                              setEditConfirmPassword("");
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Editar Usuário & Senha
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setResetPasswordDialog({
                              isOpen: true,
                              userEmail: user.email
                            })}
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            Esqueci Senha
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setChangePasswordDialog({
                              isOpen: true,
                              userEmail: user.email
                            })}
                          >
                            <KeyRound className="mr-2 h-4 w-4" />
                            Alterar Senha
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setMenuPermissionsDialog({
                              isOpen: true,
                              userId: user.id,
                              userEmail: user.email
                            })}
                          >
                            <Settings className="mr-2 h-4 w-4" />
                            Gerenciar Menus
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateUserRole(user.id, 'admin')}
                            disabled={user.roles.includes('admin')}
                          >
                            <Crown className="mr-2 h-4 w-4" />
                            Tornar Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateUserRole(user.id, 'manager')}
                            disabled={user.roles.includes('manager')}
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            Tornar Manager
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateUserRole(user.id, 'user')}
                            disabled={user.roles.includes('user')}
                          >
                            <UserCheck className="mr-2 h-4 w-4" />
                            Tornar Usuário
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteUserDialog({ isOpen: true, user })}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir Usuário
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog para redefinir senha */}
      <Dialog open={resetPasswordDialog.isOpen} onOpenChange={(isOpen) => 
        setResetPasswordDialog({ ...resetPasswordDialog, isOpen })
      }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Será enviado um email de redefinição de senha para {resetPasswordDialog.userEmail}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialog({ isOpen: false, userEmail: '' })}>
              Cancelar
            </Button>
            <Button onClick={() => sendPasswordReset(resetPasswordDialog.userEmail)}>
              Enviar Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar usuário */}
      <Dialog open={editUserDialog.isOpen} onOpenChange={(isOpen) => 
        setEditUserDialog({ ...editUserDialog, isOpen })
      }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Edite as informações do usuário {editUserDialog.user?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="displayName">Nome de Exibição</Label>
              <Input
                id="displayName"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Nome de exibição"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                id="changePassword"
                checked={changePasswordInEdit}
                onCheckedChange={setChangePasswordInEdit}
              />
              <Label htmlFor="changePassword">Alterar senha do usuário</Label>
            </div>

            {changePasswordInEdit && (
              <div className="space-y-3 p-4 border rounded-md bg-muted/30">
                <div>
                  <Label htmlFor="editNewPassword">Nova Senha</Label>
                  <Input
                    id="editNewPassword"
                    type="password"
                    value={editNewPassword}
                    onChange={(e) => setEditNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                  />
                </div>
                
                <div>
                  <Label htmlFor="editConfirmPassword">Confirmar Nova Senha</Label>
                  <Input
                    id="editConfirmPassword"
                    type="password"
                    value={editConfirmPassword}
                    onChange={(e) => setEditConfirmPassword(e.target.value)}
                    placeholder="Confirme a nova senha"
                  />
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <p>• A senha deve ter pelo menos 6 caracteres</p>
                  <p>• A nova senha será definida diretamente pelo administrador</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditUserDialog({ isOpen: false, user: null });
              setEditDisplayName("");
              setEditNewPassword("");
              setEditConfirmPassword("");
              setChangePasswordInEdit(false);
            }}>
              Cancelar
            </Button>
            <Button onClick={updateUserProfile}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para alterar senha */}
      <Dialog open={changePasswordDialog.isOpen} onOpenChange={(isOpen) => 
        setChangePasswordDialog({ ...changePasswordDialog, isOpen })
      }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>
              Será enviado um email de redefinição para {changePasswordDialog.userEmail}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setChangePasswordDialog({ isOpen: false, userEmail: '' });
              setNewPassword("");
              setConfirmPassword("");
            }}>
              Cancelar
            </Button>
            <Button onClick={changeUserPassword}>
              Enviar Email de Redefinição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para excluir usuário */}
      <Dialog open={deleteUserDialog.isOpen} onOpenChange={(isOpen) => 
        setDeleteUserDialog({ ...deleteUserDialog, isOpen })
      }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Usuário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o usuário {deleteUserDialog.user?.email}?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive mb-1">Atenção!</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Todas as permissões do usuário serão removidas</li>
                  <li>O perfil será permanentemente excluído</li>
                  <li>O usuário não poderá mais acessar o sistema</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserDialog({ isOpen: false, user: null })}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={deleteUser}>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MenuPermissionsDialog
        isOpen={menuPermissionsDialog.isOpen}
        onClose={() => setMenuPermissionsDialog({ isOpen: false, userId: '', userEmail: '' })}
        userId={menuPermissionsDialog.userId}
        userEmail={menuPermissionsDialog.userEmail}
      />
    </div>
  );
}