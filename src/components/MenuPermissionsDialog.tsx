import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface MenuPermissionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
}

interface MenuOption {
  key: string;
  label: string;
  defaultRoles: string[];
}

const menuOptions: MenuOption[] = [
  { key: 'dashboard', label: 'Dashboard', defaultRoles: ['admin', 'manager', 'user'] },
  { key: 'volumetria', label: 'Volumetria', defaultRoles: ['admin', 'manager', 'user'] },
  { key: 'operacional', label: 'Operacional', defaultRoles: ['admin', 'manager'] },
  { key: 'operacional-producao', label: 'Operacional - Produção', defaultRoles: ['admin', 'manager'] },
  { key: 'operacional-qualidade', label: 'Operacional - Qualidade', defaultRoles: ['admin', 'manager'] },
  { key: 'escala', label: 'Escala', defaultRoles: ['admin', 'manager'] },
  { key: 'financeiro', label: 'Financeiro', defaultRoles: ['admin', 'manager'] },
  { key: 'gerar-faturamento', label: 'Gerar Faturamento', defaultRoles: ['admin', 'manager'] },
  { key: 'regua-cobranca', label: 'Régua de Cobrança', defaultRoles: ['admin', 'manager'] },
  { key: 'contratos-clientes', label: 'Contratos Clientes', defaultRoles: ['admin', 'manager'] },
  { key: 'contratos-fornecedores', label: 'Contratos Fornecedores', defaultRoles: ['admin'] },
  { key: 'medicos-ativos', label: 'Médicos Ativos', defaultRoles: ['admin', 'manager'] },
  { key: 'colaboradores', label: 'Colaboradores', defaultRoles: ['admin', 'manager'] },
  { key: 'plano-carreira', label: 'Plano de Carreira', defaultRoles: ['admin'] },
  { key: 'desenvolvimento', label: 'Desenvolvimento', defaultRoles: ['admin'] },
  { key: 'bonificacao', label: 'Bonificação', defaultRoles: ['admin', 'manager'] },
  { key: 'treinamento-equipe', label: 'Treinamento Equipe', defaultRoles: ['admin', 'manager'] },
  { key: 'configuracao', label: 'Configuração', defaultRoles: ['admin'] },
  { key: 'usuarios', label: 'Gerenciar Usuários', defaultRoles: ['admin'] },
  { key: 'configuracao-faturamento', label: 'Configuração Faturamento', defaultRoles: ['admin'] },
];

export const MenuPermissionsDialog: React.FC<MenuPermissionsDialogProps> = ({
  isOpen,
  onClose,
  userId,
  userEmail,
}) => {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && userId) {
      loadCurrentPermissions();
    }
  }, [isOpen, userId]);

  const loadCurrentPermissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_menu_permissions')
        .select('menu_key, granted')
        .eq('user_id', userId);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const currentPermissions: Record<string, boolean> = {};
      data?.forEach(perm => {
        currentPermissions[perm.menu_key] = perm.granted;
      });

      setPermissions(currentPermissions);
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar permissões do usuário',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (menuKey: string, granted: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [menuKey]: granted,
    }));
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      // Primeiro, deletar todas as permissões existentes do usuário
      await supabase
        .from('user_menu_permissions')
        .delete()
        .eq('user_id', userId);

      // Buscar o usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      
      // Inserir as novas permissões
      const permissionsToInsert = Object.entries(permissions).map(([menuKey, granted]) => ({
        user_id: userId,
        menu_key: menuKey,
        granted,
        created_by: user?.id,
      }));

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase
          .from('user_menu_permissions')
          .insert(permissionsToInsert);

        if (error) throw error;
      }

      toast({
        title: 'Sucesso',
        description: 'Permissões atualizadas com sucesso',
      });

      onClose();
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar permissões',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Gerenciar Permissões de Menu - {userEmail}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Selecione quais menus este usuário pode acessar. Permissões customizadas
              sobrescreverão as permissões padrão baseadas no role.
            </div>

            <div className="grid gap-3">
              {menuOptions.map((menu) => (
                <div
                  key={menu.key}
                  className="flex items-center space-x-3 p-3 border rounded-md"
                >
                  <Checkbox
                    id={menu.key}
                    checked={permissions[menu.key] || false}
                    onCheckedChange={(checked) =>
                      handlePermissionChange(menu.key, !!checked)
                    }
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={menu.key}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {menu.label}
                    </label>
                    <div className="text-xs text-muted-foreground">
                      Padrão para: {menu.defaultRoles.join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={savePermissions} disabled={loading || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Permissões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};