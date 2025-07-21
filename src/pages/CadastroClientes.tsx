import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FileUpload } from "@/components/FileUpload";
import { Users, Upload, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

export default function CadastroClientes() {
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [clienteData, setClienteData] = useState({
    nome: "",
    email: "",
    cnpj: "",
    endereco: "",
    contato: "",
    cod_cliente: "",
    data_inicio_contrato: "",
    data_termino_vigencia: "",
    ativo: true
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setClienteData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSalvarCliente = () => {
    // Validação básica
    if (!clienteData.nome || !clienteData.email) {
      toast({
        title: "Erro",
        description: "Nome e email são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    // Aqui será implementada a lógica de salvamento
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
      ativo: true
    });
  };

  const clientesExemplo = [
    {
      id: "1",
      nome: "Hospital São Lucas",
      email: "contato@saolucas.com.br",
      cnpj: "12.345.678/0001-90",
      cod_cliente: "CLI001",
      ativo: true
    },
    {
      id: "2", 
      nome: "Clínica Vida Plena",
      email: "admin@vidaplena.com.br",
      cnpj: "98.765.432/0001-10",
      cod_cliente: "CLI002",
      ativo: true
    }
  ];

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

      {/* Upload de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de Clientes
          </CardTitle>
          <CardDescription>
            Faça upload de uma planilha com os dados dos clientes. Os clientes existentes não serão excluídos.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              // Aqui será implementada a lógica de upload
              console.log('Arquivo selecionado:', file.name);
              // Simular processamento
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              toast({
                title: "Upload realizado com sucesso!",
                description: "Os clientes foram processados.",
              });
            }}
            icon={<Upload className="h-5 w-5" />}
          />
        </CardContent>
      </Card>

      {/* Ações e Cadastro Manual */}
      <div className="flex gap-4">
        <Button 
          onClick={() => setShowNovoCliente(!showNovoCliente)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientesExemplo.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell className="font-medium">{cliente.nome}</TableCell>
                  <TableCell>{cliente.email}</TableCell>
                  <TableCell>{cliente.cnpj}</TableCell>
                  <TableCell>{cliente.cod_cliente}</TableCell>
                  <TableCell>
                    <Badge variant={cliente.ativo ? "default" : "secondary"}>
                      {cliente.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}