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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          ip: string | null
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          active: boolean
          button_label: string | null
          button_url: string | null
          created_at: string
          ends_at: string | null
          id: string
          image_url: string | null
          sort_order: number
          starts_at: string | null
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          button_label?: string | null
          button_url?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          sort_order?: number
          starts_at?: string | null
          subtitle?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          button_label?: string | null
          button_url?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          sort_order?: number
          starts_at?: string | null
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          amount: number
          created_at: string
          id: string
          level: number
          payment_id: string
          percentage: number
          referred_id: string
          sponsor_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          level: number
          payment_id: string
          percentage: number
          referred_id: string
          sponsor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          level?: number
          payment_id?: string
          percentage?: number
          referred_id?: string
          sponsor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_roi_logs: {
        Row: {
          amount: number
          created_at: string
          id: string
          user_plan_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          user_plan_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          user_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_roi_logs_user_plan_id_fkey"
            columns: ["user_plan_id"]
            isOneToOne: false
            referencedRelation: "user_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          points_cost: number
          product_id: string
          product_name: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          points_cost: number
          product_id: string
          product_name: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          points_cost?: number
          product_id?: string
          product_name?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          order_number: string
          points_used: number
          ship_city: string
          ship_complement: string | null
          ship_district: string
          ship_name: string
          ship_number: string
          ship_state: string
          ship_street: string
          ship_zip: string
          status: Database["public"]["Enums"]["order_status"]
          tracking_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_number?: string
          points_used?: number
          ship_city: string
          ship_complement?: string | null
          ship_district: string
          ship_name: string
          ship_number: string
          ship_state: string
          ship_street: string
          ship_zip: string
          status?: Database["public"]["Enums"]["order_status"]
          tracking_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_number?: string
          points_used?: number
          ship_city?: string
          ship_complement?: string | null
          ship_district?: string
          ship_name?: string
          ship_number?: string
          ship_state?: string
          ship_street?: string
          ship_zip?: string
          status?: Database["public"]["Enums"]["order_status"]
          tracking_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          payment_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          payment_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          external_id: string | null
          gateway: string
          id: string
          paid_at: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          plan_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
          user_plan_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string | null
          external_id?: string | null
          gateway?: string
          id?: string
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
          user_plan_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          external_id?: string | null
          gateway?: string
          id?: string
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
          user_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_plan_id_fkey"
            columns: ["user_plan_id"]
            isOneToOne: false
            referencedRelation: "user_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pix_keys: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          key_type: Database["public"]["Enums"]["pix_key_type"]
          key_value: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          key_type: Database["public"]["Enums"]["pix_key_type"]
          key_value: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          key_type?: Database["public"]["Enums"]["pix_key_type"]
          key_value?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pix_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          benefits: string[]
          created_at: string
          description: string
          id: string
          image_url: string | null
          name: string
          points: number
          price: number
          sort_order: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          active?: boolean
          benefits?: string[]
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          name: string
          points?: number
          price: number
          sort_order?: number
          updated_at?: string
          validity_days?: number
        }
        Update: {
          active?: boolean
          benefits?: string[]
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          name?: string
          points?: number
          price?: number
          sort_order?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: []
      }
      points_transactions: {
        Row: {
          balance_after: number
          category: Database["public"]["Enums"]["tx_category"]
          created_at: string
          description: string
          direction: Database["public"]["Enums"]["tx_direction"]
          id: string
          points: number
          reference_id: string | null
          user_id: string
        }
        Insert: {
          balance_after?: number
          category?: Database["public"]["Enums"]["tx_category"]
          created_at?: string
          description?: string
          direction: Database["public"]["Enums"]["tx_direction"]
          id?: string
          points: number
          reference_id?: string | null
          user_id: string
        }
        Update: {
          balance_after?: number
          category?: Database["public"]["Enums"]["tx_category"]
          created_at?: string
          description?: string
          direction?: Database["public"]["Enums"]["tx_direction"]
          id?: string
          points?: number
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          description: string
          id: string
          image_url: string | null
          name: string
          points_cost: number
          sku: string | null
          stock: number
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          name: string
          points_cost: number
          sku?: string | null
          stock?: number
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          name?: string
          points_cost?: number
          sku?: string | null
          stock?: number
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          blocked: boolean
          cpf: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          notify_email: boolean
          notify_whatsapp: boolean
          phone: string | null
          referral_code: string
          sponsor_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          blocked?: boolean
          cpf?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
          notify_email?: boolean
          notify_whatsapp?: boolean
          phone?: string | null
          referral_code: string
          sponsor_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          blocked?: boolean
          cpf?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          notify_email?: boolean
          notify_whatsapp?: boolean
          phone?: string | null
          referral_code?: string
          sponsor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          level: number
          referred_id: string
          sponsor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: number
          referred_id: string
          sponsor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          referred_id?: string
          sponsor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      user_plans: {
        Row: {
          activated_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          plan_id: string
          plan_name: string
          points_granted: number
          price: number
          status: Database["public"]["Enums"]["user_plan_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id: string
          plan_name: string
          points_granted?: number
          price: number
          status?: Database["public"]["Enums"]["user_plan_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id?: string
          plan_name?: string
          points_granted?: number
          price?: number
          status?: Database["public"]["Enums"]["user_plan_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          category: Database["public"]["Enums"]["tx_category"]
          created_at: string
          description: string
          direction: Database["public"]["Enums"]["tx_direction"]
          id: string
          reference_id: string | null
          status: Database["public"]["Enums"]["tx_status"]
          user_id: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Insert: {
          amount: number
          balance_after?: number
          balance_before?: number
          category: Database["public"]["Enums"]["tx_category"]
          created_at?: string
          description?: string
          direction: Database["public"]["Enums"]["tx_direction"]
          id?: string
          reference_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          user_id: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          category?: Database["public"]["Enums"]["tx_category"]
          created_at?: string
          description?: string
          direction?: Database["public"]["Enums"]["tx_direction"]
          id?: string
          reference_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          user_id?: string
          wallet_type?: Database["public"]["Enums"]["wallet_type"]
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          earnings_balance: number
          main_balance: number
          points_balance: number
          referral_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          earnings_balance?: number
          main_balance?: number
          points_balance?: number
          referral_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          earnings_balance?: number
          main_balance?: number
          points_balance?: number
          referral_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          fee: number
          id: string
          net_amount: number
          pix_key_type: Database["public"]["Enums"]["pix_key_type"]
          pix_key_value: string
          processed_at: string | null
          reject_reason: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
          user_id: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          fee?: number
          id?: string
          net_amount: number
          pix_key_type: Database["public"]["Enums"]["pix_key_type"]
          pix_key_value: string
          processed_at?: string | null
          reject_reason?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          fee?: number
          id?: string
          net_amount?: number
          pix_key_type?: Database["public"]["Enums"]["pix_key_type"]
          pix_key_value?: string
          processed_at?: string | null
          reject_reason?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id?: string
          wallet_type?: Database["public"]["Enums"]["wallet_type"]
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_payment: {
        Args: { _payload: Json; _payment: string }
        Returns: boolean
      }
      create_plan_payment: {
        Args: { _plan: string; _user: string }
        Returns: string
      }
      credit_points: {
        Args: {
          _cat: Database["public"]["Enums"]["tx_category"]
          _desc: string
          _points: number
          _ref: string
          _user: string
        }
        Returns: undefined
      }
      credit_wallet: {
        Args: {
          _amount: number
          _cat: Database["public"]["Enums"]["tx_category"]
          _desc: string
          _ref: string
          _user: string
          _wallet: Database["public"]["Enums"]["wallet_type"]
        }
        Returns: undefined
      }
      generate_referral_code: { Args: never; Returns: string }
      get_setting: { Args: { _default: Json; _key: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      process_daily_roi: { Args: never; Returns: undefined }
      process_withdrawal: {
        Args: { _action: string; _admin: string; _reason: string; _wid: string }
        Returns: boolean
      }
      redeem_product: {
        Args: { _addr: Json; _product: string; _user: string }
        Returns: string
      }
      request_withdrawal: {
        Args: {
          _amount: number
          _key: string
          _key_type: Database["public"]["Enums"]["pix_key_type"]
          _user: string
          _wallet: Database["public"]["Enums"]["wallet_type"]
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "user" | "admin"
      order_status:
        | "placed"
        | "preparing"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_status: "pending" | "paid" | "expired" | "cancelled" | "refunded"
      pix_key_type: "cpf" | "cnpj" | "email" | "phone" | "random"
      tx_category:
        | "payment"
        | "earning"
        | "referral"
        | "withdrawal"
        | "points"
        | "adjustment"
        | "redeem"
        | "bonus"
      tx_direction: "in" | "out"
      tx_status: "pending" | "completed" | "failed" | "cancelled"
      user_plan_status: "pending" | "active" | "expired" | "cancelled"
      wallet_type: "main" | "earnings" | "referral" | "points"
      withdrawal_status:
        | "pending"
        | "reviewing"
        | "processing"
        | "paid"
        | "rejected"
        | "cancelled"
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
      app_role: ["user", "admin"],
      order_status: [
        "placed",
        "preparing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_status: ["pending", "paid", "expired", "cancelled", "refunded"],
      pix_key_type: ["cpf", "cnpj", "email", "phone", "random"],
      tx_category: [
        "payment",
        "earning",
        "referral",
        "withdrawal",
        "points",
        "adjustment",
        "redeem",
        "bonus",
      ],
      tx_direction: ["in", "out"],
      tx_status: ["pending", "completed", "failed", "cancelled"],
      user_plan_status: ["pending", "active", "expired", "cancelled"],
      wallet_type: ["main", "earnings", "referral", "points"],
      withdrawal_status: [
        "pending",
        "reviewing",
        "processing",
        "paid",
        "rejected",
        "cancelled",
      ],
    },
  },
} as const
