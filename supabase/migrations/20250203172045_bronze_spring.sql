/*
  # Add test project
  
  1. Changes
    - Insert a test project for development purposes
*/

-- Insert test project
INSERT INTO projects (name, description, owner_id)
SELECT 
  'Website Redesign',
  'Complete overhaul of our company website with modern design and improved user experience',
  auth.uid()
WHERE EXISTS (
  SELECT 1 FROM auth.users 
  WHERE id = auth.uid()
);

-- Insert another test project
INSERT INTO projects (name, description, owner_id)
SELECT 
  'Mobile App Development',
  'Create a new mobile app for both iOS and Android platforms',
  auth.uid()
WHERE EXISTS (
  SELECT 1 FROM auth.users 
  WHERE id = auth.uid()
);