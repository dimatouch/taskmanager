import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, AlertCircle, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

// Schema for sign in
const signInSchema = z.object({
  email: z.string().min(3, 'Login must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type SignInFormData = z.infer<typeof signInSchema>;

export function AuthForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  
  const { register, handleSubmit, formState: { errors } } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (data: SignInFormData) => {
    setIsLoading(true);
    setError(null);
    setEmail(data.email);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      
      if (error) {
        throw new Error('Invalid email or password');
      }

      // Get user's current company
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('current_company_id')
        .eq('user_id', authData.user.id)
        .single();

      // If user has no company, they need to request access
      if (!profile?.current_company_id) {
        throw new Error('No company access. Please contact administrator.');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsResetting(true);
      setError(null);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`
      });

      if (error) throw error;
      setResetSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 p-8 bg-white rounded-lg shadow-lg relative">
      <div>
        <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
          Sign in to your account
        </h2>
        <div className="mt-4 text-center space-y-2">
          <p className="text-sm text-gray-600">
            Please contact your administrator to get access to the system
          </p>
          <button
            onClick={handleResetPassword}
            disabled={isResetting || !email}
            className={cn(
              "text-sm text-indigo-600 hover:text-indigo-500",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isResetting ? 'Sending reset link...' : 'Forgot your password?'}
          </button>
        </div>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4 rounded-md">
          <div>
            <input
              {...register('email')}
              type="email"
              placeholder="Email address"
              className={cn(
                'block w-full rounded-lg border-0 py-2.5 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300',
                'placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600',
                'sm:text-sm sm:leading-6',
                errors.email && 'ring-red-500 focus:ring-red-500'
              )}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>
          <div>
            <input
              {...register('password')}
              type="password"
              placeholder="Password"
              className={cn(
                'block w-full rounded-lg border-0 py-2.5 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300',
                'placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600',
                'sm:text-sm sm:leading-6',
                errors.password && 'ring-red-500 focus:ring-red-500'
              )}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "flex w-full justify-center items-center rounded-lg bg-indigo-600 px-4 py-2.5",
              "text-sm font-semibold text-white shadow-sm hover:bg-indigo-500",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}