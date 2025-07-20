import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Key } from 'lucide-react';

export function TwoFactorAuthPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Autenticação de Dois Fatores (2FA)
        </CardTitle>
        <CardDescription>
          Configuração de 2FA para usuários
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Painel de 2FA em desenvolvimento...</p>
      </CardContent>
    </Card>
  );
}