import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'manager' | 'user' | 'medico';

interface UserPermissions {
  isAdmin: boolean;
  isManager: boolean;
  isUser: boolean;
  roles: UserRole[];
  menuPermissions: Record<string, boolean>;
  loading: boolean;
}

interface MenuPermission {
  menu_key: string;
  granted: boolean;
}

export const useUserPermissions = (): UserPermissions => {
  const [permissions, setPermissions] = useState<UserPermissions>({
    isAdmin: false,
    isManager: false,
    isUser: false,
    roles: [],
    menuPermissions: {},
    loading: true,
  });

  useEffect(() => {
    const checkUserPermissions = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setPermissions({
            isAdmin: false,
            isManager: false,
            isUser: false,
            roles: [],
            menuPermissions: {},
            loading: false,
          });
          return;
        }

        // Buscar roles do usuário
        const { data: userRoles, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (rolesError) {
          console.error('Erro ao buscar roles:', rolesError);
          setPermissions(prev => ({ ...prev, loading: false }));
          return;
        }

        const roles = userRoles?.map(r => r.role as UserRole) || ['user'];

        // Buscar permissões customizadas de menu
        const { data: menuPermissionsData, error: menuError } = await supabase
          .from('user_menu_permissions')
          .select('menu_key, granted')
          .eq('user_id', user.id);

        if (menuError && menuError.code !== 'PGRST116') { // Ignorar erro de nenhum resultado
          console.error('Erro ao buscar permissões de menu:', menuError);
        }

        // Converter para objeto menu_key -> boolean
        const menuPermissions: Record<string, boolean> = {};
        menuPermissionsData?.forEach((perm: MenuPermission) => {
          menuPermissions[perm.menu_key] = perm.granted;
        });
        
        setPermissions({
          isAdmin: roles.includes('admin'),
          isManager: roles.includes('manager'),
          isUser: roles.includes('user'),
          roles,
          menuPermissions,
          loading: false,
        });
      } catch (error) {
        console.error('Erro ao verificar permissões:', error);
        setPermissions(prev => ({ ...prev, loading: false }));
      }
    };

    checkUserPermissions();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkUserPermissions();
    });

    return () => subscription.unsubscribe();
  }, []);

  return permissions;
};

// Hook para verificar se o usuário tem permissão específica
export const useHasPermission = (requiredRoles: UserRole | UserRole[]) => {
  const permissions = useUserPermissions();
  
  const hasPermission = () => {
    if (permissions.loading) return false;
    
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return roles.some(role => permissions.roles.includes(role));
  };

  return {
    hasPermission: hasPermission(),
    loading: permissions.loading,
    userRoles: permissions.roles,
  };
};

// Hook para verificar permissão de menu específico
export const useHasMenuPermission = (menuKey: string) => {
  const permissions = useUserPermissions();
  
  const hasMenuPermission = () => {
    if (permissions.loading) return false;
    
    // Se é admin, tem acesso a tudo
    if (permissions.isAdmin) return true;
    
    // Verificar se é um sub-menu (contém hífen além do menu principal)
    const menuParts = menuKey.split('-');
    let mainMenuKey = menuKey;
    
    // Se for um sub-menu, extrair o menu principal
    if (menuParts.length > 1) {
      // Para sub-menus como 'operacional-producao', o menu principal é 'operacional'
      // Para 'configuracao-faturamento', o menu principal é 'configuracao'
      mainMenuKey = menuParts[0];
    }
    
    // Verificar se há permissão customizada para este menu específico
    if (menuKey in permissions.menuPermissions) {
      return permissions.menuPermissions[menuKey];
    }
    
    // Se for um sub-menu, verificar se tem acesso ao menu principal
    if (menuParts.length > 1 && mainMenuKey in permissions.menuPermissions) {
      return permissions.menuPermissions[mainMenuKey];
    }
    
    // Permissões padrão baseadas em roles (fallback)
    const defaultPermissions: Record<string, UserRole[]> = {
      'dashboard': ['admin', 'manager', 'user'],
      'operacional': ['admin', 'manager'],
      'operacional-producao': ['admin', 'manager'],
      'operacional-qualidade': ['admin', 'manager'],
      'financeiro': ['admin', 'manager'],
      'gerar-faturamento': ['admin', 'manager'],
      'configuracao-faturamento': ['admin'],
      'regua-cobranca': ['admin', 'manager'],
      'contratos-clientes': ['admin', 'manager'],
      'contratos-fornecedores': ['admin'],
      'volumetria': ['admin', 'manager'],
      'medicos-ativos': ['admin', 'manager'],
      'escala': ['admin', 'manager'],
      'colaboradores': ['admin', 'manager'],
      'treinamento-equipe': ['admin', 'manager'],
      'plano-carreira': ['admin', 'manager'],
      'bonificacao': ['admin', 'manager'],
      'desenvolvimento': ['admin'],
      'configuracao': ['admin'],
      'usuarios': ['admin'],
    };
    
    // Verificar permissão do menu específico
    let allowedRoles = defaultPermissions[menuKey] || [];
    
    // Se for um sub-menu e não tiver permissão específica, verificar o menu principal
    if (allowedRoles.length === 0 && menuParts.length > 1) {
      allowedRoles = defaultPermissions[mainMenuKey] || [];
    }
    
    return permissions.roles.some(role => allowedRoles.includes(role));
  };

  return {
    hasMenuPermission: hasMenuPermission(),
    loading: permissions.loading,
  };
};