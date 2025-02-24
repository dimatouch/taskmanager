-- Create recordings table
CREATE TABLE recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  duration integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  converted_to_task boolean DEFAULT false,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL
);

-- Create storage bucket for recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- Create policies for recordings table
CREATE POLICY "Users can manage their own recordings"
  ON recordings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create policies for recordings bucket
CREATE POLICY "Users can upload recordings"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'recordings' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read recordings"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'recordings');

CREATE POLICY "Users can delete their recordings"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'recordings' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );