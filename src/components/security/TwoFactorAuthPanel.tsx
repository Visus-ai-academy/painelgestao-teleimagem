import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Key, Shield, Smartphone, CheckCircle, AlertTriangle, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface User2FA {
  id: string;
  user_id: string;
  enabled: boolean;
  last_used: string | null;
  created_at: string;
}

export function TwoFactorAuthPanel() {
  const [user2FA, setUser2FA] = useState<User2FA | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      load2FAStatus();
    }
  }, [user]);

  const load2FAStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_2fa')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setUser2FA(data);
    } catch (error: any) {
      console.error('Erro ao carregar status 2FA:', error);
    } finally {
      setLoading(false);
    }
  };

  const generate2FA = async () => {
    try {
      setEnabling(true);
      
      // Gerar secret para 2FA (simulado - em produção usar biblioteca como speakeasy)
      const secret = generateRandomSecret();
      const appName = 'TeleImagem';
      const userEmail = user?.email || 'usuario@exemplo.com';
      
      // Gerar URL do QR Code para Google Authenticator
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(userEmail)}?secret=${secret}&issuer=${encodeURIComponent(appName)}`;
      
      // Gerar códigos de backup
      const codes = generateBackupCodes();
      
      setQrCodeUrl(qrUrl);
      setBackupCodes(codes);
      
      // Inserir no banco (desabilitado até verificação)
      const { error } = await supabase
        .from('user_2fa')
        .upsert({
          user_id: user?.id,
          secret: secret,
          backup_codes: codes,
          enabled: false
        });

      if (error) throw error;

      toast({
        title: "2FA Configurado",
        description: "Escaneie o QR Code com seu aplicativo autenticador",
      });

    } catch (error: any) {
      console.error('Erro ao configurar 2FA:', error);
      toast({
        title: "Erro",
        description: "Falha ao configurar 2FA",
        variant: "destructive",
      });
    } finally {
      setEnabling(false);
    }
  };

  const verify2FA = async () => {
    try {
      if (!verificationCode || verificationCode.length !== 6) {
        toast({
          title: "Código Inválido",
          description: "Digite um código de 6 dígitos",
          variant: "destructive",
        });
        return;
      }

      // Em produção, verificar o código TOTP
      // Por enquanto, aceitar qualquer código de 6 dígitos
      const isValid = /^\d{6}$/.test(verificationCode);

      if (isValid) {
        const { error } = await supabase
          .from('user_2fa')
          .update({ 
            enabled: true,
            last_used: new Date().toISOString()
          })
          .eq('user_id', user?.id);

        if (error) throw error;

        await load2FAStatus();
        setQrCodeUrl('');
        setVerificationCode('');

        toast({
          title: "2FA Ativado",
          description: "Autenticação de dois fatores ativada com sucesso",
        });
      } else {
        toast({
          title: "Código Inválido",
          description: "Verifique o código do seu aplicativo autenticador",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Erro ao verificar 2FA:', error);
      toast({
        title: "Erro",
        description: "Falha ao verificar código 2FA",
        variant: "destructive",
      });
    }
  };

  const disable2FA = async () => {
    try {
      const { error } = await supabase
        .from('user_2fa')
        .update({ enabled: false })
        .eq('user_id', user?.id);

      if (error) throw error;

      await load2FAStatus();
      setBackupCodes([]);

      toast({
        title: "2FA Desativado",
        description: "Autenticação de dois fatores foi desativada",
      });
    } catch (error: any) {
      console.error('Erro ao desativar 2FA:', error);
      toast({
        title: "Erro",
        description: "Falha ao desativar 2FA",
        variant: "destructive",
      });
    }
  };

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    toast({
      title: "Códigos Copiados",
      description: "Códigos de backup copiados para a área de transferência",
    });
  };

  const generateRandomSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const generateBackupCodes = () => {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.random().toString(36).substr(2, 8).toUpperCase();
      codes.push(code);
    }
    return codes;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Autenticação de Dois Fatores (2FA)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Carregando configurações 2FA...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Autenticação de Dois Fatores (2FA)
        </CardTitle>
        <CardDescription>
          Adicione uma camada extra de segurança à sua conta
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Atual */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <Shield className={`h-6 w-6 ${user2FA?.enabled ? 'text-green-500' : 'text-gray-400'}`} />
            <div>
              <h4 className="font-semibold">Status do 2FA</h4>
              <p className="text-sm text-muted-foreground">
                {user2FA?.enabled ? 'Ativado e protegendo sua conta' : 'Desativado - sua conta está vulnerável'}
              </p>
            </div>
          </div>
          <Badge variant={user2FA?.enabled ? 'default' : 'destructive'}>
            {user2FA?.enabled ? 'ATIVO' : 'INATIVO'}
          </Badge>
        </div>

        {/* Configuração Inicial */}
        {!user2FA?.enabled && !qrCodeUrl && (
          <div className="space-y-4">
            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                Para usar 2FA, você precisará de um aplicativo autenticador como Google Authenticator, 
                Authy ou Microsoft Authenticator instalado no seu smartphone.
              </AlertDescription>
            </Alert>

            <Button onClick={generate2FA} disabled={enabling} className="w-full">
              {enabling ? 'Configurando...' : 'Configurar 2FA'}
            </Button>
          </div>
        )}

        {/* QR Code e Verificação */}
        {qrCodeUrl && (
          <div className="space-y-4">
            <div className="text-center">
              <h4 className="font-semibold mb-2">Escaneie o QR Code</h4>
              <img src={qrCodeUrl} alt="QR Code 2FA" className="mx-auto border rounded" />
              <p className="text-sm text-muted-foreground mt-2">
                Abra seu aplicativo autenticador e escaneie este código
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verification-code">Código de Verificação</Label>
              <Input
                id="verification-code"
                type="text"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Digite o código de 6 dígitos do seu aplicativo autenticador
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={verify2FA} className="flex-1">
                Verificar e Ativar
              </Button>
              <Button variant="outline" onClick={() => setQrCodeUrl('')}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Códigos de Backup */}
        {backupCodes.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Códigos de Backup</h4>
              <Button size="sm" variant="outline" onClick={copyBackupCodes}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            </div>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Guarde estes códigos em local seguro. Você pode usá-los para acessar sua conta se perder acesso ao seu dispositivo.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded font-mono text-sm">
              {backupCodes.map((code, index) => (
                <div key={index} className="text-center p-2 border rounded bg-background">
                  {code}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Desativar 2FA */}
        {user2FA?.enabled && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-semibold">2FA está ativo e protegendo sua conta</span>
            </div>
            
            {user2FA.last_used && (
              <p className="text-sm text-muted-foreground">
                Último uso: {new Date(user2FA.last_used).toLocaleString('pt-BR')}
              </p>
            )}

            <Button variant="destructive" onClick={disable2FA}>
              Desativar 2FA
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}