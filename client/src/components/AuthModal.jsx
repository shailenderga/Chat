import React, { useState } from 'react';
import {
  MessageSquare, Lock, Mail, User, AtSign, Shield,
  ArrowRight, Check, AlertCircle, Sparkles, KeyRound,
  ArrowLeft, Eye, EyeOff, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal() {
  const { login, register } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: email, 2: code + new password

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(null); // 'checking', 'available', 'taken'

  // Forgot password states
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetToken, setResetToken] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [generatedCode, setGeneratedCode] = useState(null);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
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

  // Sign In / Sign Up Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
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

  // Step 1: Request Reset Code
  const handleRequestResetCode = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setError('Please enter your registered email address');
      return;
    }

    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to request reset code');
      }

      setGeneratedCode(data.code);
      setResetToken(data.resetToken || null);
      setResetCode(String(data.code || '')); // Auto-fill code into box!
      setForgotStep(2);
      setSuccessMsg('Verification code generated! Please enter your new password below.');
    } catch (err) {
      setError(err.message || 'Could not send verification code');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Code and Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetCode.trim()) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match');
      return;
    }

    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail.trim(),
          code: resetCode.trim(),
          newPassword,
          resetToken
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setSuccessMsg('✅ Password reset successfully! Redirecting to login...');
      setEmail(resetEmail);
      setPassword('');

      setTimeout(() => {
        setIsForgot(false);
        setForgotStep(1);
        setIsLogin(true);
        setGeneratedCode(null);
        setResetToken(null);
        setResetCode('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccessMsg('');
        setError('');
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to reset password');
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
            {isForgot ? (
              <KeyRound className="w-7 h-7 text-white" />
            ) : (
              <MessageSquare className="w-7 h-7 text-white" />
            )}
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            {isForgot ? 'Reset Password' : 'Wavy'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isForgot
              ? forgotStep === 1
                ? 'Enter your registered email to receive a 6-digit reset code'
                : 'Enter the 6-digit code and set your new password'
              : 'Privacy-Protected Chat with Zoom Meetings & Streaks'}
          </p>
        </div>

        {/* Tab Switcher (Only visible in normal Login/Register mode) */}
        {!isForgot && (
          <div className="grid grid-cols-2 bg-dark-950 p-1 rounded-2xl border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setError('');
                setSuccessMsg('');
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
                setSuccessMsg('');
              }}
              className={`py-2 text-xs font-semibold rounded-xl transition ${
                !isLogin ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* --- FORGOT PASSWORD WORKFLOW --- */}
        {isForgot ? (
          <div className="space-y-4">
            {forgotStep === 1 ? (
              // Step 1 Form: Enter Registered Email
              <form onSubmit={handleRequestResetCode} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Registered Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-dark-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition shadow-lg shadow-brand-600/30 flex items-center justify-center space-x-2"
                >
                  <span>{loading ? 'Sending Code...' : 'Send Verification Code'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              // Step 2 Form: Enter 6-digit Code + New Password
              <form onSubmit={handleResetPassword} className="space-y-4">
                {/* Instant Verification Code Display Card */}
                {generatedCode && (
                  <div className="p-3.5 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 text-xs space-y-2">
                    <div className="flex items-center justify-between font-bold text-indigo-300">
                      <div className="flex items-center space-x-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <span>Your 6-Digit Verification Code</span>
                      </div>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                        Auto-filled ✓
                      </span>
                    </div>
                    <div
                      onClick={() => setResetCode(String(generatedCode))}
                      className="font-mono text-2xl font-extrabold text-white tracking-widest bg-dark-950/90 px-4 py-2.5 rounded-xl border border-indigo-500/40 text-center select-all cursor-pointer hover:border-brand-400 hover:bg-slate-900 transition shadow-inner"
                      title="Click to copy / refill code"
                    >
                      {generatedCode}
                    </div>
                    <p className="text-[10px] text-slate-400 text-center">
                      Valid for 15 minutes. Code is already auto-filled below. Just enter your new password to reset.
                    </p>
                  </div>
                )}

                {/* 6-Digit Code Input */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    6-Digit Verification Code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="e.g. 123456"
                      className="w-full bg-dark-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white font-mono tracking-widest focus:outline-none focus:border-brand-500 transition"
                    />
                  </div>
                </div>

                {/* New Password Input */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full bg-dark-950 border border-slate-800 rounded-2xl pl-10 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Input */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type new password"
                      className="w-full bg-dark-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 transition"
                    />
                  </div>
                </div>

                {/* Reset Password Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2"
                >
                  <span>{loading ? 'Resetting Password...' : 'Reset Password'}</span>
                  <Check className="w-4 h-4" />
                </button>

                {/* Resend Code Option */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={handleRequestResetCode}
                    disabled={loading}
                    className="text-[11px] text-slate-400 hover:text-brand-300 transition underline underline-offset-2"
                  >
                    Didn't receive code? Request a new code
                  </button>
                </div>
              </form>
            )}

            {/* Back to Sign In Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsForgot(false);
                  setForgotStep(1);
                  setError('');
                  setSuccessMsg('');
                  setGeneratedCode(null);
                }}
                className="w-full py-2.5 rounded-2xl bg-dark-950 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition border border-slate-800 flex items-center justify-center space-x-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            </div>
          </div>
        ) : (
          // --- NORMAL LOGIN / REGISTER WORKFLOW ---
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Password
                </label>
                {/* Forgot Password Trigger Button */}
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgot(true);
                      setForgotStep(1);
                      setResetEmail(email || '');
                      setError('');
                      setSuccessMsg('');
                      setGeneratedCode(null);
                    }}
                    className="text-[11px] font-medium text-brand-400 hover:text-brand-300 transition hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
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
        )}
      </div>
    </div>
  );
}

