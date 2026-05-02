export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      courses: {
        Row: {
          course_code: string | null;
          course_name: string;
          created_at: string;
          credit_hours: number;
          id: string;
          letter_grade: string;
          student_id: string;
          term: string | null;
          updated_at: string;
        };
        Insert: {
          course_code?: string | null;
          course_name: string;
          created_at?: string;
          credit_hours: number;
          id?: string;
          letter_grade: string;
          student_id: string;
          term?: string | null;
          updated_at?: string;
        };
        Update: {
          course_code?: string | null;
          course_name?: string;
          created_at?: string;
          credit_hours?: number;
          id?: string;
          letter_grade?: string;
          student_id?: string;
          term?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "courses_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          auth_user_id: string | null;
          created_at: string;
          credits_earned: number;
          enrollment_year: number | null;
          full_name: string;
          id: string;
          level: string | null;
          program: string | null;
          registration_number: string;
          updated_at: string;
        };
        Insert: {
          auth_user_id?: string | null;
          created_at?: string;
          credits_earned?: number;
          enrollment_year?: number | null;
          full_name: string;
          id?: string;
          level?: string | null;
          program?: string | null;
          registration_number: string;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string | null;
          created_at?: string;
          credits_earned?: number;
          enrollment_year?: number | null;
          full_name?: string;
          id?: string;
          level?: string | null;
          program?: string | null;
          registration_number?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          role: "student" | "advisor";
          student_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          role?: "student" | "advisor" | null;
          student_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          role?: "student" | "advisor" | null;
          student_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: true;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      advisor_students: {
        Row: {
          advisor_id: string;
          created_at: string;
          student_id: string;
        };
        Insert: {
          advisor_id: string;
          created_at?: string;
          student_id: string;
        };
        Update: {
          advisor_id?: string;
          created_at?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "advisor_students_advisor_id_fkey";
            columns: ["advisor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "advisor_students_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      student_notes: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          student_id: string;
          visibility: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          student_id: string;
          visibility: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          student_id?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_notes_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      semester_plans: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          student_id: string;
          term: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          student_id: string;
          term: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          student_id?: string;
          term?: string;
        };
        Relationships: [
          {
            foreignKeyName: "semester_plans_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "semester_plans_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      planned_courses: {
        Row: {
          course_code: string | null;
          course_name: string | null;
          created_at: string;
          credit_hours: number;
          id: string;
          plan_id: string;
          status: string;
        };
        Insert: {
          course_code?: string | null;
          course_name?: string | null;
          created_at?: string;
          credit_hours?: number;
          id?: string;
          plan_id: string;
          status?: string;
        };
        Update: {
          course_code?: string | null;
          course_name?: string | null;
          created_at?: string;
          credit_hours?: number;
          id?: string;
          plan_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planned_courses_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "semester_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      alerts: {
        Row: {
          created_at: string;
          id: string;
          message: string;
          resolved_at: string | null;
          severity: string;
          student_id: string;
          type: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message: string;
          resolved_at?: string | null;
          severity: string;
          student_id: string;
          type: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string;
          resolved_at?: string | null;
          severity?: string;
          student_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alerts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      advisor_availability: {
        Row: {
          advisor_id: string;
          created_at: string;
          end_at: string;
          id: string;
          location: string | null;
          start_at: string;
        };
        Insert: {
          advisor_id: string;
          created_at?: string;
          end_at: string;
          id?: string;
          location?: string | null;
          start_at: string;
        };
        Update: {
          advisor_id?: string;
          created_at?: string;
          end_at?: string;
          id?: string;
          location?: string | null;
          start_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "advisor_availability_advisor_id_fkey";
            columns: ["advisor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          advisor_id: string;
          created_at: string;
          end_at: string;
          id: string;
          note: string | null;
          start_at: string;
          status: string;
          student_id: string;
        };
        Insert: {
          advisor_id: string;
          created_at?: string;
          end_at: string;
          id?: string;
          note?: string | null;
          start_at: string;
          status?: string;
          student_id: string;
        };
        Update: {
          advisor_id?: string;
          created_at?: string;
          end_at?: string;
          id?: string;
          note?: string | null;
          start_at?: string;
          status?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_advisor_id_fkey";
            columns: ["advisor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          advisor_id: string;
          body: string;
          created_at: string;
          id: string;
          sender_id: string;
          student_id: string;
        };
        Insert: {
          advisor_id: string;
          body: string;
          created_at?: string;
          id?: string;
          sender_id: string;
          student_id: string;
        };
        Update: {
          advisor_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          sender_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_advisor_id_fkey";
            columns: ["advisor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      action_items: {
        Row: {
          assigned_to: string | null;
          created_at: string;
          created_by: string;
          due_at: string | null;
          id: string;
          status: string;
          student_id: string;
          title: string;
        };
        Insert: {
          assigned_to?: string | null;
          created_at?: string;
          created_by: string;
          due_at?: string | null;
          id?: string;
          status?: string;
          student_id: string;
          title: string;
        };
        Update: {
          assigned_to?: string | null;
          created_at?: string;
          created_by?: string;
          due_at?: string | null;
          id?: string;
          status?: string;
          student_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "action_items_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "action_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "action_items_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: "student" | "advisor";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
