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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      auth_events: {
        Row: {
          created_at: string
          email: string | null
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_type: string
          id?: string
          ip_address: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      credit_balances: {
        Row: {
          created_at: string | null
          current_balance: number | null
          expires_at: string | null
          id: string
          transactions: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_balance?: number | null
          expires_at?: string | null
          id?: string
          transactions?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_balance?: number | null
          expires_at?: string | null
          id?: string
          transactions?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_view_stats: {
        Row: {
          country_stats: Json | null
          created_at: string | null
          date: string
          id: string
          screenshot_id: string
          unique_viewers: number | null
          view_count: number | null
        }
        Insert: {
          country_stats?: Json | null
          created_at?: string | null
          date: string
          id?: string
          screenshot_id: string
          unique_viewers?: number | null
          view_count?: number | null
        }
        Update: {
          country_stats?: Json | null
          created_at?: string | null
          date?: string
          id?: string
          screenshot_id?: string
          unique_viewers?: number | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_view_stats_screenshot_id_fkey"
            columns: ["screenshot_id"]
            isOneToOne: false
            referencedRelation: "screenshots"
            referencedColumns: ["id"]
          },
        ]
      }
      dunning_attempts: {
        Row: {
          attempt_date: string
          attempt_number: number
          created_at: string | null
          failure_reason: string | null
          id: string
          next_retry_date: string | null
          notification_sent: boolean | null
          notification_sent_at: string | null
          payment_result: string
          subscription_id: string
          updated_at: string | null
        }
        Insert: {
          attempt_date: string
          attempt_number: number
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          next_retry_date?: string | null
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          payment_result: string
          subscription_id: string
          updated_at?: string | null
        }
        Update: {
          attempt_date?: string
          attempt_number?: number
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          next_retry_date?: string | null
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          payment_result?: string
          subscription_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dunning_attempts_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number | null
          created_at: string | null
          due_date: string | null
          id: string
          invoice_number: string
          line_items: Json
          paid_at: string | null
          period_end: string
          period_start: string
          status: string
          stripe_hosted_invoice_url: string | null
          stripe_invoice_id: string
          stripe_invoice_pdf: string | null
          subscription_id: string | null
          subtotal: number
          tax: number | null
          total: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          line_items: Json
          paid_at?: string | null
          period_end: string
          period_start: string
          status: string
          stripe_hosted_invoice_url?: string | null
          stripe_invoice_id: string
          stripe_invoice_pdf?: string | null
          subscription_id?: string | null
          subtotal: number
          tax?: number | null
          total: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          line_items?: Json
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string
          stripe_hosted_invoice_url?: string | null
          stripe_invoice_id?: string
          stripe_invoice_pdf?: string | null
          subscription_id?: string | null
          subtotal?: number
          tax?: number | null
          total?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_usage: {
        Row: {
          bandwidth_bytes: number | null
          created_at: string | null
          id: string
          month: string
          screenshot_count: number | null
          storage_bytes: number | null
          user_id: string
        }
        Insert: {
          bandwidth_bytes?: number | null
          created_at?: string | null
          id?: string
          month: string
          screenshot_count?: number | null
          storage_bytes?: number | null
          user_id: string
        }
        Update: {
          bandwidth_bytes?: number | null
          created_at?: string | null
          id?: string
          month?: string
          screenshot_count?: number | null
          storage_bytes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          billing_address: Json | null
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          stripe_payment_method_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_address?: Json | null
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          stripe_payment_method_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_address?: Json | null
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          stripe_payment_method_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          downgraded_at: string | null
          email: string
          full_name: string | null
          id: string
          plan: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          downgraded_at?: string | null
          email: string
          full_name?: string | null
          id: string
          plan?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          downgraded_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          plan?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      screenshots: {
        Row: {
          created_at: string | null
          expires_at: string | null
          file_hash: string
          file_size: number
          height: number
          id: string
          is_public: boolean | null
          mime_type: string | null
          optimized_path: string | null
          original_filename: string
          password_hash: string | null
          processing_error: string | null
          processing_status: string | null
          sharing_mode: string
          short_id: string
          storage_path: string
          thumbnail_path: string | null
          updated_at: string | null
          user_id: string
          views: number | null
          width: number
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          file_hash?: string
          file_size: number
          height: number
          id?: string
          is_public?: boolean | null
          mime_type?: string | null
          optimized_path?: string | null
          original_filename: string
          password_hash?: string | null
          processing_error?: string | null
          processing_status?: string | null
          sharing_mode?: string
          short_id: string
          storage_path: string
          thumbnail_path?: string | null
          updated_at?: string | null
          user_id: string
          views?: number | null
          width: number
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          file_hash?: string
          file_size?: number
          height?: number
          id?: string
          is_public?: boolean | null
          mime_type?: string | null
          optimized_path?: string | null
          original_filename?: string
          password_hash?: string | null
          processing_error?: string | null
          processing_status?: string | null
          sharing_mode?: string
          short_id?: string
          storage_path?: string
          thumbnail_path?: string | null
          updated_at?: string | null
          user_id?: string
          views?: number | null
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "screenshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_customers: {
        Row: {
          created_at: string | null
          default_payment_method_id: string | null
          email: string
          id: string
          name: string | null
          stripe_customer_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          default_payment_method_id?: string | null
          email: string
          id?: string
          name?: string | null
          stripe_customer_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          default_payment_method_id?: string | null
          email?: string
          id?: string
          name?: string | null
          stripe_customer_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          id: string
          processed_at: string | null
        }
        Insert: {
          id: string
          processed_at?: string | null
        }
        Update: {
          id?: string
          processed_at?: string | null
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          new_plan: string | null
          new_status: string | null
          previous_plan: string | null
          previous_status: string | null
          reason: string | null
          subscription_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          new_plan?: string | null
          new_status?: string | null
          previous_plan?: string | null
          previous_status?: string | null
          reason?: string | null
          subscription_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          new_plan?: string | null
          new_status?: string | null
          previous_plan?: string | null
          previous_status?: string | null
          reason?: string | null
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          id: string
          plan_type: string
          seat_count: number | null
          status: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          team_id: string | null
          trial_end: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_cycle: string
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end: string
          current_period_start: string
          id?: string
          plan_type: string
          seat_count?: number | null
          status: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          team_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_cycle?: string
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_type?: string
          seat_count?: number | null
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string
          stripe_subscription_id?: string
          team_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_subscriptions_team"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          invitation_expires_at: string | null
          invitation_token: string | null
          invited_at: string | null
          joined_at: string | null
          removed_at: string | null
          role: string
          status: string
          team_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invitation_expires_at?: string | null
          invitation_token?: string | null
          invited_at?: string | null
          joined_at?: string | null
          removed_at?: string | null
          role?: string
          status?: string
          team_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invitation_expires_at?: string | null
          invitation_token?: string | null
          invited_at?: string | null
          joined_at?: string | null
          removed_at?: string | null
          role?: string
          status?: string
          team_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          admin_user_id: string
          billing_email: string | null
          company_name: string | null
          created_at: string | null
          filled_seats: number | null
          id: string
          name: string
          seat_count: number
          subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          admin_user_id: string
          billing_email?: string | null
          company_name?: string | null
          created_at?: string | null
          filled_seats?: number | null
          id?: string
          name: string
          seat_count: number
          subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_user_id?: string
          billing_email?: string | null
          company_name?: string | null
          created_at?: string | null
          filled_seats?: number | null
          id?: string
          name?: string
          seat_count?: number
          subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_teams_subscription"
            columns: ["subscription_id"]
            isOneToOne: true
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_sessions: {
        Row: {
          bytes_uploaded: number | null
          created_at: string | null
          error_message: string | null
          file_size: number
          filename: string
          id: string
          mime_type: string
          retry_count: number | null
          screenshot_id: string | null
          signed_url: string | null
          signed_url_expires_at: string | null
          updated_at: string | null
          upload_status: string | null
          user_id: string
        }
        Insert: {
          bytes_uploaded?: number | null
          created_at?: string | null
          error_message?: string | null
          file_size: number
          filename: string
          id?: string
          mime_type: string
          retry_count?: number | null
          screenshot_id?: string | null
          signed_url?: string | null
          signed_url_expires_at?: string | null
          updated_at?: string | null
          upload_status?: string | null
          user_id: string
        }
        Update: {
          bytes_uploaded?: number | null
          created_at?: string | null
          error_message?: string | null
          file_size?: number
          filename?: string
          id?: string
          mime_type?: string
          retry_count?: number | null
          screenshot_id?: string | null
          signed_url?: string | null
          signed_url_expires_at?: string | null
          updated_at?: string | null
          upload_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_sessions_screenshot_id_fkey"
            columns: ["screenshot_id"]
            isOneToOne: false
            referencedRelation: "screenshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_records: {
        Row: {
          bandwidth_bytes: number | null
          created_at: string | null
          id: string
          period_end: string
          period_start: string
          screenshot_count: number | null
          storage_bytes: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bandwidth_bytes?: number | null
          created_at?: string | null
          id?: string
          period_end: string
          period_start: string
          screenshot_count?: number | null
          storage_bytes?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bandwidth_bytes?: number | null
          created_at?: string | null
          id?: string
          period_end?: string
          period_start?: string
          screenshot_count?: number | null
          storage_bytes?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      view_events: {
        Row: {
          country: string | null
          id: string
          ip_hash: string
          is_authenticated: boolean | null
          is_owner: boolean | null
          screenshot_id: string
          user_agent_hash: string | null
          viewed_at: string | null
        }
        Insert: {
          country?: string | null
          id?: string
          ip_hash: string
          is_authenticated?: boolean | null
          is_owner?: boolean | null
          screenshot_id: string
          user_agent_hash?: string | null
          viewed_at?: string | null
        }
        Update: {
          country?: string | null
          id?: string
          ip_hash?: string
          is_authenticated?: boolean | null
          is_owner?: boolean | null
          screenshot_id?: string
          user_agent_hash?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "view_events_screenshot_id_fkey"
            columns: ["screenshot_id"]
            isOneToOne: false
            referencedRelation: "screenshots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_upload_quota: {
        Args: { p_user_id: string }
        Returns: {
          allowed: boolean
          current_count: number
          plan_type: string
          quota_limit: number
        }[]
      }
      delete_user_data: { Args: { target_user_id: string }; Returns: Json }
      invoke_cleanup_edge_function: { Args: never; Returns: undefined }
      verify_user_password: {
        Args: { user_email: string; user_password: string }
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
    Enums: {},
  },
} as const
