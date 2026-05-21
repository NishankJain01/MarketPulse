import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, Mail, User, ShieldAlert, ArrowRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

// Zod schemas for client validation
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  rememberMe: z.boolean().optional()
});

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export default function Auth() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [sendingForgot, setSendingForgot] = useState(false);
  
  const canvasRef = useRef(null);

  // Form setups
  const { register: registerLogin, handleSubmit: handleLoginSubmit, formState: { errors: loginErrors } } = useForm({
    resolver: zodResolver(loginSchema)
  });

  const { register: registerSignup, handleSubmit: handleSignupSubmit, watch: watchSignup, formState: { errors: signupErrors } } = useForm({
    resolver: zodResolver(signupSchema)
  });

  const signupPassword = watchSignup('password', '');
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: 'Weak', color: 'bg-neon-red' });

  // Calculate Password Strength
  useEffect(() => {
    if (!signupPassword) {
      setPasswordStrength({ score: 0, label: 'Weak', color: 'bg-neon-red' });
      return;
    }
    let score = 0;
    if (signupPassword.length >= 6) score += 1;
    if (signupPassword.length >= 10) score += 1;
    if (/[0-9]/.test(signupPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(signupPassword)) score += 1;

    if (score <= 1) {
      setPasswordStrength({ score: 25, label: 'Weak', color: 'bg-red-500' });
    } else if (score <= 3) {
      setPasswordStrength({ score: 65, label: 'Moderate', color: 'bg-yellow-500' });
    } else {
      setPasswordStrength({ score: 100, label: 'Strong', color: 'bg-emerald-500' });
    }
  }, [signupPassword]);

  // Canvas Candlestick Mock Chart Loops
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationId;
    let width = canvas.width = canvas.parentElement.offsetWidth;
    let height = canvas.height = canvas.parentElement.offsetHeight;

    // Handle resizing
    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        width = canvas.width = canvas.parentElement.offsetWidth;
        height = canvas.height = canvas.parentElement.offsetHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    const bars = [];
    const barCount = 18;
    const barWidth = 14;
    const spacing = 25;

    // Initialize mock candles
    for (let i = 0; i < barCount; i++) {
      const open = 200 + Math.sin(i * 0.4) * 80 + Math.random() * 40;
      const close = open + (Math.random() - 0.45) * 50;
      bars.push({
        x: i * spacing + 40,
        open,
        close,
        high: Math.max(open, close) + Math.random() * 20,
        low: Math.min(open, close) - Math.random() * 20,
        speed: (Math.random() - 0.5) * 1.5
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Draw grid lines
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let i = 40; i < height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }
      for (let i = 40; i < width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }

      // Draw bars
      bars.forEach((bar) => {
        // Update price levels dynamically
        bar.close += bar.speed;
        if (Math.random() > 0.95) bar.speed = (Math.random() - 0.5) * 2;
        
        // Boundaries checks
        if (bar.close > height - 60 || bar.close < 60) bar.speed *= -1;

        bar.high = Math.max(bar.open, bar.close) + Math.abs(bar.speed * 8);
        bar.low = Math.min(bar.open, bar.close) - Math.abs(bar.speed * 8);

        const isBullish = bar.close >= bar.open;
        const color = isBullish ? '#00ff88' : '#ff3366';

        // Draw shadow line (high/low wick)
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bar.x + barWidth / 2, bar.low);
        ctx.lineTo(bar.x + barWidth / 2, bar.high);
        ctx.stroke();

        // Draw candle body
        ctx.fillStyle = isBullish ? 'rgba(0, 255, 136, 0.25)' : 'rgba(255, 51, 102, 0.25)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(bar.x, Math.min(bar.open, bar.close), barWidth, Math.abs(bar.close - bar.open) || 2);
        ctx.fill();
        ctx.stroke();
      });

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  const onLoginSubmit = async (data) => {
    setSubmitting(true);
    try {
      await login(data.email, data.password);
    } catch (e) {
      // Auth context triggers toast
    } finally {
      setSubmitting(false);
    }
  };

  const onSignupSubmit = async (data) => {
    setSubmitting(true);
    try {
      await register(data.name, data.email, data.password);
    } catch (e) {
      // Auth context triggers toast
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error('Please enter your email address');
      return;
    }
    setSendingForgot(true);
    try {
      const res = await axios.post('http://localhost:5000/api/auth/forgot', { email: forgotEmail });
      toast.success(res.data.message || 'Reset link sent. Check your inbox!');
      if (res.data.previewUrl) {
        console.log(`[Developer Preview Link]: ${res.data.previewUrl}`);
      }
      setShowForgot(false);
      setForgotEmail('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error requesting password reset.');
    } finally {
      setSendingForgot(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background-primary text-text-primary overflow-hidden font-dmsans">
      {/* LEFT PANEL: Splendid Visual Showcase (Hidden on Mobile) */}
      <div className="hidden md:flex md:w-1/2 relative bg-background-secondary border-r border-white/[0.05] flex-col justify-between p-12 overflow-hidden neon-grid">
        {/* Animated canvas in background */}
        <div className="absolute inset-0 z-0 opacity-45">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>

        {/* Glow rings in background */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl pointer-events-none z-0"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-purple/10 rounded-full blur-3xl pointer-events-none z-0"></div>

        {/* Header Logo */}
        <div className="relative z-10 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-neon-blue to-neon-purple flex items-center justify-center shadow-glow-purple">
            <svg className="w-6 h-6 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
          </div>
          <span className="text-2xl font-black display-font text-text-primary tracking-wider">
            MARKET<span className="text-neon-blue">PULSE</span>
          </span>
        </div>

        {/* Glowing Digital Bull hologram in center */}
        <div className="relative z-10 my-auto flex flex-col items-center justify-center text-center px-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="relative w-64 h-64 lg:w-72 lg:h-72 mb-6 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.25)] border border-indigo-500/30 group"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 z-10 mix-blend-overlay"></div>
            <img 
              src="/neon_market_bull.png" 
              alt="MarketPulse Bull" 
              className="w-full h-full object-cover transform scale-100 group-hover:scale-105 transition-transform duration-1000"
            />
            {/* Pulsing overlay border */}
            <div className="absolute inset-0 border border-indigo-500/40 rounded-3xl animate-pulse pointer-events-none"></div>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-4xl lg:text-5xl font-black tracking-tight leading-tight display-font text-white"
          >
            MarketPulse
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-2 text-indigo-400 font-bold uppercase text-xs tracking-widest font-orbitron"
          >
            AI-Powered Market Psychology & Sentiment Intelligence
          </motion.p>
          
          <p className="mt-4 text-text-muted text-sm max-w-sm leading-relaxed">
            Harness real-time NLP AI sentiment scoring, Indian & Global market data, and expert chat assistants to trade ahead of market psychology.
          </p>
        </div>

        {/* Running Stock Ticker Tape Strip */}
        <div className="relative z-10 w-full overflow-hidden py-3 border-y border-white/[0.05] bg-white/[0.01] backdrop-blur-md -mx-12 px-12">
          <div className="animate-ticker space-x-8 text-sm font-bold mono-font">
            {/* Set 1 */}
            <span className="flex items-center space-x-2">
              <span className="text-white">NIFTY 50</span>
              <span className="text-neon-green">22,350.90 (+0.65%)</span>
            </span>
            <span className="flex items-center space-x-2">
              <span className="text-white">SENSEX</span>
              <span className="text-neon-green">73,520.40 (+0.66%)</span>
            </span>
            <span className="flex items-center space-x-2">
              <span className="text-white">RELIANCE</span>
              <span className="text-neon-green">₹2,855.20 (+1.26%)</span>
            </span>
            <span className="flex items-center space-x-2">
              <span className="text-white">TCS</span>
              <span className="text-neon-red">₹3,880.60 (-1.07%)</span>
            </span>
            <span className="flex items-center space-x-2">
              <span className="text-white">INFY</span>
              <span className="text-neon-red">₹1,435.50 (-0.85%)</span>
            </span>
            {/* Set 2 (Duplicated for infinite scroll) */}
            <span className="flex items-center space-x-2">
              <span className="text-white">NIFTY 50</span>
              <span className="text-neon-green">22,350.90 (+0.65%)</span>
            </span>
            <span className="flex items-center space-x-2">
              <span className="text-white">SENSEX</span>
              <span className="text-neon-green">73,520.40 (+0.66%)</span>
            </span>
            <span className="flex items-center space-x-2">
              <span className="text-white">RELIANCE</span>
              <span className="text-neon-green">₹2,855.20 (+1.26%)</span>
            </span>
            <span className="flex items-center space-x-2">
              <span className="text-white">TCS</span>
              <span className="text-neon-red">₹3,880.60 (-1.07%)</span>
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Glowing Authenticator Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 lg:p-16 relative bg-[#05050f] neon-grid">
        {/* Glow rings in background */}
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-neon-purple/10 rounded-full blur-3xl pointer-events-none z-0"></div>

        <div className="w-full max-w-md relative z-10">
          {/* Logo only visible on mobile header */}
          <div className="flex md:hidden items-center justify-center space-x-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-neon-blue to-neon-purple flex items-center justify-center shadow-glow-purple">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
            </div>
            <span className="text-xl font-bold display-font text-text-primary tracking-wider">
              MARKET<span className="text-neon-blue">PULSE</span>
            </span>
          </div>

          <div className="glass-panel p-8 rounded-3xl backdrop-blur-xl border border-white/[0.04] shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative overflow-hidden">
            {/* Welcome message header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl lg:text-3xl font-black tracking-tight display-font text-white mb-1">
                {isLogin ? "Welcome Back!" : "Get Started"}
              </h2>
              <p className="text-xs text-text-muted font-semibold tracking-wide">
                {isLogin ? "Login to continue to your account" : "Create an account to start stock audits"}
              </p>
            </div>

            {/* Header tab selectors */}
            <div className="flex bg-white/[0.02] border border-white/[0.04] p-1 rounded-xl mb-6">
              <button 
                type="button"
                onClick={() => setIsLogin(true)}
                className={`flex-1 text-center font-bold text-xs py-2 rounded-lg transition-all ${isLogin ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-white shadow-md' : 'text-text-muted hover:text-white'}`}
              >
                Sign In
              </button>
              <button 
                type="button"
                onClick={() => setIsLogin(false)}
                className={`flex-1 text-center font-bold text-xs py-2 rounded-lg transition-all ${!isLogin ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-white shadow-md' : 'text-text-muted hover:text-white'}`}
              >
                Sign Up
              </button>
            </div>

            <AnimatePresence mode="wait">
              {isLogin ? (
                <motion.form 
                  key="login-form"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onSubmit={handleLoginSubmit(onLoginSubmit)}
                  className="space-y-4"
                >
                  {/* Email Field */}
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-bold text-text-muted tracking-wider">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 w-4 h-4 text-text-muted" />
                      <input 
                        type="email"
                        placeholder="you@example.com"
                        {...registerLogin('email')}
                        className={`w-full glass-panel pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 ${loginErrors.email ? 'focus:ring-neon-red border-neon-red/[0.4]' : 'focus:ring-neon-blue'} text-text-primary bg-background-primary`}
                      />
                    </div>
                    {loginErrors.email && (
                      <span className="text-xs text-neon-red flex items-center gap-1 mt-0.5 font-semibold">
                        <ShieldAlert className="w-3 h-3" /> {loginErrors.email.message}
                      </span>
                    )}
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs uppercase font-bold text-text-muted tracking-wider">Password</label>
                      <button 
                        type="button"
                        onClick={() => setShowForgot(true)}
                        className="text-xs font-bold text-neon-blue hover:text-indigo-400 focus:outline-none"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 w-4 h-4 text-text-muted" />
                      <input 
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        {...registerLogin('password')}
                        className={`w-full glass-panel pl-10 pr-10 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 ${loginErrors.password ? 'focus:ring-neon-red border-neon-red/[0.4]' : 'focus:ring-neon-blue'} text-text-primary bg-background-primary`}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3 text-text-muted hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {loginErrors.password && (
                      <span className="text-xs text-neon-red flex items-center gap-1 mt-0.5 font-semibold">
                        <ShieldAlert className="w-3 h-3" /> {loginErrors.password.message}
                      </span>
                    )}
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center">
                    <input 
                      type="checkbox"
                      id="rememberMe"
                      {...registerLogin('rememberMe')}
                      className="w-4 h-4 rounded border-white/[0.08] text-neon-purple focus:ring-neon-purple focus:ring-offset-0 bg-background-primary"
                    />
                    <label htmlFor="rememberMe" className="ml-2 text-xs text-text-muted font-bold select-none cursor-pointer">
                      Remember this session
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="w-full btn-neon py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold cursor-pointer disabled:opacity-50 text-sm shadow-[0_4px_20px_rgba(99,102,241,0.2)]"
                  >
                    {submitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Sign In <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-white/[0.05]"></div>
                    <span className="flex-shrink mx-4 text-[10px] uppercase font-black text-text-muted tracking-wider">or login with</span>
                    <div className="flex-grow border-t border-white/[0.05]"></div>
                  </div>

                  {/* Mock Google Login */}
                  <button 
                    type="button"
                    onClick={() => toast.success('Google OAuth redirect (Simulated Dev Mode)')}
                    className="w-full glass-panel py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-white hover:bg-white/[0.02] text-xs border border-white/[0.05]"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    Google Account
                  </button>
                </motion.form>
              ) : (
                <motion.form 
                  key="signup-form"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onSubmit={handleSignupSubmit(onSignupSubmit)}
                  className="space-y-3.5"
                >
                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-bold text-text-muted tracking-wider">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3 w-4 h-4 text-text-muted" />
                      <input 
                        type="text"
                        placeholder="John Doe"
                        {...registerSignup('name')}
                        className={`w-full glass-panel pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 ${signupErrors.name ? 'focus:ring-neon-red border-neon-red/[0.4]' : 'focus:ring-neon-blue'} text-text-primary bg-background-primary`}
                      />
                    </div>
                    {signupErrors.name && (
                      <span className="text-xs text-neon-red flex items-center gap-1 mt-0.5 font-semibold">
                        <ShieldAlert className="w-3 h-3" /> {signupErrors.name.message}
                      </span>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-bold text-text-muted tracking-wider">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 w-4 h-4 text-text-muted" />
                      <input 
                        type="email"
                        placeholder="you@example.com"
                        {...registerSignup('email')}
                        className={`w-full glass-panel pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 ${signupErrors.email ? 'focus:ring-neon-red border-neon-red/[0.4]' : 'focus:ring-neon-blue'} text-text-primary bg-background-primary`}
                      />
                    </div>
                    {signupErrors.email && (
                      <span className="text-xs text-neon-red flex items-center gap-1 mt-0.5 font-semibold">
                        <ShieldAlert className="w-3 h-3" /> {signupErrors.email.message}
                      </span>
                    )}
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-bold text-text-muted tracking-wider">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 w-4 h-4 text-text-muted" />
                      <input 
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        {...registerSignup('password')}
                        className={`w-full glass-panel pl-10 pr-10 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 ${signupErrors.password ? 'focus:ring-neon-red border-neon-red/[0.4]' : 'focus:ring-neon-blue'} text-text-primary bg-background-primary`}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3 text-text-muted hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Password Strength Indicator */}
                    {signupPassword && (
                      <div className="mt-1.5 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-text-muted">
                          <span>Strength: {passwordStrength.label}</span>
                        </div>
                        <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
                          <div className={`h-full ${passwordStrength.color} transition-all duration-300`} style={{ width: `${passwordStrength.score}%` }}></div>
                        </div>
                      </div>
                    )}
                    {signupErrors.password && (
                      <span className="text-xs text-neon-red flex items-center gap-1 mt-0.5 font-semibold">
                        <ShieldAlert className="w-3 h-3" /> {signupErrors.password.message}
                      </span>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-bold text-text-muted tracking-wider">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 w-4 h-4 text-text-muted" />
                      <input 
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        {...registerSignup('confirmPassword')}
                        className={`w-full glass-panel pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 ${signupErrors.confirmPassword ? 'focus:ring-neon-red border-neon-red/[0.4]' : 'focus:ring-neon-blue'} text-text-primary bg-background-primary`}
                      />
                    </div>
                    {signupErrors.confirmPassword && (
                      <span className="text-xs text-neon-red flex items-center gap-1 mt-0.5 font-semibold">
                        <ShieldAlert className="w-3 h-3" /> {signupErrors.confirmPassword.message}
                      </span>
                    )}
                  </div>

                  {/* Terms */}
                  <div className="flex items-start py-1">
                    <input 
                      type="checkbox"
                      id="terms"
                      required
                      className="mt-0.5 w-4 h-4 rounded border-white/[0.08] text-neon-purple focus:ring-neon-purple focus:ring-offset-0 bg-background-primary"
                    />
                    <label htmlFor="terms" className="ml-2 text-[10px] text-text-muted leading-relaxed select-none cursor-pointer">
                      I agree to the <span className="text-neon-blue hover:underline cursor-pointer">Terms of Service</span> and consent to AI stock audits.
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="w-full btn-neon py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold cursor-pointer disabled:opacity-50 text-sm shadow-[0_4px_20px_rgba(99,102,241,0.2)]"
                  >
                    {submitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Create Account <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Forgot Password Reset Modal */}
      <AnimatePresence>
        {showForgot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-primary/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel p-8 rounded-3xl max-w-sm w-full relative"
            >
              <h3 className="text-xl font-bold display-font text-white mb-2">Reset Password</h3>
              <p className="text-sm text-text-muted mb-6 leading-relaxed">
                Enter your email address and we'll generate a secure Ethereal-smtp dev recovery link for you.
              </p>
              
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs uppercase font-black text-text-muted tracking-wider">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-text-muted" />
                    <input 
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full glass-panel pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-neon-blue text-text-primary bg-background-primary"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button 
                    type="button"
                    onClick={() => setShowForgot(false)}
                    className="flex-1 glass-panel py-3 rounded-xl font-bold hover:bg-white/[0.02]"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={sendingForgot}
                    className="flex-1 btn-neon py-3 rounded-xl font-bold flex items-center justify-center"
                  >
                    {sendingForgot ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Send Link"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
