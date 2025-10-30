/**
 * TypeScript types for Supabase database schema
 * Auto-generated types based on data-model.md
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          plan: 'free' | 'pro' | 'team';
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          downgraded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          plan?: 'free' | 'pro' | 'team';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          downgraded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          plan?: 'free' | 'pro' | 'team';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          downgraded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      screenshots: {
        Row: {
          id: string;
          user_id: string;
          short_id: string;
          storage_path: string;
          original_filename: string;
          file_size: number;
          width: number;
          height: number;
          mime_type: string;
          expires_at: string | null;
          views: number;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          short_id: string;
          storage_path: string;
          original_filename: string;
          file_size: number;
          width: number;
          height: number;
          mime_type?: string;
          expires_at?: string | null;
          views?: number;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          short_id?: string;
          storage_path?: string;
          original_filename?: string;
          file_size?: number;
          width?: number;
          height?: number;
          mime_type?: string;
          expires_at?: string | null;
          views?: number;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'screenshots_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      monthly_usage: {
        Row: {
          id: string;
          user_id: string;
          month: string;
          screenshot_count: number;
          storage_bytes: number;
          bandwidth_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month: string;
          screenshot_count?: number;
          storage_bytes?: number;
          bandwidth_bytes?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month?: string;
          screenshot_count?: number;
          storage_bytes?: number;
          bandwidth_bytes?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'monthly_usage_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      stripe_events: {
        Row: {
          id: string;
          processed_at: string;
        };
        Insert: {
          id: string;
          processed_at?: string;
        };
        Update: {
          id?: string;
          processed_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

