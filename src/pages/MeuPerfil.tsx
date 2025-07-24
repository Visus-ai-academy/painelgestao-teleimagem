import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, KeyRound, Mail, Save, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface UserProfile {
  user_id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export default function MeuPerfil() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        throw error;
      }

      setProfile(data);
      setDisplayName(data.display_name || data.email || '');
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar perfil do usuário",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    try {
      setUpdating(true);
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('user_id', user?.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso",
      });
      
      fetchProfile();
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar perfil",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  const updatePassword = async () => {
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

    try {
      setUpdating(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Senha alterada com sucesso",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar senha",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  const sendPasswordReset = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user?.email || '', {
        redirectTo: `${window.location.origin}/auth`
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Email de redefinição de senha enviado",
      });
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar email de redefinição",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <UserCheck className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-pulse" />
          <p>Carregando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meu Perfil</h1>
          <p className="text-gray-600 mt-1">Gerencie suas informações pessoais e configurações</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informações do Perfil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações do Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground mt-1">
                O email não pode ser alterado
              </p>
            </div>

            <div>
              <Label htmlFor="displayName">Nome de Exibição</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Digite seu nome de exibição"
              />
            </div>

            <div>
              <Label>Data de Cadastro</Label>
              <Input
                value={profile ? new Date(profile.created_at).toLocaleDateString('pt-BR') : ''}
                disabled
                className="bg-muted"
              />
            </div>

            <Button onClick={updateProfile} disabled={updating} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {updating ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </CardContent>
        </Card>

        {/* Alterar Senha */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Alterar Senha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha"
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme a nova senha"
              />
            </div>

            <div className="space-y-2">
              <Button 
                onClick={updatePassword} 
                disabled={updating || !newPassword || !confirmPassword}
                className="w-full"
              >
                <KeyRound className="mr-2 h-4 w-4" />
                {updating ? "Alterando..." : "Alterar Senha"}
              </Button>

              <Button 
                variant="outline" 
                onClick={sendPasswordReset}
                className="w-full"
              >
                <Mail className="mr-2 h-4 w-4" />
                Enviar Email de Redefinição
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>• A senha deve ter pelo menos 6 caracteres</p>
              <p>• Use o email de redefinição se esqueceu sua senha atual</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}