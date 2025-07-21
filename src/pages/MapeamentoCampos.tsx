import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MapeamentoCampos = () => {
  const clientesMappings = [
    { origem: "Cliente (Nome Fantasia)", destino: "nome", tipo: "text", obrigatorio: true },
    { origem: "email", destino: "email", tipo: "text", obrigatorio: false },
    { origem: "cnpj", destino: "cnpj", tipo: "text", obrigatorio: false },
    { origem: "contato", destino: "contato", tipo: "text", obrigatorio: false },
    { origem: "endereço", destino: "endereco", tipo: "text", obrigatorio: false },
    { origem: "Status", destino: "ativo", tipo: "boolean", obrigatorio: false, transformacao: "A=true, I=false" },
    { origem: "data inicio contrato", destino: "data_inicio_contrato", tipo: "date", obrigatorio: false },
    { origem: "data termino de vigência", destino: "data_termino_vigencia", tipo: "date", obrigatorio: false },
    { origem: "cod cliente", destino: "cod_cliente", tipo: "text", obrigatorio: false },
  ];

  const examesMappings = [
    { origem: "Data do Exame", destino: "data_exame", tipo: "date", obrigatorio: true },
    { origem: "Nome do Paciente", destino: "paciente_nome", tipo: "text", obrigatorio: true },
    { origem: "Médico", destino: "medico_id", tipo: "text", obrigatorio: true },
    { origem: "Cliente", destino: "cliente_id", tipo: "text", obrigatorio: true },
    { origem: "Modalidade", destino: "modalidade", tipo: "text", obrigatorio: true },
    { origem: "Especialidade", destino: "especialidade", tipo: "text", obrigatorio: true },
    { origem: "Categoria", destino: "categoria", tipo: "text", obrigatorio: false },
    { origem: "Quantidade", destino: "quantidade", tipo: "number", obrigatorio: true },
    { origem: "Valor Unitário", destino: "valor_unitario", tipo: "number", obrigatorio: true },
  ];

  const medicosMappings = [
    { origem: "Nome", destino: "nome", tipo: "text", obrigatorio: true },
    { origem: "CRM", destino: "crm", tipo: "text", obrigatorio: true },
    { origem: "Especialidade", destino: "especialidade", tipo: "text", obrigatorio: true },
    { origem: "Email", destino: "email", tipo: "text", obrigatorio: false },
    { origem: "Telefone", destino: "telefone", tipo: "text", obrigatorio: false },
    { origem: "Categoria", destino: "categoria", tipo: "text", obrigatorio: false },
    { origem: "Modalidades", destino: "modalidades", tipo: "array", obrigatorio: false },
    { origem: "Status", destino: "ativo", tipo: "boolean", obrigatorio: false, transformacao: "A=true, I=false" },
  ];

  const escalasMappings = [
    { origem: "Data", destino: "data", tipo: "date", obrigatorio: true },
    { origem: "Médico", destino: "medico_id", tipo: "text", obrigatorio: true },
    { origem: "Turno", destino: "turno", tipo: "text", obrigatorio: true },
    { origem: "Modalidade", destino: "modalidade", tipo: "text", obrigatorio: true },
    { origem: "Especialidade", destino: "especialidade", tipo: "text", obrigatorio: true },
    { origem: "Status", destino: "status", tipo: "text", obrigatorio: false },
    { origem: "Observações", destino: "observacoes", tipo: "text", obrigatorio: false },
  ];

  const renderMappingTable = (mappings: any[], title: string, icon: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>📄 Campo no Arquivo</TableHead>
              <TableHead>🗄️ Campo no Banco</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Obrigatório</TableHead>
              <TableHead>Transformação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.map((mapping, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium bg-blue-50">{mapping.origem}</TableCell>
                <TableCell className="bg-green-50">{mapping.destino}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs ${
                    mapping.tipo === 'text' ? 'bg-gray-100 text-gray-800' :
                    mapping.tipo === 'number' ? 'bg-blue-100 text-blue-800' :
                    mapping.tipo === 'date' ? 'bg-purple-100 text-purple-800' :
                    mapping.tipo === 'boolean' ? 'bg-orange-100 text-orange-800' :
                    'bg-indigo-100 text-indigo-800'
                  }`}>
                    {mapping.tipo}
                  </span>
                </TableCell>
                <TableCell>{mapping.obrigatorio ? "✅" : "❌"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {mapping.transformacao || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🔗</span>
            Mapeamento de Campos de Upload
          </CardTitle>
          <CardDescription>
            Visualização dos mapeamentos entre campos dos arquivos de upload (CSV/Excel) e campos das tabelas do banco de dados
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6">
        {renderMappingTable(clientesMappings, "Mapeamento de Clientes", "🏥")}
        {renderMappingTable(examesMappings, "Mapeamento de Exames", "🔬")}
        {renderMappingTable(medicosMappings, "Mapeamento de Médicos", "👨‍⚕️")}
        {renderMappingTable(escalasMappings, "Mapeamento de Escalas", "📅")}

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="text-amber-600 mt-0.5 text-xl">💡</div>
              <div className="text-sm">
                <p className="font-medium text-amber-800 mb-2">Como usar os mapeamentos:</p>
                <ul className="space-y-1 text-amber-700">
                  <li>• Os campos da <strong>esquerda</strong> são os nomes das colunas no seu arquivo CSV/Excel</li>
                  <li>• Os campos da <strong>direita</strong> são os campos correspondentes no banco de dados</li>
                  <li>• Certifique-se de que os nomes das colunas no arquivo coincidam exatamente com os da esquerda</li>
                  <li>• Campos com transformação: Status → ativo (A=true, I=false)</li>
                  <li>• Para configurar novos mapeamentos, use a página "Configuração de Importação"</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MapeamentoCampos;