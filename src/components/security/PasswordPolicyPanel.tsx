import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock } from 'lucide-react';

export function PasswordPolicyPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Políticas de Senha
        </CardTitle>
        <CardDescription>
          Configuração de requisitos de senha
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Painel de políticas de senha em desenvolvimento...</p>
      </CardContent>
    </Card>
  );
}