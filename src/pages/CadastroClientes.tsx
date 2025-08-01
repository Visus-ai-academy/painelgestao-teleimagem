import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FileUpload } from "@/components/FileUpload";
import { Users, Upload, Plus, Search, Edit, Trash2, Filter, ArrowUpDown, ArrowUp, ArrowDown, FileText, Building, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useClienteStats } from "@/hooks/useClienteStats";

interface Cliente {
  id: string;
  nome: string;
  email: string;
  cnpj?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  contato?: string;
  cod_cliente?: string;
  data_inicio_contrato?: string;
  data_termino_vigencia?: string;
  ativo: boolean;
  status: string;
  tipo_cliente?: string;
}

export default function CadastroClientes() {
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [showEditarCliente, setShowEditarCliente] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Hook para estatísticas detalhadas
  const { stats, loading: loadingStats, refreshStats } = useClienteStats();
  
  // Estados para busca, filtro e ordenação
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [ordenacao, setOrdenacao] = useState<{campo: keyof Cliente, direcao: 'asc' | 'desc'}>({
    campo: 'nome',
    direcao: 'asc'
  });
  
  const [clienteData, setClienteData] = useState({
    nome: "",
    email: "",
    cnpj: "",
    endereco: "",
    cidade: "",
    estado: "",
    contato: "",
    cod_cliente: "",
    data_inicio_contrato: "",
    data_termino_vigencia: "",
    tipo_cliente: "",
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
      const dadosParaSalvar = {
        ...clienteData,
        status: clienteData.ativo ? 'Ativo' : 'Inativo',
        data_inicio_contrato: clienteData.data_inicio_contrato || null,
        data_termino_vigencia: clienteData.data_termino_vigencia || null
      };
      
      const { error } = await supabase
        .from('clientes')
        .insert([dadosParaSalvar]);

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
        cidade: "",
        estado: "",
        contato: "",
        cod_cliente: "",
        data_inicio_contrato: "",
        data_termino_vigencia: "",
        tipo_cliente: "",
        ativo: true,
        status: "Ativo"
      });
      
      carregarClientes();
      refreshStats();
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
      cidade: cliente.cidade || "",
      estado: cliente.estado || "",
      contato: cliente.contato || "",
      cod_cliente: cliente.cod_cliente || "",
      data_inicio_contrato: cliente.data_inicio_contrato || "",
      data_termino_vigencia: cliente.data_termino_vigencia || "",
      tipo_cliente: cliente.tipo_cliente || "",
      ativo: cliente.ativo,
      status: cliente.status || (cliente.ativo ? "Ativo" : "Inativo")
    });
    setShowEditarCliente(true);
  };

  const handleAtualizarCliente = async () => {
    if (!clienteEditando) return;

    try {
      const dadosParaAtualizar = {
        ...clienteData,
        status: clienteData.ativo ? 'Ativo' : 'Inativo',
        data_inicio_contrato: clienteData.data_inicio_contrato || null,
        data_termino_vigencia: clienteData.data_termino_vigencia || null
      };
      
      const { error } = await supabase
        .from('clientes')
        .update(dadosParaAtualizar)
        .eq('id', clienteEditando.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cliente atualizado com sucesso!",
      });
      
      setShowEditarCliente(false);
      setClienteEditando(null);
      carregarClientes();
      refreshStats();
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
      refreshStats();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Função para alterar ordenação
  const handleOrdenacao = (campo: keyof Cliente) => {
    setOrdenacao(prev => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Clientes filtrados e ordenados
  const clientesFiltrados = useMemo(() => {
    let resultado = [...clientes];

    // Aplicar busca
    if (busca.trim()) {
      const buscaLower = busca.toLowerCase().trim();
      resultado = resultado.filter(cliente =>
        cliente.nome?.toLowerCase().includes(buscaLower) ||
        cliente.email?.toLowerCase().includes(buscaLower) ||
        cliente.cnpj?.toLowerCase().includes(buscaLower) ||
        cliente.cod_cliente?.toLowerCase().includes(buscaLower) ||
        cliente.contato?.toLowerCase().includes(buscaLower)
      );
    }

    // Aplicar filtro de status
    if (filtroStatus !== 'todos') {
      if (filtroStatus === 'ativo') {
        resultado = resultado.filter(cliente => cliente.ativo === true);
      } else if (filtroStatus === 'inativo') {
        resultado = resultado.filter(cliente => cliente.ativo === false);
      }
    }

    // Aplicar ordenação
    resultado.sort((a, b) => {
      let valorA = a[ordenacao.campo];
      let valorB = b[ordenacao.campo];

      // Tratar valores nulos/undefined
      if (valorA === null || valorA === undefined) valorA = '';
      if (valorB === null || valorB === undefined) valorB = '';

      // Converter para string para comparação
      const strA = String(valorA).toLowerCase();
      const strB = String(valorB).toLowerCase();

      if (ordenacao.direcao === 'asc') {
        return strA.localeCompare(strB);
      } else {
        return strB.localeCompare(strA);
      }
    });

    return resultado;
  }, [clientes, busca, filtroStatus, ordenacao]);

  // Função para renderizar ícone de ordenação
  const renderIconeOrdenacao = (campo: keyof Cliente) => {
    if (ordenacao.campo !== campo) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    return ordenacao.direcao === 'asc' ? 
      <ArrowUp className="h-4 w-4 text-primary" /> : 
      <ArrowDown className="h-4 w-4 text-primary" />;
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
              
              // Recarregar lista de clientes e estatísticas
              carregarClientes();
              refreshStats();
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
                <Label htmlFor="nome" className="text-sm font-semibold text-foreground">Nome*</Label>
                <Input
                  id="nome"
                  value={clienteData.nome}
                  onChange={(e) => handleInputChange("nome", e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-foreground">Email*</Label>
                <Input
                  id="email"
                  type="email"
                  value={clienteData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="email@cliente.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cnpj" className="text-sm font-semibold text-foreground">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={clienteData.cnpj}
                  onChange={(e) => handleInputChange("cnpj", e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cod_cliente" className="text-sm font-semibold text-foreground">Código Cliente</Label>
                <Input
                  id="cod_cliente"
                  value={clienteData.cod_cliente}
                  onChange={(e) => handleInputChange("cod_cliente", e.target.value)}
                  placeholder="CLI001"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cidade" className="text-sm font-semibold text-foreground">Cidade</Label>
                <Input
                  id="cidade"
                  value={clienteData.cidade}
                  onChange={(e) => handleInputChange("cidade", e.target.value)}
                  placeholder="São Paulo"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="estado" className="text-sm font-semibold text-foreground">Estado</Label>
                <Input
                  id="estado"
                  value={clienteData.estado}
                  onChange={(e) => handleInputChange("estado", e.target.value)}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
              
               <div className="space-y-2">
                 <Label htmlFor="contato" className="text-sm font-semibold text-foreground">Contato</Label>
                 <Input
                   id="contato"
                   value={clienteData.contato}
                   onChange={(e) => handleInputChange("contato", e.target.value)}
                   placeholder="Nome do contato"
                 />
               </div>

               <div className="space-y-2">
                 <Label htmlFor="tipo_cliente" className="text-sm font-semibold text-foreground">Tipo Cliente</Label>
                 <Select value={clienteData.tipo_cliente} onValueChange={(value) => handleInputChange("tipo_cliente", value)}>
                   <SelectTrigger>
                     <SelectValue placeholder="Selecione o tipo" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="CO">CO - Cliente Operacional</SelectItem>
                     <SelectItem value="NC">NC - Não Contratual</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               
               <div className="space-y-2">
                 <Label htmlFor="data_inicio" className="text-sm font-semibold text-foreground">Data Início Contrato</Label>
                 <Input
                   id="data_inicio"
                   type="date"
                   value={clienteData.data_inicio_contrato}
                   onChange={(e) => handleInputChange("data_inicio_contrato", e.target.value)}
                 />
               </div>
              
              <div className="space-y-2">
                <Label htmlFor="data_fim" className="text-sm font-semibold text-foreground">Data Término Vigência</Label>
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
                <Label htmlFor="ativo" className="text-sm font-semibold text-foreground">Cliente Ativo</Label>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endereco" className="text-sm font-semibold text-foreground">Endereço</Label>
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
          
          {/* Estatísticas Detalhadas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
              <Users className="h-4 w-4 text-blue-600" />
              <div className="text-left">
                <div className="text-sm font-medium text-blue-700">Total Registros</div>
                <div className="text-xs text-blue-600">
                  {loadingStats ? "..." : stats.totalRegistros}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
              <FileText className="h-4 w-4 text-green-600" />
              <div className="text-left">
                <div className="text-sm font-medium text-green-700">NOME_MOBILEMED</div>
                <div className="text-xs text-green-600">
                  {loadingStats ? "..." : stats.totalNomeMobilemed}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-md">
              <Building className="h-4 w-4 text-purple-600" />
              <div className="text-left">
                <div className="text-sm font-medium text-purple-700">CNPJs Únicos</div>
                <div className="text-xs text-purple-600">
                  {loadingStats ? "..." : stats.totalCnpjUnicos}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-md">
              <Mail className="h-4 w-4 text-orange-600" />
              <div className="text-left">
                <div className="text-sm font-medium text-orange-700">Nome_Fantasia</div>
                <div className="text-xs text-orange-600">
                  {loadingStats ? "..." : stats.totalNomeFantasia}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-2 bg-cyan-50 border border-cyan-200 rounded-md">
              <div className="w-3 h-3 bg-cyan-600 rounded-full"></div>
              <div className="text-left">
                <div className="text-sm font-medium text-cyan-700">Tipo CO</div>
                <div className="text-xs text-cyan-600">
                  {loadingStats ? "..." : stats.tipoClienteCO}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-2 bg-pink-50 border border-pink-200 rounded-md">
              <div className="w-3 h-3 bg-pink-600 rounded-full"></div>
              <div className="text-left">
                <div className="text-sm font-medium text-pink-700">Tipo NC</div>
                <div className="text-xs text-pink-600">
                  {loadingStats ? "..." : stats.tipoClienteNC}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Controles de Busca e Filtro */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por nome, email, CNPJ ou código..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os clientes</SelectItem>
                  <SelectItem value="ativo">Apenas ativos</SelectItem>
                  <SelectItem value="inativo">Apenas inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="mb-4 text-sm text-muted-foreground">
            Exibindo {clientesFiltrados.length} de {clientes.length} clientes
            {busca && ` | Busca: "${busca}"`}
            {filtroStatus !== 'todos' && ` | Filtro: ${filtroStatus === 'ativo' ? 'Ativos' : 'Inativos'}`}
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Carregando clientes...</p>
            </div>
          ) : clientes.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Nenhum cliente cadastrado ainda.</p>
              <p className="text-sm">Use o upload de clientes ou cadastre manualmente.</p>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Nenhum cliente encontrado com os filtros aplicados.</p>
              <p className="text-sm">Tente alterar os critérios de busca ou filtro.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleOrdenacao('nome')}
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Nome Mobilemed
                      {renderIconeOrdenacao('nome')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleOrdenacao('cnpj')}
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      CNPJ
                      {renderIconeOrdenacao('cnpj')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleOrdenacao('email')}
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      E-mail Envio NF
                      {renderIconeOrdenacao('email')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleOrdenacao('contato')}
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Nome Fantasia
                      {renderIconeOrdenacao('contato')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleOrdenacao('cidade')}
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Cidade
                      {renderIconeOrdenacao('cidade')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleOrdenacao('estado')}
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Estado
                      {renderIconeOrdenacao('estado')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleOrdenacao('tipo_cliente')}
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Tipo Cliente
                      {renderIconeOrdenacao('tipo_cliente')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleOrdenacao('status')}
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Status
                      {renderIconeOrdenacao('status')}
                    </Button>
                  </TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesFiltrados.map((cliente) => (
                   <TableRow key={cliente.id}>
                     <TableCell className="font-medium">{cliente.nome}</TableCell>
                     <TableCell>{cliente.cnpj}</TableCell>
                     <TableCell>{cliente.email}</TableCell>
                     <TableCell>{cliente.contato || "-"}</TableCell>
                     <TableCell>{cliente.cidade || "-"}</TableCell>
                     <TableCell>{cliente.estado || "-"}</TableCell>
                     <TableCell>
                       <Badge 
                         variant={cliente.tipo_cliente === 'CO' ? "default" : "secondary"}
                         className={
                           cliente.tipo_cliente === 'CO'
                             ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200" 
                             : "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200"
                         }
                       >
                         {cliente.tipo_cliente || "-"}
                       </Badge>
                     </TableCell>
                     <TableCell>
                      <Badge 
                        variant={cliente.ativo ? "default" : "destructive"}
                        className={
                          cliente.ativo 
                            ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200" 
                            : "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
                        }
                      >
                        {cliente.status || (cliente.ativo ? "Ativo" : "Inativo")}
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
                  <Label htmlFor="edit-nome" className="text-sm font-semibold text-foreground">Nome*</Label>
                  <Input
                    id="edit-nome"
                    value={clienteData.nome}
                    onChange={(e) => handleInputChange("nome", e.target.value)}
                    placeholder="Nome do cliente"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-email" className="text-sm font-semibold text-foreground">Email*</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={clienteData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="email@cliente.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-cnpj" className="text-sm font-semibold text-foreground">CNPJ</Label>
                  <Input
                    id="edit-cnpj"
                    value={clienteData.cnpj}
                    onChange={(e) => handleInputChange("cnpj", e.target.value)}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-cod_cliente" className="text-sm font-semibold text-foreground">Código Cliente</Label>
                  <Input
                    id="edit-cod_cliente"
                    value={clienteData.cod_cliente}
                    onChange={(e) => handleInputChange("cod_cliente", e.target.value)}
                    placeholder="CLI001"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-cidade" className="text-sm font-semibold text-foreground">Cidade</Label>
                  <Input
                    id="edit-cidade"
                    value={clienteData.cidade}
                    onChange={(e) => handleInputChange("cidade", e.target.value)}
                    placeholder="São Paulo"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-estado" className="text-sm font-semibold text-foreground">Estado</Label>
                  <Input
                    id="edit-estado"
                    value={clienteData.estado}
                    onChange={(e) => handleInputChange("estado", e.target.value)}
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
                
                 <div className="space-y-2">
                   <Label htmlFor="edit-contato" className="text-sm font-semibold text-foreground">Contato</Label>
                   <Input
                     id="edit-contato"
                     value={clienteData.contato}
                     onChange={(e) => handleInputChange("contato", e.target.value)}
                     placeholder="Nome do contato"
                   />
                 </div>

                 <div className="space-y-2">
                   <Label htmlFor="edit-tipo_cliente" className="text-sm font-semibold text-foreground">Tipo Cliente</Label>
                   <Select value={clienteData.tipo_cliente} onValueChange={(value) => handleInputChange("tipo_cliente", value)}>
                     <SelectTrigger>
                       <SelectValue placeholder="Selecione o tipo" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="CO">CO - Cliente Operacional</SelectItem>
                       <SelectItem value="NC">NC - Não Contratual</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 
                 <div className="space-y-2">
                   <Label htmlFor="edit-endereco" className="text-sm font-semibold text-foreground">Endereço</Label>
                   <Textarea
                     id="edit-endereco"
                     value={clienteData.endereco}
                     onChange={(e) => handleInputChange("endereco", e.target.value)}
                     placeholder="Endereço completo do cliente"
                     rows={3}
                   />
                 </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-ativo"
                    checked={clienteData.ativo}
                    onCheckedChange={(checked) => handleInputChange("ativo", checked)}
                  />
                  <Label htmlFor="edit-ativo" className="text-sm font-semibold text-foreground">Cliente Ativo</Label>
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