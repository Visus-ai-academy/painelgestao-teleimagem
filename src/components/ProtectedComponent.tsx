import React from 'react';
import { useHasPermission, UserRole } from '@/hooks/useUserPermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Lock } from 'lucide-react';

interface ProtectedComponentProps {
  children: React.ReactNode;
  requiredRoles: UserRole | UserRole[];
  fallback?: React.ReactNode;
  showFallback?: boolean;
}

export const ProtectedComponent: React.FC<ProtectedComponentProps> = ({
  children,
  requiredRoles,
  fallback,
  showFallback = true,
}) => {
  const { hasPermission, loading } = useHasPermission(requiredRoles);

  if (loading) {
    return null; // ou um skeleton loader
  }

  if (!hasPermission) {
    if (!showFallback) return null;
    
    if (fallback) return <>{fallback}</>;
    
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center">
            <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
            <p className="text-muted-foreground text-sm">
              Você não tem permissão para acessar esta funcionalidade.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
};