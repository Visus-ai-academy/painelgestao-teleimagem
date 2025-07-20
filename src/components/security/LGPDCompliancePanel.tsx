import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export function LGPDCompliancePanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Compliance LGPD
        </CardTitle>
        <CardDescription>
          Gestão de consentimentos e direitos dos titulares
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Painel LGPD em desenvolvimento...</p>
      </CardContent>
    </Card>
  );
}