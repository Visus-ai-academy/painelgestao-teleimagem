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
  isSubMenu?: boolean;
  parentMenu?: string;
}

const menuOptions: MenuOption[] = [
  // Menus Principais
  { key: 'dashboard', label: 'Dashboard', defaultRoles: ['admin', 'manager', 'user'] },
  { key: 'volumetria', label: 'Volumetria', defaultRoles: ['admin', 'manager', 'user'] },
  { key: 'operacional', label: 'Operacional', defaultRoles: ['admin', 'manager'] },
  { key: 'financeiro', label: 'Financeiro', defaultRoles: ['admin', 'manager'] },
  { key: 'people', label: 'People', defaultRoles: ['admin', 'manager'] },
  { key: 'clientes', label: 'Clientes', defaultRoles: ['admin', 'manager'] },
  { key: 'contratos', label: 'Contratos', defaultRoles: ['admin', 'manager'] },
  { key: 'configuracao', label: 'Configuração', defaultRoles: ['admin'] },
  { key: 'controle-regras', label: 'Controle de Regras', defaultRoles: ['admin'] },
  { key: 'relatorio-implementacoes', label: 'Relatório de Implementações', defaultRoles: ['admin'] },
  { key: 'gerenciar-cadastros', label: 'Gerenciar Cadastros', defaultRoles: ['admin'] },
  { key: 'limpar-dados', label: 'Limpar Dados', defaultRoles: ['admin'] },
  
  // Sub-menus do Dashboard
  { key: 'dashboard-faturamento', label: 'Faturamento', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'dashboard' },
  { key: 'dashboard-volumetria', label: 'Volumetria', defaultRoles: ['admin', 'manager', 'user'], isSubMenu: true, parentMenu: 'dashboard' },
  { key: 'dashboard-qualidade', label: 'Qualidade', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'dashboard' },
  { key: 'mapa-distribuicao', label: 'Mapa Distribuição', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'dashboard' },
  
  // Sub-menus do Operacional
  { key: 'operacional-producao', label: 'Produção', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'operacional' },
  { key: 'operacional-qualidade', label: 'Qualidade', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'operacional' },
  { key: 'escala', label: 'Escala', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'operacional' },
  { key: 'pcp', label: 'PCP', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'operacional' },
  { key: 'dados-volumetria', label: 'Dados MobileMed', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'operacional' },
  { key: 'relatorio-exclusoes', label: 'Relatório Exclusões', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'operacional' },
  { key: 'comparativo', label: 'Comparativo', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'operacional' },
  
  // Sub-menus da Qualidade
  { key: 'treinamento-equipe', label: 'Treinamento Equipe', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'operacional-qualidade' },
  
  // Sub-menus do Financeiro
  { key: 'gerar-faturamento', label: 'Gerar Faturamento', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'financeiro' },
  { key: 'pagamento-medico', label: 'Pagamento Médico', defaultRoles: ['admin'], isSubMenu: true, parentMenu: 'financeiro' },
  { key: 'bonificacao-comercial', label: 'Bonificação Comercial', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'financeiro' },
  { key: 'regua-cobranca', label: 'Régua de Cobrança', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'financeiro' },
  { key: 'documentacao-faturamento', label: 'Documentação', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'financeiro' },
  { key: 'fluxo-caixa', label: 'Fluxo de Caixa', defaultRoles: ['admin'], isSubMenu: true, parentMenu: 'financeiro' },
  { key: 'dre', label: 'DRE', defaultRoles: ['admin'], isSubMenu: true, parentMenu: 'financeiro' },
  
  // Sub-menus do People
  { key: 'colaboradores', label: 'Colaboradores', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'people' },
  { key: 'medicos-ativos', label: 'Médicos Ativos', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'people' },
  { key: 'plano-carreira', label: 'Plano de Carreira', defaultRoles: ['admin'], isSubMenu: true, parentMenu: 'people' },
  { key: 'desenvolvimento', label: 'Desenvolvimento', defaultRoles: ['admin'], isSubMenu: true, parentMenu: 'people' },
  { key: 'bonificacao-people', label: 'Bonificação', defaultRoles: ['admin'], isSubMenu: true, parentMenu: 'people' },
  
  // Sub-menus dos Clientes
  { key: 'cadastro-clientes', label: 'Cadastro de Clientes', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'clientes' },
  
  // Sub-menus dos Contratos
  { key: 'contratos-clientes', label: 'Contratos Clientes', defaultRoles: ['admin', 'manager'], isSubMenu: true, parentMenu: 'contratos' },
  { key: 'contratos-fornecedores', label: 'Contratos Fornecedores', defaultRoles: ['admin'], isSubMenu: true, parentMenu: 'contratos' },
  
  // Sub-menus da Configuração
  { key: 'configuracao-faturamento', label: 'Configuração de Faturamento', defaultRoles: ['admin'], isSubMenu: true, parentMenu: 'configuracao' },
  { key: 'usuarios', label: 'Gerenciar Usuários', defaultRoles: ['admin'], isSubMenu: true, parentMenu: 'configuracao' },
  { key: 'logomarca', label: 'Logomarca', defaultRoles: ['admin'], isSubMenu: true, parentMenu: 'configuracao' },
  { key: 'listas', label: 'Gerenciar Listas', defaultRoles: ['admin'], isSubMenu: true, parentMenu: 'configuracao' },
  { key: 'estrutura-vendas', label: 'Estrutura de Vendas', defaultRoles: ['admin'], isSubMenu: true, parentMenu: 'configuracao' },
  { key: 'configuracao-importacao', label: 'Configuração Importação', defaultRoles: ['admin'], isSubMenu: true, parentMenu: 'configuracao' },
  { key: 'arquitetura', label: 'Arquitetura do Projeto', defaultRoles: ['admin'], isSubMenu: true, parentMenu: 'configuracao' },
  { key: 'seguranca', label: 'Segurança', defaultRoles: ['admin'], isSubMenu: true, parentMenu: 'configuracao' },
  { key: 'mapeamento-visual', label: 'Mapeamento Visual', defaultRoles: ['admin'], isSubMenu: true, parentMenu: 'configuracao' },
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
    setPermissions(prev => {
      const updatedPermissions = {
        ...prev,
        [menuKey]: granted,
      };
      
      // Se estiver alterando um menu principal, automaticamente alterar todos os sub-menus
      const subMenus = menuOptions.filter(menu => menu.parentMenu === menuKey);
      if (subMenus.length > 0) {
        subMenus.forEach(subMenu => {
          updatedPermissions[subMenu.key] = granted;
        });
      }
      
      return updatedPermissions;
    });
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

            <div className="space-y-4">
              <div className="text-sm text-muted-foreground mb-3">
                Acesso aos sub-menus é concedido automaticamente quando o usuário tem acesso ao menu principal correspondente.
              </div>
              
              <div className="space-y-4">
                {menuOptions
                  .filter(menu => !menu.isSubMenu)
                  .map((mainMenu) => {
                    const subMenus = menuOptions.filter(menu => menu.parentMenu === mainMenu.key);
                    
                    return (
                      <div key={mainMenu.key} className="space-y-2">
                        {/* Menu Principal */}
                        <div className="flex items-center space-x-3 p-3 border rounded-md bg-card">
                          <Checkbox
                            id={mainMenu.key}
                            checked={permissions[mainMenu.key] || false}
                            onCheckedChange={(checked) =>
                              handlePermissionChange(mainMenu.key, !!checked)
                            }
                          />
                          <div className="flex-1">
                            <label
                              htmlFor={mainMenu.key}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {mainMenu.label}
                            </label>
                            <div className="text-xs text-muted-foreground">
                              Padrão para: {mainMenu.defaultRoles.join(', ')}
                            </div>
                          </div>
                        </div>

                        {/* Sub-menus */}
                        {subMenus.length > 0 && (
                          <div className="ml-6 space-y-2">
                            {subMenus.map((subMenu) => (
                              <div
                                key={subMenu.key}
                                className="flex items-center space-x-3 p-2 border rounded-md bg-muted/30"
                              >
                                <Checkbox
                                  id={subMenu.key}
                                  checked={permissions[subMenu.key] || false}
                                  onCheckedChange={(checked) =>
                                    handlePermissionChange(subMenu.key, !!checked)
                                  }
                                  disabled={permissions[mainMenu.key] === true}
                                />
                                <div className="flex-1">
                                  <label
                                    htmlFor={subMenu.key}
                                    className="text-sm cursor-pointer"
                                  >
                                    {subMenu.label}
                                  </label>
                                  <div className="text-xs text-muted-foreground">
                                    Padrão para: {subMenu.defaultRoles.join(', ')}
                                    {permissions[mainMenu.key] === true && (
                                      <span className="ml-2 text-green-600">• Habilitado pelo menu principal</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
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