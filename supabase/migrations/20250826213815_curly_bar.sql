/*
  # Whiteboard Schema Setup

  1. New Tables
    - `whiteboards`
      - `id` (uuid, primary key)
      - `title` (text)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `whiteboard_elements`
      - `id` (uuid, primary key)
      - `whiteboard_id` (uuid, references whiteboards)
      - `type` (text) - line, rectangle, circle, text
      - `data` (jsonb) - element-specific data
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `whiteboard_permissions`
      - `id` (uuid, primary key)
      - `whiteboard_id` (uuid, references whiteboards)
      - `user_id` (uuid, references auth.users)
      - `permission` (text) - read, edit
      - `created_at` (timestamp)
    
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Users can only access whiteboards they own or have permissions for
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create whiteboards table
CREATE TABLE IF NOT EXISTS whiteboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create whiteboard_elements table
CREATE TABLE IF NOT EXISTS whiteboard_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whiteboard_id uuid REFERENCES whiteboards(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create whiteboard_permissions table
CREATE TABLE IF NOT EXISTS whiteboard_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whiteboard_id uuid REFERENCES whiteboards(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission text NOT NULL CHECK (permission IN ('read', 'edit')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(whiteboard_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE whiteboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE whiteboard_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE whiteboard_permissions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Whiteboards policies
CREATE POLICY "Users can read whiteboards they own or have access to"
  ON whiteboards
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    id IN (
      SELECT whiteboard_id FROM whiteboard_permissions 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create whiteboards"
  ON whiteboards
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update whiteboards they own"
  ON whiteboards
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete whiteboards they own"
  ON whiteboards
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Whiteboard elements policies
CREATE POLICY "Users can read elements from accessible whiteboards"
  ON whiteboard_elements
  FOR SELECT
  TO authenticated
  USING (
    whiteboard_id IN (
      SELECT id FROM whiteboards 
      WHERE created_by = auth.uid() OR
      id IN (
        SELECT whiteboard_id FROM whiteboard_permissions 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create elements in accessible whiteboards"
  ON whiteboard_elements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    whiteboard_id IN (
      SELECT id FROM whiteboards 
      WHERE created_by = auth.uid() OR
      id IN (
        SELECT whiteboard_id FROM whiteboard_permissions 
        WHERE user_id = auth.uid() AND permission = 'edit'
      )
    )
  );

CREATE POLICY "Users can delete elements they created"
  ON whiteboard_elements
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    whiteboard_id IN (
      SELECT id FROM whiteboards WHERE created_by = auth.uid()
    )
  );

-- Whiteboard permissions policies
CREATE POLICY "Users can read permissions for whiteboards they own"
  ON whiteboard_permissions
  FOR SELECT
  TO authenticated
  USING (
    whiteboard_id IN (
      SELECT id FROM whiteboards WHERE created_by = auth.uid()
    ) OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can create permissions for whiteboards they own"
  ON whiteboard_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    whiteboard_id IN (
      SELECT id FROM whiteboards WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete permissions for whiteboards they own"
  ON whiteboard_permissions
  FOR DELETE
  TO authenticated
  USING (
    whiteboard_id IN (
      SELECT id FROM whiteboards WHERE created_by = auth.uid()
    )
  );

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_whiteboards_updated_at
  BEFORE UPDATE ON whiteboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whiteboard_elements_updated_at
  BEFORE UPDATE ON whiteboard_elements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();