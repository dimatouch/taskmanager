/*
  # Update user profiles and roles

  1. Changes
    - Create user_profiles table if it doesn't exist
    - Add policies for viewing and managing profiles
    - Update trigger to handle user creation

  2. Security
    - Enable RLS on user_profiles table
    - Add policies for viewing and managing profiles
*/

-- Create user_profiles table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'user_profiles'
  ) THEN
    CREATE TABLE user_profiles (
      user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email text NOT NULL,
      first_name text,
      last_name text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

-- Create policies
CREATE POLICY "Users can view all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create function to handle user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create user profile
  INSERT INTO user_profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = now();

  -- Make first user admin if no roles exist
  IF NOT EXISTS (SELECT 1 FROM user_roles) THEN
    INSERT INTO user_roles (user_id, role, created_by, is_admin)
    VALUES (NEW.id, 'admin', NEW.id, true);
  ELSE
    -- For users created through admin panel, use the role from metadata
    INSERT INTO user_roles (user_id, role, created_by, is_admin)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
      COALESCE((NEW.raw_user_meta_data->>'created_by')::uuid, NEW.id),
      COALESCE((NEW.raw_user_meta_data->>'role')::text = 'admin', false)
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      role = EXCLUDED.role,
      is_admin = EXCLUDED.is_admin,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user handling
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();