/*
  # Initial Schema Setup for Trello Clone

  1. Tables
    - boards
      - id (uuid, primary key)
      - title (text)
      - owner_id (uuid, references auth.users)
      - created_at (timestamp)
      - updated_at (timestamp)
    
    - lists
      - id (uuid, primary key)
      - title (text)
      - board_id (uuid, references boards)
      - position (integer)
      - created_at (timestamp)
      - updated_at (timestamp)
    
    - cards
      - id (uuid, primary key)
      - title (text)
      - description (text)
      - list_id (uuid, references lists)
      - position (integer)
      - due_date (timestamp)
      - created_at (timestamp)
      - updated_at (timestamp)
    
    - board_members
      - board_id (uuid, references boards)
      - user_id (uuid, references auth.users)
      - role (text)
      - created_at (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for board owners and members
*/

-- Create boards table
CREATE TABLE boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  owner_id uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create lists table
CREATE TABLE lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  board_id uuid REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create cards table
CREATE TABLE cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  position integer NOT NULL,
  due_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create board_members table
CREATE TABLE board_members (
  board_id uuid REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('viewer', 'editor')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);

-- Enable RLS
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;

-- Policies for boards
CREATE POLICY "Users can view their own boards"
  ON boards
  FOR SELECT
  USING (
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM board_members
      WHERE board_id = boards.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own boards"
  ON boards
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Board owners can update their boards"
  ON boards
  FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Board owners can delete their boards"
  ON boards
  FOR DELETE
  USING (auth.uid() = owner_id);

-- Policies for lists
CREATE POLICY "Users can view lists of accessible boards"
  ON lists
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE id = lists.board_id AND (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM board_members
          WHERE board_id = boards.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Board owners and editors can manage lists"
  ON lists
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE id = lists.board_id AND (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM board_members
          WHERE board_id = boards.id AND user_id = auth.uid() AND role = 'editor'
        )
      )
    )
  );

-- Policies for cards
CREATE POLICY "Users can view cards of accessible boards"
  ON cards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      JOIN boards ON boards.id = lists.board_id
      WHERE lists.id = cards.list_id AND (
        boards.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM board_members
          WHERE board_id = boards.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Board owners and editors can manage cards"
  ON cards
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM lists
      JOIN boards ON boards.id = lists.board_id
      WHERE lists.id = cards.list_id AND (
        boards.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM board_members
          WHERE board_id = boards.id AND user_id = auth.uid() AND role = 'editor'
        )
      )
    )
  );

-- Policies for board_members
CREATE POLICY "Board owners can manage members"
  ON board_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE id = board_members.board_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can view board members"
  ON board_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE id = board_members.board_id AND (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM board_members b2
          WHERE b2.board_id = board_members.board_id AND b2.user_id = auth.uid()
        )
      )
    )
  );