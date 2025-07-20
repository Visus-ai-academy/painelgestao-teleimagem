import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Shield, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PasswordPolicy {
  id: string;
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_symbols: boolean;
  max_age_days: number;
  history_count: number;
  max_attempts: number;
  lockout_duration_minutes: number;
}

export function PasswordPolicyPanel() {
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testPassword, setTestPassword] = useState('');
  const [showTestPassword, setShowTestPassword] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPasswordPolicy();
  }, []);

  const loadPasswordPolicy = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('password_policies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setPolicy(data);
    } catch (error: any) {
      console.error('Erro ao carregar política de senha:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar política de senha",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const savePasswordPolicy = async () => {
    if (!policy) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('password_policies')
        .update({
          min_length: policy.min_length,
          require_uppercase: policy.require_uppercase,
          require_lowercase: policy.require_lowercase,
          require_numbers: policy.require_numbers,
          require_symbols: policy.require_symbols,
          max_age_days: policy.max_age_days,
          history_count: policy.history_count,
          max_attempts: policy.max_attempts,
          lockout_duration_minutes: policy.lockout_duration_minutes,
          updated_at: new Date().toISOString()
        })
        .eq('id', policy.id);

      if (error) throw error;

      toast({
        title: "Política Atualizada",
        description: "Política de senha atualizada com sucesso",
      });

    } catch (error: any) {
      console.error('Erro ao salvar política:', error);
      toast({
        title: "Erro",
        description: "Falha ao salvar política de senha",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testPasswordStrength = (password: string) => {
    if (!policy) return { valid: false, errors: [] };

    const errors = [];

    if (password.length < policy.min_length) {
      errors.push(`Mínimo ${policy.min_length} caracteres`);
    }

    if (policy.require_uppercase && !/[A-Z]/.test(password)) {
      errors.push('Pelo menos uma letra maiúscula');
    }

    if (policy.require_lowercase && !/[a-z]/.test(password)) {
      errors.push('Pelo menos uma letra minúscula');
    }

    if (policy.require_numbers && !/\d/.test(password)) {
      errors.push('Pelo menos um número');
    }

    if (policy.require_symbols && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Pelo menos um símbolo especial');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  };

  const updatePolicy = (field: keyof PasswordPolicy, value: any) => {
    if (!policy) return;
    setPolicy({ ...policy, [field]: value });
  };

  const getSecurityLevel = () => {
    if (!policy) return 'low';
    
    let score = 0;
    if (policy.min_length >= 12) score += 2;
    else if (policy.min_length >= 8) score += 1;
    
    if (policy.require_uppercase) score += 1;
    if (policy.require_lowercase) score += 1;
    if (policy.require_numbers) score += 1;
    if (policy.require_symbols) score += 2;
    
    if (policy.max_attempts <= 3) score += 1;
    if (policy.lockout_duration_minutes >= 30) score += 1;

    if (score >= 8) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  };

  const passwordTest = testPasswordStrength(testPassword);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Políticas de Senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Carregando políticas...</div>
        </CardContent>
      </Card>
    );
  }

  if (!policy) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Políticas de Senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma política de senha encontrada. Verifique a configuração do banco de dados.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const securityLevel = getSecurityLevel();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Políticas de Senha
        </CardTitle>
        <CardDescription>
          Configure os requisitos de segurança para senhas de usuários
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Nível de Segurança */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <Shield className={`h-6 w-6 ${
              securityLevel === 'high' ? 'text-green-500' : 
              securityLevel === 'medium' ? 'text-yellow-500' : 'text-red-500'
            }`} />
            <div>
              <h4 className="font-semibold">Nível de Segurança</h4>
              <p className="text-sm text-muted-foreground">
                {securityLevel === 'high' ? 'Alto - Política robusta' : 
                 securityLevel === 'medium' ? 'Médio - Política adequada' : 'Baixo - Melhorias necessárias'}
              </p>
            </div>
          </div>
          <Badge variant={
            securityLevel === 'high' ? 'default' : 
            securityLevel === 'medium' ? 'secondary' : 'destructive'
          }>
            {securityLevel.toUpperCase()}
          </Badge>
        </div>

        {/* Configurações de Complexidade */}
        <div className="space-y-4">
          <h4 className="font-semibold">Requisitos de Complexidade</h4>
          
          <div className="space-y-2">
            <Label htmlFor="min-length">Comprimento Mínimo</Label>
            <Input
              id="min-length"
              type="number"
              min="6"
              max="128"
              value={policy.min_length}
              onChange={(e) => updatePolicy('min_length', parseInt(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Recomendado: pelo menos 12 caracteres
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="require-uppercase"
                checked={policy.require_uppercase}
                onCheckedChange={(checked) => updatePolicy('require_uppercase', checked)}
              />
              <Label htmlFor="require-uppercase">Letras maiúsculas (A-Z)</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="require-lowercase"
                checked={policy.require_lowercase}
                onCheckedChange={(checked) => updatePolicy('require_lowercase', checked)}
              />
              <Label htmlFor="require-lowercase">Letras minúsculas (a-z)</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="require-numbers"
                checked={policy.require_numbers}
                onCheckedChange={(checked) => updatePolicy('require_numbers', checked)}
              />
              <Label htmlFor="require-numbers">Números (0-9)</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="require-symbols"
                checked={policy.require_symbols}
                onCheckedChange={(checked) => updatePolicy('require_symbols', checked)}
              />
              <Label htmlFor="require-symbols">Símbolos (!@#$%...)</Label>
            </div>
          </div>
        </div>

        {/* Configurações de Segurança */}
        <div className="space-y-4">
          <h4 className="font-semibold">Configurações de Segurança</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max-age">Validade da Senha (dias)</Label>
              <Input
                id="max-age"
                type="number"
                min="0"
                max="365"
                value={policy.max_age_days}
                onChange={(e) => updatePolicy('max_age_days', parseInt(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="history-count">Histórico de Senhas</Label>
              <Input
                id="history-count"
                type="number"
                min="0"
                max="20"
                value={policy.history_count}
                onChange={(e) => updatePolicy('history_count', parseInt(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-attempts">Máx. Tentativas</Label>
              <Input
                id="max-attempts"
                type="number"
                min="1"
                max="10"
                value={policy.max_attempts}
                onChange={(e) => updatePolicy('max_attempts', parseInt(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lockout-duration">Bloqueio (minutos)</Label>
              <Input
                id="lockout-duration"
                type="number"
                min="5"
                max="1440"
                value={policy.lockout_duration_minutes}
                onChange={(e) => updatePolicy('lockout_duration_minutes', parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Teste de Senha */}
        <div className="space-y-4">
          <h4 className="font-semibold">Teste de Política</h4>
          <div className="space-y-2">
            <Label htmlFor="test-password">Digite uma senha para testar</Label>
            <div className="relative">
              <Input
                id="test-password"
                type={showTestPassword ? "text" : "password"}
                placeholder="Digite uma senha..."
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowTestPassword(!showTestPassword)}
              >
                {showTestPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {testPassword && (
            <div className={`p-3 border rounded ${passwordTest.valid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                {passwordTest.valid ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <span className={`font-semibold ${passwordTest.valid ? 'text-green-600' : 'text-red-600'}`}>
                  {passwordTest.valid ? 'Senha válida' : 'Senha inválida'}
                </span>
              </div>
              
              {passwordTest.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-600">Problemas encontrados:</p>
                  <ul className="text-sm text-red-600 list-disc list-inside">
                    {passwordTest.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botão Salvar */}
        <Button onClick={savePasswordPolicy} disabled={saving} className="w-full">
          {saving ? 'Salvando...' : 'Salvar Política'}
        </Button>
      </CardContent>
    </Card>
  );
}