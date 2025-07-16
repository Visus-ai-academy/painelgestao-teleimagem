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
  Users, 
  UserPlus, 
  Shield, 
  Edit, 
  Trash2, 
  Search,
  Crown,
  UserCheck,
  MoreHorizontal,
  Settings
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

      <MenuPermissionsDialog
        isOpen={menuPermissionsDialog.isOpen}
        onClose={() => setMenuPermissionsDialog({ isOpen: false, userId: '', userEmail: '' })}
        userId={menuPermissionsDialog.userId}
        userEmail={menuPermissionsDialog.userEmail}
      />
    </div>
  );
}