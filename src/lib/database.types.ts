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
      announcements: {
        Row: {
          author: string | null
          branch_id: string | null
          category: string | null
          created_at: string | null
          id: string
          message: string | null
          pinned: boolean | null
          title: string | null
        }
        Insert: {
          author?: string | null
          branch_id?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          pinned?: boolean | null
          title?: string | null
        }
        Update: {
          author?: string | null
          branch_id?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          pinned?: boolean | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      attendance_corrections: {
        Row: {
          attendance_log_id: string | null
          branch_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          evidence_url: string | null
          id: string
          manager_note: string | null
          original_snapshot: Json | null
          reason: string
          requested_clock_in: string | null
          requested_clock_out: string | null
          status: string
          target_date: string
          type: string
          user_id: string | null
        }
        Insert: {
          attendance_log_id?: string | null
          branch_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence_url?: string | null
          id?: string
          manager_note?: string | null
          original_snapshot?: Json | null
          reason: string
          requested_clock_in?: string | null
          requested_clock_out?: string | null
          status?: string
          target_date: string
          type: string
          user_id?: string | null
        }
        Update: {
          attendance_log_id?: string | null
          branch_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence_url?: string | null
          id?: string
          manager_note?: string | null
          original_snapshot?: Json | null
          reason?: string
          requested_clock_in?: string | null
          requested_clock_out?: string | null
          status?: string
          target_date?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_corrections_attendance_log_id_fkey"
            columns: ["attendance_log_id"]
            isOneToOne: false
            referencedRelation: "attendance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_events: {
        Row: {
          action: string
          attendance_log_id: string | null
          branch_id: string | null
          captured_at: string
          code: string | null
          code_valid: boolean | null
          created_at: string
          device_id: string | null
          error: string | null
          event_uuid: string
          id: string
          source: string
          sync_status: string
          user_id: string
        }
        Insert: {
          action: string
          attendance_log_id?: string | null
          branch_id?: string | null
          captured_at: string
          code?: string | null
          code_valid?: boolean | null
          created_at?: string
          device_id?: string | null
          error?: string | null
          event_uuid: string
          id?: string
          source?: string
          sync_status?: string
          user_id: string
        }
        Update: {
          action?: string
          attendance_log_id?: string | null
          branch_id?: string | null
          captured_at?: string
          code?: string | null
          code_valid?: boolean | null
          created_at?: string
          device_id?: string | null
          error?: string | null
          event_uuid?: string
          id?: string
          source?: string
          sync_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_attendance_log_id_fkey"
            columns: ["attendance_log_id"]
            isOneToOne: false
            referencedRelation: "attendance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_logs: {
        Row: {
          approval_status: string | null
          branch_id: string | null
          breaks: Json | null
          clock_in: string | null
          clock_out: string | null
          created_at: string | null
          device_id: string | null
          duration_mins: number | null
          geo_distance_m: number | null
          geo_flagged: boolean | null
          geo_lat: number | null
          geo_lng: number | null
          geo_max_distance_m: number | null
          geo_ok: boolean | null
          geo_out_distance_m: number | null
          geo_out_lat: number | null
          geo_out_lng: number | null
          id: string
          late_mins: number | null
          source: string
          status: string | null
          user_id: string | null
          work_date: string
        }
        Insert: {
          approval_status?: string | null
          branch_id?: string | null
          breaks?: Json | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          device_id?: string | null
          duration_mins?: number | null
          geo_distance_m?: number | null
          geo_flagged?: boolean | null
          geo_lat?: number | null
          geo_lng?: number | null
          geo_max_distance_m?: number | null
          geo_ok?: boolean | null
          geo_out_distance_m?: number | null
          geo_out_lat?: number | null
          geo_out_lng?: number | null
          id?: string
          late_mins?: number | null
          source?: string
          status?: string | null
          user_id?: string | null
          work_date: string
        }
        Update: {
          approval_status?: string | null
          branch_id?: string | null
          breaks?: Json | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          device_id?: string | null
          duration_mins?: number | null
          geo_distance_m?: number | null
          geo_flagged?: boolean | null
          geo_lat?: number | null
          geo_lng?: number | null
          geo_max_distance_m?: number | null
          geo_ok?: boolean | null
          geo_out_distance_m?: number | null
          geo_out_lat?: number | null
          geo_out_lng?: number | null
          id?: string
          late_mins?: number | null
          source?: string
          status?: string | null
          user_id?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string | null
          actor: string | null
          branch_id: string | null
          created_at: string | null
          details: string | null
          id: string
        }
        Insert: {
          action?: string | null
          actor?: string | null
          branch_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
        }
        Update: {
          action?: string | null
          actor?: string | null
          branch_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_throttle: {
        Row: {
          attempted_at: string
          id: number
          identifier: string
        }
        Insert: {
          attempted_at?: string
          id?: number
          identifier: string
        }
        Update: {
          attempted_at?: string
          id?: number
          identifier?: string
        }
        Relationships: []
      }
      availability: {
        Row: {
          branch_id: string | null
          created_at: string | null
          days: Json | null
          id: string
          user_id: string | null
          week_start: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          days?: Json | null
          id?: string
          user_id?: string | null
          week_start: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          days?: Json | null
          id?: string
          user_id?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_settings: {
        Row: {
          branch_id: string
          gps_mode: string | null
          qr_required: boolean | null
          settings: Json | null
        }
        Insert: {
          branch_id: string
          gps_mode?: string | null
          qr_required?: boolean | null
          settings?: Json | null
        }
        Update: {
          branch_id?: string
          gps_mode?: string | null
          qr_required?: boolean | null
          settings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          created_at: string | null
          franchise_id: string | null
          gps_lat: number | null
          gps_lng: number | null
          gps_radius_m: number | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          franchise_id?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          gps_radius_m?: number | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          franchise_id?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          gps_radius_m?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          added_by: string | null
          branch_id: string | null
          cert_type: string | null
          created_at: string | null
          expiry_date: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          note: string | null
          user_id: string | null
        }
        Insert: {
          added_by?: string | null
          branch_id?: string | null
          cert_type?: string | null
          created_at?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          note?: string | null
          user_id?: string | null
        }
        Update: {
          added_by?: string | null
          branch_id?: string | null
          cert_type?: string | null
          created_at?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          note?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certifications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          branch_id: string | null
          completed_at: string | null
          completed_by: string | null
          done: boolean | null
          id: string
          input_kind: string
          task: string | null
          type: string | null
          value: string | null
          work_date: string
        }
        Insert: {
          branch_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          done?: boolean | null
          id?: string
          input_kind?: string
          task?: string | null
          type?: string | null
          value?: string | null
          work_date: string
        }
        Update: {
          branch_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          done?: boolean | null
          id?: string
          input_kind?: string
          task?: string | null
          type?: string | null
          value?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clock_overrides: {
        Row: {
          branch_id: string | null
          created_at: string
          expires_at: string
          granted_by: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          expires_at: string
          granted_by?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          expires_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clock_overrides_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cover_requests: {
        Row: {
          branch_id: string
          claimer_id: string | null
          created_at: string
          day: string
          id: string
          reason: string | null
          requester_id: string
          resolved_at: string | null
          resolved_by: string | null
          shift: string
          status: string
          team: string
          work_date: string
        }
        Insert: {
          branch_id: string
          claimer_id?: string | null
          created_at?: string
          day: string
          id?: string
          reason?: string | null
          requester_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          shift: string
          status?: string
          team: string
          work_date: string
        }
        Update: {
          branch_id?: string
          claimer_id?: string | null
          created_at?: string
          day?: string
          id?: string
          reason?: string | null
          requester_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          shift?: string
          status?: string
          team?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "cover_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cover_requests_claimer_id_fkey"
            columns: ["claimer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cover_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales: {
        Row: {
          amount: number
          branch_id: string
          created_at: string
          id: string
          sale_date: string
        }
        Insert: {
          amount?: number
          branch_id: string
          created_at?: string
          id?: string
          sale_date: string
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string
          id?: string
          sale_date?: string
        }
        Relationships: []
      }
      franchises: {
        Row: {
          created_at: string | null
          id: string
          name: string
          owner_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          owner_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          owner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "franchises_owner_fk"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          branch_id: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          manager_note: string | null
          photo_url: string | null
          reported_by: string | null
          reviewed_by: string | null
          severity: string | null
          status: string | null
        }
        Insert: {
          branch_id?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          manager_note?: string | null
          photo_url?: string | null
          reported_by?: string | null
          reviewed_by?: string | null
          severity?: string | null
          status?: string | null
        }
        Update: {
          branch_id?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          manager_note?: string | null
          photo_url?: string | null
          reported_by?: string | null
          reviewed_by?: string | null
          severity?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          branch_id: string | null
          category: string | null
          count_date: string
          counted_by: string | null
          created_at: string | null
          id: string
          ist: number | null
          product: string | null
          soll: number | null
          unit: string | null
        }
        Insert: {
          branch_id?: string | null
          category?: string | null
          count_date: string
          counted_by?: string | null
          created_at?: string | null
          id?: string
          ist?: number | null
          product?: string | null
          soll?: number | null
          unit?: string | null
        }
        Update: {
          branch_id?: string | null
          category?: string | null
          count_date?: string
          counted_by?: string | null
          created_at?: string | null
          id?: string
          ist?: number | null
          product?: string | null
          soll?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_master: {
        Row: {
          branch_id: string | null
          category: string
          created_at: string | null
          id: string
          is_active: boolean | null
          product: string
          soll: number | null
          unit: string | null
        }
        Insert: {
          branch_id?: string | null
          category: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          product: string
          soll?: number | null
          unit?: string | null
        }
        Update: {
          branch_id?: string | null
          category?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          product?: string
          soll?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_master_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_purchases: {
        Row: {
          branch_id: string
          category: string | null
          cost: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          product: string
          purchase_date: string
          qty: number
          supplier: string | null
          unit: string | null
        }
        Insert: {
          branch_id: string
          category?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product: string
          purchase_date?: string
          qty?: number
          supplier?: string | null
          unit?: string | null
        }
        Update: {
          branch_id?: string
          category?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product?: string
          purchase_date?: string
          qty?: number
          supplier?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_purchases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosks: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string
          last_seen: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          last_seen?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          last_seen?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kiosks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          branch_id: string | null
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          from_date: string | null
          id: string
          reason: string | null
          sick_note_url: string | null
          status: string | null
          to_date: string | null
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          from_date?: string | null
          id?: string
          reason?: string | null
          sick_note_url?: string | null
          status?: string | null
          to_date?: string | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          from_date?: string | null
          id?: string
          reason?: string | null
          sick_note_url?: string | null
          status?: string | null
          to_date?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          branch_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          title: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          created_at: string
          id: string
          month: string
          note: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          created_at?: string
          id?: string
          month: string
          note?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          created_at?: string
          id?: string
          month?: string
          note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_settings: {
        Row: {
          branch_id: string
          night_end: string
          night_start: string
          ot_daily_hours: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id: string
          night_end?: string
          night_start?: string
          ot_daily_hours?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string
          night_end?: string
          night_start?: string
          ot_daily_hours?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_notes: {
        Row: {
          author: string | null
          branch_id: string | null
          created_at: string | null
          id: string
          note: string | null
          user_id: string | null
        }
        Insert: {
          author?: string | null
          branch_id?: string | null
          created_at?: string | null
          id?: string
          note?: string | null
          user_id?: string | null
        }
        Update: {
          author?: string | null
          branch_id?: string | null
          created_at?: string | null
          id?: string
          note?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_notes_author_fkey"
            columns: ["author"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_notes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      required_documents: {
        Row: {
          branch_id: string | null
          created_at: string
          doc_type: string
          id: string
          is_required: boolean
          sort_order: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          doc_type: string
          id?: string
          is_required?: boolean
          sort_order?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          doc_type?: string
          id?: string
          is_required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "required_documents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_broadcasts: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          day: string | null
          filled_by: string | null
          id: string
          note: string | null
          responses: Json | null
          shift: string | null
          status: string | null
          team_filter: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          day?: string | null
          filled_by?: string | null
          id?: string
          note?: string | null
          responses?: Json | null
          shift?: string | null
          status?: string | null
          team_filter?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          day?: string | null
          filled_by?: string | null
          id?: string
          note?: string | null
          responses?: Json | null
          shift?: string | null
          status?: string | null
          team_filter?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_broadcasts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_broadcasts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_templates: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          roster_data: Json | null
          template_name: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          roster_data?: Json | null
          template_name?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          roster_data?: Json | null
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_times: {
        Row: {
          branch_id: string | null
          break_mins: number
          end_time: string
          id: string
          is_active: boolean
          shift: string
          start_time: string
          team: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          break_mins?: number
          end_time: string
          id?: string
          is_active?: boolean
          shift: string
          start_time: string
          team: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          break_mins?: number
          end_time?: string
          id?: string
          is_active?: boolean
          shift?: string
          start_time?: string
          team?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_times_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_batches: {
        Row: {
          branch_id: string
          category: string | null
          created_at: string
          expiry_date: string
          id: string
          logged_by: string | null
          logged_by_name: string | null
          note: string | null
          product: string
          qty: number
          received_date: string
          status: string
          unit: string | null
        }
        Insert: {
          branch_id: string
          category?: string | null
          created_at?: string
          expiry_date: string
          id?: string
          logged_by?: string | null
          logged_by_name?: string | null
          note?: string | null
          product: string
          qty: number
          received_date: string
          status?: string
          unit?: string | null
        }
        Update: {
          branch_id?: string
          category?: string | null
          created_at?: string
          expiry_date?: string
          id?: string
          logged_by?: string | null
          logged_by_name?: string | null
          note?: string | null
          product?: string
          qty?: number
          received_date?: string
          status?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_batches_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          category: string | null
          created_at: string
          from_branch_id: string
          from_branch_name: string | null
          id: string
          note: string | null
          product: string
          qty: number
          requested_by: string | null
          requested_by_name: string | null
          status: string
          to_branch_id: string
          to_branch_name: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          from_branch_id: string
          from_branch_name?: string | null
          id?: string
          note?: string | null
          product: string
          qty: number
          requested_by?: string | null
          requested_by_name?: string | null
          status?: string
          to_branch_id: string
          to_branch_name?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          from_branch_id?: string
          from_branch_name?: string | null
          id?: string
          note?: string | null
          product?: string
          qty?: number
          requested_by?: string | null
          requested_by_name?: string | null
          status?: string
          to_branch_id?: string
          to_branch_name?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      swap_requests: {
        Row: {
          branch_id: string | null
          created_at: string | null
          id: string
          my_day: string | null
          other_person_id: string | null
          requester_id: string | null
          status: string | null
          their_day: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          my_day?: string | null
          other_person_id?: string | null
          requester_id?: string | null
          status?: string | null
          their_day?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          my_day?: string | null
          other_person_id?: string | null
          requester_id?: string | null
          status?: string | null
          their_day?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swap_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_other_person_id_fkey"
            columns: ["other_person_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_logs: {
        Row: {
          branch_id: string
          corrective_action: string | null
          id: string
          in_range: boolean
          note: string | null
          recorded_at: string
          recorded_by: string | null
          recorded_by_name: string | null
          temp: number
          unit_id: string
          work_date: string
        }
        Insert: {
          branch_id: string
          corrective_action?: string | null
          id?: string
          in_range: boolean
          note?: string | null
          recorded_at?: string
          recorded_by?: string | null
          recorded_by_name?: string | null
          temp: number
          unit_id: string
          work_date: string
        }
        Update: {
          branch_id?: string
          corrective_action?: string | null
          id?: string
          in_range?: boolean
          note?: string | null
          recorded_at?: string
          recorded_by?: string | null
          recorded_by_name?: string | null
          temp?: number
          unit_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "temp_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_logs_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "temp_units"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_units: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          kind: string
          max_temp: number
          min_temp: number
          name: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          max_temp: number
          min_temp: number
          name: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          max_temp?: number
          min_temp?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "temp_units_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branches: {
        Row: {
          branch_id: string
          user_id: string
        }
        Insert: {
          branch_id: string
          user_id: string
        }
        Update: {
          branch_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_branches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_documents: {
        Row: {
          branch_id: string | null
          created_at: string
          doc_type: string
          expiry_date: string | null
          file_name: string
          file_path: string
          id: string
          is_active: boolean
          issue_date: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          uploaded_by: string | null
          user_id: string
          version_no: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          doc_type: string
          expiry_date?: string | null
          file_name: string
          file_path: string
          id?: string
          is_active?: boolean
          issue_date?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          uploaded_by?: string | null
          user_id: string
          version_no?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          doc_type?: string
          expiry_date?: string | null
          file_name?: string
          file_path?: string
          id?: string
          is_active?: boolean
          issue_date?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          uploaded_by?: string | null
          user_id?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pay: {
        Row: {
          branch_id: string | null
          hourly_wage: number | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          hourly_wage?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string | null
          hourly_wage?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pay_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          annual_leave_days: number | null
          avatar_url: string | null
          branch_id: string | null
          contract_hours: number | null
          contract_type: string | null
          created_at: string | null
          email: string | null
          employee_code: string | null
          full_name: string | null
          id: string
          must_change_password: boolean
          phone: string | null
          role: string
          skills: string[] | null
          status: string | null
          team: string | null
        }
        Insert: {
          annual_leave_days?: number | null
          avatar_url?: string | null
          branch_id?: string | null
          contract_hours?: number | null
          contract_type?: string | null
          created_at?: string | null
          email?: string | null
          employee_code?: string | null
          full_name?: string | null
          id: string
          must_change_password?: boolean
          phone?: string | null
          role?: string
          skills?: string[] | null
          status?: string | null
          team?: string | null
        }
        Update: {
          annual_leave_days?: number | null
          avatar_url?: string | null
          branch_id?: string | null
          contract_hours?: number | null
          contract_type?: string | null
          created_at?: string | null
          email?: string | null
          employee_code?: string | null
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          phone?: string | null
          role?: string
          skills?: string[] | null
          status?: string | null
          team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      users_hourly_wage_backup_20260718: {
        Row: {
          backed_up_at: string | null
          hourly_wage: number | null
          id: string | null
        }
        Insert: {
          backed_up_at?: string | null
          hourly_wage?: number | null
          id?: string | null
        }
        Update: {
          backed_up_at?: string | null
          hourly_wage?: number | null
          id?: string | null
        }
        Relationships: []
      }
      waste_log: {
        Row: {
          branch_id: string
          category: string | null
          created_at: string
          id: string
          logged_by: string | null
          logged_by_name: string | null
          note: string | null
          product: string
          qty: number
          reason: string
          unit: string | null
          work_date: string
        }
        Insert: {
          branch_id: string
          category?: string | null
          created_at?: string
          id?: string
          logged_by?: string | null
          logged_by_name?: string | null
          note?: string | null
          product: string
          qty: number
          reason?: string
          unit?: string | null
          work_date: string
        }
        Update: {
          branch_id?: string
          category?: string | null
          created_at?: string
          id?: string
          logged_by?: string | null
          logged_by_name?: string | null
          note?: string | null
          product?: string
          qty?: number
          reason?: string
          unit?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_log_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_log_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_roster: {
        Row: {
          branch_id: string | null
          created_at: string | null
          id: string
          roster_data: Json | null
          week_start: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          roster_data?: Json | null
          week_start: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          roster_data?: Json | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_roster_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accessible_branch_ids: { Args: never; Returns: string[] }
      attendance_break_mins: { Args: { p_breaks: Json }; Returns: number }
      clock_code_batch: { Args: { p_count?: number }; Returns: Json }
      clock_code_for: {
        Args: { p_branch: string; p_window: number }
        Returns: string
      }
      clock_in: {
        Args: {
          p_code?: string
          p_device?: string
          p_lat?: number
          p_lng?: number
        }
        Returns: Json
      }
      clock_out: {
        Args: {
          p_code?: string
          p_device?: string
          p_lat?: number
          p_lng?: number
        }
        Returns: Json
      }
      clock_token_batch: {
        Args: { p_count?: number; p_kiosk?: string }
        Returns: Json
      }
      clock_token_for: {
        Args: { p_branch: string; p_kiosk: string; p_w: number }
        Returns: string
      }
      clock_token_sig: {
        Args: { p_branch: string; p_kiosk: string; p_w: number }
        Returns: string
      }
      clock_token_valid: {
        Args: { p_at?: string; p_token: string }
        Returns: Json
      }
      clock_value_ok: {
        Args: { p_branch: string; p_value: string }
        Returns: boolean
      }
      code_valid: {
        Args: { p_branch: string; p_code: string }
        Returns: boolean
      }
      code_valid_at: {
        Args: {
          p_at: string
          p_branch: string
          p_code: string
          p_skew_windows?: number
        }
        Returns: boolean
      }
      current_branch: { Args: never; Returns: string }
      current_clock_code: { Args: never; Returns: Json }
      current_clock_token: { Args: { p_kiosk?: string }; Returns: Json }
      current_role: { Args: never; Returns: string }
      decide_attendance_correction: {
        Args: { p_approve: boolean; p_id: string; p_note?: string }
        Returns: Json
      }
      distance_m: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      end_break: { Args: { p_lat?: number; p_lng?: number }; Returns: Json }
      geo_checkpoint: {
        Args: { p_lat: number; p_lng: number; p_log_id: string }
        Returns: undefined
      }
      grant_clock_override: {
        Args: { p_minutes?: number; p_user: string }
        Returns: Json
      }
      is_manager: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      notification_sweep: { Args: never; Returns: undefined }
      notify: {
        Args: {
          p_branch: string
          p_message: string
          p_title: string
          p_type: string
          p_user: string
          p_window?: string
        }
        Returns: undefined
      }
      notify_system_error: {
        Args: { p_branch?: string; p_message: string }
        Returns: undefined
      }
      resolve_kiosk: {
        Args: { p_branch: string; p_kiosk: string }
        Returns: string
      }
      role_rank: { Args: { p_role: string }; Returns: number }
      start_break: { Args: { p_lat?: number; p_lng?: number }; Returns: Json }
      sync_attendance_events: { Args: { p_events: Json }; Returns: Json }
      user_in_my_branches: { Args: { p_user: string }; Returns: boolean }
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
