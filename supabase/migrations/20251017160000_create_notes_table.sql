-- Migration: Create notes table for To-Do List functionality
-- Description: Simple CRUD for user notes with RLS security

-- Create the notes table
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  due_date date,
  priority integer DEFAULT 2 CHECK (priority >= 1 AND priority <= 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for better query performance
CREATE INDEX idx_notes_user_id ON public.notes(user_id);
CREATE INDEX idx_notes_user_completed ON public.notes(user_id, is_completed);
CREATE INDEX idx_notes_due_date ON public.notes(due_date) WHERE due_date IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notes table

-- Policy: Users can view only their own notes
CREATE POLICY "Users can view their own notes"
  ON public.notes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own notes
CREATE POLICY "Users can create their own notes"
  ON public.notes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own notes
CREATE POLICY "Users can update their own notes"
  ON public.notes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own notes
CREATE POLICY "Users can delete their own notes"
  ON public.notes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.notes IS 'User notes and to-do items with financial context';
COMMENT ON COLUMN public.notes.id IS 'Unique identifier for the note';
COMMENT ON COLUMN public.notes.user_id IS 'Reference to the user who owns this note';
COMMENT ON COLUMN public.notes.content IS 'The note content/task description';
COMMENT ON COLUMN public.notes.is_completed IS 'Whether the task is completed';
COMMENT ON COLUMN public.notes.due_date IS 'Optional due date for the task';
COMMENT ON COLUMN public.notes.priority IS 'Task priority: 1=High, 2=Medium, 3=Low';
COMMENT ON COLUMN public.notes.created_at IS 'Timestamp when the note was created';
COMMENT ON COLUMN public.notes.updated_at IS 'Timestamp when the note was last updated';

