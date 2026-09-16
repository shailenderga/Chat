import React, { useState } from 'react';
import {
  MessageSquare, Lock, Mail, User, AtSign, Shield,
  ArrowRight, Check, AlertCircle, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal() {
  const { login, register } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(null); // 'checking', 'available', 'taken'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check username availability
  const checkUsernameAvailability = async (uname) => {
    const clean = uname.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
    setUsername(clean);

    if (clean.length < 3) {
      setUsernameStatus(null);
      return;
    }

    setUsernameStatus('checking');
    try {
      const res = await fetch(`/api/auth/check-username/${clean}`);
      const data = await res.json();
      if (data.available) {
        setUsernameStatus('available');
      } else {
        setUsernameStatus('taken');
      }
    } catch (e) {
      setUsernameStatus(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (usernameStatus === 'taken') {
          setError('Please choose a different unique username.');
          setLoading(false);
          return;
        }
        await register({
          name,
          username,
          email,
          password
        });
      }
    } catch (err) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-dark-950 flex items-center justify-center p-4 select-none">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full filter blur-3xl pointer-events-none" />

      <div className="bg-dark-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-8 shadow-2xl relative z-10">
        {/* Logo & Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center mx-auto mb-3 shadow-xl shadow-brand-500/20">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Wavy</h2>
          <p className="text-xs text-slate-400 mt-1">
            Privacy-Protected Chat with Zoom Meetings & Streaks
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 bg-dark-950 p-1 rounded-2xl border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError('');
            }}
            className={`py-2 text-xs font-semibold rounded-xl transition ${
              isLogin ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In with Email
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError('');
            }}
            className={`py-2 text-xs font-semibold rounded-xl transition ${
              !isLogin ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sign Up Specific: Name and Unique Username */}
          {!isLogin && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Aryan Sharma"
                    className="w-full bg-dark-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Unique Username Handle
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => checkUsernameAvailability(e.target.value)}
                    placeholder="e.g. aryan_dev"
                    className={`w-full bg-dark-950 border rounded-2xl pl-10 pr-10 py-2.5 text-xs text-white focus:outline-none transition ${
                      usernameStatus === 'available'
                        ? 'border-emerald-500'
                        : usernameStatus === 'taken'
                        ? 'border-red-500'
                        : 'border-slate-800 focus:border-brand-500'
                    }`}
                  />
                  <div className="absolute right-3.5 top-3">
                    {usernameStatus === 'available' && (
                      <Check className="w-4 h-4 text-emerald-400" />
                    )}
                    {usernameStatus === 'taken' && (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </div>
                <div className="mt-1 text-[10px]">
                  {usernameStatus === 'available' && (
                    <span className="text-emerald-400">✅ @{username} is available!</span>
                  )}
                  {usernameStatus === 'taken' && (
                    <span className="text-red-400">❌ @{username} is already taken. Try another.</span>
                  )}
                  {!usernameStatus && (
                    <span className="text-slate-500">Every user has a strictly unique username handle.</span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Email input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-dark-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 transition"
              />
            </div>
          </div>

          {/* Password input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-dark-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 transition"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition shadow-lg shadow-brand-600/30 flex items-center justify-center space-x-2"
          >
            <span>{loading ? 'Processing...' : isLogin ? 'Sign In with Email' : 'Complete Registration'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Attribution */}
          <div className="pt-2 text-center">
            <p className="text-xs text-slate-400 font-medium tracking-wide">
              Created by <span className="text-brand-400 font-semibold">Shailender Gautam</span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
