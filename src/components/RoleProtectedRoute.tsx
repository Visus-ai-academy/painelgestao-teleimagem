import React from 'react';
import { Navigate } from 'react-router-dom';
import { useHasPermission, UserRole } from '@/hooks/useUserPermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Lock } from 'lucide-react';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles: UserRole | UserRole[];
  redirectTo?: string;
  showFallback?: boolean;
}

export const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({
  children,
  requiredRoles,
  redirectTo = "/",
  showFallback = true,
}) => {
  const { hasPermission, loading } = useHasPermission(requiredRoles);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-pulse" />
          <p>Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!hasPermission) {
    if (!showFallback) {
      return <Navigate to={redirectTo} replace />;
    }
    
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center">
              <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Acesso Negado</h3>
              <p className="text-muted-foreground">
                Você não tem permissão para acessar esta página.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Roles necessários: {Array.isArray(requiredRoles) ? requiredRoles.join(', ') : requiredRoles}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};