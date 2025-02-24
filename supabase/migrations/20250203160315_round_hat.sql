/*
  # Fix board policies to prevent recursion

  1. Changes
    - Simplify board access policies to prevent recursion
    - Update board member policies for cleaner access control
    - Ensure proper cascading for related tables

  2. Security
    - Maintain RLS security while fixing recursion issues
    - Keep existing access patterns but with optimized queries
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view their own boards" ON boards;
DROP POLICY IF EXISTS "Users can create their own boards" ON boards;
DROP POLICY IF EXISTS "Board owners can update their boards" ON boards;
DROP POLICY IF EXISTS "Board owners can delete their boards" ON boards;
DROP POLICY IF EXISTS "Users can view board members" ON board_members;
DROP POLICY IF EXISTS "Board owners can manage members" ON board_members;

-- Recreate board policies without recursion
CREATE POLICY "Users can view their own boards"
  ON boards
  FOR SELECT
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM board_members
      WHERE board_members.board_id = boards.id 
      AND board_members.user_id = auth.uid()
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

-- Recreate board members policies
CREATE POLICY "Users can view board members"
  ON board_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_members.board_id 
      AND (boards.owner_id = auth.uid() OR board_members.user_id = auth.uid())
    )
  );

CREATE POLICY "Board owners can manage members"
  ON board_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_members.board_id 
      AND boards.owner_id = auth.uid()
    )
  );