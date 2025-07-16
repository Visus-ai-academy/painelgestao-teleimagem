import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'manager' | 'user';

interface UserPermissions {
  isAdmin: boolean;
  isManager: boolean;
  isUser: boolean;
  roles: UserRole[];
  loading: boolean;
}

export const useUserPermissions = (): UserPermissions => {
  const [permissions, setPermissions] = useState<UserPermissions>({
    isAdmin: false,
    isManager: false,
    isUser: false,
    roles: [],
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
            loading: false,
          });
          return;
        }

        const { data: userRoles, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.error('Erro ao buscar roles:', error);
          setPermissions(prev => ({ ...prev, loading: false }));
          return;
        }

        const roles = userRoles?.map(r => r.role as UserRole) || ['user'];
        
        setPermissions({
          isAdmin: roles.includes('admin'),
          isManager: roles.includes('manager'),
          isUser: roles.includes('user'),
          roles,
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