'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
}

interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  
  const router = useRouter();

  // Check if user is already authenticated
  useEffect(() => {
    const validateAuth = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      try {
        // Validate the token with your API
        const response = await fetch('/api/auth/validate', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const userRole = localStorage.getItem('userRole');
          if (userRole === 'ADMIN') {
            router.push('/admin/overview');
          } else {
            router.push('/questions');
          }
        } else {
          // Invalid token, clear localStorage
          localStorage.removeItem('authToken');
          localStorage.removeItem('userRole');
          localStorage.removeItem('userData');
        }
      } catch (error) {
        // Network error or invalid token, clear localStorage
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userData');
      }
    };

    validateAuth();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  // Client-side signup function with proper error handling
  const signupUser = async (userData: { name: string; email: string; password: string }) => {
    try {
      console.log('Sending signup request...');
      
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      // Check if response has content
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Response is not JSON:', text);
        throw new Error('Server returned non-JSON response');
      }
      
      // Parse JSON response
      const data = await response.json();
      console.log('Response data:', data);
      
      if (!response.ok) {
        console.error('Response not ok:', response.status, response.statusText);
        throw new Error(data.error || 'Signup failed');
      }
      
      return data;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      let data: AuthResponse;
      
      if (isSignUp) {
        // Use the improved signup function
        data = await signupUser({
          name: formData.name,
          email: formData.email,
          password: formData.password
        });
      } else {
        // Sign in logic
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Sign in failed');
        }

        data = await response.json();
      }

      // Store auth data
      localStorage.setItem('authToken', data.token || 'mock-token');
      localStorage.setItem('userRole', data.user.role);
      localStorage.setItem('userData', JSON.stringify(data.user));

      // Redirect based on role
      if (data.user.role === 'ADMIN') {
        router.push('/admin/overview');
      } else {
        router.push('/questions');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      // Mock Google sign-in for demonstration
      // In production, integrate with actual Google OAuth
      const mockUser = {
        id: 'google-user-123',
        name: 'Google User',
        email: 'user@gmail.com',
        role: 'USER' as const,
        createdAt: new Date().toISOString()
      };

      localStorage.setItem('authToken', 'google-token');
      localStorage.setItem('userRole', mockUser.role);
      localStorage.setItem('userData', JSON.stringify(mockUser));

      router.push('/questions');
    } catch (err) {
      setError('Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      // Mock Apple sign-in for demonstration
      // In production, integrate with actual Apple Sign-In
      const mockUser = {
        id: 'apple-user-123',
        name: 'Apple User',
        email: 'user@icloud.com',
        role: 'USER' as const,
        createdAt: new Date().toISOString()
      };

      localStorage.setItem('authToken', 'apple-token');
      localStorage.setItem('userRole', mockUser.role);
      localStorage.setItem('userData', JSON.stringify(mockUser));

      router.push('/questions');
    } catch (err) {
      setError('Apple sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAsGuest = () => {
    localStorage.setItem('authToken', 'guest-token');
    localStorage.setItem('userRole', 'USER');
    localStorage.setItem('userData', JSON.stringify({
      id: 'guest',
      name: 'Guest User',
      email: 'guest@stackit.com',
      role: 'USER'
    }));
    
    router.push('/questions');
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return false;
    }
    
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    
    if (isSignUp && !formData.name) {
      setError('Name is required for sign up');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    return true;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-mono">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-black mb-2">Stack-It</h1>
          <p className="text-black text-sm">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          {isSignUp && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-black mb-1">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-black bg-white"
                placeholder="Enter your name"
                required={isSignUp}
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-black mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-black bg-white"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-black mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-black bg-white"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-black"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2 px-4 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              isSignUp ? 'Sign Up' : 'Sign In'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-black">or</span>
          </div>
        </div>

        {/* Social Sign-in Buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-black">Continue with Google</span>
          </button>

          <button
            onClick={handleAppleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <span>Continue with Apple</span>
          </button>
        </div>

        {/* Continue as Guest */}
        <button
          onClick={handleContinueAsGuest}
          className="w-full text-black hover:text-gray-700 py-2 text-sm underline transition-colors"
        >
          Continue as Guest
        </button>

        {/* Toggle Sign In/Sign Up */}
        <div className="text-center mt-6">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setFormData({ name: '', email: '', password: '' });
            }}
            className="text-sm text-black hover:text-gray-700 transition-colors"
          >
            {isSignUp 
              ? 'Already have an account? Sign in' 
              : "Don't have an account? Sign up"
            }
          </button>
        </div>
      </div>
    </div>
  );
}