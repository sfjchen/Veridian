export type UserRole = "teacher" | "student";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  display_name: string;
}

export interface AssignmentConfig {
  check_button_visible: boolean;
  dot_threshold: "notational" | "mechanical" | "procedural" | "conceptual";
  max_dots_shown: number;
  analysis_trigger: "auto_idle" | "manual_only" | "passive";
  analysis_debounce_seconds: number;
  notification_style: "silent" | "toast" | "badge";
  chat_enabled: boolean;
  hint_level: "guided" | "minimal" | "detailed";
}

export interface Classroom {
  id: string;
  teacher_id: string;
  name: string;
  class_code: string;
  created_at: string;
  config: Partial<AssignmentConfig>;
}

export interface Assignment {
  id: string;
  classroom_id: string;
  title: string;
  prompt_storage_path: string | null;
  answer_key_storage_path: string | null;
  context_file_ids: string[];
  due_date: string | null;
  created_at: string;
  config: Partial<AssignmentConfig>;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  storage_path: string;
  submitted_at: string;
  download_url?: string | null;
  student_display_name?: string | null;
}

export interface CorpusFile {
  id: string;
  classroom_id: string;
  display_name: string;
  storage_path: string;
  file_type: string;
  uploaded_at: string;
  download_url: string | null;
}

export interface AssignmentDetail extends Assignment {
  assignment_file_download_url?: string;
  answer_key_download_url?: string;
  resolved_config?: AssignmentConfig;
}

export interface ClassroomStudent {
  student_id: string;
  display_name: string | null;
  joined_at: string;
}
