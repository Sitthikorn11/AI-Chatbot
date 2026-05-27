import { useState, useEffect } from 'react'
import { Sparkles, LogIn, UserPlus, Lock, Mail, Eye, EyeOff } from 'lucide-react'
import { GoogleLogin } from '@react-oauth/google'

interface AuthScreenProps {
  setUsername: (username: string) => void;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback
}

export default function AuthScreen({ setUsername }: AuthScreenProps) {
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good Morning')
    else if (hour < 18) setGreeting('Good Afternoon')
    else setGreeting('Good Evening')
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)

    const endpoint = isLoginMode ? '/api/login' : '/api/register'
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: "include",
        body: JSON.stringify({ username: authUsername, password: authPassword })
      })
      
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed")
      }

      if (isLoginMode) {
        localStorage.setItem('username', data.username)
        setUsername(data.username)
      } else {
        setIsLoginMode(true)
        setAuthError('Registration successful! Please login.')
      }
    } catch (err: unknown) {
      setAuthError(getErrorMessage(err, 'Authentication failed'))
    } finally {
      setAuthLoading(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setAuthError('')
    setAuthLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: "include",
        body: JSON.stringify({ token: credentialResponse.credential })
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || "Google authentication failed")
      }
      localStorage.setItem('username', data.username)
      setUsername(data.username)
    } catch (err: unknown) {
      setAuthError(getErrorMessage(err, 'Google authentication failed'))
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-transparent text-slate-800 dark:text-slate-200 font-sans items-center justify-center relative overflow-hidden transition-colors duration-300">
      {/* Animated Floating Backgrounds */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-amber-500/20 rounded-full blur-[100px] animate-[pulse_6s_ease-in-out_infinite]"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-orange-500/20 rounded-full blur-[120px] animate-[pulse_8s_ease-in-out_infinite_reverse]"></div>
      <div className="absolute top-[20%] right-[20%] w-[300px] h-[300px] bg-yellow-400/10 rounded-full blur-[80px] animate-[ping_10s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
      
      <div className={`w-full max-w-md glass-panel p-8 sm:p-10 rounded-[2rem] shadow-2xl z-10 mx-4 transition-all duration-700 transform ${isLoginMode ? 'translate-y-0' : 'scale-[1.02] shadow-[0_20px_50px_rgba(245,158,11,0.15)]'} animate-pop-in`}>
        <div className="flex flex-col items-center mb-8">
          <div className="relative group cursor-pointer mb-6">
            <div className="absolute inset-0 bg-amber-400 blur-md opacity-40 group-hover:opacity-70 transition-opacity duration-300 rounded-2xl"></div>
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg transform group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 tracking-tight">
            {isLoginMode ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium">
            {isLoginMode ? `${greeting}! Ready to analyze some data?` : 'Join us to explore your data intelligently.'}
          </p>
        </div>

        {authError && (
          <div className={`p-4 rounded-2xl text-sm mb-6 flex items-center gap-2 animate-pop-in ${authError.includes('successful') ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50'}`}>
            <div className={`w-2 h-2 rounded-full ${authError.includes('successful') ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-red-500 dark:bg-red-400'}`}></div>
            {authError}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="relative group">
            <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors duration-300" />
            <input 
              type="text" 
              required
              value={authUsername}
              onChange={e => setAuthUsername(e.target.value)}
              placeholder="Username"
              className="w-full bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-amber-400 dark:focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all duration-300 shadow-sm"
            />
          </div>
          <div className="relative group">
            <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors duration-300" />
            <input 
              type={showPassword ? "text" : "password"} 
              required
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-12 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-amber-400 dark:focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all duration-300 shadow-sm"
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-500 focus:outline-none transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <button 
            type="submit" 
            disabled={authLoading}
            className="w-full relative group overflow-hidden bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3.5 rounded-2xl shadow-[0_8px_20px_rgba(245,158,11,0.25)] hover:shadow-[0_8px_25px_rgba(245,158,11,0.4)] transition-all duration-300 flex items-center justify-center gap-2 mt-2 transform hover:-translate-y-0.5"
          >
            {/* Button Shine Effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            
            {authLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                {isLoginMode ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                <span>{isLoginMode ? 'Sign In to Dashboard' : 'Create Account'}</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
            </div>
            <div className="relative bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm px-4 text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider rounded-full transition-colors duration-300">
              Or continue with
            </div>
          </div>
          
          <div className="flex justify-center mb-6">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setAuthError('Google Login Failed')}
              useOneTap
              theme="outline"
              shape="pill"
            />
          </div>
          
          <button 
            onClick={() => {
              setIsLoginMode(!isLoginMode)
              setAuthError('')
            }}
            className="text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-500 text-sm font-semibold transition-colors duration-300"
          >
            {isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
        </div>
      </div>
    </div>
  )
}
