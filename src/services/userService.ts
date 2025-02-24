import { supabase } from '../lib/supabase';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export const userService = {
  async getUsers(): Promise<User[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.log('No authenticated session');
        return [];
      }

      // Get user's current company
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('current_company_id')
        .eq('user_id', session.user.id)
        .single();

      if (!profile?.current_company_id) {
        console.log('No current company');
        return [];
      }

      // Get company members with profiles
      const { data: members, error } = await supabase
        .from('company_member_profiles')
        .select('*')
        .eq('company_id', profile.current_company_id);

      if (error) {
        console.error('Failed to fetch company members:', error);
        return [];
      }

      console.log('Fetched company members:', members);

      return (members || []).map(member => ({
        id: member.user_id,
        email: member.email,
        first_name: member.first_name || '',
        last_name: member.last_name || ''
      }));

    } catch (err) {
      console.error('Failed to fetch users:', err);
      return [];
    }
  },

  formatUserName(user: User): string {
    if (!user) return 'Unknown';
    const fullName = [user.first_name, user.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || user.email?.split('@')[0] || 'Unknown';
  }
};