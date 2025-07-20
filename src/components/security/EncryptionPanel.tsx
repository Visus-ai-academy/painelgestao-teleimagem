import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, Lock, Unlock, Eye, EyeOff, Hash, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EncryptedData {
  id: string;
  record_id: string;
  table_name: string;
  field_name: string;
  encrypted_value: string;
  hash_value: string;
  encryption_algorithm: string;
  created_at: string;
}

export function EncryptionPanel() {
  const [encryptedRecords, setEncryptedRecords] = useState<EncryptedData[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Estados para criptografia
  const [dataToEncrypt, setDataToEncrypt] = useState('');
  const [encryptResult, setEncryptResult] = useState<any>(null);
  
  // Estados para descriptografia
  const [recordId, setRecordId] = useState('');
  const [tableName, setTableName] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [decryptResult, setDecryptResult] = useState<any>(null);
  
  // Estados para hash
  const [dataToHash, setDataToHash] = useState('');
  const [hashResult, setHashResult] = useState<any>(null);
  
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadEncryptedData();
  }, []);

  const loadEncryptedData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('encrypted_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setEncryptedRecords(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados criptografados:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados criptografados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const encryptData = async () => {
    if (!dataToEncrypt.trim()) {
      toast({
        title: "Erro",
        description: "Digite os dados para criptografar",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessing(true);
      const { data, error } = await supabase.functions.invoke('data-encryption', {
        body: {
          operation: 'encrypt',
          data: dataToEncrypt
        }
      });

      if (error) throw error;

      setEncryptResult(data);
      toast({
        title: "Dados Criptografados",
        description: "Dados criptografados com sucesso usando AES-256-GCM",
      });

    } catch (error: any) {
      console.error('Erro ao criptografar:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao criptografar dados",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const decryptData = async () => {
    if (!recordId || !tableName || !fieldName) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos para descriptografar",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessing(true);
      const { data, error } = await supabase.functions.invoke('data-encryption', {
        body: {
          operation: 'decrypt',
          record_id: recordId,
          table_name: tableName,
          field_name: fieldName
        }
      });

      if (error) throw error;

      setDecryptResult(data);
      toast({
        title: "Dados Descriptografados",
        description: "Dados descriptografados e verificados com sucesso",
      });

    } catch (error: any) {
      console.error('Erro ao descriptografar:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao descriptografar dados",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const generateHash = async () => {
    if (!dataToHash.trim()) {
      toast({
        title: "Erro",
        description: "Digite os dados para gerar hash",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessing(true);
      const { data, error } = await supabase.functions.invoke('data-encryption', {
        body: {
          operation: 'hash',
          data: dataToHash
        }
      });

      if (error) throw error;

      setHashResult(data);
      toast({
        title: "Hash Gerado",
        description: "Hash SHA-256 gerado com sucesso",
      });

    } catch (error: any) {
      console.error('Erro ao gerar hash:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao gerar hash",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: "Texto copiado para a área de transferência",
    });
  };

  const maskData = (data: string) => {
    if (!showSensitiveData && data.length > 10) {
      return data.substring(0, 6) + '***' + data.substring(data.length - 4);
    }
    return data;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Criptografia de Dados
        </CardTitle>
        <CardDescription>
          Ferramentas para criptografia, descriptografia e hash de dados sensíveis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="encrypt" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="encrypt">Criptografar</TabsTrigger>
            <TabsTrigger value="decrypt">Descriptografar</TabsTrigger>
            <TabsTrigger value="hash">Hash</TabsTrigger>
            <TabsTrigger value="records">Registros</TabsTrigger>
          </TabsList>

          <TabsContent value="encrypt" className="space-y-4">
            <div className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Use AES-256-GCM para criptografar dados pessoais sensíveis como CPF, CNPJ e informações médicas.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="data-encrypt">Dados para Criptografar</Label>
                <Textarea
                  id="data-encrypt"
                  placeholder="Digite os dados sensíveis aqui..."
                  value={dataToEncrypt}
                  onChange={(e) => setDataToEncrypt(e.target.value)}
                  rows={4}
                />
              </div>

              <Button onClick={encryptData} disabled={processing} className="w-full">
                <Lock className="h-4 w-4 mr-2" />
                {processing ? 'Criptografando...' : 'Criptografar Dados'}
              </Button>

              {encryptResult && (
                <div className="space-y-4 p-4 border rounded bg-muted">
                  <h4 className="font-semibold">Resultado da Criptografia</h4>
                  
                  <div className="space-y-2">
                    <Label>Dados Criptografados (AES-256-GCM)</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={encryptResult.encrypted_value} 
                        readOnly 
                        className="font-mono text-xs"
                      />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyToClipboard(encryptResult.encrypted_value)}
                      >
                        Copiar
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Hash de Verificação (SHA-256)</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={encryptResult.hash_value} 
                        readOnly 
                        className="font-mono text-xs"
                      />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyToClipboard(encryptResult.hash_value)}
                      >
                        Copiar
                      </Button>
                    </div>
                  </div>

                  <Badge variant="secondary">
                    Algoritmo: {encryptResult.algorithm}
                  </Badge>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="decrypt" className="space-y-4">
            <div className="space-y-4">
              <Alert>
                <Unlock className="h-4 w-4" />
                <AlertDescription>
                  Descriptografe dados armazenados fornecendo as informações do registro.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="record-id">ID do Registro</Label>
                  <Input
                    id="record-id"
                    placeholder="UUID do registro"
                    value={recordId}
                    onChange={(e) => setRecordId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="table-name">Nome da Tabela</Label>
                  <Input
                    id="table-name"
                    placeholder="ex: clientes"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field-name">Nome do Campo</Label>
                  <Input
                    id="field-name"
                    placeholder="ex: cpf"
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={decryptData} disabled={processing} className="w-full">
                <Unlock className="h-4 w-4 mr-2" />
                {processing ? 'Descriptografando...' : 'Descriptografar Dados'}
              </Button>

              {decryptResult && (
                <div className="space-y-4 p-4 border rounded bg-muted">
                  <h4 className="font-semibold">Resultado da Descriptografia</h4>
                  
                  <div className="space-y-2">
                    <Label>Dados Descriptografados</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={decryptResult.decrypted_value} 
                        readOnly 
                        className="font-mono"
                      />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyToClipboard(decryptResult.decrypted_value)}
                      >
                        Copiar
                      </Button>
                    </div>
                  </div>

                  <Badge variant={decryptResult.verified ? 'default' : 'destructive'}>
                    {decryptResult.verified ? 'Integridade Verificada' : 'Integridade Comprometida'}
                  </Badge>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="hash" className="space-y-4">
            <div className="space-y-4">
              <Alert>
                <Hash className="h-4 w-4" />
                <AlertDescription>
                  Gere hash SHA-256 para verificação de integridade ou pseudonimização de dados.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="data-hash">Dados para Hash</Label>
                <Textarea
                  id="data-hash"
                  placeholder="Digite os dados para gerar hash..."
                  value={dataToHash}
                  onChange={(e) => setDataToHash(e.target.value)}
                  rows={4}
                />
              </div>

              <Button onClick={generateHash} disabled={processing} className="w-full">
                <Hash className="h-4 w-4 mr-2" />
                {processing ? 'Gerando Hash...' : 'Gerar Hash SHA-256'}
              </Button>

              {hashResult && (
                <div className="space-y-4 p-4 border rounded bg-muted">
                  <h4 className="font-semibold">Hash Gerado</h4>
                  
                  <div className="space-y-2">
                    <Label>Hash SHA-256</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={hashResult.hash_value} 
                        readOnly 
                        className="font-mono text-xs"
                      />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyToClipboard(hashResult.hash_value)}
                      >
                        Copiar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="records" className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Registros Criptografados</h4>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSensitiveData(!showSensitiveData)}
                >
                  {showSensitiveData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showSensitiveData ? 'Ocultar' : 'Mostrar'}
                </Button>
                <Button variant="outline" size="sm" onClick={loadEncryptedData}>
                  Atualizar
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">Carregando registros...</div>
            ) : encryptedRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum registro criptografado encontrado
              </div>
            ) : (
              <div className="space-y-4">
                {encryptedRecords.map((record) => (
                  <div key={record.id} className="border rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Tabela/Campo</Label>
                        <p className="font-mono text-sm">{record.table_name}.{record.field_name}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">ID do Registro</Label>
                        <p className="font-mono text-sm">{record.record_id}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Dados Criptografados</Label>
                        <p className="font-mono text-xs break-all">
                          {maskData(record.encrypted_value)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Hash de Verificação</Label>
                        <p className="font-mono text-xs break-all">
                          {maskData(record.hash_value)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <Badge variant="outline">{record.encryption_algorithm}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(record.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}