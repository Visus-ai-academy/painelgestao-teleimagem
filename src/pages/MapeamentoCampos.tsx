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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🏥 Mapeamento de Clientes
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
              {clientesMappings.map((mapping, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium bg-blue-50">{mapping.origem}</TableCell>
                  <TableCell className="bg-green-50">{mapping.destino}</TableCell>
                  <TableCell>{mapping.tipo}</TableCell>
                  <TableCell>{mapping.obrigatorio ? "✅" : "❌"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{mapping.transformacao || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

        {/* Mapeamento de Exames */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔬 Mapeamento de Exames
            </CardTitle>
          </CardHeader>
          <CardContent>
            <lov-mermaid>
{`graph LR
  subgraph "📄 Arquivo CSV/Excel"
    C1["Data do Exame"]
    C2["Nome do Paciente"]
    C3["Médico"]
    C4["Cliente"]
    C5["Modalidade"]
    C6["Especialidade"]
    C7["Categoria"]
    C8["Quantidade"]
    C9["Valor Unitário"]
  end

  subgraph "🗄️ Tabela exames"
    D1["data_exame"]
    D2["paciente_nome"]
    D3["medico_id"]
    D4["cliente_id"]
    D5["modalidade"]
    D6["especialidade"]
    D7["categoria"]
    D8["quantidade"]
    D9["valor_unitario"]
  end

  C1 --> D1
  C2 --> D2
  C3 --> D3
  C4 --> D4
  C5 --> D5
  C6 --> D6
  C7 --> D7
  C8 --> D8
  C9 --> D9

  classDef csvStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px
  classDef dbStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
  
  class C1,C2,C3,C4,C5,C6,C7,C8,C9 csvStyle
  class D1,D2,D3,D4,D5,D6,D7,D8,D9 dbStyle`}
            </lov-mermaid>
          </CardContent>
        </Card>

        {/* Mapeamento de Médicos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              👨‍⚕️ Mapeamento de Médicos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <lov-mermaid>
{`graph LR
  subgraph "📄 Arquivo CSV/Excel"
    E1["Nome"]
    E2["CRM"]
    E3["Especialidade"]
    E4["Email"]
    E5["Telefone"]
    E6["Categoria"]
    E7["Modalidades"]
    E8["Status"]
  end

  subgraph "🗄️ Tabela medicos"
    F1["nome"]
    F2["crm"]
    F3["especialidade"]
    F4["email"]
    F5["telefone"]
    F6["categoria"]
    F7["modalidades"]
    F8["ativo"]
  end

  E1 --> F1
  E2 --> F2
  E3 --> F3
  E4 --> F4
  E5 --> F5
  E6 --> F6
  E7 --> F7
  E8 --> F8

  classDef csvStyle fill:#e0f2f1,stroke:#00695c,stroke-width:2px
  classDef dbStyle fill:#fce4ec,stroke:#c2185b,stroke-width:2px
  
  class E1,E2,E3,E4,E5,E6,E7,E8 csvStyle
  class F1,F2,F3,F4,F5,F6,F7,F8 dbStyle`}
            </lov-mermaid>
          </CardContent>
        </Card>

        {/* Mapeamento de Escalas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📅 Mapeamento de Escalas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <lov-mermaid>
{`graph LR
  subgraph "📄 Arquivo CSV/Excel"
    G1["Data"]
    G2["Médico"]
    G3["Turno"]
    G4["Modalidade"]
    G5["Especialidade"]
    G6["Status"]
    G7["Observações"]
  end

  subgraph "🗄️ Tabela escalas_medicas"
    H1["data"]
    H2["medico_id"]
    H3["turno"]
    H4["modalidade"]
    H5["especialidade"]
    H6["status"]
    H7["observacoes"]
  end

  G1 --> H1
  G2 --> H2
  G3 --> H3
  G4 --> H4
  G5 --> H5
  G6 --> H6
  G7 --> H7

  classDef csvStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
  classDef dbStyle fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
  
  class G1,G2,G3,G4,G5,G6,G7 csvStyle
  class H1,H2,H3,H4,H5,H6,H7 dbStyle`}
            </lov-mermaid>
          </CardContent>
        </Card>

        {/* Dicas de uso */}
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
                  <li>• Campos com transformação: "Status" → "ativo" (A=true, I=false)</li>
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