export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          initial_balance: number
          name: string
          type: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          initial_balance?: number
          name: string
          type: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          initial_balance?: number
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          category_type: string
          created_at: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          user_id: string | null
        }
        Insert: {
          category_type?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          user_id?: string | null
        }
        Update: {
          category_type?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      credit_cards: {
        Row: {
          brand: string | null
          connected_account_id: string | null
          created_at: string | null
          due_date: number
          id: string
          limit: number
          name: string
          statement_date: number
          user_id: string
        }
        Insert: {
          brand?: string | null
          connected_account_id?: string | null
          created_at?: string | null
          due_date: number
          id?: string
          limit: number
          name: string
          statement_date: number
          user_id: string
        }
        Update: {
          brand?: string | null
          connected_account_id?: string | null
          created_at?: string | null
          due_date?: number
          id?: string
          limit?: number
          name?: string
          statement_date?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_cards_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "vw_account_current_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "credit_cards_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "vw_account_projected_balance"
            referencedColumns: ["account_id"]
          },
        ]
      }
      global_learned_patterns: {
        Row: {
          category: string
          confidence: number
          created_at: string | null
          description: string
          first_learned_at: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          metadata: Json | null
          normalized_description: string
          source_type: string
          subcategory: string | null
          usage_count: number
          user_votes: number
        }
        Insert: {
          category: string
          confidence?: number
          created_at?: string | null
          description: string
          first_learned_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          metadata?: Json | null
          normalized_description: string
          source_type?: string
          subcategory?: string | null
          usage_count?: number
          user_votes?: number
        }
        Update: {
          category?: string
          confidence?: number
          created_at?: string | null
          description?: string
          first_learned_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          metadata?: Json | null
          normalized_description?: string
          source_type?: string
          subcategory?: string | null
          usage_count?: number
          user_votes?: number
        }
        Relationships: []
      }
      merchants_dictionary: {
        Row: {
          aliases: string[] | null
          category: string
          confidence_modifier: number
          context: string | null
          created_at: string | null
          created_by: string | null
          entity_name: string
          entry_type: string
          id: string
          is_active: boolean | null
          keywords: string[] | null
          last_used_at: string | null
          merchant_key: string
          metadata: Json | null
          priority: number
          regex_patterns: string[] | null
          region: string | null
          source_type: string | null
          state_specific: boolean | null
          states: string[] | null
          subcategory: string | null
          updated_at: string | null
          updated_by: string | null
          usage_count: number | null
        }
        Insert: {
          aliases?: string[] | null
          category: string
          confidence_modifier?: number
          context?: string | null
          created_at?: string | null
          created_by?: string | null
          entity_name: string
          entry_type?: string
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          last_used_at?: string | null
          merchant_key: string
          metadata?: Json | null
          priority?: number
          regex_patterns?: string[] | null
          region?: string | null
          source_type?: string | null
          state_specific?: boolean | null
          states?: string[] | null
          subcategory?: string | null
          updated_at?: string | null
          updated_by?: string | null
          usage_count?: number | null
        }
        Update: {
          aliases?: string[] | null
          category?: string
          confidence_modifier?: number
          context?: string | null
          created_at?: string | null
          created_by?: string | null
          entity_name?: string
          entry_type?: string
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          last_used_at?: string | null
          merchant_key?: string
          metadata?: Json | null
          priority?: number
          regex_patterns?: string[] | null
          region?: string | null
          source_type?: string | null
          state_specific?: boolean | null
          states?: string[] | null
          subcategory?: string | null
          updated_at?: string | null
          updated_by?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      people: {
        Row: {
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      series: {
        Row: {
          category_id: string | null
          created_at: string | null
          created_by_txn_id: string | null
          description: string
          end_date: string | null
          frequency: string
          id: string
          is_fixed: boolean
          logo_url: string | null
          start_date: string
          total_installments: number
          total_value: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          created_by_txn_id?: string | null
          description: string
          end_date?: string | null
          frequency?: string
          id?: string
          is_fixed?: boolean
          logo_url?: string | null
          start_date?: string
          total_installments: number
          total_value: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          created_by_txn_id?: string | null
          description?: string
          end_date?: string | null
          frequency?: string
          id?: string
          is_fixed?: boolean
          logo_url?: string | null
          start_date?: string
          total_installments?: number
          total_value?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          category_id: string | null
          compensation_value: number | null
          composition_details: string | null
          created_at: string | null
          credit_card_id: string | null
          date: string
          description: string
          id: string
          installment_number: number | null
          is_fixed: boolean | null
          is_shared: boolean | null
          linked_txn_id: string | null
          liquidation_date: string | null
          payment_method: string | null
          person_id: string | null
          series_id: string | null
          status: string
          type: string
          updated_at: string | null
          user_id: string
          value: number
        }
        Insert: {
          account_id?: string | null
          category_id?: string | null
          compensation_value?: number | null
          composition_details?: string | null
          created_at?: string | null
          credit_card_id?: string | null
          date: string
          description: string
          id?: string
          installment_number?: number | null
          is_fixed?: boolean | null
          is_shared?: boolean | null
          linked_txn_id?: string | null
          liquidation_date?: string | null
          payment_method?: string | null
          person_id?: string | null
          series_id?: string | null
          status?: string
          type: string
          updated_at?: string | null
          user_id: string
          value: number
        }
        Update: {
          account_id?: string | null
          category_id?: string | null
          compensation_value?: number | null
          composition_details?: string | null
          created_at?: string | null
          credit_card_id?: string | null
          date?: string
          description?: string
          id?: string
          installment_number?: number | null
          is_fixed?: boolean | null
          is_shared?: boolean | null
          linked_txn_id?: string | null
          liquidation_date?: string | null
          payment_method?: string | null
          person_id?: string | null
          series_id?: string | null
          status?: string
          type?: string
          updated_at?: string | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "vw_account_current_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "vw_account_projected_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_linked_txn_id_fkey"
            columns: ["linked_txn_id"]
            isOneToOne: false
            referencedRelation: "transaction_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_linked_txn_id_fkey"
            columns: ["linked_txn_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series_summary"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mv_frequent_merchants: {
        Row: {
          aliases: string[] | null
          category: string | null
          confidence_modifier: number | null
          entity_name: string | null
          entry_type: string | null
          id: string | null
          last_used_at: string | null
          merchant_key: string | null
          priority: number | null
          subcategory: string | null
          usage_count: number | null
        }
        Relationships: []
      }
      mv_frequent_patterns: {
        Row: {
          category: string | null
          confidence: number | null
          last_used_at: string | null
          normalized_description: string | null
          subcategory: string | null
          usage_count: number | null
          user_votes: number | null
        }
        Relationships: []
      }
      series_summary: {
        Row: {
          category_id: string | null
          created_at: string | null
          created_installments: number | null
          description: string | null
          id: string | null
          is_fixed: boolean | null
          paid_installments: number | null
          paid_value: number | null
          pending_installments: number | null
          pending_value: number | null
          total_installments: number | null
          total_value: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "series_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_installments: {
        Row: {
          date: string | null
          description: string | null
          id: string | null
          installment_display: string | null
          installment_number: number | null
          series_description: string | null
          series_id: string | null
          series_is_fixed: boolean | null
          series_total_value: number | null
          status: string | null
          total_installments: number | null
          type: string | null
          user_id: string | null
          value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_account_current_balance: {
        Row: {
          account_id: string | null
          current_balance: number | null
          user_id: string | null
        }
        Relationships: []
      }
      vw_account_projected_balance: {
        Row: {
          account_id: string | null
          projected_balance: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      batch_update_learned_patterns: {
        Args: { p_updates: Json[] }
        Returns: number
      }
      cleanup_old_global_learned_patterns: {
        Args: {
          p_days_old?: number
          p_min_usage?: number
          p_min_user_votes?: number
        }
        Returns: number
      }
      cleanup_orphaned_series: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      create_installment_series: {
        Args: {
          p_account_id: string
          p_category_id: string
          p_credit_card_id: string
          p_description: string
          p_installments_data: Json
          p_is_fixed: boolean
          p_payment_method: string
          p_person_id: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      delete_installment_series: {
        Args: { p_series_id: string; p_user_id: string }
        Returns: number
      }
      generate_future_fixed_transactions: {
        Args: { count: number; from_date: string; target_series_id: string }
        Returns: number
      }
      get_global_learned_patterns: {
        Args: {
          p_limit?: number
          p_min_confidence?: number
          p_min_user_votes?: number
        }
        Returns: {
          category: string
          confidence: number
          description: string
          id: string
          last_used_at: string
          subcategory: string
          usage_count: number
          user_votes: number
        }[]
      }
      get_patterns_by_descriptions: {
        Args: { p_descriptions: string[]; p_min_confidence?: number }
        Returns: {
          category: string
          confidence: number
          description: string
          subcategory: string
          usage_count: number
          user_votes: number
        }[]
      }
      get_top_merchants: {
        Args: { p_limit?: number }
        Returns: {
          aliases: string[]
          category: string
          confidence_modifier: number
          entity_name: string
          entry_type: string
          id: string
          merchant_key: string
          priority: number
          subcategory: string
          usage_count: number
        }[]
      }
      get_top_patterns_by_category: {
        Args: {
          p_category: string
          p_limit?: number
          p_min_confidence?: number
        }
        Returns: {
          category: string
          confidence: number
          description: string
          subcategory: string
          usage_count: number
          user_votes: number
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      maintain_fixed_transaction_series: {
        Args: Record<PropertyKey, never>
        Returns: {
          generated_count: number
          next_generation_date: string
          series_id: string
        }[]
      }
      record_merchant_usage: {
        Args: { p_merchant_id: string }
        Returns: undefined
      }
      refresh_frequent_merchants: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_frequent_patterns_view: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      run_fixed_transaction_maintenance: {
        Args: Record<PropertyKey, never>
        Returns: {
          generated_transactions: number
          processed_series: number
        }[]
      }
      search_banking_pattern: {
        Args: { p_context?: string; p_description: string }
        Returns: {
          category: string
          confidence_modifier: number
          id: string
          merchant_key: string
          priority: number
          subcategory: string
        }[]
      }
      search_by_keywords: {
        Args: { p_description: string; p_type?: string }
        Returns: {
          category: string
          confidence_modifier: number
          id: string
          merchant_key: string
          priority: number
          subcategory: string
        }[]
      }
      search_merchant: {
        Args: {
          p_description: string
          p_limit?: number
          p_user_location?: string
        }
        Returns: {
          category: string
          confidence_modifier: number
          entity_name: string
          id: string
          match_score: number
          merchant_key: string
          priority: number
          subcategory: string
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      update_global_learned_pattern: {
        Args: {
          p_category: string
          p_confidence?: number
          p_description: string
          p_subcategory?: string
          p_user_vote?: boolean
        }
        Returns: undefined
      }
      update_installment_series: {
        Args: {
          p_installments_data: Json
          p_series_id: string
          p_user_id: string
        }
        Returns: number
      }
      update_transaction_series_with_balance: {
        Args: {
          affected_account_id: string
          from_date: string
          new_account_id: string
          new_category_id: string
          new_credit_card_id: string
          new_description: string
          new_installments: number
          new_is_fixed: boolean
          new_payment_method: string
          new_person_id: string
          new_type: string
          new_value: number
          series_id: string
          total_value_difference: number
        }
        Returns: number
      }
      update_transaction_with_balance: {
        Args: {
          affected_account_id: string
          new_account_id: string
          new_category_id: string
          new_credit_card_id: string
          new_date: string
          new_description: string
          new_installments: number
          new_is_fixed: boolean
          new_payment_method: string
          new_person_id: string
          new_type: string
          new_value: number
          transaction_id: string
          value_difference: number
        }
        Returns: undefined
      }
      vote_on_learned_pattern: {
        Args: { p_description: string; p_user_vote?: boolean }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          format: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          format?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          level: number | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      prefixes: {
        Row: {
          bucket_id: string
          created_at: string | null
          level: number
          name: string
          updated_at: string | null
        }
        Insert: {
          bucket_id: string
          created_at?: string | null
          level?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          bucket_id?: string
          created_at?: string | null
          level?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prefixes_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_prefixes: {
        Args: { _bucket_id: string; _name: string }
        Returns: undefined
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      delete_leaf_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      delete_prefix: {
        Args: { _bucket_id: string; _name: string }
        Returns: boolean
      }
      extension: {
        Args: { name: string }
        Returns: string
      }
      filename: {
        Args: { name: string }
        Returns: string
      }
      foldername: {
        Args: { name: string }
        Returns: string[]
      }
      get_level: {
        Args: { name: string }
        Returns: number
      }
      get_prefix: {
        Args: { name: string }
        Returns: string
      }
      get_prefixes: {
        Args: { name: string }
        Returns: string[]
      }
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          start_after?: string
        }
        Returns: {
          id: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      lock_top_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      operation: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_legacy_v1: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v1_optimised: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS"],
    },
  },
} as const

