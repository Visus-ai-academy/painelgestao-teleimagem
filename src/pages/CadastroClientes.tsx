import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FileUpload } from "@/components/FileUpload";
import { Users, Upload, Plus, Search, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Cliente {
  id: string;
  nome: string;
  email: string;
  cnpj?: string;
  endereco?: string;
  contato?: string;
  cod_cliente?: string;
  data_inicio_contrato?: string;
  data_termino_vigencia?: string;
  ativo: boolean;
  status: string;
}

export default function CadastroClientes() {
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [showEditarCliente, setShowEditarCliente] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [clienteData, setClienteData] = useState({
    nome: "",
    email: "",
    cnpj: "",
    endereco: "",
    contato: "",
    cod_cliente: "",
    data_inicio_contrato: "",
    data_termino_vigencia: "",
    ativo: true,
    status: "Ativo"
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setClienteData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Carregar clientes do banco
  const carregarClientes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');

      if (error) throw error;

      setClientes(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar clientes",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarClientes();
  }, []);

  const handleSalvarCliente = async () => {
    // Validação básica
    if (!clienteData.nome || !clienteData.email) {
      toast({
        title: "Erro",
        description: "Nome e email são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('clientes')
        .insert([{...clienteData, status: clienteData.ativo ? 'Ativo' : 'Inativo'}]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cliente cadastrado com sucesso!",
      });
      
      setShowNovoCliente(false);
      setClienteData({
        nome: "",
        email: "",
        cnpj: "",
        endereco: "",
        contato: "",
        cod_cliente: "",
        data_inicio_contrato: "",
        data_termino_vigencia: "",
        ativo: true,
        status: "Ativo"
      });
      
      carregarClientes();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar cliente",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleEditarCliente = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setClienteData({
      nome: cliente.nome,
      email: cliente.email,
      cnpj: cliente.cnpj || "",
      endereco: cliente.endereco || "",
      contato: cliente.contato || "",
      cod_cliente: cliente.cod_cliente || "",
      data_inicio_contrato: cliente.data_inicio_contrato || "",
      data_termino_vigencia: cliente.data_termino_vigencia || "",
      ativo: cliente.ativo,
      status: cliente.status || (cliente.ativo ? "Ativo" : "Inativo")
    });
    setShowEditarCliente(true);
  };

  const handleAtualizarCliente = async () => {
    if (!clienteEditando) return;

    try {
      const { error } = await supabase
        .from('clientes')
        .update(clienteData)
        .eq('id', clienteEditando.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cliente atualizado com sucesso!",
      });
      
      setShowEditarCliente(false);
      setClienteEditando(null);
      carregarClientes();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar cliente",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleInativarCliente = async (cliente: Cliente) => {
    try {
      const novoStatus = cliente.ativo ? 'Inativo' : 'Ativo';
      const { error } = await supabase
        .from('clientes')
        .update({ 
          ativo: !cliente.ativo,
          status: novoStatus
        })
        .eq('id', cliente.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Cliente ${cliente.ativo ? 'inativado' : 'ativado'} com sucesso!`,
      });
      
      carregarClientes();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Cadastro de Clientes</h1>
            <p className="text-muted-foreground">Gerencie o cadastro de clientes do sistema</p>
          </div>
        </div>
      </div>

      {/* Ações e Cadastro Manual */}
      <div className="flex gap-4">
        <Button 
          onClick={() => setShowNovoCliente(!showNovoCliente)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
        
        <FileUpload 
          title="Upload de Clientes"
          description="Selecione um arquivo CSV ou Excel com os dados dos clientes"
          acceptedTypes={['.csv', '.xlsx', '.xls']}
          maxSizeInMB={10}
          expectedFormat={[
            'Nome do cliente',
            'Email do cliente',
            'CNPJ (opcional)',
            'Endereço (opcional)',
            'Contato (opcional)',
            'Código cliente (opcional)',
            'Data início contrato (opcional)',
            'Data término vigência (opcional)',
            'Status ativo (opcional)'
          ]}
          onUpload={async (file: File) => {
            try {
              // 1. Upload do arquivo para o storage
              const fileName = `${Date.now()}-${file.name}`;
              
              const { error: uploadError } = await supabase.storage
                .from('uploads')
                .upload(fileName, file);

              if (uploadError) throw uploadError;

              // 2. Chamar edge function para processar
              const { data, error: processError } = await supabase.functions
                .invoke('processar-importacao-inteligente', {
                  body: { fileName }
                });

              if (processError) throw processError;

              if (data.success) {
                toast({
                  title: "Upload realizado com sucesso!",
                  description: `${data.registros_processados} clientes foram processados.`,
                });
              } else {
                throw new Error(data.error || 'Erro no processamento');
              }
              
              // Recarregar lista de clientes
              carregarClientes();
            } catch (error: any) {
              toast({
                title: "Erro no upload",
                description: error.message,
                variant: "destructive"
              });
            }
          }}
          icon={<Upload className="h-5 w-5" />}
          variant="button"
        />
      </div>

      {/* Formulário de Novo Cliente */}
      {showNovoCliente && (
        <Card>
          <CardHeader>
            <CardTitle>Cadastrar Novo Cliente</CardTitle>
            <CardDescription>
              Preencha os dados do cliente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome*</Label>
                <Input
                  id="nome"
                  value={clienteData.nome}
                  onChange={(e) => handleInputChange("nome", e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email*</Label>
                <Input
                  id="email"
                  type="email"
                  value={clienteData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="email@cliente.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={clienteData.cnpj}
                  onChange={(e) => handleInputChange("cnpj", e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cod_cliente">Código Cliente</Label>
                <Input
                  id="cod_cliente"
                  value={clienteData.cod_cliente}
                  onChange={(e) => handleInputChange("cod_cliente", e.target.value)}
                  placeholder="CLI001"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contato">Contato</Label>
                <Input
                  id="contato"
                  value={clienteData.contato}
                  onChange={(e) => handleInputChange("contato", e.target.value)}
                  placeholder="Nome do contato"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="data_inicio">Data Início Contrato</Label>
                <Input
                  id="data_inicio"
                  type="date"
                  value={clienteData.data_inicio_contrato}
                  onChange={(e) => handleInputChange("data_inicio_contrato", e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="data_fim">Data Término Vigência</Label>
                <Input
                  id="data_fim"
                  type="date"
                  value={clienteData.data_termino_vigencia}
                  onChange={(e) => handleInputChange("data_termino_vigencia", e.target.value)}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="ativo"
                  checked={clienteData.ativo}
                  onCheckedChange={(checked) => handleInputChange("ativo", checked)}
                />
                <Label htmlFor="ativo">Cliente Ativo</Label>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Textarea
                id="endereco"
                value={clienteData.endereco}
                onChange={(e) => handleInputChange("endereco", e.target.value)}
                placeholder="Endereço completo do cliente"
                rows={3}
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSalvarCliente}>
                Salvar Cliente
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowNovoCliente(false)}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Clientes Cadastrados
          </CardTitle>
          <CardDescription>
            Lista dos clientes ativos e inativos do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Carregando clientes...</p>
            </div>
          ) : clientes.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Nenhum cliente cadastrado ainda.</p>
              <p className="text-sm">Use o upload de clientes ou cadastre manualmente.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell className="font-medium">{cliente.nome}</TableCell>
                    <TableCell>{cliente.email}</TableCell>
                    <TableCell>{cliente.cnpj}</TableCell>
                    <TableCell>{cliente.cod_cliente}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={cliente.ativo ? "default" : "destructive"}
                        className={cliente.ativo ? "" : "bg-red-100 text-red-800 border-red-300"}
                      >
                        {cliente.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditarCliente(cliente)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant={cliente.ativo ? "destructive" : "default"}
                              className="h-8 px-2 text-xs"
                            >
                              {cliente.ativo ? "Inativar" : "Ativar"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar {cliente.ativo ? "Inativação" : "Ativação"}</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja {cliente.ativo ? "inativar" : "ativar"} o cliente "{cliente.nome}"?
                                {cliente.ativo && " Esta ação pode afetar contratos e faturamentos ativos."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleInativarCliente(cliente)}>
                                Confirmar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Dialog para editar cliente */}
        <Dialog open={showEditarCliente} onOpenChange={setShowEditarCliente}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Cliente</DialogTitle>
              <DialogDescription>
                Edite os dados do cliente
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-nome">Nome*</Label>
                  <Input
                    id="edit-nome"
                    value={clienteData.nome}
                    onChange={(e) => handleInputChange("nome", e.target.value)}
                    placeholder="Nome do cliente"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email*</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={clienteData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="email@cliente.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-cnpj">CNPJ</Label>
                  <Input
                    id="edit-cnpj"
                    value={clienteData.cnpj}
                    onChange={(e) => handleInputChange("cnpj", e.target.value)}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-cod_cliente">Código Cliente</Label>
                  <Input
                    id="edit-cod_cliente"
                    value={clienteData.cod_cliente}
                    onChange={(e) => handleInputChange("cod_cliente", e.target.value)}
                    placeholder="CLI001"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-ativo"
                    checked={clienteData.ativo}
                    onCheckedChange={(checked) => handleInputChange("ativo", checked)}
                  />
                  <Label htmlFor="edit-ativo">Cliente Ativo</Label>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={handleAtualizarCliente}>
                  Salvar Alterações
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowEditarCliente(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}