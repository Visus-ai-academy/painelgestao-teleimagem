import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Shield, Download, Trash2, FileText, User, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LGPDConsent {
  id: string;
  email: string;
  consent_type: string;
  purpose: string;
  granted: boolean;
  timestamp: string;
  expires_at: string | null;
  withdrawn_at: string | null;
  legal_basis: string;
}

export function LGPDCompliancePanel() {
  const [consents, setConsents] = useState<LGPDConsent[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Estados para gestão de consentimento
  const [userEmail, setUserEmail] = useState('');
  const [consentType, setConsentType] = useState('');
  const [purpose, setPurpose] = useState('');
  const [legalBasis, setLegalBasis] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  
  // Estados para operações LGPD
  const [requestEmail, setRequestEmail] = useState('');
  const [requestType, setRequestType] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    loadConsents();
  }, []);

  const loadConsents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lgpd_consent')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      setConsents(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar consentimentos:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar consentimentos LGPD",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const recordConsent = async () => {
    if (!userEmail || !consentType || !purpose || !legalBasis) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessing(true);
      const { data, error } = await supabase.functions.invoke('lgpd-compliance', {
        body: {
          operation: 'consent',
          user_email: userEmail,
          consent_data: {
            type: consentType,
            purpose: purpose,
            legal_basis: legalBasis,
            expires_at: expiresAt || null
          },
          ip_address: '127.0.0.1', // Em produção, capturar IP real
          user_agent: navigator.userAgent
        }
      });

      if (error) throw error;

      toast({
        title: "Consentimento Registrado",
        description: "Consentimento LGPD registrado com sucesso",
      });

      // Limpar formulário
      setUserEmail('');
      setConsentType('');
      setPurpose('');
      setLegalBasis('');
      setExpiresAt('');
      
      await loadConsents();

    } catch (error: any) {
      console.error('Erro ao registrar consentimento:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao registrar consentimento",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const withdrawConsent = async (email: string, type: string) => {
    try {
      setProcessing(true);
      const { data, error } = await supabase.functions.invoke('lgpd-compliance', {
        body: {
          operation: 'withdraw',
          user_email: email,
          consent_data: { type }
        }
      });

      if (error) throw error;

      toast({
        title: "Consentimento Retirado",
        description: "Consentimento retirado com sucesso",
      });

      await loadConsents();

    } catch (error: any) {
      console.error('Erro ao retirar consentimento:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao retirar consentimento",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const exportUserData = async () => {
    if (!requestEmail) {
      toast({
        title: "Erro",
        description: "Digite o email do usuário",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessing(true);
      const { data, error } = await supabase.functions.invoke('lgpd-compliance', {
        body: {
          operation: 'data_portability',
          user_email: requestEmail
        }
      });

      if (error) throw error;

      // Download dos dados como JSON
      const dataStr = JSON.stringify(data.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dados-${requestEmail}-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Dados Exportados",
        description: "Dados do usuário exportados com sucesso",
      });

    } catch (error: any) {
      console.error('Erro ao exportar dados:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao exportar dados",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const deleteUserData = async () => {
    if (!requestEmail) {
      toast({
        title: "Erro",
        description: "Digite o email do usuário",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm(
      `Tem certeza que deseja DELETAR PERMANENTEMENTE todos os dados de ${requestEmail}? Esta ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    try {
      setProcessing(true);
      const { data, error } = await supabase.functions.invoke('lgpd-compliance', {
        body: {
          operation: 'deletion',
          user_email: requestEmail
        }
      });

      if (error) throw error;

      toast({
        title: "Dados Deletados",
        description: `Dados de ${requestEmail} foram deletados conforme LGPD`,
      });

      setRequestEmail('');
      await loadConsents();

    } catch (error: any) {
      console.error('Erro ao deletar dados:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao deletar dados",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const getConsentStatus = (consent: LGPDConsent) => {
    if (consent.withdrawn_at) return 'withdrawn';
    if (consent.expires_at && new Date(consent.expires_at) < new Date()) return 'expired';
    if (consent.granted) return 'active';
    return 'denied';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Ativo</Badge>;
      case 'withdrawn':
        return <Badge variant="destructive">Retirado</Badge>;
      case 'expired':
        return <Badge variant="secondary">Expirado</Badge>;
      case 'denied':
        return <Badge variant="outline">Negado</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Compliance LGPD
        </CardTitle>
        <CardDescription>
          Gestão de consentimentos e direitos dos titulares de dados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="consents" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="consents">Consentimentos</TabsTrigger>
            <TabsTrigger value="new-consent">Novo Consentimento</TabsTrigger>
            <TabsTrigger value="rights">Direitos do Titular</TabsTrigger>
            <TabsTrigger value="policies">Políticas</TabsTrigger>
          </TabsList>

          <TabsContent value="consents" className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Consentimentos Registrados</h4>
              <Button variant="outline" size="sm" onClick={loadConsents}>
                Atualizar
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8">Carregando consentimentos...</div>
            ) : consents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum consentimento registrado
              </div>
            ) : (
              <div className="space-y-4">
                {consents.map((consent) => {
                  const status = getConsentStatus(consent);
                  return (
                    <div key={consent.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h5 className="font-semibold">{consent.email}</h5>
                          <p className="text-sm text-muted-foreground">{consent.consent_type}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(status)}
                          {status === 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => withdrawConsent(consent.email, consent.consent_type)}
                              disabled={processing}
                            >
                              Retirar
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">Finalidade</Label>
                          <p>{consent.purpose}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Base Legal</Label>
                          <p>{consent.legal_basis}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Data do Consentimento</Label>
                          <p>{new Date(consent.timestamp).toLocaleString('pt-BR')}</p>
                        </div>
                        {consent.expires_at && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Expira em</Label>
                            <p>{new Date(consent.expires_at).toLocaleString('pt-BR')}</p>
                          </div>
                        )}
                        {consent.withdrawn_at && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Retirado em</Label>
                            <p>{new Date(consent.withdrawn_at).toLocaleString('pt-BR')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="new-consent" className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Registre consentimentos LGPD para processamento de dados pessoais.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user-email">Email do Usuário *</Label>
                <Input
                  id="user-email"
                  type="email"
                  placeholder="usuario@exemplo.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="consent-type">Tipo de Consentimento *</Label>
                <Select value={consentType} onValueChange={setConsentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="data_processing">Processamento de Dados</SelectItem>
                    <SelectItem value="marketing">Marketing e Comunicação</SelectItem>
                    <SelectItem value="analytics">Análise e Estatísticas</SelectItem>
                    <SelectItem value="cookies">Cookies e Rastreamento</SelectItem>
                    <SelectItem value="data_sharing">Compartilhamento de Dados</SelectItem>
                    <SelectItem value="data_deletion">Deleção de Dados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="legal-basis">Base Legal *</Label>
                <Select value={legalBasis} onValueChange={setLegalBasis}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a base legal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consent">Consentimento</SelectItem>
                    <SelectItem value="contract">Execução de Contrato</SelectItem>
                    <SelectItem value="legal_obligation">Obrigação Legal</SelectItem>
                    <SelectItem value="vital_interests">Interesses Vitais</SelectItem>
                    <SelectItem value="public_task">Tarefa Pública</SelectItem>
                    <SelectItem value="legitimate_interests">Interesses Legítimos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires-at">Data de Expiração (opcional)</Label>
                <Input
                  id="expires-at"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Finalidade do Processamento *</Label>
              <Textarea
                id="purpose"
                placeholder="Descreva a finalidade do processamento dos dados..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={3}
              />
            </div>

            <Button onClick={recordConsent} disabled={processing} className="w-full">
              <CheckCircle className="h-4 w-4 mr-2" />
              {processing ? 'Registrando...' : 'Registrar Consentimento'}
            </Button>
          </TabsContent>

          <TabsContent value="rights" className="space-y-4">
            <Alert>
              <User className="h-4 w-4" />
              <AlertDescription>
                Processe solicitações de direitos dos titulares: portabilidade, retificação e deleção.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="request-email">Email do Solicitante</Label>
              <Input
                id="request-email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button onClick={exportUserData} disabled={processing} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                {processing ? 'Exportando...' : 'Exportar Dados (Portabilidade)'}
              </Button>

              <Button 
                variant="destructive" 
                onClick={deleteUserData} 
                disabled={processing} 
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {processing ? 'Deletando...' : 'Deletar Dados (Esquecimento)'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="policies" className="space-y-4">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                Configurações de políticas de retenção e conformidade LGPD.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Políticas de Retenção</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Logs de Auditoria</Label>
                    <p>7 anos (retenção legal)</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Logs de Acesso</Label>
                    <p>3 anos (segurança)</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Consentimentos LGPD</Label>
                    <p>5 anos (evidência)</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tentativas de Login</Label>
                    <p>1 ano (segurança)</p>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Bases Legais Utilizadas</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Consentimento - Para marketing e comunicação</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Execução de Contrato - Para prestação de serviços</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Obrigação Legal - Para cumprimento fiscal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Interesses Legítimos - Para segurança e auditoria</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}