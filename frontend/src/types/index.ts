export type UserRole = "teacher" | "student";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  display_name: string;
}

export interface Classroom {
  id: string;
  teacher_id: string;
  name: string;
  class_code: string;
  created_at: string;
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
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  storage_path: string;
  submitted_at: string;
}

export interface CorpusFile {
  id: string;
  classroom_id: string;
  display_name: string;
  storage_path: string;
  file_type: string;
  uploaded_at: string;
}
