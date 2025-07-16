import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  RefreshCw, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Mail, 
  Calendar,
  TrendingUp,
  DollarSign,
  Users,
  Send,
  Settings,
  RotateCcw
} from 'lucide-react';
import { format, isAfter, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OmieFatura {
  id: string;
  omie_id: string;
  cliente_nome: string;
  cliente_email: string;
  numero_fatura: string;
  valor: number;
  data_emissao: string;
  data_vencimento: string;
  status: 'pago' | 'em_aberto' | 'cancelado';
  data_pagamento?: string;
  sync_date: string;
}

interface ReguaCobranca {
  id: string;
  fatura_id: string;
  dias_envio: number;
  proximo_envio: string;
  emails_enviados: number;
  max_emails: number;
  ativo: boolean;
}

interface EmailCobranca {
  id: string;
  cliente_email: string;
  assunto: string;
  enviado_em: string;
  status: string;
}

export default function ReguaCobranca() {
  const [faturas, setFaturas] = useState<OmieFatura[]>([]);
  const [faturasSelecionadas, setFaturasSelecionadas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [emails, setEmails] = useState<EmailCobranca[]>([]);
  const { toast } = useToast();

  // Estados para métricas
  const [totalFaturas, setTotalFaturas] = useState(0);
  const [totalVencidas, setTotalVencidas] = useState(0);
  const [valorEmAberto, setValorEmAberto] = useState(0);
  const [emailsEnviados, setEmailsEnviados] = useState(0);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Carregar faturas do Omie
      const { data: faturasData, error: faturasError } = await supabase
        .from('omie_faturas')
        .select('*')
        .order('data_vencimento', { ascending: false });

      if (faturasError) throw faturasError;

      setFaturas((faturasData || []) as OmieFatura[]);

      // Carregar emails de cobrança
      const { data: emailsData, error: emailsError } = await supabase
        .from('emails_cobranca')
        .select('*')
        .order('enviado_em', { ascending: false })
        .limit(50);

      if (emailsError) throw emailsError;

      setEmails(emailsData || []);

      // Calcular métricas
      calcularMetricas((faturasData || []) as OmieFatura[], emailsData || []);

    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calcularMetricas = (faturasData: OmieFatura[], emailsData: EmailCobranca[]) => {
    const hoje = new Date();
    const faturasEmAberto = faturasData.filter(f => f.status === 'em_aberto');
    const faturasVencidas = faturasEmAberto.filter(f => 
      isAfter(hoje, new Date(f.data_vencimento))
    );

    setTotalFaturas(faturasData.length);
    setTotalVencidas(faturasVencidas.length);
    setValorEmAberto(faturasEmAberto.reduce((acc, f) => acc + Number(f.valor), 0));
    setEmailsEnviados(emailsData.length);
  };

  const sincronizarOmie = async () => {
    setSincronizando(true);
    try {
      const { data, error } = await supabase.functions.invoke('sincronizar-omie');
      
      if (error) throw error;

      toast({
        title: "Sincronização concluída",
        description: `${data.faturas_sincronizadas} faturas sincronizadas com sucesso`
      });

      await carregarDados();
    } catch (error: any) {
      toast({
        title: "Erro na sincronização",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSincronizando(false);
    }
  };

  const ativarReguaCobranca = async (faturaIds: string[]) => {
    try {
      const { data, error } = await supabase.functions.invoke('ativar-regua-cobranca', {
        body: { faturaIds }
      });

      if (error) throw error;

      toast({
        title: "Régua de cobrança ativada",
        description: `${faturaIds.length} faturas adicionadas à régua de cobrança`
      });

      setFaturasSelecionadas([]);
      await carregarDados();
    } catch (error: any) {
      toast({
        title: "Erro ao ativar régua",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Pago</Badge>;
      case 'em_aberto':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Em Aberto</Badge>;
      case 'cancelado':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDiasVencimento = (dataVencimento: string) => {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const dias = differenceInDays(hoje, vencimento);
    
    if (dias > 0) {
      return <span className="text-red-600 font-medium">{dias} dias em atraso</span>;
    } else if (dias === 0) {
      return <span className="text-yellow-600 font-medium">Vence hoje</span>;
    } else {
      return <span className="text-green-600">Vence em {Math.abs(dias)} dias</span>;
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Régua de Cobrança</h1>
          <p className="text-muted-foreground mt-2">
            Gestão automatizada de cobrança integrada ao Omie
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={sincronizarOmie} 
            disabled={sincronizando}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RotateCcw className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} />
            {sincronizando ? 'Sincronizando...' : 'Sincronizar Omie'}
          </Button>
          <Button onClick={carregarDados} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Faturas</p>
                <p className="text-2xl font-bold">{totalFaturas}</p>
              </div>
              <DollarSign className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Faturas Vencidas</p>
                <p className="text-2xl font-bold text-red-600">{totalVencidas}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor em Aberto</p>
                <p className="text-2xl font-bold">{formatarMoeda(valorEmAberto)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Emails Enviados</p>
                <p className="text-2xl font-bold">{emailsEnviados}</p>
              </div>
              <Mail className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="faturas" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="faturas">Faturas</TabsTrigger>
          <TabsTrigger value="emails">Histórico de Emails</TabsTrigger>
          <TabsTrigger value="configuracao">Configuração</TabsTrigger>
        </TabsList>

        <TabsContent value="faturas" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Faturas do Omie</CardTitle>
                  <CardDescription>
                    Gerencie as faturas e ative a régua de cobrança
                  </CardDescription>
                </div>
                {faturasSelecionadas.length > 0 && (
                  <Button 
                    onClick={() => ativarReguaCobranca(faturasSelecionadas)}
                    className="flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Ativar Régua ({faturasSelecionadas.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input 
                          type="checkbox" 
                          className="rounded"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFaturasSelecionadas(faturas.filter(f => f.status === 'em_aberto').map(f => f.id));
                            } else {
                              setFaturasSelecionadas([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faturas.map((fatura) => (
                      <TableRow key={fatura.id}>
                        <TableCell>
                          {fatura.status === 'em_aberto' && (
                            <input 
                              type="checkbox" 
                              className="rounded"
                              checked={faturasSelecionadas.includes(fatura.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFaturasSelecionadas([...faturasSelecionadas, fatura.id]);
                                } else {
                                  setFaturasSelecionadas(faturasSelecionadas.filter(id => id !== fatura.id));
                                }
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{fatura.numero_fatura}</TableCell>
                        <TableCell>{fatura.cliente_nome}</TableCell>
                        <TableCell>{formatarMoeda(Number(fatura.valor))}</TableCell>
                        <TableCell>
                          {format(new Date(fatura.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{getStatusBadge(fatura.status)}</TableCell>
                        <TableCell>
                          {fatura.status === 'em_aberto' && getDiasVencimento(fatura.data_vencimento)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emails" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Emails</CardTitle>
              <CardDescription>
                Acompanhe todos os emails de cobrança enviados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emails.map((email) => (
                      <TableRow key={email.id}>
                        <TableCell>
                          {format(new Date(email.enviado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{email.cliente_email}</TableCell>
                        <TableCell>{email.assunto}</TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              email.status === 'enviado' 
                                ? 'bg-green-100 text-green-800 hover:bg-green-100'
                                : 'bg-red-100 text-red-800 hover:bg-red-100'
                            }
                          >
                            {email.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuração da Régua</CardTitle>
              <CardDescription>
                Configure os parâmetros da régua de cobrança
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  Para configurar a integração com o Omie, você precisa fornecer suas credenciais da API.
                  Os emails serão enviados automaticamente via Resend.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Máximo de emails por fatura</Label>
                  <Input type="number" defaultValue="10" />
                </div>
                <div className="space-y-2">
                  <Label>Intervalo entre emails (dias)</Label>
                  <Input type="number" defaultValue="1" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Template do email</Label>
                <textarea 
                  className="w-full h-32 p-3 border rounded-md resize-none"
                  placeholder="Digite o template do email de cobrança..."
                  defaultValue="Prezado(a) {cliente_nome},

Identificamos que a fatura {numero_fatura} no valor de {valor} está em aberto desde {data_vencimento}.

Por favor, efetue o pagamento o quanto antes para evitar juros e multas.

Atenciosamente,
Equipe de Cobrança"
                />
              </div>

              <Button className="w-full">
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}