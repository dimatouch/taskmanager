/*
  # Simplify board policies to eliminate recursion

  1. Changes
    - Completely simplify board access policies
    - Remove complex joins and subqueries
    - Ensure direct ownership checks
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own boards" ON boards;
DROP POLICY IF EXISTS "Users can create their own boards" ON boards;
DROP POLICY IF EXISTS "Board owners can update their boards" ON boards;
DROP POLICY IF EXISTS "Board owners can delete their boards" ON boards;
DROP POLICY IF EXISTS "Users can view board members" ON board_members;
DROP POLICY IF EXISTS "Board owners can manage members" ON board_members;
DROP POLICY IF EXISTS "Users can view lists of accessible boards" ON lists;
DROP POLICY IF EXISTS "Board owners and editors can manage lists" ON lists;
DROP POLICY IF EXISTS "Users can view cards of accessible boards" ON cards;
DROP POLICY IF EXISTS "Board owners and editors can manage cards" ON cards;

-- Simple board policies
CREATE POLICY "Users can view boards"
  ON boards
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create boards"
  ON boards
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own boards"
  ON boards
  FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own boards"
  ON boards
  FOR DELETE
  USING (owner_id = auth.uid());

-- Simple board members policies
CREATE POLICY "View board members"
  ON board_members
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Manage board members"
  ON board_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE id = board_members.board_id 
      AND owner_id = auth.uid()
    )
  );

-- Simple list policies
CREATE POLICY "View lists"
  ON lists
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE id = lists.board_id 
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Manage lists"
  ON lists
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE id = lists.board_id 
      AND owner_id = auth.uid()
    )
  );

-- Simple card policies
CREATE POLICY "View cards"
  ON cards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      JOIN boards ON boards.id = lists.board_id
      WHERE lists.id = cards.list_id 
      AND boards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Manage cards"
  ON cards
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM lists
      JOIN boards ON boards.id = lists.board_id
      WHERE lists.id = cards.list_id 
      AND boards.owner_id = auth.uid()
    )
  );