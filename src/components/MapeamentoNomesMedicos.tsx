import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertCircle, Check, Link2, Plus, Trash2, X, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Mapeamento {
  id: string;
  nome_origem: string;
  nome_origem_normalizado: string;
  medico_id: string;
  medico_nome: string;
  tipo_origem: string;
  ativo: boolean;
  criado_automaticamente: boolean;
  verificado_manualmente: boolean;
  observacoes: string | null;
}

interface Medico {
  id: string;
  nome: string;
  crm: string | null;
}

export const MapeamentoNomesMedicos = () => {
  const [mapeamentos, setMapeamentos] = useState<Mapeamento[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [nomesNaoMapeados, setNomesNaoMapeados] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    nome_origem: '',
    medico_id: '',
    tipo_origem: 'manual',
    observacoes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Buscar mapeamentos existentes
      const { data: mapData, error: mapError } = await supabase
        .from('mapeamento_nomes_medicos')
        .select('*')
        .eq('ativo', true)
        .order('nome_origem');

      if (mapError) throw mapError;

      // Buscar médicos ativos
      const { data: medData, error: medError } = await supabase
        .from('medicos')
        .select('id, nome, crm')
        .eq('ativo', true)
        .order('nome');

      if (medError) throw medError;

      // Buscar nomes não mapeados dos repasses
      const { data: repasseData, error: repasseError } = await supabase
        .from('medicos_valores_repasse')
        .select('medico_nome_original')
        .is('medico_id', null)
        .not('medico_nome_original', 'is', null);

      if (repasseError) throw repasseError;

      // Extrair nomes únicos não mapeados
      const nomesUnicos = Array.from(
        new Set(
          (repasseData || [])
            .map(r => r.medico_nome_original)
            .filter(n => n && n.trim())
        )
      ).sort();

      setMapeamentos(mapData || []);
      setMedicos(medData || []);
      setNomesNaoMapeados(nomesUnicos);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const medicoSelecionado = medicos.find(m => m.id === formData.medico_id);
      if (!medicoSelecionado) {
        toast.error('Selecione um médico válido');
        return;
      }

      // Normalizar o nome de origem
      const nomeNormalizado = formData.nome_origem
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\bdr\.?\s*/gi, '')
        .replace(/\bdra\.?\s*/gi, '');

      const { error } = await supabase
        .from('mapeamento_nomes_medicos')
        .insert({
          nome_origem: formData.nome_origem.trim(),
          nome_origem_normalizado: nomeNormalizado,
          medico_id: formData.medico_id,
          medico_nome: medicoSelecionado.nome,
          tipo_origem: formData.tipo_origem,
          observacoes: formData.observacoes || null,
          criado_automaticamente: false,
          verificado_manualmente: true
        });

      if (error) throw error;

      toast.success('Mapeamento criado com sucesso!');
      setIsDialogOpen(false);
      setFormData({
        nome_origem: '',
        medico_id: '',
        tipo_origem: 'manual',
        observacoes: ''
      });
      
      await fetchData();
    } catch (error: any) {
      console.error('Erro ao criar mapeamento:', error);
      toast.error(`Erro: ${error.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este mapeamento?')) return;

    try {
      const { error } = await supabase
        .from('mapeamento_nomes_medicos')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;

      toast.success('Mapeamento removido');
      await fetchData();
    } catch (error: any) {
      console.error('Erro ao remover mapeamento:', error);
      toast.error(`Erro: ${error.message}`);
    }
  };

  const aplicarMapeamentoRapido = (nomeOrigem: string) => {
    setFormData({
      ...formData,
      nome_origem: nomeOrigem,
      tipo_origem: 'repasse'
    });
    setIsDialogOpen(true);
  };

  const aplicarMapeamentosExistentes = async () => {
    try {
      setLoading(true);
      toast.info('Aplicando mapeamentos aos repasses existentes...');

      const { data, error } = await supabase.functions.invoke('aplicar-mapeamentos-repasses');

      if (error) throw error;

      if (data.atualizados > 0) {
        toast.success(`${data.atualizados} repasses atualizados com sucesso!`);
      } else {
        toast.info('Nenhum repasse foi atualizado');
      }

      await fetchData();
    } catch (error: any) {
      console.error('Erro ao aplicar mapeamentos:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Mapeamento Manual de Nomes de Médicos
          </CardTitle>
          <CardDescription>
            Associe variações de nomes aos médicos corretos para importações futuras
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> Crie mapeamentos para nomes que aparecem nos arquivos de importação 
              (repasse, volumetria) mas não são encontrados no cadastro de médicos. O sistema usará esses 
              mapeamentos automaticamente nos próximos uploads.
              <br/><br/>
              <strong>💡 Dica:</strong> Após criar mapeamentos, clique em "Aplicar Mapeamentos" para atualizar 
              repasses que já foram importados mas não tinham médico associado.
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Total de mapeamentos ativos: <span className="text-primary">{mapeamentos.length}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Nomes não mapeados em repasses: <span className="text-destructive font-medium">{nomesNaoMapeados.length}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Button 
                onClick={aplicarMapeamentosExistentes} 
                variant="secondary" 
                size="sm"
                disabled={loading || mapeamentos.length === 0}
              >
                <Check className="h-4 w-4 mr-2" />
                Aplicar Mapeamentos
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Mapeamento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Mapeamento</DialogTitle>
                    <DialogDescription>
                      Associe um nome de origem a um médico cadastrado
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="nome_origem">Nome de Origem *</Label>
                      <Input
                        id="nome_origem"
                        value={formData.nome_origem}
                        onChange={(e) => setFormData({ ...formData, nome_origem: e.target.value })}
                        placeholder="Ex: Dr. João Silva"
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Exatamente como aparece no arquivo de importação
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="medico_id">Médico Cadastrado *</Label>
                      <Select
                        value={formData.medico_id}
                        onValueChange={(value) => setFormData({ ...formData, medico_id: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o médico correto" />
                        </SelectTrigger>
                        <SelectContent>
                          {medicos.map((med) => (
                            <SelectItem key={med.id} value={med.id}>
                              {med.nome} {med.crm && `(${med.crm})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="tipo_origem">Tipo de Origem</Label>
                      <Select
                        value={formData.tipo_origem}
                        onValueChange={(value) => setFormData({ ...formData, tipo_origem: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="repasse">Repasse</SelectItem>
                          <SelectItem value="volumetria">Volumetria</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="observacoes">Observações</Label>
                      <Textarea
                        id="observacoes"
                        value={formData.observacoes}
                        onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                        placeholder="Notas sobre este mapeamento"
                        rows={3}
                      />
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">Criar Mapeamento</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Mapeamentos Existentes */}
      <Card>
        <CardHeader>
          <CardTitle>Mapeamentos Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : mapeamentos.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum mapeamento criado ainda. Crie seu primeiro mapeamento para facilitar as importações.
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome de Origem</TableHead>
                  <TableHead>Médico Associado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mapeamentos.map((map) => (
                  <TableRow key={map.id}>
                    <TableCell className="font-medium">{map.nome_origem}</TableCell>
                    <TableCell>{map.medico_nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{map.tipo_origem}</Badge>
                    </TableCell>
                    <TableCell>
                      {map.verificado_manualmente ? (
                        <Badge className="bg-green-500">
                          <Check className="h-3 w-3 mr-1" />
                          Verificado
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Automático</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {map.observacoes || '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(map.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Lista de Nomes Não Mapeados */}
      {nomesNaoMapeados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">
              ⚠️ Nomes Não Mapeados ({nomesNaoMapeados.length})
            </CardTitle>
            <CardDescription>
              Estes nomes aparecem nos repasses mas não foram associados a nenhum médico
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {nomesNaoMapeados.slice(0, 20).map((nome, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">{nome}</span>
                  <Button
                    size="sm"
                    onClick={() => aplicarMapeamentoRapido(nome)}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Mapear
                  </Button>
                </div>
              ))}
              {nomesNaoMapeados.length > 20 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  E mais {nomesNaoMapeados.length - 20} nomes não mapeados...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
