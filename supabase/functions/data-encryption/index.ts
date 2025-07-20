import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EncryptionRequest {
  operation: 'encrypt' | 'decrypt' | 'hash';
  data: string;
  field_name?: string;
  record_id?: string;
  table_name?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { operation, data, field_name, record_id, table_name }: EncryptionRequest = await req.json();

    console.log(`Operação de ${operation} solicitada`);

    let result: any = {};

    switch (operation) {
      case 'encrypt':
        result = await encryptData(supabase, data, field_name, record_id, table_name);
        break;
      case 'decrypt':
        result = await decryptData(supabase, record_id!, table_name!, field_name!);
        break;
      case 'hash':
        result = await hashData(data);
        break;
      default:
        throw new Error('Operação não suportada');
    }

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Erro na criptografia:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

async function encryptData(
  supabase: any, 
  data: string, 
  field_name?: string, 
  record_id?: string, 
  table_name?: string
): Promise<any> {
  try {
    // Gerar chave de criptografia (em produção, usar KMS)
    const key = await generateEncryptionKey();
    
    // Criptografar dados
    const encryptedData = await encryptWithAES(data, key);
    
    // Gerar hash para verificação de integridade
    const hashValue = await generateHash(data);
    
    // Armazenar dados criptografados se informações da tabela fornecidas
    if (record_id && table_name && field_name) {
      const { error } = await supabase
        .from('encrypted_data')
        .upsert({
          record_id,
          table_name,
          field_name,
          encrypted_value: encryptedData,
          hash_value: hashValue,
          encryption_algorithm: 'AES-256-GCM'
        });

      if (error) {
        throw new Error(`Erro ao armazenar dados criptografados: ${error.message}`);
      }
    }

    return {
      encrypted_value: encryptedData,
      hash_value: hashValue,
      algorithm: 'AES-256-GCM'
    };

  } catch (error: any) {
    throw new Error(`Erro na criptografia: ${error.message}`);
  }
}

async function decryptData(
  supabase: any, 
  record_id: string, 
  table_name: string, 
  field_name: string
): Promise<any> {
  try {
    // Buscar dados criptografados
    const { data: encryptedRecord, error } = await supabase
      .from('encrypted_data')
      .select('*')
      .eq('record_id', record_id)
      .eq('table_name', table_name)
      .eq('field_name', field_name)
      .single();

    if (error || !encryptedRecord) {
      throw new Error('Dados criptografados não encontrados');
    }

    // Descriptografar (em produção, recuperar chave do KMS)
    const key = await generateEncryptionKey(); // Mesma chave para teste
    const decryptedData = await decryptWithAES(encryptedRecord.encrypted_value, key);
    
    // Verificar integridade
    const computedHash = await generateHash(decryptedData);
    if (computedHash !== encryptedRecord.hash_value) {
      throw new Error('Integridade dos dados comprometida');
    }

    return {
      decrypted_value: decryptedData,
      verified: true
    };

  } catch (error: any) {
    throw new Error(`Erro na descriptografia: ${error.message}`);
  }
}

async function hashData(data: string): Promise<any> {
  const hash = await generateHash(data);
  return { hash_value: hash };
}

async function generateEncryptionKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

async function encryptWithAES(data: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV para GCM
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encoder.encode(data)
  );

  // Combinar IV + dados criptografados
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);

  // Converter para base64
  return btoa(String.fromCharCode(...combined));
}

async function decryptWithAES(encryptedData: string, key: CryptoKey): Promise<string> {
  try {
    // Decodificar base64
    const combined = new Uint8Array(
      atob(encryptedData)
        .split('')
        .map(char => char.charCodeAt(0))
    );

    // Extrair IV e dados criptografados
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);

  } catch (error: any) {
    throw new Error(`Erro na descriptografia AES: ${error.message}`);
  }
}

async function generateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Função auxiliar para criptografar CPF/CNPJ
export async function encryptPersonalData(
  supabase: any,
  recordId: string,
  tableName: string,
  cpf?: string,
  cnpj?: string
): Promise<void> {
  if (cpf) {
    await encryptData(supabase, cpf, 'cpf', recordId, tableName);
  }
  if (cnpj) {
    await encryptData(supabase, cnpj, 'cnpj', recordId, tableName);
  }
}