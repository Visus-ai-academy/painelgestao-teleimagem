import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database } from 'lucide-react';

export function EncryptionPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Criptografia de Dados
        </CardTitle>
        <CardDescription>
          Gestão de dados criptografados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Painel de criptografia em desenvolvimento...</p>
      </CardContent>
    </Card>
  );
}