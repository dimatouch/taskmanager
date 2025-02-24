-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Create policies for file management
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT TO public
WITH CHECK (
  bucket_id = 'task-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated users can read files"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'task-attachments');

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE TO public
USING (
  bucket_id = 'task-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;