import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FieldMapping {
  source_field: string
  target_field: string
  field_type: string
  is_required: boolean
  order_index: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { templateName, fileType } = await req.json()
    
    console.log('=== SINCRONIZANDO TEMPLATE ===')
    console.log('Template:', templateName)
    console.log('Tipo:', fileType)

    // Buscar mapeamentos ativos ordenados
    const { data: mappings, error: mappingsError } = await supabaseClient
      .from('field_mappings')
      .select('source_field, target_field, field_type, is_required, order_index')
      .eq('template_name', templateName)
      .eq('file_type', fileType)
      .eq('active', true)
      .order('order_index')

    if (mappingsError) {
      console.error('Erro ao buscar mapeamentos:', mappingsError)
      throw mappingsError
    }

    if (!mappings || mappings.length === 0) {
      throw new Error('Nenhum mapeamento encontrado para este template')
    }

    console.log('Mapeamentos encontrados:', mappings.length)

    // Gerar cabeçalho CSV baseado nos source_fields
    const headers = mappings.map((m: FieldMapping) => m.source_field)
    console.log('Cabeçalhos gerados:', headers)

    // Gerar dados de exemplo baseados no tipo de arquivo
    const exampleData = generateExampleData(fileType, mappings as FieldMapping[])
    
    // Criar conteúdo CSV
    const csvContent = [
      headers.join(','),
      ...exampleData.map(row => 
        headers.map(header => {
          const value = row[header] || ''
          // Envolver em aspas se contém vírgula ou espaço
          return value.includes(',') || value.includes(' ') ? `"${value}"` : value
        }).join(',')
      )
    ].join('\n')

    console.log('CSV gerado:', csvContent.substring(0, 200) + '...')

    // Salvar no storage
    const fileName = `template_${fileType}.csv`
    const { error: uploadError } = await supabaseClient.storage
      .from('uploads')
      .upload(`templates/${fileName}`, new Blob([csvContent], { type: 'text/csv' }), {
        upsert: true
      })

    if (uploadError) {
      console.error('Erro ao fazer upload:', uploadError)
      throw uploadError
    }

    console.log('Template sincronizado com sucesso!')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Template sincronizado com sucesso',
        fileName,
        headers,
        exampleRows: exampleData.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Erro:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function generateExampleData(fileType: string, mappings: FieldMapping[]): Record<string, string>[] {
  const examples: Record<string, Record<string, string>[]> = {
    clientes: [
      {
        'nome': 'Hospital São Lucas',
        'email': 'contato@saolucas.com.br',
        'telefone': '(11) 3456-7890',
        'endereco': 'Rua das Flores, 123 - São Paulo/SP',
        'cnpj': '12.345.678/0001-90',
        'ativo': 'true'
      },
      {
        'nome': 'Clínica Vida Plena',
        'email': 'admin@vidaplena.com.br',
        'telefone': '(11) 2345-6789',
        'endereco': 'Av. Paulista, 456 - São Paulo/SP',
        'cnpj': '98.765.432/0001-10',
        'ativo': 'true'
      },
      {
        'nome': 'Centro Médico Norte',
        'email': 'faturamento@centronorte.com.br',
        'telefone': '(11) 4567-8901',
        'endereco': 'Rua Norte, 789 - São Paulo/SP',
        'cnpj': '11.222.333/0001-44',
        'ativo': 'true'
      }
    ],
    medicos: [
      {
        'nome': 'Dr. João Silva',
        'crm': '123456',
        'especialidade': 'Cardiologia',
        'telefone': '(11) 99999-1234',
        'email': 'joao.silva@email.com',
        'ativo': 'true'
      },
      {
        'nome': 'Dra. Maria Santos',
        'crm': '789012',
        'especialidade': 'Radiologia',
        'telefone': '(11) 88888-5678',
        'email': 'maria.santos@email.com',
        'ativo': 'true'
      }
    ],
    exames: [
      {
        'data_exame': '2024-01-15',
        'cliente_nome': 'Hospital São Lucas',
        'medico_nome': 'Dr. João Silva',
        'paciente_nome': 'João da Silva',
        'categoria': 'Cardiologia',
        'especialidade': 'Cardiologia',
        'modalidade': 'Presencial',
        'valor_unitario': '150.00',
        'quantidade': '1'
      }
    ]
  }

  return examples[fileType] || [{}]
}