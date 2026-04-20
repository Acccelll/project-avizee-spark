export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_configuracoes: {
        Row: {
          chave: string
          created_at: string
          id: string
          updated_at: string
          valor: Json | null
        }
        Insert: {
          chave: string
          created_at?: string
          id?: string
          updated_at?: string
          valor?: Json | null
        }
        Update: {
          chave?: string
          created_at?: string
          id?: string
          updated_at?: string
          valor?: Json | null
        }
        Relationships: []
      }
      apresentacao_comentarios: {
        Row: {
          comentario_automatico: string | null
          comentario_manual: string | null
          created_at: string
          geracao_id: string
          id: string
          slide_codigo: string
          updated_at: string
        }
        Insert: {
          comentario_automatico?: string | null
          comentario_manual?: string | null
          created_at?: string
          geracao_id: string
          id?: string
          slide_codigo: string
          updated_at?: string
        }
        Update: {
          comentario_automatico?: string | null
          comentario_manual?: string | null
          created_at?: string
          geracao_id?: string
          id?: string
          slide_codigo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apresentacao_comentarios_geracao_id_fkey"
            columns: ["geracao_id"]
            isOneToOne: false
            referencedRelation: "apresentacao_geracoes"
            referencedColumns: ["id"]
          },
        ]
      }
      apresentacao_geracoes: {
        Row: {
          arquivo_path: string | null
          competencia_final: string | null
          competencia_inicial: string | null
          created_at: string
          gerado_por: string | null
          hash_geracao: string | null
          id: string
          modo_geracao: string
          observacoes: string | null
          parametros_json: Json | null
          slides_json: Json | null
          status: string
          status_editorial: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          arquivo_path?: string | null
          competencia_final?: string | null
          competencia_inicial?: string | null
          created_at?: string
          gerado_por?: string | null
          hash_geracao?: string | null
          id?: string
          modo_geracao?: string
          observacoes?: string | null
          parametros_json?: Json | null
          slides_json?: Json | null
          status?: string
          status_editorial?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_path?: string | null
          competencia_final?: string | null
          competencia_inicial?: string | null
          created_at?: string
          gerado_por?: string | null
          hash_geracao?: string | null
          id?: string
          modo_geracao?: string
          observacoes?: string | null
          parametros_json?: Json | null
          slides_json?: Json | null
          status?: string
          status_editorial?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apresentacao_geracoes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "apresentacao_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      apresentacao_templates: {
        Row: {
          arquivo_path: string | null
          ativo: boolean
          codigo: string
          config_json: Json | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
          versao: string
        }
        Insert: {
          arquivo_path?: string | null
          ativo?: boolean
          codigo: string
          config_json?: Json | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
          versao?: string
        }
        Update: {
          arquivo_path?: string | null
          ativo?: boolean
          codigo?: string
          config_json?: Json | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
          versao?: string
        }
        Relationships: []
      }
      auditoria_logs: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          ip_address: string | null
          registro_id: string | null
          tabela: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip_address?: string | null
          registro_id?: string | null
          tabela: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip_address?: string | null
          registro_id?: string | null
          tabela?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      bancos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          tipo: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          tipo?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          tipo?: string | null
        }
        Relationships: []
      }
      cadastros_pendencias_migracao: {
        Row: {
          campo: string | null
          created_at: string
          entidade: string
          entidade_id: string | null
          id: string
          motivo: string
          valor_origem: string | null
        }
        Insert: {
          campo?: string | null
          created_at?: string
          entidade: string
          entidade_id?: string | null
          id?: string
          motivo: string
          valor_origem?: string | null
        }
        Update: {
          campo?: string | null
          created_at?: string
          entidade?: string
          entidade_id?: string | null
          id?: string
          motivo?: string
          valor_origem?: string | null
        }
        Relationships: []
      }
      caixa_movimentos: {
        Row: {
          conta_bancaria_id: string | null
          created_at: string
          descricao: string | null
          forma_pagamento: string | null
          id: string
          saldo_anterior: number | null
          saldo_atual: number | null
          tipo: string
          valor: number
        }
        Insert: {
          conta_bancaria_id?: string | null
          created_at?: string
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          saldo_anterior?: number | null
          saldo_atual?: number | null
          tipo: string
          valor: number
        }
        Update: {
          conta_bancaria_id?: string | null
          created_at?: string
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          saldo_anterior?: number | null
          saldo_atual?: number | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "caixa_movimentos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_movimentos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_bancos_saldo"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_registros_comunicacao: {
        Row: {
          assunto: string | null
          cliente_id: string
          conteudo: string | null
          created_at: string
          data_hora: string | null
          data_registro: string
          id: string
          responsavel_id: string | null
          responsavel_nome: string | null
          retorno_previsto: string | null
          status: string | null
          tipo: string | null
        }
        Insert: {
          assunto?: string | null
          cliente_id: string
          conteudo?: string | null
          created_at?: string
          data_hora?: string | null
          data_registro?: string
          id?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          retorno_previsto?: string | null
          status?: string | null
          tipo?: string | null
        }
        Update: {
          assunto?: string | null
          cliente_id?: string
          conteudo?: string | null
          created_at?: string
          data_hora?: string | null
          data_registro?: string
          id?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          retorno_previsto?: string | null
          status?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_registros_comunicacao_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_transportadoras: {
        Row: {
          ativo: boolean
          cliente_id: string
          created_at: string
          id: string
          modalidade: string | null
          prazo_medio: string | null
          prioridade: number | null
          transportadora_id: string
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          created_at?: string
          id?: string
          modalidade?: string | null
          prazo_medio?: string | null
          prioridade?: number | null
          transportadora_id: string
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          created_at?: string
          id?: string
          modalidade?: string | null
          prazo_medio?: string | null
          prioridade?: number | null
          transportadora_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_transportadoras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_transportadoras_transportadora_id_fkey"
            columns: ["transportadora_id"]
            isOneToOne: false
            referencedRelation: "transportadoras"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean
          bairro: string | null
          caixa_postal: string | null
          celular: string | null
          cep: string | null
          cidade: string | null
          codigo_legado: string | null
          complemento: string | null
          contato: string | null
          cpf_cnpj: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          forma_pagamento_id: string | null
          forma_pagamento_padrao: string | null
          grupo_economico_id: string | null
          id: string
          inscricao_estadual: string | null
          limite_credito: number | null
          logradouro: string | null
          motivo_inativacao: string | null
          nome_fantasia: string | null
          nome_razao_social: string
          numero: string | null
          observacoes: string | null
          pais: string | null
          prazo_padrao: number | null
          prazo_preferencial: number | null
          telefone: string | null
          tipo_pessoa: string
          tipo_relacao_grupo: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          caixa_postal?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_legado?: string | null
          complemento?: string | null
          contato?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          forma_pagamento_id?: string | null
          forma_pagamento_padrao?: string | null
          grupo_economico_id?: string | null
          id?: string
          inscricao_estadual?: string | null
          limite_credito?: number | null
          logradouro?: string | null
          motivo_inativacao?: string | null
          nome_fantasia?: string | null
          nome_razao_social: string
          numero?: string | null
          observacoes?: string | null
          pais?: string | null
          prazo_padrao?: number | null
          prazo_preferencial?: number | null
          telefone?: string | null
          tipo_pessoa?: string
          tipo_relacao_grupo?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          caixa_postal?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_legado?: string | null
          complemento?: string | null
          contato?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          forma_pagamento_id?: string | null
          forma_pagamento_padrao?: string | null
          grupo_economico_id?: string | null
          id?: string
          inscricao_estadual?: string | null
          limite_credito?: number | null
          logradouro?: string | null
          motivo_inativacao?: string | null
          nome_fantasia?: string | null
          nome_razao_social?: string
          numero?: string | null
          observacoes?: string | null
          pais?: string | null
          prazo_padrao?: number | null
          prazo_preferencial?: number | null
          telefone?: string | null
          tipo_pessoa?: string
          tipo_relacao_grupo?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_grupo_economico_id_fkey"
            columns: ["grupo_economico_id"]
            isOneToOne: false
            referencedRelation: "grupos_economicos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_enderecos_entrega: {
        Row: {
          ativo: boolean | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente_id: string
          complemento: string | null
          contato: string | null
          created_at: string | null
          descricao: string | null
          id: string
          identificacao: string | null
          logradouro: string | null
          numero: string | null
          observacoes: string | null
          principal: boolean | null
          telefone: string | null
          uf: string | null
        }
        Insert: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id: string
          complemento?: string | null
          contato?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          identificacao?: string | null
          logradouro?: string | null
          numero?: string | null
          observacoes?: string | null
          principal?: boolean | null
          telefone?: string | null
          uf?: string | null
        }
        Update: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string
          complemento?: string | null
          contato?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          identificacao?: string | null
          logradouro?: string | null
          numero?: string | null
          observacoes?: string | null
          principal?: boolean | null
          telefone?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_enderecos_entrega_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      comentarios: {
        Row: {
          created_at: string
          entidade_id: string
          entidade_tipo: string
          id: string
          texto: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          entidade_id: string
          entidade_tipo: string
          id?: string
          texto: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          entidade_id?: string
          entidade_tipo?: string
          id?: string
          texto?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      compras: {
        Row: {
          ativo: boolean
          created_at: string
          data_compra: string | null
          data_entrega_prevista: string | null
          data_entrega_real: string | null
          fornecedor_id: string | null
          frete_valor: number | null
          id: string
          impostos_valor: number | null
          numero: string | null
          observacoes: string | null
          pedido_compra_id: string | null
          status: string | null
          updated_at: string
          valor_produtos: number | null
          valor_total: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_compra?: string | null
          data_entrega_prevista?: string | null
          data_entrega_real?: string | null
          fornecedor_id?: string | null
          frete_valor?: number | null
          id?: string
          impostos_valor?: number | null
          numero?: string | null
          observacoes?: string | null
          pedido_compra_id?: string | null
          status?: string | null
          updated_at?: string
          valor_produtos?: number | null
          valor_total?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_compra?: string | null
          data_entrega_prevista?: string | null
          data_entrega_real?: string | null
          fornecedor_id?: string | null
          frete_valor?: number | null
          id?: string
          impostos_valor?: number | null
          numero?: string | null
          observacoes?: string | null
          pedido_compra_id?: string | null
          status?: string | null
          updated_at?: string
          valor_produtos?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compras_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_compras_pedido_compra"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_compras_pedido_compra"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_compras"
            referencedColumns: ["pedido_id"]
          },
          {
            foreignKeyName: "fk_compras_pedido_compra"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "vw_recebimentos_consolidado"
            referencedColumns: ["pedido_compra_id"]
          },
        ]
      }
      compras_itens: {
        Row: {
          compra_id: string
          created_at: string
          descricao: string | null
          id: string
          produto_id: string | null
          quantidade: number | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          compra_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          produto_id?: string | null
          quantidade?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          compra_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          produto_id?: string | null
          quantidade?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compras_itens_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_itens_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_compras"
            referencedColumns: ["compra_id"]
          },
          {
            foreignKeyName: "compras_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_estoque_posicao"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      conciliacao_bancaria: {
        Row: {
          conta_bancaria_id: string
          created_at: string
          data_conciliacao: string
          id: string
          observacoes: string | null
          total_pares: number
          usuario_id: string | null
        }
        Insert: {
          conta_bancaria_id: string
          created_at?: string
          data_conciliacao?: string
          id?: string
          observacoes?: string | null
          total_pares?: number
          usuario_id?: string | null
        }
        Update: {
          conta_bancaria_id?: string
          created_at?: string
          data_conciliacao?: string
          id?: string
          observacoes?: string | null
          total_pares?: number
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conciliacao_bancaria_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_bancaria_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_bancos_saldo"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliacao_pares: {
        Row: {
          conciliacao_id: string
          criado_em: string
          extrato_id: string
          id: string
          lancamento_id: string | null
          valor_extrato: number | null
          valor_lancamento: number | null
        }
        Insert: {
          conciliacao_id: string
          criado_em?: string
          extrato_id: string
          id?: string
          lancamento_id?: string | null
          valor_extrato?: number | null
          valor_lancamento?: number | null
        }
        Update: {
          conciliacao_id?: string
          criado_em?: string
          extrato_id?: string
          id?: string
          lancamento_id?: string | null
          valor_extrato?: number | null
          valor_lancamento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conciliacao_pares_conciliacao_id_fkey"
            columns: ["conciliacao_id"]
            isOneToOne: false
            referencedRelation: "conciliacao_bancaria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_pares_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_pares_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_aging_cp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_pares_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_aging_cr"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco_id: string | null
          conta: string | null
          created_at: string
          descricao: string
          id: string
          saldo_atual: number | null
          titular: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco_id?: string | null
          conta?: string | null
          created_at?: string
          descricao: string
          id?: string
          saldo_atual?: number | null
          titular?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco_id?: string | null
          conta?: string | null
          created_at?: string
          descricao?: string
          id?: string
          saldo_atual?: number | null
          titular?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_bancarias_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "bancos"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_contabeis: {
        Row: {
          aceita_lancamento: boolean | null
          ativo: boolean
          codigo: string
          conta_pai_id: string | null
          created_at: string
          descricao: string
          i_level: string | null
          id: string
          natureza: string | null
        }
        Insert: {
          aceita_lancamento?: boolean | null
          ativo?: boolean
          codigo: string
          conta_pai_id?: string | null
          created_at?: string
          descricao: string
          i_level?: string | null
          id?: string
          natureza?: string | null
        }
        Update: {
          aceita_lancamento?: boolean | null
          ativo?: boolean
          codigo?: string
          conta_pai_id?: string | null
          created_at?: string
          descricao?: string
          i_level?: string | null
          id?: string
          natureza?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_contabeis_conta_pai_id_fkey"
            columns: ["conta_pai_id"]
            isOneToOne: false
            referencedRelation: "contas_contabeis"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes_compra: {
        Row: {
          ativo: boolean
          created_at: string
          data_cotacao: string | null
          data_validade: string | null
          id: string
          numero: string
          observacoes: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_cotacao?: string | null
          data_validade?: string | null
          id?: string
          numero: string
          observacoes?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_cotacao?: string | null
          data_validade?: string | null
          id?: string
          numero?: string
          observacoes?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cotacoes_compra_itens: {
        Row: {
          cotacao_compra_id: string
          created_at: string
          id: string
          produto_id: string | null
          quantidade: number | null
          unidade: string | null
        }
        Insert: {
          cotacao_compra_id: string
          created_at?: string
          id?: string
          produto_id?: string | null
          quantidade?: number | null
          unidade?: string | null
        }
        Update: {
          cotacao_compra_id?: string
          created_at?: string
          id?: string
          produto_id?: string | null
          quantidade?: number | null
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_compra_itens_cotacao_compra_id_fkey"
            columns: ["cotacao_compra_id"]
            isOneToOne: false
            referencedRelation: "cotacoes_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_compra_itens_cotacao_compra_id_fkey"
            columns: ["cotacao_compra_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_compras"
            referencedColumns: ["cotacao_id"]
          },
          {
            foreignKeyName: "cotacoes_compra_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_compra_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_estoque_posicao"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      cotacoes_compra_propostas: {
        Row: {
          cotacao_compra_id: string
          created_at: string
          fornecedor_id: string
          id: string
          item_id: string | null
          observacoes: string | null
          prazo_entrega_dias: number | null
          preco_unitario: number | null
          selecionado: boolean | null
        }
        Insert: {
          cotacao_compra_id: string
          created_at?: string
          fornecedor_id: string
          id?: string
          item_id?: string | null
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          preco_unitario?: number | null
          selecionado?: boolean | null
        }
        Update: {
          cotacao_compra_id?: string
          created_at?: string
          fornecedor_id?: string
          id?: string
          item_id?: string | null
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          preco_unitario?: number | null
          selecionado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_compra_propostas_cotacao_compra_id_fkey"
            columns: ["cotacao_compra_id"]
            isOneToOne: false
            referencedRelation: "cotacoes_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_compra_propostas_cotacao_compra_id_fkey"
            columns: ["cotacao_compra_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_compras"
            referencedColumns: ["cotacao_id"]
          },
          {
            foreignKeyName: "cotacoes_compra_propostas_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_compra_propostas_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "cotacoes_compra_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      empresa_config: {
        Row: {
          ambiente_padrao: string | null
          ambiente_sefaz: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnae: string | null
          cnpj: string | null
          codigo_ibge_municipio: string | null
          complemento: string | null
          created_at: string
          crt: string | null
          email: string | null
          email_fiscal: string | null
          id: string
          inscricao_estadual: string | null
          logo_url: string | null
          logradouro: string | null
          nome_fantasia: string | null
          numero: string | null
          proximo_numero_nfe: number | null
          razao_social: string | null
          regime_tributario: string | null
          serie_padrao_nfe: string | null
          telefone: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ambiente_padrao?: string | null
          ambiente_sefaz?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnae?: string | null
          cnpj?: string | null
          codigo_ibge_municipio?: string | null
          complemento?: string | null
          created_at?: string
          crt?: string | null
          email?: string | null
          email_fiscal?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          logradouro?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          proximo_numero_nfe?: number | null
          razao_social?: string | null
          regime_tributario?: string | null
          serie_padrao_nfe?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ambiente_padrao?: string | null
          ambiente_sefaz?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnae?: string | null
          cnpj?: string | null
          codigo_ibge_municipio?: string | null
          complemento?: string | null
          created_at?: string
          crt?: string | null
          email?: string | null
          email_fiscal?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          logradouro?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          proximo_numero_nfe?: number | null
          razao_social?: string | null
          regime_tributario?: string | null
          serie_padrao_nfe?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      estoque_movimentos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          categoria_ajuste: string | null
          created_at: string
          documento_id: string | null
          documento_tipo: string | null
          id: string
          motivo: string | null
          motivo_estruturado: string | null
          produto_id: string
          quantidade: number
          requer_aprovacao: boolean
          saldo_anterior: number | null
          saldo_atual: number | null
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          categoria_ajuste?: string | null
          created_at?: string
          documento_id?: string | null
          documento_tipo?: string | null
          id?: string
          motivo?: string | null
          motivo_estruturado?: string | null
          produto_id: string
          quantidade: number
          requer_aprovacao?: boolean
          saldo_anterior?: number | null
          saldo_atual?: number | null
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          categoria_ajuste?: string | null
          created_at?: string
          documento_id?: string | null
          documento_tipo?: string | null
          id?: string
          motivo?: string | null
          motivo_estruturado?: string | null
          produto_id?: string
          quantidade?: number
          requer_aprovacao?: boolean
          saldo_anterior?: number | null
          saldo_atual?: number | null
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_estoque_posicao"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      fechamento_caixa_saldos: {
        Row: {
          competencia: string
          conta_bancaria_id: string | null
          created_at: string
          fechamento_id: string | null
          id: string
          saldo: number
        }
        Insert: {
          competencia: string
          conta_bancaria_id?: string | null
          created_at?: string
          fechamento_id?: string | null
          id?: string
          saldo?: number
        }
        Update: {
          competencia?: string
          conta_bancaria_id?: string | null
          created_at?: string
          fechamento_id?: string | null
          id?: string
          saldo?: number
        }
        Relationships: [
          {
            foreignKeyName: "fechamento_caixa_saldos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_caixa_saldos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_bancos_saldo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_caixa_saldos_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "fechamentos_mensais"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamento_estoque_saldos: {
        Row: {
          competencia: string
          created_at: string
          fechamento_id: string | null
          id: string
          produto_id: string | null
          quantidade: number
          valor_custo: number
        }
        Insert: {
          competencia: string
          created_at?: string
          fechamento_id?: string | null
          id?: string
          produto_id?: string | null
          quantidade?: number
          valor_custo?: number
        }
        Update: {
          competencia?: string
          created_at?: string
          fechamento_id?: string | null
          id?: string
          produto_id?: string | null
          quantidade?: number
          valor_custo?: number
        }
        Relationships: [
          {
            foreignKeyName: "fechamento_estoque_saldos_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "fechamentos_mensais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_estoque_saldos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_estoque_saldos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_estoque_posicao"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      fechamento_financeiro_saldos: {
        Row: {
          competencia: string
          created_at: string
          fechamento_id: string | null
          id: string
          quantidade: number
          saldo_total: number
          tipo: string
        }
        Insert: {
          competencia: string
          created_at?: string
          fechamento_id?: string | null
          id?: string
          quantidade?: number
          saldo_total?: number
          tipo: string
        }
        Update: {
          competencia?: string
          created_at?: string
          fechamento_id?: string | null
          id?: string
          quantidade?: number
          saldo_total?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fechamento_financeiro_saldos_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "fechamentos_mensais"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamento_fopag_resumo: {
        Row: {
          competencia: string
          created_at: string
          descontos: number
          fechamento_id: string | null
          funcionario_id: string | null
          id: string
          proventos: number
          salario_base: number
          valor_liquido: number
        }
        Insert: {
          competencia: string
          created_at?: string
          descontos?: number
          fechamento_id?: string | null
          funcionario_id?: string | null
          id?: string
          proventos?: number
          salario_base?: number
          valor_liquido?: number
        }
        Update: {
          competencia?: string
          created_at?: string
          descontos?: number
          fechamento_id?: string | null
          funcionario_id?: string | null
          id?: string
          proventos?: number
          salario_base?: number
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "fechamento_fopag_resumo_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "fechamentos_mensais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_fopag_resumo_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamentos_mensais: {
        Row: {
          competencia: string
          created_at: string
          empresa_id: string | null
          fechado_em: string | null
          fechado_por: string | null
          id: string
          observacoes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          competencia: string
          created_at?: string
          empresa_id?: string | null
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          competencia?: string
          created_at?: string
          empresa_id?: string | null
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      financeiro_auditoria: {
        Row: {
          baixa_id: string | null
          created_at: string
          evento: string
          id: string
          lancamento_id: string | null
          payload: Json | null
          usuario_id: string | null
        }
        Insert: {
          baixa_id?: string | null
          created_at?: string
          evento: string
          id?: string
          lancamento_id?: string | null
          payload?: Json | null
          usuario_id?: string | null
        }
        Update: {
          baixa_id?: string | null
          created_at?: string
          evento?: string
          id?: string
          lancamento_id?: string | null
          payload?: Json | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      financeiro_baixas: {
        Row: {
          conciliacao_data: string | null
          conciliacao_extrato_referencia: string | null
          conciliacao_status: string
          conciliacao_usuario: string | null
          conta_bancaria_id: string | null
          created_at: string
          data_baixa: string
          estornada_em: string | null
          estornada_por: string | null
          forma_pagamento: string | null
          id: string
          lancamento_id: string
          motivo_estorno: string | null
          observacoes: string | null
          valor_pago: number
        }
        Insert: {
          conciliacao_data?: string | null
          conciliacao_extrato_referencia?: string | null
          conciliacao_status?: string
          conciliacao_usuario?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_baixa: string
          estornada_em?: string | null
          estornada_por?: string | null
          forma_pagamento?: string | null
          id?: string
          lancamento_id: string
          motivo_estorno?: string | null
          observacoes?: string | null
          valor_pago: number
        }
        Update: {
          conciliacao_data?: string | null
          conciliacao_extrato_referencia?: string | null
          conciliacao_status?: string
          conciliacao_usuario?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_baixa?: string
          estornada_em?: string | null
          estornada_por?: string | null
          forma_pagamento?: string | null
          id?: string
          lancamento_id?: string
          motivo_estorno?: string | null
          observacoes?: string | null
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_baixas_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_baixas_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_bancos_saldo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_baixas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_baixas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_aging_cp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_baixas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_aging_cr"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_lancamentos: {
        Row: {
          ativo: boolean
          banco: string | null
          cartao: string | null
          cliente_id: string | null
          codigo_fluxo_origem: string | null
          conta_bancaria_id: string | null
          conta_contabil_id: string | null
          created_at: string
          data_emissao: string | null
          data_pagamento: string | null
          data_vencimento: string
          descricao: string | null
          documento_pai_id: string | null
          forma_pagamento: string | null
          forma_pagamento_id: string | null
          fornecedor_id: string | null
          funcionario_id: string | null
          id: string
          motivo_estorno: string | null
          nome_abreviado_origem: string | null
          nota_fiscal_id: string | null
          observacoes: string | null
          origem_descricao: string | null
          origem_id: string | null
          origem_tabela: string | null
          origem_tipo: string
          parcela_numero: number | null
          parcela_total: number | null
          pedido_compra_id: string | null
          saldo_restante: number | null
          status: string | null
          tipo: string
          tipo_baixa: string | null
          titulo: string | null
          updated_at: string
          valor: number
          valor_pago: number | null
        }
        Insert: {
          ativo?: boolean
          banco?: string | null
          cartao?: string | null
          cliente_id?: string | null
          codigo_fluxo_origem?: string | null
          conta_bancaria_id?: string | null
          conta_contabil_id?: string | null
          created_at?: string
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          descricao?: string | null
          documento_pai_id?: string | null
          forma_pagamento?: string | null
          forma_pagamento_id?: string | null
          fornecedor_id?: string | null
          funcionario_id?: string | null
          id?: string
          motivo_estorno?: string | null
          nome_abreviado_origem?: string | null
          nota_fiscal_id?: string | null
          observacoes?: string | null
          origem_descricao?: string | null
          origem_id?: string | null
          origem_tabela?: string | null
          origem_tipo?: string
          parcela_numero?: number | null
          parcela_total?: number | null
          pedido_compra_id?: string | null
          saldo_restante?: number | null
          status?: string | null
          tipo?: string
          tipo_baixa?: string | null
          titulo?: string | null
          updated_at?: string
          valor?: number
          valor_pago?: number | null
        }
        Update: {
          ativo?: boolean
          banco?: string | null
          cartao?: string | null
          cliente_id?: string | null
          codigo_fluxo_origem?: string | null
          conta_bancaria_id?: string | null
          conta_contabil_id?: string | null
          created_at?: string
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string | null
          documento_pai_id?: string | null
          forma_pagamento?: string | null
          forma_pagamento_id?: string | null
          fornecedor_id?: string | null
          funcionario_id?: string | null
          id?: string
          motivo_estorno?: string | null
          nome_abreviado_origem?: string | null
          nota_fiscal_id?: string | null
          observacoes?: string | null
          origem_descricao?: string | null
          origem_id?: string | null
          origem_tabela?: string | null
          origem_tipo?: string
          parcela_numero?: number | null
          parcela_total?: number | null
          pedido_compra_id?: string | null
          saldo_restante?: number | null
          status?: string | null
          tipo?: string
          tipo_baixa?: string | null
          titulo?: string | null
          updated_at?: string
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_lancamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_bancos_saldo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_conta_contabil_id_fkey"
            columns: ["conta_contabil_id"]
            isOneToOne: false
            referencedRelation: "contas_contabeis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_documento_pai_id_fkey"
            columns: ["documento_pai_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_documento_pai_id_fkey"
            columns: ["documento_pai_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_aging_cp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_documento_pai_id_fkey"
            columns: ["documento_pai_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_aging_cr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_comercial"
            referencedColumns: ["nf_id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_fiscal"
            referencedColumns: ["nf_id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_compras"
            referencedColumns: ["pedido_id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "vw_recebimentos_consolidado"
            referencedColumns: ["pedido_compra_id"]
          },
        ]
      }
      folha_pagamento: {
        Row: {
          competencia: string
          created_at: string
          descontos: number | null
          financeiro_gerado: boolean | null
          funcionario_id: string
          id: string
          observacoes: string | null
          proventos: number | null
          salario_base: number | null
          status: string | null
          valor_liquido: number | null
        }
        Insert: {
          competencia: string
          created_at?: string
          descontos?: number | null
          financeiro_gerado?: boolean | null
          funcionario_id: string
          id?: string
          observacoes?: string | null
          proventos?: number | null
          salario_base?: number | null
          status?: string | null
          valor_liquido?: number | null
        }
        Update: {
          competencia?: string
          created_at?: string
          descontos?: number | null
          financeiro_gerado?: boolean | null
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          proventos?: number | null
          salario_base?: number | null
          status?: string | null
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "folha_pagamento_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      formas_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          gera_financeiro: boolean | null
          id: string
          intervalos_dias: Json | null
          observacoes: string | null
          parcelas: number | null
          prazo_dias: number | null
          tipo: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao: string
          gera_financeiro?: boolean | null
          id?: string
          intervalos_dias?: Json | null
          observacoes?: string | null
          parcelas?: number | null
          prazo_dias?: number | null
          tipo?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          gera_financeiro?: boolean | null
          id?: string
          intervalos_dias?: Json | null
          observacoes?: string | null
          parcelas?: number | null
          prazo_dias?: number | null
          tipo?: string | null
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          ativo: boolean
          bairro: string | null
          celular: string | null
          cep: string | null
          cidade: string | null
          codigo_legado: string | null
          complemento: string | null
          contato: string | null
          cpf_cnpj: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          id: string
          inscricao_estadual: string | null
          logradouro: string | null
          motivo_inativacao: string | null
          nome_fantasia: string | null
          nome_razao_social: string
          numero: string | null
          observacoes: string | null
          pais: string | null
          prazo_padrao: number | null
          telefone: string | null
          tipo_pessoa: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_legado?: string | null
          complemento?: string | null
          contato?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          inscricao_estadual?: string | null
          logradouro?: string | null
          motivo_inativacao?: string | null
          nome_fantasia?: string | null
          nome_razao_social: string
          numero?: string | null
          observacoes?: string | null
          pais?: string | null
          prazo_padrao?: number | null
          telefone?: string | null
          tipo_pessoa?: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_legado?: string | null
          complemento?: string | null
          contato?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          inscricao_estadual?: string | null
          logradouro?: string | null
          motivo_inativacao?: string | null
          nome_fantasia?: string | null
          nome_razao_social?: string
          numero?: string | null
          observacoes?: string | null
          pais?: string | null
          prazo_padrao?: number | null
          telefone?: string | null
          tipo_pessoa?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      frete_simulacoes: {
        Row: {
          altura_cm: number | null
          cep_destino: string | null
          cep_origem: string | null
          cliente_id: string | null
          comprimento_cm: number | null
          created_at: string
          id: string
          largura_cm: number | null
          observacoes: string | null
          opcao_escolhida_id: string | null
          origem_id: string
          origem_tipo: string
          peso_total: number | null
          status: string | null
          updated_at: string
          valor_mercadoria: number | null
          volumes: number | null
        }
        Insert: {
          altura_cm?: number | null
          cep_destino?: string | null
          cep_origem?: string | null
          cliente_id?: string | null
          comprimento_cm?: number | null
          created_at?: string
          id?: string
          largura_cm?: number | null
          observacoes?: string | null
          opcao_escolhida_id?: string | null
          origem_id: string
          origem_tipo?: string
          peso_total?: number | null
          status?: string | null
          updated_at?: string
          valor_mercadoria?: number | null
          volumes?: number | null
        }
        Update: {
          altura_cm?: number | null
          cep_destino?: string | null
          cep_origem?: string | null
          cliente_id?: string | null
          comprimento_cm?: number | null
          created_at?: string
          id?: string
          largura_cm?: number | null
          observacoes?: string | null
          opcao_escolhida_id?: string | null
          origem_id?: string
          origem_tipo?: string
          peso_total?: number | null
          status?: string | null
          updated_at?: string
          valor_mercadoria?: number | null
          volumes?: number | null
        }
        Relationships: []
      }
      frete_simulacoes_opcoes: {
        Row: {
          codigo: string | null
          created_at: string
          fonte: string
          id: string
          modalidade: string | null
          observacoes: string | null
          payload_raw: Json | null
          prazo_dias: number | null
          selecionada: boolean | null
          servico: string | null
          simulacao_id: string
          transportadora_id: string | null
          updated_at: string
          valor_adicional: number | null
          valor_frete: number | null
          valor_total: number | null
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          fonte?: string
          id?: string
          modalidade?: string | null
          observacoes?: string | null
          payload_raw?: Json | null
          prazo_dias?: number | null
          selecionada?: boolean | null
          servico?: string | null
          simulacao_id: string
          transportadora_id?: string | null
          updated_at?: string
          valor_adicional?: number | null
          valor_frete?: number | null
          valor_total?: number | null
        }
        Update: {
          codigo?: string | null
          created_at?: string
          fonte?: string
          id?: string
          modalidade?: string | null
          observacoes?: string | null
          payload_raw?: Json | null
          prazo_dias?: number | null
          selecionada?: boolean | null
          servico?: string | null
          simulacao_id?: string
          transportadora_id?: string | null
          updated_at?: string
          valor_adicional?: number | null
          valor_frete?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "frete_simulacoes_opcoes_simulacao_id_fkey"
            columns: ["simulacao_id"]
            isOneToOne: false
            referencedRelation: "frete_simulacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          ativo: boolean
          cargo: string | null
          cpf: string | null
          created_at: string
          data_admissao: string | null
          data_demissao: string | null
          deleted_at: string | null
          deleted_by: string | null
          departamento: string | null
          id: string
          motivo_inativacao: string | null
          nome: string
          observacoes: string | null
          salario_base: number | null
          tipo_contrato: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_demissao?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          departamento?: string | null
          id?: string
          motivo_inativacao?: string | null
          nome: string
          observacoes?: string | null
          salario_base?: number | null
          tipo_contrato?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_demissao?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          departamento?: string | null
          id?: string
          motivo_inativacao?: string | null
          nome?: string
          observacoes?: string | null
          salario_base?: number | null
          tipo_contrato?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      grupos_economicos: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_matriz_id: string | null
          id: string
          nome: string
          observacoes: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_matriz_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_matriz_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grupos_economicos_matriz_fkey"
            columns: ["empresa_matriz_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos_produto: {
        Row: {
          ativo: boolean
          conta_contabil_id: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          conta_contabil_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          conta_contabil_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupos_produto_conta_contabil_id_fkey"
            columns: ["conta_contabil_id"]
            isOneToOne: false
            referencedRelation: "contas_contabeis"
            referencedColumns: ["id"]
          },
        ]
      }
      importacao_logs: {
        Row: {
          created_at: string
          etapa: string | null
          id: string
          lote_id: string | null
          mensagem: string | null
          nivel: string | null
        }
        Insert: {
          created_at?: string
          etapa?: string | null
          id?: string
          lote_id?: string | null
          mensagem?: string | null
          nivel?: string | null
        }
        Update: {
          created_at?: string
          etapa?: string | null
          id?: string
          lote_id?: string | null
          mensagem?: string | null
          nivel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "importacao_logs_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "importacao_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      importacao_lotes: {
        Row: {
          arquivo_nome: string | null
          created_at: string
          erros: Json | null
          fase: string | null
          hash_conteudo: string | null
          id: string
          registros_atualizados: number | null
          registros_duplicados: number | null
          registros_erro: number | null
          registros_ignorados: number | null
          registros_sucesso: number | null
          resumo: Json | null
          status: string | null
          tipo: string
          total_registros: number | null
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          created_at?: string
          erros?: Json | null
          fase?: string | null
          hash_conteudo?: string | null
          id?: string
          registros_atualizados?: number | null
          registros_duplicados?: number | null
          registros_erro?: number | null
          registros_ignorados?: number | null
          registros_sucesso?: number | null
          resumo?: Json | null
          status?: string | null
          tipo: string
          total_registros?: number | null
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          created_at?: string
          erros?: Json | null
          fase?: string | null
          hash_conteudo?: string | null
          id?: string
          registros_atualizados?: number | null
          registros_duplicados?: number | null
          registros_erro?: number | null
          registros_ignorados?: number | null
          registros_sucesso?: number | null
          resumo?: Json | null
          status?: string | null
          tipo?: string
          total_registros?: number | null
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      nota_fiscal_anexos: {
        Row: {
          caminho_storage: string | null
          created_at: string
          id: string
          nome_arquivo: string | null
          nota_fiscal_id: string
          tamanho: number | null
          tipo_arquivo: string
        }
        Insert: {
          caminho_storage?: string | null
          created_at?: string
          id?: string
          nome_arquivo?: string | null
          nota_fiscal_id: string
          tamanho?: number | null
          tipo_arquivo: string
        }
        Update: {
          caminho_storage?: string | null
          created_at?: string
          id?: string
          nome_arquivo?: string | null
          nota_fiscal_id?: string
          tamanho?: number | null
          tipo_arquivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_anexos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_fiscal_anexos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_comercial"
            referencedColumns: ["nf_id"]
          },
          {
            foreignKeyName: "nota_fiscal_anexos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_fiscal"
            referencedColumns: ["nf_id"]
          },
        ]
      }
      nota_fiscal_eventos: {
        Row: {
          data_evento: string
          descricao: string | null
          id: string
          nota_fiscal_id: string
          payload_resumido: Json | null
          status_anterior: string | null
          status_novo: string | null
          tipo_evento: string
          usuario_id: string | null
        }
        Insert: {
          data_evento?: string
          descricao?: string | null
          id?: string
          nota_fiscal_id: string
          payload_resumido?: Json | null
          status_anterior?: string | null
          status_novo?: string | null
          tipo_evento: string
          usuario_id?: string | null
        }
        Update: {
          data_evento?: string
          descricao?: string | null
          id?: string
          nota_fiscal_id?: string
          payload_resumido?: Json | null
          status_anterior?: string | null
          status_novo?: string | null
          tipo_evento?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_eventos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_fiscal_eventos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_comercial"
            referencedColumns: ["nf_id"]
          },
          {
            foreignKeyName: "nota_fiscal_eventos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_fiscal"
            referencedColumns: ["nf_id"]
          },
        ]
      }
      notas_fiscais: {
        Row: {
          ambiente_emissao: string | null
          ativo: boolean
          caminho_pdf: string | null
          caminho_xml: string | null
          chave_acesso: string | null
          cliente_id: string | null
          cofins_valor: number | null
          condicao_pagamento: string | null
          conta_contabil_id: string | null
          created_at: string
          data_emissao: string | null
          data_saida_entrada: string | null
          desconto_valor: number | null
          enviado_email: boolean | null
          especie_volumes: string | null
          finalidade_nfe: string | null
          forma_pagamento: string | null
          fornecedor_id: string | null
          frete_modalidade: string | null
          frete_valor: number | null
          gera_financeiro: boolean | null
          icms_st_valor: number | null
          icms_valor: number | null
          id: string
          ipi_valor: number | null
          marca_volumes: string | null
          modelo_documento: string | null
          motivo_rejeicao: string | null
          movimenta_estoque: boolean | null
          natureza_operacao: string | null
          nf_referenciada_id: string | null
          numeracao_volumes: string | null
          numero: string | null
          observacoes: string | null
          ordem_venda_id: string | null
          origem: string | null
          outras_despesas: number | null
          pdf_gerado: boolean | null
          peso_bruto: number | null
          peso_liquido: number | null
          pis_valor: number | null
          protocolo_autorizacao: string | null
          quantidade_volumes: number | null
          recibo: string | null
          serie: string | null
          status: string | null
          status_sefaz: string | null
          tipo: string | null
          tipo_operacao: string | null
          transportadora_id: string | null
          updated_at: string
          usuario_criacao_id: string | null
          usuario_ultima_modificacao_id: string | null
          valor_produtos: number | null
          valor_seguro: number | null
          valor_total: number | null
          xml_gerado: boolean | null
        }
        Insert: {
          ambiente_emissao?: string | null
          ativo?: boolean
          caminho_pdf?: string | null
          caminho_xml?: string | null
          chave_acesso?: string | null
          cliente_id?: string | null
          cofins_valor?: number | null
          condicao_pagamento?: string | null
          conta_contabil_id?: string | null
          created_at?: string
          data_emissao?: string | null
          data_saida_entrada?: string | null
          desconto_valor?: number | null
          enviado_email?: boolean | null
          especie_volumes?: string | null
          finalidade_nfe?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          frete_modalidade?: string | null
          frete_valor?: number | null
          gera_financeiro?: boolean | null
          icms_st_valor?: number | null
          icms_valor?: number | null
          id?: string
          ipi_valor?: number | null
          marca_volumes?: string | null
          modelo_documento?: string | null
          motivo_rejeicao?: string | null
          movimenta_estoque?: boolean | null
          natureza_operacao?: string | null
          nf_referenciada_id?: string | null
          numeracao_volumes?: string | null
          numero?: string | null
          observacoes?: string | null
          ordem_venda_id?: string | null
          origem?: string | null
          outras_despesas?: number | null
          pdf_gerado?: boolean | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          pis_valor?: number | null
          protocolo_autorizacao?: string | null
          quantidade_volumes?: number | null
          recibo?: string | null
          serie?: string | null
          status?: string | null
          status_sefaz?: string | null
          tipo?: string | null
          tipo_operacao?: string | null
          transportadora_id?: string | null
          updated_at?: string
          usuario_criacao_id?: string | null
          usuario_ultima_modificacao_id?: string | null
          valor_produtos?: number | null
          valor_seguro?: number | null
          valor_total?: number | null
          xml_gerado?: boolean | null
        }
        Update: {
          ambiente_emissao?: string | null
          ativo?: boolean
          caminho_pdf?: string | null
          caminho_xml?: string | null
          chave_acesso?: string | null
          cliente_id?: string | null
          cofins_valor?: number | null
          condicao_pagamento?: string | null
          conta_contabil_id?: string | null
          created_at?: string
          data_emissao?: string | null
          data_saida_entrada?: string | null
          desconto_valor?: number | null
          enviado_email?: boolean | null
          especie_volumes?: string | null
          finalidade_nfe?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          frete_modalidade?: string | null
          frete_valor?: number | null
          gera_financeiro?: boolean | null
          icms_st_valor?: number | null
          icms_valor?: number | null
          id?: string
          ipi_valor?: number | null
          marca_volumes?: string | null
          modelo_documento?: string | null
          motivo_rejeicao?: string | null
          movimenta_estoque?: boolean | null
          natureza_operacao?: string | null
          nf_referenciada_id?: string | null
          numeracao_volumes?: string | null
          numero?: string | null
          observacoes?: string | null
          ordem_venda_id?: string | null
          origem?: string | null
          outras_despesas?: number | null
          pdf_gerado?: boolean | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          pis_valor?: number | null
          protocolo_autorizacao?: string | null
          quantidade_volumes?: number | null
          recibo?: string | null
          serie?: string | null
          status?: string | null
          status_sefaz?: string | null
          tipo?: string | null
          tipo_operacao?: string | null
          transportadora_id?: string | null
          updated_at?: string
          usuario_criacao_id?: string | null
          usuario_ultima_modificacao_id?: string | null
          valor_produtos?: number | null
          valor_seguro?: number | null
          valor_total?: number | null
          xml_gerado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_conta_contabil_id_fkey"
            columns: ["conta_contabil_id"]
            isOneToOne: false
            referencedRelation: "contas_contabeis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_nf_referenciada_id_fkey"
            columns: ["nf_referenciada_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_nf_referenciada_id_fkey"
            columns: ["nf_referenciada_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_comercial"
            referencedColumns: ["nf_id"]
          },
          {
            foreignKeyName: "notas_fiscais_nf_referenciada_id_fkey"
            columns: ["nf_referenciada_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_fiscal"
            referencedColumns: ["nf_id"]
          },
          {
            foreignKeyName: "notas_fiscais_ordem_venda_id_fkey"
            columns: ["ordem_venda_id"]
            isOneToOne: false
            referencedRelation: "ordens_venda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_ordem_venda_id_fkey"
            columns: ["ordem_venda_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_comercial"
            referencedColumns: ["pedido_id"]
          },
          {
            foreignKeyName: "notas_fiscais_ordem_venda_id_fkey"
            columns: ["ordem_venda_id"]
            isOneToOne: false
            referencedRelation: "vw_entregas_consolidadas"
            referencedColumns: ["ordem_venda_id"]
          },
          {
            foreignKeyName: "notas_fiscais_transportadora_id_fkey"
            columns: ["transportadora_id"]
            isOneToOne: false
            referencedRelation: "transportadoras"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais_itens: {
        Row: {
          base_cofins: number | null
          base_ipi: number | null
          base_pis: number | null
          base_st: number | null
          cest: string | null
          cfop: string | null
          codigo_produto: string | null
          cofins_aliquota: number | null
          cofins_valor: number | null
          created_at: string
          csosn: string | null
          cst: string | null
          cst_cofins: string | null
          cst_ipi: string | null
          cst_pis: string | null
          desconto: number | null
          descricao: string | null
          frete_rateado: number | null
          icms_aliquota: number | null
          icms_base: number | null
          icms_valor: number | null
          id: string
          ipi_aliquota: number | null
          ipi_valor: number | null
          ncm: string | null
          nota_fiscal_id: string
          observacoes: string | null
          origem_mercadoria: string | null
          outras_despesas_rateadas: number | null
          pis_aliquota: number | null
          pis_valor: number | null
          produto_id: string | null
          quantidade: number | null
          seguro_rateado: number | null
          unidade: string | null
          unidade_tributavel: string | null
          valor_st: number | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          base_cofins?: number | null
          base_ipi?: number | null
          base_pis?: number | null
          base_st?: number | null
          cest?: string | null
          cfop?: string | null
          codigo_produto?: string | null
          cofins_aliquota?: number | null
          cofins_valor?: number | null
          created_at?: string
          csosn?: string | null
          cst?: string | null
          cst_cofins?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          desconto?: number | null
          descricao?: string | null
          frete_rateado?: number | null
          icms_aliquota?: number | null
          icms_base?: number | null
          icms_valor?: number | null
          id?: string
          ipi_aliquota?: number | null
          ipi_valor?: number | null
          ncm?: string | null
          nota_fiscal_id: string
          observacoes?: string | null
          origem_mercadoria?: string | null
          outras_despesas_rateadas?: number | null
          pis_aliquota?: number | null
          pis_valor?: number | null
          produto_id?: string | null
          quantidade?: number | null
          seguro_rateado?: number | null
          unidade?: string | null
          unidade_tributavel?: string | null
          valor_st?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          base_cofins?: number | null
          base_ipi?: number | null
          base_pis?: number | null
          base_st?: number | null
          cest?: string | null
          cfop?: string | null
          codigo_produto?: string | null
          cofins_aliquota?: number | null
          cofins_valor?: number | null
          created_at?: string
          csosn?: string | null
          cst?: string | null
          cst_cofins?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          desconto?: number | null
          descricao?: string | null
          frete_rateado?: number | null
          icms_aliquota?: number | null
          icms_base?: number | null
          icms_valor?: number | null
          id?: string
          ipi_aliquota?: number | null
          ipi_valor?: number | null
          ncm?: string | null
          nota_fiscal_id?: string
          observacoes?: string | null
          origem_mercadoria?: string | null
          outras_despesas_rateadas?: number | null
          pis_aliquota?: number | null
          pis_valor?: number | null
          produto_id?: string | null
          quantidade?: number | null
          seguro_rateado?: number | null
          unidade?: string | null
          unidade_tributavel?: string | null
          valor_st?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_itens_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_itens_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_comercial"
            referencedColumns: ["nf_id"]
          },
          {
            foreignKeyName: "notas_fiscais_itens_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_fiscal"
            referencedColumns: ["nf_id"]
          },
          {
            foreignKeyName: "notas_fiscais_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_estoque_posicao"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      orcamento_drafts: {
        Row: {
          created_at: string
          draft_key: string
          id: string
          payload: Json
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          draft_key: string
          id?: string
          payload: Json
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          draft_key?: string
          id?: string
          payload?: Json
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          altura_cm: number | null
          ativo: boolean
          cliente_id: string | null
          cliente_snapshot: Json | null
          comprimento_cm: number | null
          created_at: string
          data_orcamento: string | null
          desconto: number | null
          frete_simulacao_id: string | null
          frete_tipo: string | null
          frete_valor: number | null
          id: string
          imposto_ipi: number | null
          imposto_st: number | null
          largura_cm: number | null
          modalidade: string | null
          numero: string
          observacoes: string | null
          observacoes_internas: string | null
          origem_frete: string | null
          outras_despesas: number | null
          pagamento: string | null
          peso_total: number | null
          prazo_entrega: string | null
          prazo_entrega_dias: number | null
          prazo_pagamento: string | null
          public_token: string | null
          quantidade_total: number | null
          servico_frete: string | null
          status: string | null
          transportadora_id: string | null
          updated_at: string
          validade: string | null
          valor_total: number | null
          vendedor_id: string | null
          volumes: number | null
        }
        Insert: {
          altura_cm?: number | null
          ativo?: boolean
          cliente_id?: string | null
          cliente_snapshot?: Json | null
          comprimento_cm?: number | null
          created_at?: string
          data_orcamento?: string | null
          desconto?: number | null
          frete_simulacao_id?: string | null
          frete_tipo?: string | null
          frete_valor?: number | null
          id?: string
          imposto_ipi?: number | null
          imposto_st?: number | null
          largura_cm?: number | null
          modalidade?: string | null
          numero: string
          observacoes?: string | null
          observacoes_internas?: string | null
          origem_frete?: string | null
          outras_despesas?: number | null
          pagamento?: string | null
          peso_total?: number | null
          prazo_entrega?: string | null
          prazo_entrega_dias?: number | null
          prazo_pagamento?: string | null
          public_token?: string | null
          quantidade_total?: number | null
          servico_frete?: string | null
          status?: string | null
          transportadora_id?: string | null
          updated_at?: string
          validade?: string | null
          valor_total?: number | null
          vendedor_id?: string | null
          volumes?: number | null
        }
        Update: {
          altura_cm?: number | null
          ativo?: boolean
          cliente_id?: string | null
          cliente_snapshot?: Json | null
          comprimento_cm?: number | null
          created_at?: string
          data_orcamento?: string | null
          desconto?: number | null
          frete_simulacao_id?: string | null
          frete_tipo?: string | null
          frete_valor?: number | null
          id?: string
          imposto_ipi?: number | null
          imposto_st?: number | null
          largura_cm?: number | null
          modalidade?: string | null
          numero?: string
          observacoes?: string | null
          observacoes_internas?: string | null
          origem_frete?: string | null
          outras_despesas?: number | null
          pagamento?: string | null
          peso_total?: number | null
          prazo_entrega?: string | null
          prazo_entrega_dias?: number | null
          prazo_pagamento?: string | null
          public_token?: string | null
          quantidade_total?: number | null
          servico_frete?: string | null
          status?: string | null
          transportadora_id?: string | null
          updated_at?: string
          validade?: string | null
          valor_total?: number | null
          vendedor_id?: string | null
          volumes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_frete_simulacao_id_fkey"
            columns: ["frete_simulacao_id"]
            isOneToOne: false
            referencedRelation: "frete_simulacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_transportadora_id_fkey"
            columns: ["transportadora_id"]
            isOneToOne: false
            referencedRelation: "transportadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos_itens: {
        Row: {
          codigo_snapshot: string | null
          created_at: string
          custo_unitario: number | null
          descricao_snapshot: string | null
          id: string
          orcamento_id: string
          peso_total: number | null
          peso_unitario: number | null
          produto_id: string | null
          quantidade: number | null
          unidade: string | null
          valor_total: number | null
          valor_unitario: number | null
          variacao: string | null
        }
        Insert: {
          codigo_snapshot?: string | null
          created_at?: string
          custo_unitario?: number | null
          descricao_snapshot?: string | null
          id?: string
          orcamento_id: string
          peso_total?: number | null
          peso_unitario?: number | null
          produto_id?: string | null
          quantidade?: number | null
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
          variacao?: string | null
        }
        Update: {
          codigo_snapshot?: string | null
          created_at?: string
          custo_unitario?: number | null
          descricao_snapshot?: string | null
          id?: string
          orcamento_id?: string
          peso_total?: number | null
          peso_unitario?: number | null
          produto_id?: string | null
          quantidade?: number | null
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
          variacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_comercial"
            referencedColumns: ["orcamento_id"]
          },
          {
            foreignKeyName: "orcamentos_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_estoque_posicao"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      ordens_venda: {
        Row: {
          ativo: boolean
          cliente_id: string | null
          cotacao_id: string | null
          created_at: string
          data_aprovacao: string | null
          data_emissao: string | null
          data_po_cliente: string | null
          data_prometida_despacho: string | null
          frete_simulacao_id: string | null
          frete_tipo: string | null
          frete_valor: number | null
          id: string
          modalidade: string | null
          numero: string
          observacoes: string | null
          origem_frete: string | null
          peso_total: number | null
          po_number: string | null
          prazo_despacho_dias: number | null
          prazo_entrega_dias: number | null
          servico_frete: string | null
          status: string | null
          status_faturamento: string | null
          transportadora_id: string | null
          updated_at: string
          valor_total: number | null
          vendedor_id: string | null
          volumes: number | null
        }
        Insert: {
          ativo?: boolean
          cliente_id?: string | null
          cotacao_id?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_emissao?: string | null
          data_po_cliente?: string | null
          data_prometida_despacho?: string | null
          frete_simulacao_id?: string | null
          frete_tipo?: string | null
          frete_valor?: number | null
          id?: string
          modalidade?: string | null
          numero: string
          observacoes?: string | null
          origem_frete?: string | null
          peso_total?: number | null
          po_number?: string | null
          prazo_despacho_dias?: number | null
          prazo_entrega_dias?: number | null
          servico_frete?: string | null
          status?: string | null
          status_faturamento?: string | null
          transportadora_id?: string | null
          updated_at?: string
          valor_total?: number | null
          vendedor_id?: string | null
          volumes?: number | null
        }
        Update: {
          ativo?: boolean
          cliente_id?: string | null
          cotacao_id?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_emissao?: string | null
          data_po_cliente?: string | null
          data_prometida_despacho?: string | null
          frete_simulacao_id?: string | null
          frete_tipo?: string | null
          frete_valor?: number | null
          id?: string
          modalidade?: string | null
          numero?: string
          observacoes?: string | null
          origem_frete?: string | null
          peso_total?: number | null
          po_number?: string | null
          prazo_despacho_dias?: number | null
          prazo_entrega_dias?: number | null
          servico_frete?: string | null
          status?: string | null
          status_faturamento?: string | null
          transportadora_id?: string | null
          updated_at?: string
          valor_total?: number | null
          vendedor_id?: string | null
          volumes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_venda_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_venda_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_venda_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "orcamentos_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_venda_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_comercial"
            referencedColumns: ["orcamento_id"]
          },
          {
            foreignKeyName: "ordens_venda_transportadora_id_fkey"
            columns: ["transportadora_id"]
            isOneToOne: false
            referencedRelation: "transportadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_venda_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_venda_itens: {
        Row: {
          codigo_snapshot: string | null
          created_at: string
          descricao_snapshot: string | null
          id: string
          ordem_venda_id: string
          peso_total: number | null
          peso_unitario: number | null
          produto_id: string | null
          quantidade: number | null
          quantidade_faturada: number | null
          unidade: string | null
          valor_total: number | null
          valor_unitario: number | null
          variacao: string | null
        }
        Insert: {
          codigo_snapshot?: string | null
          created_at?: string
          descricao_snapshot?: string | null
          id?: string
          ordem_venda_id: string
          peso_total?: number | null
          peso_unitario?: number | null
          produto_id?: string | null
          quantidade?: number | null
          quantidade_faturada?: number | null
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
          variacao?: string | null
        }
        Update: {
          codigo_snapshot?: string | null
          created_at?: string
          descricao_snapshot?: string | null
          id?: string
          ordem_venda_id?: string
          peso_total?: number | null
          peso_unitario?: number | null
          produto_id?: string | null
          quantidade?: number | null
          quantidade_faturada?: number | null
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
          variacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_venda_itens_ordem_venda_id_fkey"
            columns: ["ordem_venda_id"]
            isOneToOne: false
            referencedRelation: "ordens_venda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_venda_itens_ordem_venda_id_fkey"
            columns: ["ordem_venda_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_comercial"
            referencedColumns: ["pedido_id"]
          },
          {
            foreignKeyName: "ordens_venda_itens_ordem_venda_id_fkey"
            columns: ["ordem_venda_id"]
            isOneToOne: false
            referencedRelation: "vw_entregas_consolidadas"
            referencedColumns: ["ordem_venda_id"]
          },
          {
            foreignKeyName: "ordens_venda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_venda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_estoque_posicao"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      pedidos_compra: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          ativo: boolean
          condicao_pagamento: string | null
          condicoes_pagamento: string | null
          cotacao_compra_id: string | null
          created_at: string
          data_entrega_prevista: string | null
          data_entrega_real: string | null
          data_pedido: string | null
          fornecedor_id: string | null
          frete_valor: number | null
          id: string
          motivo_rejeicao: string | null
          numero: string | null
          observacoes: string | null
          requer_aprovacao: boolean
          status: string | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          ativo?: boolean
          condicao_pagamento?: string | null
          condicoes_pagamento?: string | null
          cotacao_compra_id?: string | null
          created_at?: string
          data_entrega_prevista?: string | null
          data_entrega_real?: string | null
          data_pedido?: string | null
          fornecedor_id?: string | null
          frete_valor?: number | null
          id?: string
          motivo_rejeicao?: string | null
          numero?: string | null
          observacoes?: string | null
          requer_aprovacao?: boolean
          status?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          ativo?: boolean
          condicao_pagamento?: string | null
          condicoes_pagamento?: string | null
          cotacao_compra_id?: string | null
          created_at?: string
          data_entrega_prevista?: string | null
          data_entrega_real?: string | null
          data_pedido?: string | null
          fornecedor_id?: string | null
          frete_valor?: number | null
          id?: string
          motivo_rejeicao?: string | null
          numero?: string | null
          observacoes?: string | null
          requer_aprovacao?: boolean
          status?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_cotacao_compra_id_fkey"
            columns: ["cotacao_compra_id"]
            isOneToOne: false
            referencedRelation: "cotacoes_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_cotacao_compra_id_fkey"
            columns: ["cotacao_compra_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_compras"
            referencedColumns: ["cotacao_id"]
          },
          {
            foreignKeyName: "pedidos_compra_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_compra_itens: {
        Row: {
          created_at: string
          id: string
          pedido_compra_id: string
          preco_unitario: number | null
          produto_id: string | null
          proposta_selecionada_id: string | null
          quantidade: number | null
          quantidade_recebida: number
          subtotal: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          pedido_compra_id: string
          preco_unitario?: number | null
          produto_id?: string | null
          proposta_selecionada_id?: string | null
          quantidade?: number | null
          quantidade_recebida?: number
          subtotal?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          pedido_compra_id?: string
          preco_unitario?: number | null
          produto_id?: string | null
          proposta_selecionada_id?: string | null
          quantidade?: number | null
          quantidade_recebida?: number
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_itens_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_itens_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_compras"
            referencedColumns: ["pedido_id"]
          },
          {
            foreignKeyName: "pedidos_compra_itens_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "vw_recebimentos_consolidado"
            referencedColumns: ["pedido_compra_id"]
          },
          {
            foreignKeyName: "pedidos_compra_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_estoque_posicao"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "pedidos_compra_itens_proposta_selecionada_id_fkey"
            columns: ["proposta_selecionada_id"]
            isOneToOne: false
            referencedRelation: "cotacoes_compra_propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_audit: {
        Row: {
          alteracao: Json | null
          created_at: string
          id: string
          role_padrao: string | null
          target_user_id: string | null
          user_id: string | null
        }
        Insert: {
          alteracao?: Json | null
          created_at?: string
          id?: string
          role_padrao?: string | null
          target_user_id?: string | null
          user_id?: string | null
        }
        Update: {
          alteracao?: Json | null
          created_at?: string
          id?: string
          role_padrao?: string | null
          target_user_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      precos_especiais: {
        Row: {
          ativo: boolean
          cliente_id: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          id: string
          observacoes: string | null
          preco_especial: number
          produto_id: string | null
        }
        Insert: {
          ativo?: boolean
          cliente_id?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          observacoes?: string | null
          preco_especial: number
          produto_id?: string | null
        }
        Update: {
          ativo?: boolean
          cliente_id?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          observacoes?: string | null
          preco_especial?: number
          produto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "precos_especiais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_especiais_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_especiais_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_estoque_posicao"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      produto_composicoes: {
        Row: {
          created_at: string
          id: string
          ordem: number | null
          produto_filho_id: string
          produto_pai_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          id?: string
          ordem?: number | null
          produto_filho_id: string
          produto_pai_id: string
          quantidade?: number
        }
        Update: {
          created_at?: string
          id?: string
          ordem?: number | null
          produto_filho_id?: string
          produto_pai_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "produto_composicoes_produto_filho_id_fkey"
            columns: ["produto_filho_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_composicoes_produto_filho_id_fkey"
            columns: ["produto_filho_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_estoque_posicao"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "produto_composicoes_produto_pai_id_fkey"
            columns: ["produto_pai_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_composicoes_produto_pai_id_fkey"
            columns: ["produto_pai_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_estoque_posicao"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          cest: string | null
          cfop_padrao: string | null
          codigo_interno: string | null
          codigo_legado: string | null
          created_at: string
          cst: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string | null
          eh_composto: boolean
          estoque_atual: number | null
          estoque_ideal: number | null
          estoque_minimo: number | null
          estoque_reservado: number | null
          grupo_id: string | null
          gtin: string | null
          id: string
          motivo_inativacao: string | null
          ncm: string | null
          nome: string
          origem_mercadoria: string | null
          peso: number | null
          peso_bruto: number | null
          peso_liquido: number | null
          ponto_reposicao: number | null
          preco_custo: number | null
          preco_venda: number | null
          sku: string | null
          tipo_item: string | null
          unidade_medida: string | null
          unidade_tributavel: string | null
          updated_at: string
          variacoes: string | null
        }
        Insert: {
          ativo?: boolean
          cest?: string | null
          cfop_padrao?: string | null
          codigo_interno?: string | null
          codigo_legado?: string | null
          created_at?: string
          cst?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          eh_composto?: boolean
          estoque_atual?: number | null
          estoque_ideal?: number | null
          estoque_minimo?: number | null
          estoque_reservado?: number | null
          grupo_id?: string | null
          gtin?: string | null
          id?: string
          motivo_inativacao?: string | null
          ncm?: string | null
          nome: string
          origem_mercadoria?: string | null
          peso?: number | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          ponto_reposicao?: number | null
          preco_custo?: number | null
          preco_venda?: number | null
          sku?: string | null
          tipo_item?: string | null
          unidade_medida?: string | null
          unidade_tributavel?: string | null
          updated_at?: string
          variacoes?: string | null
        }
        Update: {
          ativo?: boolean
          cest?: string | null
          cfop_padrao?: string | null
          codigo_interno?: string | null
          codigo_legado?: string | null
          created_at?: string
          cst?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          eh_composto?: boolean
          estoque_atual?: number | null
          estoque_ideal?: number | null
          estoque_minimo?: number | null
          estoque_reservado?: number | null
          grupo_id?: string | null
          gtin?: string | null
          id?: string
          motivo_inativacao?: string | null
          ncm?: string | null
          nome?: string
          origem_mercadoria?: string | null
          peso?: number | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          ponto_reposicao?: number | null
          preco_custo?: number | null
          preco_venda?: number | null
          sku?: string | null
          tipo_item?: string | null
          unidade_medida?: string | null
          unidade_tributavel?: string | null
          updated_at?: string
          variacoes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_produto"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_fornecedores: {
        Row: {
          created_at: string
          descricao_fornecedor: string | null
          eh_principal: boolean | null
          fornecedor_id: string
          id: string
          lead_time_dias: number | null
          preco_compra: number | null
          produto_id: string
          referencia_fornecedor: string | null
          unidade_fornecedor: string | null
          url_produto_fornecedor: string | null
        }
        Insert: {
          created_at?: string
          descricao_fornecedor?: string | null
          eh_principal?: boolean | null
          fornecedor_id: string
          id?: string
          lead_time_dias?: number | null
          preco_compra?: number | null
          produto_id: string
          referencia_fornecedor?: string | null
          unidade_fornecedor?: string | null
          url_produto_fornecedor?: string | null
        }
        Update: {
          created_at?: string
          descricao_fornecedor?: string | null
          eh_principal?: boolean | null
          fornecedor_id?: string
          id?: string
          lead_time_dias?: number | null
          preco_compra?: number | null
          produto_id?: string
          referencia_fornecedor?: string | null
          unidade_fornecedor?: string | null
          url_produto_fornecedor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_fornecedores_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_fornecedores_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_fornecedores_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_estoque_posicao"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          created_at: string
          email: string | null
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recebimentos_compra: {
        Row: {
          compra_id: string | null
          created_at: string
          data_recebimento: string
          id: string
          motivo_divergencia: string | null
          nota_fiscal_id: string | null
          numero: string | null
          observacoes: string | null
          pedido_compra_id: string
          responsavel_id: string | null
          status_logistico: string
          tem_divergencia: boolean
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          compra_id?: string | null
          created_at?: string
          data_recebimento?: string
          id?: string
          motivo_divergencia?: string | null
          nota_fiscal_id?: string | null
          numero?: string | null
          observacoes?: string | null
          pedido_compra_id: string
          responsavel_id?: string | null
          status_logistico?: string
          tem_divergencia?: boolean
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          compra_id?: string | null
          created_at?: string
          data_recebimento?: string
          id?: string
          motivo_divergencia?: string | null
          nota_fiscal_id?: string | null
          numero?: string | null
          observacoes?: string | null
          pedido_compra_id?: string
          responsavel_id?: string | null
          status_logistico?: string
          tem_divergencia?: boolean
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_compra_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_compra_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_compras"
            referencedColumns: ["compra_id"]
          },
          {
            foreignKeyName: "recebimentos_compra_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_compra_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_comercial"
            referencedColumns: ["nf_id"]
          },
          {
            foreignKeyName: "recebimentos_compra_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_fiscal"
            referencedColumns: ["nf_id"]
          },
          {
            foreignKeyName: "recebimentos_compra_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_compra_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_compras"
            referencedColumns: ["pedido_id"]
          },
          {
            foreignKeyName: "recebimentos_compra_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "vw_recebimentos_consolidado"
            referencedColumns: ["pedido_compra_id"]
          },
        ]
      }
      recebimentos_compra_itens: {
        Row: {
          created_at: string
          id: string
          motivo_divergencia: string | null
          pedido_compra_item_id: string
          produto_id: string | null
          quantidade_pedida_snapshot: number
          quantidade_recebida: number
          recebimento_id: string
          tem_divergencia: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          motivo_divergencia?: string | null
          pedido_compra_item_id: string
          produto_id?: string | null
          quantidade_pedida_snapshot?: number
          quantidade_recebida?: number
          recebimento_id: string
          tem_divergencia?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          motivo_divergencia?: string | null
          pedido_compra_item_id?: string
          produto_id?: string | null
          quantidade_pedida_snapshot?: number
          quantidade_recebida?: number
          recebimento_id?: string
          tem_divergencia?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_compra_itens_pedido_compra_item_id_fkey"
            columns: ["pedido_compra_item_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_compra_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_compra_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_estoque_posicao"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "recebimentos_compra_itens_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "recebimentos_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      remessa_eventos: {
        Row: {
          created_at: string
          data_hora: string
          descricao: string
          id: string
          local: string | null
          remessa_id: string
        }
        Insert: {
          created_at?: string
          data_hora?: string
          descricao: string
          id?: string
          local?: string | null
          remessa_id: string
        }
        Update: {
          created_at?: string
          data_hora?: string
          descricao?: string
          id?: string
          local?: string | null
          remessa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remessa_eventos_remessa_id_fkey"
            columns: ["remessa_id"]
            isOneToOne: false
            referencedRelation: "remessas"
            referencedColumns: ["id"]
          },
        ]
      }
      remessa_itens: {
        Row: {
          created_at: string
          id: string
          observacoes: string | null
          ordem_venda_item_id: string | null
          peso_unitario: number | null
          produto_id: string
          quantidade: number
          remessa_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          observacoes?: string | null
          ordem_venda_item_id?: string | null
          peso_unitario?: number | null
          produto_id: string
          quantidade: number
          remessa_id: string
        }
        Update: {
          created_at?: string
          id?: string
          observacoes?: string | null
          ordem_venda_item_id?: string | null
          peso_unitario?: number | null
          produto_id?: string
          quantidade?: number
          remessa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remessa_itens_ordem_venda_item_id_fkey"
            columns: ["ordem_venda_item_id"]
            isOneToOne: false
            referencedRelation: "ordens_venda_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessa_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessa_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_estoque_posicao"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "remessa_itens_remessa_id_fkey"
            columns: ["remessa_id"]
            isOneToOne: false
            referencedRelation: "remessas"
            referencedColumns: ["id"]
          },
        ]
      }
      remessas: {
        Row: {
          ativo: boolean
          cliente_id: string | null
          codigo_rastreio: string | null
          created_at: string
          data_entrega_real: string | null
          data_expedicao: string | null
          data_postagem: string | null
          id: string
          motivo_cancelamento: string | null
          nota_fiscal_id: string | null
          observacoes: string | null
          ordem_venda_id: string | null
          pedido_compra_id: string | null
          peso: number | null
          previsao_entrega: string | null
          servico: string | null
          status_transporte: string | null
          tipo_remessa: string | null
          transportadora_id: string | null
          updated_at: string
          valor_frete: number | null
          volumes: number | null
        }
        Insert: {
          ativo?: boolean
          cliente_id?: string | null
          codigo_rastreio?: string | null
          created_at?: string
          data_entrega_real?: string | null
          data_expedicao?: string | null
          data_postagem?: string | null
          id?: string
          motivo_cancelamento?: string | null
          nota_fiscal_id?: string | null
          observacoes?: string | null
          ordem_venda_id?: string | null
          pedido_compra_id?: string | null
          peso?: number | null
          previsao_entrega?: string | null
          servico?: string | null
          status_transporte?: string | null
          tipo_remessa?: string | null
          transportadora_id?: string | null
          updated_at?: string
          valor_frete?: number | null
          volumes?: number | null
        }
        Update: {
          ativo?: boolean
          cliente_id?: string | null
          codigo_rastreio?: string | null
          created_at?: string
          data_entrega_real?: string | null
          data_expedicao?: string | null
          data_postagem?: string | null
          id?: string
          motivo_cancelamento?: string | null
          nota_fiscal_id?: string | null
          observacoes?: string | null
          ordem_venda_id?: string | null
          pedido_compra_id?: string | null
          peso?: number | null
          previsao_entrega?: string | null
          servico?: string | null
          status_transporte?: string | null
          tipo_remessa?: string | null
          transportadora_id?: string | null
          updated_at?: string
          valor_frete?: number | null
          volumes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "remessas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_comercial"
            referencedColumns: ["nf_id"]
          },
          {
            foreignKeyName: "remessas_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_fiscal"
            referencedColumns: ["nf_id"]
          },
          {
            foreignKeyName: "remessas_ordem_venda_id_fkey"
            columns: ["ordem_venda_id"]
            isOneToOne: false
            referencedRelation: "ordens_venda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_ordem_venda_id_fkey"
            columns: ["ordem_venda_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_comercial"
            referencedColumns: ["pedido_id"]
          },
          {
            foreignKeyName: "remessas_ordem_venda_id_fkey"
            columns: ["ordem_venda_id"]
            isOneToOne: false
            referencedRelation: "vw_entregas_consolidadas"
            referencedColumns: ["ordem_venda_id"]
          },
          {
            foreignKeyName: "remessas_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_compras"
            referencedColumns: ["pedido_id"]
          },
          {
            foreignKeyName: "remessas_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "vw_recebimentos_consolidado"
            referencedColumns: ["pedido_compra_id"]
          },
          {
            foreignKeyName: "remessas_transportadora_id_fkey"
            columns: ["transportadora_id"]
            isOneToOne: false
            referencedRelation: "transportadoras"
            referencedColumns: ["id"]
          },
        ]
      }
      social_contas: {
        Row: {
          access_token: string | null
          ativo: boolean
          data_cadastro: string
          id: string
          identificador: string | null
          nome: string
          plataforma: string
          token_expira_em: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          ativo?: boolean
          data_cadastro?: string
          id?: string
          identificador?: string | null
          nome: string
          plataforma: string
          token_expira_em?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          ativo?: boolean
          data_cadastro?: string
          id?: string
          identificador?: string | null
          nome?: string
          plataforma?: string
          token_expira_em?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      social_metricas_snapshot: {
        Row: {
          alcance: number | null
          conta_id: string
          created_at: string
          data_referencia: string
          engajamento: number | null
          id: string
          impressoes: number | null
          publicacoes: number | null
          seguidores: number | null
          seguindo: number | null
        }
        Insert: {
          alcance?: number | null
          conta_id: string
          created_at?: string
          data_referencia: string
          engajamento?: number | null
          id?: string
          impressoes?: number | null
          publicacoes?: number | null
          seguidores?: number | null
          seguindo?: number | null
        }
        Update: {
          alcance?: number | null
          conta_id?: string
          created_at?: string
          data_referencia?: string
          engajamento?: number | null
          id?: string
          impressoes?: number | null
          publicacoes?: number | null
          seguidores?: number | null
          seguindo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_metricas_snapshot_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "social_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          alcance: number | null
          comentarios: number | null
          compartilhamentos: number | null
          conta_id: string
          conteudo: string | null
          created_at: string
          curtidas: number | null
          data_publicacao: string | null
          id: string
          impressoes: number | null
          post_id_externo: string | null
          tipo: string | null
        }
        Insert: {
          alcance?: number | null
          comentarios?: number | null
          compartilhamentos?: number | null
          conta_id: string
          conteudo?: string | null
          created_at?: string
          curtidas?: number | null
          data_publicacao?: string | null
          id?: string
          impressoes?: number | null
          post_id_externo?: string | null
          tipo?: string | null
        }
        Update: {
          alcance?: number | null
          comentarios?: number | null
          compartilhamentos?: number | null
          conta_id?: string
          conteudo?: string | null
          created_at?: string
          curtidas?: number | null
          data_publicacao?: string | null
          id?: string
          impressoes?: number | null
          post_id_externo?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "social_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      stg_cadastros: {
        Row: {
          created_at: string | null
          dados: Json
          erro: string | null
          id: string
          lote_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          dados: Json
          erro?: string | null
          id?: string
          lote_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          dados?: Json
          erro?: string | null
          id?: string
          lote_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stg_cadastros_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "importacao_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      stg_compras_xml: {
        Row: {
          created_at: string
          dados: Json | null
          erro: string | null
          id: string
          lote_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          erro?: string | null
          id?: string
          lote_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          dados?: Json | null
          erro?: string | null
          id?: string
          lote_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stg_compras_xml_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "importacao_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      stg_estoque_inicial: {
        Row: {
          created_at: string
          dados: Json | null
          erro: string | null
          id: string
          lote_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          erro?: string | null
          id?: string
          lote_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          dados?: Json | null
          erro?: string | null
          id?: string
          lote_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stg_estoque_inicial_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "importacao_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      stg_faturamento: {
        Row: {
          created_at: string
          dados: Json | null
          erro: string | null
          id: string
          lote_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          erro?: string | null
          id?: string
          lote_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          dados?: Json | null
          erro?: string | null
          id?: string
          lote_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stg_faturamento_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "importacao_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      stg_financeiro_aberto: {
        Row: {
          created_at: string
          dados: Json | null
          erro: string | null
          id: string
          lote_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          erro?: string | null
          id?: string
          lote_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          dados?: Json | null
          erro?: string | null
          id?: string
          lote_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stg_financeiro_aberto_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "importacao_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      transportadoras: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          contato: string | null
          cpf_cnpj: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          id: string
          logradouro: string | null
          modalidade: string | null
          motivo_inativacao: string | null
          nome_fantasia: string | null
          nome_razao_social: string
          numero: string | null
          observacoes: string | null
          prazo_medio: string | null
          telefone: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          contato?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          logradouro?: string | null
          modalidade?: string | null
          motivo_inativacao?: string | null
          nome_fantasia?: string | null
          nome_razao_social: string
          numero?: string | null
          observacoes?: string | null
          prazo_medio?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          contato?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          logradouro?: string | null
          modalidade?: string | null
          motivo_inativacao?: string | null
          nome_fantasia?: string | null
          nome_razao_social?: string
          numero?: string | null
          observacoes?: string | null
          prazo_medio?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      unidades_medida: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string
          id: string
          observacoes: string | null
          sigla: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao: string
          id?: string
          observacoes?: string | null
          sigla?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string
          id?: string
          observacoes?: string | null
          sigla?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          action: string
          allowed: boolean
          created_at: string
          id: string
          resource: string
          user_id: string
        }
        Insert: {
          action: string
          allowed?: boolean
          created_at?: string
          id?: string
          resource: string
          user_id: string
        }
        Update: {
          action?: string
          allowed?: boolean
          created_at?: string
          id?: string
          resource?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          columns_config: Json | null
          id: string
          module_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          columns_config?: Json | null
          id?: string
          module_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          columns_config?: Json | null
          id?: string
          module_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workbook_geracoes: {
        Row: {
          arquivo_path: string | null
          competencia_final: string | null
          competencia_inicial: string | null
          created_at: string
          empresa_id: string | null
          fechamento_id_final: string | null
          fechamento_id_inicial: string | null
          gerado_em: string
          gerado_por: string | null
          hash_geracao: string | null
          id: string
          modo_geracao: string | null
          observacoes: string | null
          parametros_json: Json | null
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          arquivo_path?: string | null
          competencia_final?: string | null
          competencia_inicial?: string | null
          created_at?: string
          empresa_id?: string | null
          fechamento_id_final?: string | null
          fechamento_id_inicial?: string | null
          gerado_em?: string
          gerado_por?: string | null
          hash_geracao?: string | null
          id?: string
          modo_geracao?: string | null
          observacoes?: string | null
          parametros_json?: Json | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_path?: string | null
          competencia_final?: string | null
          competencia_inicial?: string | null
          created_at?: string
          empresa_id?: string | null
          fechamento_id_final?: string | null
          fechamento_id_inicial?: string | null
          gerado_em?: string
          gerado_por?: string | null
          hash_geracao?: string | null
          id?: string
          modo_geracao?: string | null
          observacoes?: string | null
          parametros_json?: Json | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workbook_geracoes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workbook_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workbook_templates: {
        Row: {
          arquivo_path: string
          ativo: boolean
          codigo: string
          created_at: string
          estrutura_json: Json | null
          id: string
          nome: string
          updated_at: string
          versao: string
        }
        Insert: {
          arquivo_path?: string
          ativo?: boolean
          codigo: string
          created_at?: string
          estrutura_json?: Json | null
          id?: string
          nome: string
          updated_at?: string
          versao?: string
        }
        Update: {
          arquivo_path?: string
          ativo?: boolean
          codigo?: string
          created_at?: string
          estrutura_json?: Json | null
          id?: string
          nome?: string
          updated_at?: string
          versao?: string
        }
        Relationships: []
      }
    }
    Views: {
      orcamentos_itens_public_view: {
        Row: {
          codigo_snapshot: string | null
          descricao_snapshot: string | null
          id: string | null
          orcamento_id: string | null
          peso_total: number | null
          peso_unitario: number | null
          quantidade: number | null
          unidade: string | null
          valor_total: number | null
          valor_unitario: number | null
          variacao: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_comercial"
            referencedColumns: ["orcamento_id"]
          },
        ]
      }
      orcamentos_public_view: {
        Row: {
          ativo: boolean | null
          cliente_snapshot: Json | null
          data_orcamento: string | null
          frete_tipo: string | null
          id: string | null
          numero: string | null
          observacoes: string | null
          prazo_entrega: string | null
          prazo_pagamento: string | null
          public_token: string | null
          status: string | null
          validade: string | null
          valor_total: number | null
        }
        Insert: {
          ativo?: boolean | null
          cliente_snapshot?: Json | null
          data_orcamento?: string | null
          frete_tipo?: string | null
          id?: string | null
          numero?: string | null
          observacoes?: string | null
          prazo_entrega?: string | null
          prazo_pagamento?: string | null
          public_token?: string | null
          status?: string | null
          validade?: string | null
          valor_total?: number | null
        }
        Update: {
          ativo?: boolean | null
          cliente_snapshot?: Json | null
          data_orcamento?: string | null
          frete_tipo?: string | null
          id?: string | null
          numero?: string | null
          observacoes?: string | null
          prazo_entrega?: string | null
          prazo_pagamento?: string | null
          public_token?: string | null
          status?: string | null
          validade?: string | null
          valor_total?: number | null
        }
        Relationships: []
      }
      v_trilha_comercial: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          criado_em: string | null
          nf_id: string | null
          nf_numero: string | null
          nf_status: string | null
          orcamento_id: string | null
          orcamento_numero: string | null
          orcamento_status: string | null
          pedido_id: string | null
          pedido_numero: string | null
          pedido_status: string | null
          status_faturamento: string | null
          valor_nf: number | null
          valor_orcamento: number | null
          valor_pedido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      v_trilha_compras: {
        Row: {
          compra_id: string | null
          compra_numero: string | null
          compra_status: string | null
          compra_valor_total: number | null
          cotacao_id: string | null
          cotacao_numero: string | null
          cotacao_status: string | null
          data_entrega_real: string | null
          fornecedor_id: string | null
          fornecedor_nome: string | null
          pedido_id: string | null
          pedido_numero: string | null
          pedido_status: string | null
          pedido_valor_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      v_trilha_fiscal: {
        Row: {
          data_emissao: string | null
          devolucoes_ids: string[] | null
          estoque_movimento_ids: string[] | null
          eventos_count: number | null
          financeiro_lancamento_ids: string[] | null
          nf_id: string | null
          nf_referenciada_id: string | null
          numero: string | null
          ordem_venda_id: string | null
          origem: string | null
          status: string | null
          status_sefaz: string | null
          tipo: string | null
          tipo_operacao: string | null
          valor_total: number | null
        }
        Insert: {
          data_emissao?: string | null
          devolucoes_ids?: never
          estoque_movimento_ids?: never
          eventos_count?: never
          financeiro_lancamento_ids?: never
          nf_id?: string | null
          nf_referenciada_id?: string | null
          numero?: string | null
          ordem_venda_id?: string | null
          origem?: string | null
          status?: string | null
          status_sefaz?: string | null
          tipo?: string | null
          tipo_operacao?: string | null
          valor_total?: number | null
        }
        Update: {
          data_emissao?: string | null
          devolucoes_ids?: never
          estoque_movimento_ids?: never
          eventos_count?: never
          financeiro_lancamento_ids?: never
          nf_id?: string | null
          nf_referenciada_id?: string | null
          numero?: string | null
          ordem_venda_id?: string | null
          origem?: string | null
          status?: string | null
          status_sefaz?: string | null
          tipo?: string | null
          tipo_operacao?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_nf_referenciada_id_fkey"
            columns: ["nf_referenciada_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_nf_referenciada_id_fkey"
            columns: ["nf_referenciada_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_comercial"
            referencedColumns: ["nf_id"]
          },
          {
            foreignKeyName: "notas_fiscais_nf_referenciada_id_fkey"
            columns: ["nf_referenciada_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_fiscal"
            referencedColumns: ["nf_id"]
          },
          {
            foreignKeyName: "notas_fiscais_ordem_venda_id_fkey"
            columns: ["ordem_venda_id"]
            isOneToOne: false
            referencedRelation: "ordens_venda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_ordem_venda_id_fkey"
            columns: ["ordem_venda_id"]
            isOneToOne: false
            referencedRelation: "v_trilha_comercial"
            referencedColumns: ["pedido_id"]
          },
          {
            foreignKeyName: "notas_fiscais_ordem_venda_id_fkey"
            columns: ["ordem_venda_id"]
            isOneToOne: false
            referencedRelation: "vw_entregas_consolidadas"
            referencedColumns: ["ordem_venda_id"]
          },
        ]
      }
      v_trilha_logistica: {
        Row: {
          codigo_rastreio: string | null
          compra_id: string | null
          ordem_venda_id: string | null
          ordem_venda_numero: string | null
          origem: string | null
          pedido_compra_id: string | null
          pedido_compra_numero: string | null
          recebimento_id: string | null
          remessa_id: string | null
          status_transporte: string | null
        }
        Relationships: []
      }
      vw_conciliacao_eventos_financeiros: {
        Row: {
          baixa_id: string | null
          cliente_id: string | null
          conciliacao_data: string | null
          conciliacao_extrato_referencia: string | null
          conciliacao_status: string | null
          conta_bancaria_id: string | null
          conta_descricao: string | null
          data_baixa: string | null
          estornada_em: string | null
          forma_pagamento: string | null
          fornecedor_id: string | null
          lancamento_descricao: string | null
          lancamento_id: string | null
          lancamento_tipo: string | null
          valor_pago: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_baixas_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_baixas_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_bancos_saldo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_baixas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_baixas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_aging_cp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_baixas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "vw_workbook_aging_cr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_entregas_consolidadas: {
        Row: {
          cidade: string | null
          cliente: string | null
          cliente_id: string | null
          data_entrega: string | null
          data_expedicao: string | null
          numero_pedido: string | null
          ordem_venda_id: string | null
          peso_total: number | null
          previsao_entrega: string | null
          previsao_envio: string | null
          status_consolidado: string | null
          tem_divergencia_quantidade: boolean | null
          total_remessas: number | null
          total_volumes: number | null
          transportadora: string | null
          transportadora_principal_id: string | null
          uf: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_venda_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_transportadora_id_fkey"
            columns: ["transportadora_principal_id"]
            isOneToOne: false
            referencedRelation: "transportadoras"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_fluxo_caixa_financeiro: {
        Row: {
          baixa_id: string | null
          categoria: string | null
          cliente_id: string | null
          conta_bancaria_id: string | null
          data_ref: string | null
          descricao: string | null
          fornecedor_id: string | null
          lancamento_id: string | null
          status: string | null
          tipo: string | null
          valor: number | null
        }
        Relationships: []
      }
      vw_recebimentos_consolidado: {
        Row: {
          data_recebimento: string | null
          fornecedor: string | null
          fornecedor_id: string | null
          nf_vinculada: string | null
          numero_compra: string | null
          pedido_compra_id: string | null
          pendencia: number | null
          previsao_entrega: string | null
          quantidade_pedida: number | null
          quantidade_recebida: number | null
          status_logistico: string | null
          tem_consolidacao_real: boolean | null
          tem_divergencia: boolean | null
          total_recebimentos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_workbook_aging_cp: {
        Row: {
          data_vencimento: string | null
          descricao: string | null
          fornecedor_id: string | null
          id: string | null
          saldo_aberto: number | null
          status: string | null
          valor: number | null
          valor_pago: number | null
        }
        Insert: {
          data_vencimento?: string | null
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string | null
          saldo_aberto?: never
          status?: string | null
          valor?: number | null
          valor_pago?: never
        }
        Update: {
          data_vencimento?: string | null
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string | null
          saldo_aberto?: never
          status?: string | null
          valor?: number | null
          valor_pago?: never
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_lancamentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_workbook_aging_cr: {
        Row: {
          cliente_id: string | null
          data_vencimento: string | null
          descricao: string | null
          id: string | null
          saldo_aberto: number | null
          status: string | null
          valor: number | null
          valor_pago: number | null
        }
        Insert: {
          cliente_id?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          id?: string | null
          saldo_aberto?: never
          status?: string | null
          valor?: number | null
          valor_pago?: never
        }
        Update: {
          cliente_id?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          id?: string | null
          saldo_aberto?: never
          status?: string | null
          valor?: number | null
          valor_pago?: never
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_lancamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_workbook_bancos_saldo: {
        Row: {
          agencia: string | null
          banco_nome: string | null
          conta: string | null
          descricao: string | null
          id: string | null
          saldo_atual: number | null
        }
        Relationships: []
      }
      vw_workbook_despesa_mensal: {
        Row: {
          competencia: string | null
          quantidade: number | null
          total_despesa: number | null
          total_pago: number | null
        }
        Relationships: []
      }
      vw_workbook_estoque_posicao: {
        Row: {
          custo_unitario: number | null
          grupo_id: string | null
          grupo_nome: string | null
          nome: string | null
          produto_id: string | null
          quantidade: number | null
          sku: string | null
          valor_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_produto"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_workbook_faturamento_mensal: {
        Row: {
          competencia: string | null
          quantidade_nfs: number | null
          total_faturado: number | null
        }
        Relationships: []
      }
      vw_workbook_receita_mensal: {
        Row: {
          competencia: string | null
          quantidade: number | null
          total_recebido: number | null
          total_receita: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      ajustar_estoque_manual:
        | {
            Args: {
              p_motivo?: string
              p_produto_id: string
              p_quantidade: number
              p_tipo: string
            }
            Returns: string
          }
        | {
            Args: {
              p_categoria_ajuste?: string
              p_motivo?: string
              p_motivo_estruturado?: string
              p_produto_id: string
              p_quantidade: number
              p_tipo: string
            }
            Returns: string
          }
      aprovar_pedido: { Args: { p_pedido_id: string }; Returns: Json }
      cancelar_cotacao_compra: {
        Args: { p_id: string; p_motivo?: string }
        Returns: Json
      }
      cancelar_nota_fiscal: {
        Args: { p_motivo: string; p_nf_id: string }
        Returns: undefined
      }
      cancelar_nota_fiscal_sefaz: {
        Args: { p_motivo: string; p_nf_id: string; p_protocolo: string }
        Returns: undefined
      }
      cancelar_orcamento: {
        Args: { p_id: string; p_motivo?: string }
        Returns: Json
      }
      cancelar_remessa: {
        Args: { p_motivo?: string; p_remessa_id: string }
        Returns: undefined
      }
      carga_inicial_conciliacao: {
        Args: { p_force?: boolean; p_lote_id: string }
        Returns: Json
      }
      confirmar_nota_fiscal: { Args: { p_nf_id: string }; Returns: undefined }
      consolidar_lote_cadastros: { Args: { p_lote_id: string }; Returns: Json }
      consolidar_lote_enriquecimento: {
        Args: { p_lote_id: string }
        Returns: Json
      }
      consolidar_lote_estoque: { Args: { p_lote_id: string }; Returns: Json }
      consolidar_lote_faturamento: {
        Args: { p_lote_id: string }
        Returns: Json
      }
      consolidar_lote_financeiro: { Args: { p_lote_id: string }; Returns: Json }
      converter_orcamento_em_ov:
        | {
            Args: {
              p_data_po?: string
              p_orcamento_id: string
              p_po_number?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_data_po?: string
              p_forcar?: boolean
              p_orcamento_id: string
              p_po_number?: string
            }
            Returns: Json
          }
      count_estoque_baixo: { Args: never; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      estornar_baixa_financeira: {
        Args: { p_baixa_id: string; p_motivo?: string }
        Returns: undefined
      }
      estornar_nota_fiscal: {
        Args: { p_motivo?: string; p_nf_id: string }
        Returns: undefined
      }
      estornar_recebimento_compra: {
        Args: { p_compra_id: string; p_motivo?: string }
        Returns: Json
      }
      expedir_remessa: {
        Args: { p_data_expedicao?: string; p_remessa_id: string }
        Returns: undefined
      }
      expirar_orcamentos_vencidos: { Args: never; Returns: number }
      financeiro_cancelar_lancamento: {
        Args: { p_id: string; p_motivo: string }
        Returns: undefined
      }
      financeiro_conciliar_baixa: {
        Args: {
          p_baixa_id: string
          p_extrato_referencia?: string
          p_status: string
        }
        Returns: undefined
      }
      financeiro_processar_baixa_lote: {
        Args: { p_items: Json }
        Returns: Json
      }
      financeiro_processar_estorno: {
        Args: { p_lancamento_id: string; p_motivo?: string }
        Returns: Json
      }
      financeiro_status_efetivo: {
        Args: { p_dv: string; p_ref: string; p_status: string }
        Returns: string
      }
      gerar_devolucao_nota_fiscal: {
        Args: { p_itens?: Json; p_nf_origem_id: string }
        Returns: string
      }
      gerar_financeiro_folha: {
        Args: { p_competencia: string; p_data_vencimento: string }
        Returns: number
      }
      gerar_nf_de_pedido: { Args: { p_pedido_id: string }; Returns: Json }
      gerar_parcelas_financeiras: {
        Args: {
          p_base: Json
          p_intervalo_dias?: number
          p_num_parcelas: number
        }
        Returns: string
      }
      gerar_pedido_compra: {
        Args: { p_cotacao_id: string; p_observacoes?: string }
        Returns: Json
      }
      get_recebimento_status_efetivo: {
        Args: {
          p_previsao: string
          p_status: string
          p_tem_divergencia: boolean
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inutilizar_nota_fiscal: {
        Args: { p_motivo: string; p_nf_id: string; p_protocolo: string }
        Returns: undefined
      }
      limpar_dados_migracao: { Args: { p_confirmar?: boolean }; Returns: Json }
      marcar_lancamentos_vencidos: { Args: never; Returns: number }
      marcar_remessa_em_transito: {
        Args: { p_remessa_id: string }
        Returns: undefined
      }
      marcar_remessa_entregue: {
        Args: { p_data_entrega?: string; p_remessa_id: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      normalize_text_match: { Args: { p_input: string }; Returns: string }
      proximo_numero_cotacao_compra: { Args: never; Returns: string }
      proximo_numero_nf: { Args: never; Returns: string }
      proximo_numero_nota_fiscal: { Args: never; Returns: string }
      proximo_numero_orcamento: { Args: never; Returns: string }
      proximo_numero_ordem_venda: { Args: never; Returns: string }
      proximo_numero_pedido_compra: { Args: never; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      receber_compra: {
        Args: {
          p_data_recebimento: string
          p_itens: Json
          p_observacoes?: string
          p_pedido_id: string
        }
        Returns: Json
      }
      registrar_baixa_financeira: {
        Args: {
          p_conta_bancaria_id: string
          p_data_baixa: string
          p_forma_pagamento: string
          p_lancamento_id: string
          p_observacoes?: string
          p_valor_pago: number
        }
        Returns: string
      }
      registrar_recebimento_compra: {
        Args: {
          p_compra_id?: string
          p_data_recebimento: string
          p_itens: Json
          p_nota_fiscal_id?: string
          p_observacoes?: string
          p_pedido_compra_id: string
        }
        Returns: string
      }
      rejeitar_pedido: {
        Args: { p_motivo: string; p_pedido_id: string }
        Returns: Json
      }
      replace_cotacao_compra_itens: {
        Args: { p_cotacao_id: string; p_itens: Json }
        Returns: undefined
      }
      replace_pedido_compra_itens: {
        Args: { p_itens: Json; p_pedido_id: string }
        Returns: Json
      }
      salvar_orcamento: {
        Args: { p_id: string; p_itens: Json; p_payload: Json }
        Returns: string
      }
      save_produto_composicao: {
        Args: { p_itens: Json; p_payload?: Json; p_produto_pai_id: string }
        Returns: undefined
      }
      set_principal_endereco: {
        Args: { p_cliente_id: string; p_endereco_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      social_alertas_periodo: {
        Args: { _data_fim: string; _data_inicio: string }
        Returns: {
          created_at: string
          id: string
          mensagem: string
          tipo: string
        }[]
      }
      social_dashboard_consolidado: {
        Args: { _data_fim: string; _data_inicio: string }
        Returns: Json
      }
      social_posts_filtrados: {
        Args: { _conta_id?: string; _data_fim: string; _data_inicio: string }
        Returns: {
          alcance: number | null
          comentarios: number | null
          compartilhamentos: number | null
          conta_id: string
          conteudo: string | null
          created_at: string
          curtidas: number | null
          data_publicacao: string | null
          id: string
          impressoes: number | null
          post_id_externo: string | null
          tipo: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "social_posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      social_sincronizar_manual: { Args: { _conta_id?: string }; Returns: Json }
      solicitar_aprovacao_pedido: {
        Args: { p_pedido_id: string }
        Returns: Json
      }
      sugerir_conciliacao_bancaria: {
        Args: { p_conta_id: string; p_extrato: Json }
        Returns: {
          extrato_id: string
          lancamento_id: string
          score: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "viewer"
        | "vendedor"
        | "financeiro"
        | "estoquista"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "user",
        "viewer",
        "vendedor",
        "financeiro",
        "estoquista",
      ],
    },
  },
} as const
