import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Minus, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Mic, 
  Upload, 
  Trash2, 
  Edit2, 
  PieChart as PieChartIcon,
  LayoutDashboard,
  LogOut,
  X,
  Check,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  Camera,
  Download,
  Sparkles,
  Target,
  User,
  Shield,
  Database,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  CartesianGrid,
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';

import { auth } from './lib/firebase';
import { useAuth, AuthProvider } from './lib/AuthContext';
import { expenseService, Expense, UserProfile } from './lib/expenseService';
import { geminiService } from './lib/geminiService';
import { cn, formatCurrency } from './lib/utils';

// --- Components ---

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

function Login() {
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'admin' | 'driver' | 'customer'>('customer');
  const [secretKey, setSecretKey] = useState('');
  const [error, setError] = useState<React.ReactNode | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Check if user profile exists, if not create one
      const existingProfile = await expenseService.getUserProfile(result.user.uid);
      if (!existingProfile) {
        await expenseService.saveUserProfile({
          uid: result.user.uid,
          email: result.user.email!,
          displayName: result.user.displayName || '',
          role: 'customer', // Default role for Google login
          initialBalance: 0
        });
      }
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        return;
      }
      console.error("Login failed", error);
      let message: React.ReactNode = "An authentication error occurred. Please try again.";
      if (error.code === 'auth/operation-not-allowed') {
        message = "Google login is not enabled. Please enable it in the Firebase Console.";
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const cleanEmail = email.trim();
    try {
      if (isSignup) {
        // Only require secret key for Admin role
        if (role === 'admin' && secretKey !== 'admin123') {
          setError("Invalid Admin Secret Key. Please contact the system owner.");
          setLoading(false);
          return;
        }
        
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (displayName) {
          await updateProfile(userCredential.user, { displayName });
          await userCredential.user.reload();
        }
        
        // Save user profile to Firestore with the selected role
        await expenseService.saveUserProfile({
          uid: userCredential.user.uid,
          email: userCredential.user.email!,
          displayName: displayName || userCredential.user.displayName || '',
          role: role,
          initialBalance: 0
        });
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      }
    } catch (error: any) {
      console.error("Auth failed", error);
      
      // Check both code and message for robustness
      const errorCode = (error.code || '').toLowerCase();
      const errorMessage = (error.message || '').toLowerCase();
      
      let message: React.ReactNode = "An authentication error occurred. Please try again.";
      
      if (errorCode.includes('email-already-in-use') || errorMessage.includes('email-already-in-use')) {
        message = "This email is already registered.";
      } else if (errorCode.includes('invalid-credential') || errorMessage.includes('invalid-credential') || 
                 errorCode.includes('invalid-login-credentials') || errorMessage.includes('invalid-login-credentials')) {
        message = "Invalid email or password.";
      } else if (errorCode.includes('weak-password') || errorMessage.includes('weak-password')) {
        message = "Password should be at least 6 characters.";
      } else if (errorCode.includes('invalid-email') || errorMessage.includes('invalid-email')) {
        message = "Please enter a valid email address.";
      } else if (errorCode.includes('user-not-found') || errorMessage.includes('user-not-found')) {
        message = "No account found with this email.";
      } else if (errorCode.includes('wrong-password') || errorMessage.includes('wrong-password')) {
        message = "Incorrect password.";
      } else if (errorCode.includes('too-many-requests') || errorMessage.includes('too-many-requests')) {
        message = "Too many failed attempts. Please try again later.";
      } else if (errorCode.includes('operation-not-allowed') || errorMessage.includes('operation-not-allowed')) {
        message = (
          <span>
            Email/Password login is not enabled. 
            <a 
              href="https://console.firebase.google.com/project/_/authentication/providers" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="underline font-bold ml-1 hover:text-[#4a4a35]"
            >
              Enable it here
            </a>
          </span>
        );
      } else {
        // Fallback: Try to extract a clean message from Firebase error string
        const match = error.message?.match(/Firebase: Error \((.*?)\)\./);
        if (match && match[1]) {
          const cleanCode = match[1].split('/')[1] || match[1];
          message = cleanCode.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[32px] p-10 shadow-xl border border-black/5"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#5A5A40] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
            <Wallet className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif text-[#1a1a1a] mb-2">FinTrack</h1>
          <p className="text-[#1a1a1a]/40 font-serif italic text-sm">
            {isSignup ? "Create your account to start tracking." : "Welcome back to your financial companion."}
          </p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4 mb-8">
          {isSignup && (
            <>
              <div>
                <label className="block text-[10px] font-serif text-[#1a1a1a]/40 mb-1 uppercase tracking-widest ml-4">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#f5f5f0] border-none rounded-2xl px-6 py-3 focus:ring-2 focus:ring-[#5A5A40]/20 font-serif text-sm"
                  placeholder="John Doe"
                />
              </div>
              <div className="relative">
                <label className="block text-[10px] font-serif text-[#1a1a1a]/40 mb-1 uppercase tracking-widest ml-4">Account Role</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-[#f5f5f0] border-none rounded-2xl px-6 py-3 focus:ring-2 focus:ring-[#5A5A40]/20 font-serif text-sm appearance-none cursor-pointer"
                >
                  <option value="customer">Customer</option>
                  <option value="driver">Driver</option>
                  <option value="admin">Administrator</option>
                </select>
                <div className="absolute right-4 top-[34px] pointer-events-none text-[#1a1a1a]/40">
                  <ChevronRight className="w-4 h-4 rotate-90" />
                </div>
              </div>
              {role === 'admin' && (
                <div>
                  <label className="block text-[10px] font-serif text-[#1a1a1a]/40 mb-1 uppercase tracking-widest ml-4">Admin Secret Key</label>
                  <input 
                    type="password" 
                    required
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="w-full bg-[#f5f5f0] border-none rounded-2xl px-6 py-3 focus:ring-2 focus:ring-[#5A5A40]/20 font-serif text-sm"
                    placeholder="Enter admin key"
                  />
                </div>
              )}
            </>
          )}
          <div>
            <label className="block text-[10px] font-serif text-[#1a1a1a]/40 mb-1 uppercase tracking-widest ml-4">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#f5f5f0] border-none rounded-2xl px-6 py-3 focus:ring-2 focus:ring-[#5A5A40]/20 font-serif text-sm"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1 ml-4">
              <label className="block text-[10px] font-serif text-[#1a1a1a]/40 uppercase tracking-widest">Password</label>
              {!isSignup && (
                <button 
                  type="button"
                  onClick={() => {
                    const cleanEmail = email.trim();
                    if (!cleanEmail) {
                      setError("Please enter your email to reset password.");
                      return;
                    }
                    import('firebase/auth').then(({ sendPasswordResetEmail }) => {
                      sendPasswordResetEmail(auth, cleanEmail).then(() => {
                        setError("Password reset email sent!");
                      }).catch(err => {
                        console.error("Password reset failed", err);
                        let message: React.ReactNode = "Failed to send reset email.";
                        if (err.code === 'auth/user-not-found' || err.message.includes('auth/user-not-found')) {
                          message = "No account found with this email.";
                        } else if (err.code === 'auth/invalid-email' || err.message.includes('auth/invalid-email')) {
                          message = "Invalid email address.";
                        }
                        setError(message);
                      });
                    });
                  }}
                  className="text-[10px] font-serif text-[#5A5A40] hover:underline"
                >
                  Forgot?
                </button>
              )}
            </div>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#f5f5f0] border-none rounded-2xl px-6 py-3 focus:ring-2 focus:ring-[#5A5A40]/20 font-serif text-sm"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-rose-500 text-xs font-serif italic text-center px-4">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#5A5A40] text-white rounded-2xl py-4 font-serif text-base hover:bg-[#4a4a35] transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isSignup ? "Create Account" : "Sign In")}
          </button>
        </form>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-black/5"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-4 text-[#1a1a1a]/20 font-serif tracking-widest">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white border border-black/5 text-[#1a1a1a] rounded-2xl py-4 font-serif text-sm hover:bg-[#f5f5f0] transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-50"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          Google Account
        </button>

        <p className="mt-8 text-center text-sm font-serif text-[#1a1a1a]/40">
          {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
          <button 
            onClick={() => setIsSignup(!isSignup)}
            className="text-[#5A5A40] font-bold hover:underline"
          >
            {isSignup ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab, isOpen, onClose }: { activeTab: string, setActiveTab: (tab: string) => void, isOpen?: boolean, onClose?: () => void }) {
  const { user, profile } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'expenses', label: 'Transactions', icon: Wallet },
    { id: 'reports', label: 'Reports', icon: PieChartIcon },
    { id: 'insights', label: 'AI Insights', icon: Sparkles },
    ...(profile?.role === 'admin' ? [{ id: 'admin', label: 'Admin Panel', icon: Shield }] : []),
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const content = (
    <div className="flex flex-col h-full bg-white">
      <div className="p-8">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center">
              <Wallet className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-serif text-[#1a1a1a]">FinTrack</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="lg:hidden p-2 hover:bg-[#f5f5f0] rounded-full">
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (onClose) onClose();
              }}
              className={cn(
                "w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-serif",
                activeTab === item.id 
                  ? "bg-[#f5f5f0] text-[#5A5A40] font-bold" 
                  : "text-[#1a1a1a]/60 hover:bg-[#f5f5f0]/50"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-8 border-t border-black/5">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-[#f5f5f0] border-2 border-[#5A5A40]/20">
            {profile?.photoURL ? (
              <img 
                src={profile.photoURL} 
                alt={profile.displayName || 'User'} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#5A5A40]">
                <User className="w-6 h-6" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#1a1a1a] truncate">{profile?.displayName || user?.displayName || user?.email}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-[#1a1a1a]/40 truncate">{user?.email}</p>
              {profile?.role && (
                <span className="text-[8px] px-1.5 py-0.5 bg-[#5A5A40]/10 text-[#5A5A40] rounded-full uppercase font-bold tracking-tighter">
                  {profile.role}
                </span>
              )}
            </div>
          </div>
        </div>
        <button 
          onClick={() => signOut(auth)}
          className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-red-500 hover:bg-red-50 transition-all font-serif"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-72 border-r border-black/5 flex-col h-screen sticky top-0 bg-white">
        {content}
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 left-0 bottom-0 w-80 bg-white shadow-2xl"
            >
              {content}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function Insights({ expenses, profile }: { expenses: Expense[], profile: UserProfile | null }) {
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    const data = await expenseService.getFinancialInsights(expenses, profile);
    setInsights(data);
    setLoading(false);
  };

  useEffect(() => {
    if (expenses.length > 0) {
      fetchInsights();
    }
  }, [expenses.length]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-serif text-[#1a1a1a] mb-2">AI Insights</h2>
          <p className="text-[#1a1a1a]/40 font-serif italic">Personalized financial advice powered by Gemini.</p>
        </div>
        <button 
          onClick={fetchInsights}
          disabled={loading}
          className="bg-[#5A5A40] text-white px-6 py-3 rounded-2xl font-serif flex items-center gap-2 hover:bg-[#4a4a35] transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          Refresh Insights
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {insights.map((insight, index) => (
          <motion.div 
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm flex gap-6 items-start"
          >
            <div className="w-12 h-12 bg-[#5A5A40]/10 rounded-2xl flex items-center justify-center shrink-0">
              <span className="text-xl">💡</span>
            </div>
            <p className="text-[#1a1a1a] font-serif leading-relaxed">{insight}</p>
          </motion.div>
        ))}
        {insights.length === 0 && !loading && (
          <div className="col-span-full text-center py-20 bg-white rounded-[32px] border border-dashed border-black/10">
            <Sparkles className="w-12 h-12 text-[#1a1a1a]/10 mx-auto mb-4" />
            <p className="text-[#1a1a1a]/40 font-serif italic">Add some transactions to get personalized insights!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BudgetSetter({ profile, onSave }: { profile: UserProfile | null, onSave: (budget: number) => Promise<void> }) {
  const [budget, setBudget] = useState(profile?.monthlyBudget?.toString() || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (profile?.monthlyBudget !== undefined && profile.monthlyBudget !== null) {
      setBudget(profile.monthlyBudget.toString());
    }
  }, [profile?.monthlyBudget]);

  const handleSave = async () => {
    const val = parseFloat(budget);
    if (isNaN(val) || val <= 0) return;
    
    setIsSaving(true);
    try {
      await onSave(val);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error("Save budget failed", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center">
          <Target className="text-white w-6 h-6" />
        </div>
        <h3 className="text-xl font-serif text-[#1a1a1a]">Monthly Budget</h3>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <input 
            type="number" 
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-full bg-[#f5f5f0] border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#5A5A40]/20 font-serif text-sm"
            placeholder="Set your goal..."
          />
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#3D3D2D] text-white px-8 py-4 rounded-full font-serif hover:bg-[#2D2D1D] transition-all whitespace-nowrap flex items-center justify-center gap-2 min-w-[140px] shadow-lg"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : showSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              Saved
            </>
          ) : (
            "Save Budget"
          )}
        </button>
      </div>
    </div>
  );
}
function StatCard({ title, amount, icon: Icon, trend, color }: { title: string, amount: number, icon: any, trend?: number, color: string }) {
  return (
    <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", color)}>
          <Icon className="text-white w-6 h-6" />
        </div>
        {trend !== undefined && (
          <div className={cn("flex items-center gap-1 text-sm font-bold", trend >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-[#1a1a1a]/40 font-serif text-sm mb-2 uppercase tracking-wider">{title}</p>
      <h3 className="text-3xl font-serif text-[#1a1a1a]">{formatCurrency(amount)}</h3>
    </div>
  );
}

function ExpenseModal({ isOpen, onClose, onSave, initialData }: { isOpen: boolean, onClose: () => void, onSave: (data: any) => void, initialData?: any }) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'Food',
    type: 'expense',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ ...formData, amount: parseFloat(formData.amount), date: new Date(formData.date).toISOString() });
      // Clear draft on successful save
      if (!initialData) {
        localStorage.removeItem('expense_draft');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Load draft on mount
  useEffect(() => {
    if (isOpen && !initialData) {
      const draft = localStorage.getItem('expense_draft');
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          setFormData(prev => ({ ...prev, ...parsed }));
        } catch (e) {
          console.error("Failed to parse draft", e);
        }
      }
    }
  }, [isOpen, initialData]);

  // Save draft on change
  useEffect(() => {
    if (isOpen && !initialData && (formData.title || formData.amount)) {
      localStorage.setItem('expense_draft', JSON.stringify(formData));
    }
  }, [formData, isOpen, initialData]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title,
        amount: initialData.amount.toString(),
        category: initialData.category,
        type: initialData.type,
        date: initialData.date.split('T')[0]
      });
    } else if (!localStorage.getItem('expense_draft')) {
      setFormData({
        title: '',
        amount: '',
        category: 'Food',
        type: 'expense',
        date: format(new Date(), 'yyyy-MM-dd')
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[32px] w-full max-w-lg p-10 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-serif text-[#1a1a1a]">{initialData ? 'Edit' : 'Add'} Transaction</h2>
          <button onClick={onClose} className="p-2 hover:bg-[#f5f5f0] rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex gap-2 p-1 bg-[#f5f5f0] rounded-2xl">
            <button 
              onClick={() => setFormData({ ...formData, type: 'expense' })}
              className={cn("flex-1 py-3 rounded-xl font-serif transition-all", formData.type === 'expense' ? "bg-white shadow-sm text-[#ef4444]" : "text-[#1a1a1a]/40")}
            >
              Expense
            </button>
            <button 
              onClick={() => setFormData({ ...formData, type: 'income' })}
              className={cn("flex-1 py-3 rounded-xl font-serif transition-all", formData.type === 'income' ? "bg-white shadow-sm text-[#10b981]" : "text-[#1a1a1a]/40")}
            >
              Income
            </button>
          </div>

          <div>
            <label className="block text-sm font-serif text-[#1a1a1a]/40 mb-2 uppercase tracking-wider">Title</label>
            <input 
              type="text" 
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-[#f5f5f0] border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#5A5A40]/20 font-serif"
              placeholder="What was it for?"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-serif text-[#1a1a1a]/40 mb-2 uppercase tracking-wider">Amount</label>
              <input 
                type="number" 
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full bg-[#f5f5f0] border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#5A5A40]/20 font-serif"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-serif text-[#1a1a1a]/40 mb-2 uppercase tracking-wider">Category</label>
              <select 
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-[#f5f5f0] border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#5A5A40]/20 font-serif appearance-none"
              >
                {['Food', 'Travel', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Salary', 'Other'].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-serif text-[#1a1a1a]/40 mb-2 uppercase tracking-wider">Date</label>
            <input 
              type="date" 
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full bg-[#f5f5f0] border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#5A5A40]/20 font-serif"
            />
          </div>

          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-[#5A5A40] text-white rounded-full py-5 font-serif text-lg hover:bg-[#4a4a35] transition-colors mt-4 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : initialData ? 'Update' : 'Save'} Transaction
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function VoiceInput({ onParsed }: { onParsed: (data: any) => void }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);

  const [showFallback, setShowFallback] = useState(false);
  const [fallbackText, setFallbackText] = useState('');

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser. Switching to text input.");
      setShowFallback(true);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      handleParse(text);
    };
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      
      let message = `Speech recognition error: ${event.error}.`;
      
      if (event.error === 'network') {
        message = "Network error: The browser couldn't connect to the speech service. Please check your connection or try typing your command.";
        setShowFallback(true);
      } else if (event.error === 'not-allowed') {
        message = "Microphone access denied. Please allow permissions or type your command.";
        setShowFallback(true);
      } else {
        setShowFallback(true);
      }
      
      toast.error(message);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleParse = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const parsed = await geminiService.parseVoiceInput(text);
      if (parsed) {
        onParsed([parsed]);
        setShowFallback(false);
        setFallbackText('');
      } else {
        toast.error("Could not understand the input. Please try again.");
      }
    } catch (error) {
      console.error("Parsing failed", error);
      toast.error("Failed to process input. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (transcript) {
      const timer = setTimeout(() => {
        setTranscript('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [transcript]);

  return (
    <div className="relative">
      <button 
        onClick={startListening}
        disabled={loading}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg",
          isListening ? "bg-rose-500 animate-pulse" : "bg-[#5A5A40] hover:bg-[#4a4a35]"
        )}
        title="Voice Input"
      >
        {loading ? <Loader2 className="text-white animate-spin" /> : <Mic className="text-white w-6 h-6" />}
      </button>

      <AnimatePresence>
        {showFallback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute bottom-full mb-4 right-0 w-80 bg-white p-6 rounded-[32px] shadow-2xl border border-black/5 z-50"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-serif font-bold text-[#1a1a1a]">AI Command</h3>
              <button onClick={() => setShowFallback(false)} className="p-1 hover:bg-[#f5f5f0] rounded-full">
                <X className="w-4 h-4 text-[#1a1a1a]/40" />
              </button>
            </div>
            <p className="text-[10px] font-serif text-[#1a1a1a]/40 mb-3 uppercase tracking-widest">Type your command (e.g. "Spent 50 on lunch")</p>
            <div className="flex gap-2">
              <input 
                type="text"
                value={fallbackText}
                onChange={(e) => setFallbackText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleParse(fallbackText)}
                className="flex-1 bg-[#f5f5f0] border-none rounded-xl px-4 py-2 text-sm font-serif focus:ring-2 focus:ring-[#5A5A40]/20"
                placeholder="Type here..."
                autoFocus
              />
              <button 
                onClick={() => handleParse(fallbackText)}
                disabled={loading || !fallbackText.trim()}
                className="bg-[#5A5A40] text-white p-2 rounded-xl hover:bg-[#4a4a35] transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {transcript && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full mb-4 right-0 w-64 bg-white p-4 rounded-2xl shadow-xl border border-black/5 text-sm font-serif italic z-50"
          >
            "{transcript}"
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CameraScanner({ onParsed, onClose }: { onParsed: (data: any) => void, onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera", err);
        onClose();
      }
    };
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onClose]);

  const capture = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        setLoading(true);
        try {
          const parsed = await geminiService.parseDocument(base64, 'image/jpeg');
          if (parsed && parsed.length > 0) {
            onParsed(parsed);
            onClose();
          }
        } catch (error) {
          console.error("Scan failed", error);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center">
      <div className="relative w-full h-full max-w-2xl mx-auto overflow-hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        <div className="absolute inset-0 flex flex-col items-center justify-between p-8 pointer-events-none">
          <div className="w-full flex justify-between items-center pointer-events-auto">
            <h2 className="text-white font-serif text-xl">Scan Receipt</h2>
            <button 
              onClick={onClose}
              className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="relative w-full aspect-[3/4] border-2 border-emerald-500/30 rounded-3xl overflow-hidden">
             <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-emerald-500 rounded-tl-2xl" />
             <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-emerald-500 rounded-tr-2xl" />
             <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-emerald-500 rounded-bl-2xl" />
             <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-emerald-500 rounded-br-2xl" />
             
             <motion.div 
               animate={{ top: ['0%', '100%', '0%'] }}
               transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
               className="absolute left-0 right-0 h-1 bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.8)]"
             />
          </div>

          <div className="w-full flex flex-col items-center gap-6 pointer-events-auto">
            <p className="text-white/80 text-sm font-serif italic text-center max-w-xs">
              Position the receipt clearly within the frame
            </p>
            <button 
              onClick={capture}
              disabled={loading}
              className="group relative flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-white/20 rounded-full scale-125 group-active:scale-110 transition-transform" />
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl relative z-10">
                {loading ? (
                  <Loader2 className="w-10 h-10 text-[#5A5A40] animate-spin" />
                ) : (
                  <div className="w-16 h-16 rounded-full border-4 border-[#5A5A40] group-hover:scale-95 transition-transform" />
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FileUpload({ onParsed }: { onParsed: (data: any) => void }) {
  const [loading, setLoading] = useState(false);

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const parsed = await geminiService.parseDocument(base64, file.type);
      if (parsed && parsed.length > 0) {
        onParsed(parsed);
      }
    } catch (error) {
      console.error("Receipt parsing failed", error);
    } finally {
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 
      'image/*': [],
      'application/pdf': []
    },
    multiple: false
  });

  return (
    <div {...getRootProps()} className="cursor-pointer">
      <input {...getInputProps()} />
      <div className={cn(
        "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg",
        isDragActive ? "bg-emerald-500 scale-110" : "bg-white border border-black/5 hover:bg-[#f5f5f0]"
      )}>
        {loading ? <Loader2 className="text-[#5A5A40] animate-spin" /> : <Upload className="text-[#5A5A40] w-6 h-6" />}
      </div>
    </div>
  );
}

function Profile({ profile }: { profile: UserProfile | null }) {
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(profile?.gender || 'other');
  const [loading, setLoading] = useState(false);

  const hasUnsavedChanges = displayName !== (profile?.displayName || '') || gender !== (profile?.gender || 'other');

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const maleAvatars = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=George',
  ];

  const femaleAvatars = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Lily',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia',
  ];

  const handleSave = async (photoURL?: string) => {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      await expenseService.updateUserProfile(profile.uid, {
        displayName,
        gender,
        ...(photoURL && { photoURL })
      });
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Failed to update profile", error);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-white p-8 md:p-12 rounded-[40px] border border-black/5 shadow-sm">
        <h2 className="text-3xl font-serif text-[#1a1a1a] mb-8">Edit Profile</h2>
        
        <div className="space-y-8">
          <div className="flex flex-col items-center gap-6 mb-12">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-[#f5f5f0] border-4 border-[#5A5A40]/10 shadow-inner relative group">
              {profile?.photoURL ? (
                <img 
                  src={profile.photoURL} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#5A5A40]/20">
                  <User className="w-16 h-16" />
                </div>
              )}
            </div>
            <p className="text-xs text-[#1a1a1a]/40 uppercase tracking-widest font-bold">Current Avatar</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-serif text-[#1a1a1a]/40 mb-2 uppercase tracking-widest ml-4">Display Name</label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-[#f5f5f0] border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#5A5A40]/20 font-serif text-base"
                placeholder="Your Name"
              />
            </div>

            <div>
              <label className="block text-[10px] font-serif text-[#1a1a1a]/40 mb-4 uppercase tracking-widest ml-4">Gender</label>
              <div className="grid grid-cols-3 gap-4">
                {(['male', 'female', 'other'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={cn(
                      "py-3 rounded-2xl border-2 transition-all font-serif text-sm capitalize",
                      gender === g 
                        ? "bg-[#5A5A40] border-[#5A5A40] text-white shadow-md" 
                        : "border-black/5 text-[#1a1a1a]/40 hover:border-[#5A5A40]/20"
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4">
              <label className="block text-[10px] font-serif text-[#1a1a1a]/40 mb-4 uppercase tracking-widest ml-4">Choose Avatar</label>
              <div className="grid grid-cols-3 gap-4">
                {(gender === 'male' ? maleAvatars : gender === 'female' ? femaleAvatars : [...maleAvatars, ...femaleAvatars]).map((url, i) => (
                  <button
                    key={i}
                    onClick={() => handleSave(url)}
                    className={cn(
                      "aspect-square rounded-2xl overflow-hidden border-2 transition-all hover:scale-105",
                      profile?.photoURL === url ? "border-[#5A5A40] shadow-md" : "border-transparent"
                    )}
                  >
                    <img 
                      src={url} 
                      alt={`Avatar ${i}`} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-8">
              <button
                onClick={() => handleSave()}
                disabled={loading}
                className="w-full bg-[#5A5A40] text-white rounded-2xl py-4 font-serif text-base hover:bg-[#4a4a35] transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserDetailModal({ user, expenses, isOpen, onClose }: { user: UserProfile | null, expenses: Expense[], isOpen: boolean, onClose: () => void }) {
  if (!user) return null;

  const userExpenses = expenses.filter(e => e.uid === user.uid);
  const totalSpent = userExpenses.filter(e => e.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const totalIncome = userExpenses.filter(e => e.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-8 border-b border-black/5 flex items-center justify-between bg-[#f5f5f0]/50">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#5A5A40]/20 bg-white">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#5A5A40]">
                      <User className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-serif text-[#1a1a1a]">{user.displayName || 'Anonymous'}</h2>
                  <p className="text-sm text-[#1a1a1a]/40 font-serif">{user.email}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-3 hover:bg-white rounded-full transition-all">
                <X className="w-6 h-6 text-[#1a1a1a]/40" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#f5f5f0] p-6 rounded-3xl">
                  <p className="text-[10px] font-serif text-[#1a1a1a]/40 uppercase tracking-widest mb-1">Total Income</p>
                  <p className="text-2xl font-serif text-emerald-600">{formatCurrency(totalIncome)}</p>
                </div>
                <div className="bg-[#f5f5f0] p-6 rounded-3xl">
                  <p className="text-[10px] font-serif text-[#1a1a1a]/40 uppercase tracking-widest mb-1">Total Expenses</p>
                  <p className="text-2xl font-serif text-red-600">{formatCurrency(totalSpent)}</p>
                </div>
                <div className="bg-[#f5f5f0] p-6 rounded-3xl">
                  <p className="text-[10px] font-serif text-[#1a1a1a]/40 uppercase tracking-widest mb-1">Net Balance</p>
                  <p className="text-2xl font-serif text-[#1a1a1a]">{formatCurrency(totalIncome - totalSpent)}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-serif text-[#1a1a1a]">User Transactions</h3>
                {userExpenses.length > 0 ? (
                  <div className="space-y-3">
                    {userExpenses.map((e) => (
                      <div key={e.id} className="flex items-center justify-between p-4 bg-white border border-black/5 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            e.type === 'income' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                          )}>
                            {e.type === 'income' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-serif text-[#1a1a1a]">{e.title}</p>
                            <p className="text-[10px] text-[#1a1a1a]/40 uppercase tracking-widest">{e.category} • {format(parseISO(e.date), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                        <p className={cn(
                          "font-serif text-lg",
                          e.type === 'income' ? "text-emerald-600" : "text-red-600"
                        )}>
                          {e.type === 'income' ? '+' : '-'}{formatCurrency(e.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-[#f5f5f0] rounded-3xl">
                    <p className="text-[#1a1a1a]/40 font-serif italic">No transactions found for this user.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function AdminView() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'driver' | 'customer'>('all');
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubUsers = expenseService.subscribeToAllUsers(setUsers);
    const unsubExpenses = expenseService.subscribeToAllExpenses((expenses) => {
      setAllExpenses(expenses);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubExpenses();
    };
  }, []);

  const handleUpdateRole = async (uid: string, newRole: 'admin' | 'driver' | 'customer') => {
    setUpdatingRole(uid);
    try {
      await expenseService.updateUserProfile(uid, { role: newRole });
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      console.error("Failed to update role", error);
      toast.error("Failed to update role");
    } finally {
      setUpdatingRole(null);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Title', 'Amount', 'Category', 'Type', 'User UID'];
    const rows = allExpenses.map(e => [
      e.date,
      e.title,
      e.amount,
      e.category,
      e.type,
      e.uid
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `global_transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#5A5A40] animate-spin" />
      </div>
    );
  }

  const totalSystemVolume = allExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const avgTransaction = allExpenses.length > 0 ? totalSystemVolume / allExpenses.length : 0;
  
  // Calculate over budget users
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());
  
  const overBudgetCount = users.filter(u => {
    if (!u.monthlyBudget) return false;
    const userExpenses = allExpenses.filter(e => 
      e.uid === u.uid && 
      e.type === 'expense' && 
      isWithinInterval(parseISO(e.date), { start: currentMonthStart, end: currentMonthEnd })
    );
    const totalSpent = userExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    return totalSpent > u.monthlyBudget;
  }).length;

  // Calculate daily trends (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = format(subMonths(new Date(), 0).setDate(new Date().getDate() - (6 - i)), 'yyyy-MM-dd');
    const count = allExpenses.filter(e => e.date === date).length;
    const volume = allExpenses.filter(e => e.date === date).reduce((acc, curr) => acc + curr.amount, 0);
    return { name: format(parseISO(date), 'MMM d'), count, volume };
  });

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const globalCategoryData = allExpenses
    .filter(e => e.type === 'expense')
    .reduce((acc: any[], curr) => {
      const existing = acc.find(a => a.name === curr.category);
      if (existing) existing.value += curr.amount;
      else acc.push({ name: curr.category, value: curr.amount });
      return acc;
    }, [])
    .sort((a, b) => b.value - a.value);

  const COLORS = ['#5A5A40', '#8E9299', '#1a1a1a', '#f5f5f0', '#10b981', '#ef4444', '#f59e0b', '#6366f1'];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-[#1a1a1a]">System Administration</h2>
          <p className="text-sm text-[#1a1a1a]/40 font-serif italic">Global overview and management</p>
        </div>
        <button 
          onClick={exportToCSV}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-black/5 rounded-2xl text-sm font-serif text-[#5A5A40] hover:bg-[#f5f5f0] transition-all shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export Global Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <User className="w-4 h-4 text-[#5A5A40]/40" />
            <p className="text-[10px] font-serif text-[#1a1a1a]/40 uppercase tracking-widest">Total Users</p>
          </div>
          <p className="text-4xl font-serif text-[#1a1a1a]">{users.length}</p>
        </div>
        <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="text-[#5A5A40]/40 w-4 h-4" />
            <p className="text-[10px] font-serif text-[#1a1a1a]/40 uppercase tracking-widest">System Volume</p>
          </div>
          <p className="text-4xl font-serif text-[#1a1a1a]">{formatCurrency(totalSystemVolume)}</p>
        </div>
        <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Target className="text-red-400 w-4 h-4" />
            <p className="text-[10px] font-serif text-[#1a1a1a]/40 uppercase tracking-widest">Over Budget</p>
          </div>
          <p className="text-4xl font-serif text-red-600">{overBudgetCount}</p>
          <p className="text-[10px] text-red-600/60 font-serif mt-1 italic">Users exceeding limits</p>
        </div>
        <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="text-emerald-400 w-4 h-4" />
            <p className="text-[10px] font-serif text-[#1a1a1a]/40 uppercase tracking-widest">Avg Transaction</p>
          </div>
          <p className="text-4xl font-serif text-[#1a1a1a]">{formatCurrency(avgTransaction)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 md:p-12 rounded-[40px] border border-black/5 shadow-sm">
          <h3 className="text-2xl font-serif text-[#1a1a1a] mb-8">System Activity Trends</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#1a1a1a', opacity: 0.4, fontSize: 12 }} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
                />
                <Line type="monotone" dataKey="count" stroke="#5A5A40" strokeWidth={3} dot={{ fill: '#5A5A40', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-8 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#5A5A40]" />
              <span className="text-xs text-[#1a1a1a]/40 font-serif">Transaction Count</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 md:p-12 rounded-[40px] border border-black/5 shadow-sm">
          <h3 className="text-2xl font-serif text-[#1a1a1a] mb-8">Category Mix</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={globalCategoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {globalCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 md:p-12 rounded-[40px] border border-black/5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-6">
          <h3 className="text-2xl font-serif text-[#1a1a1a]">User Directory</h3>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex bg-[#f5f5f0] p-1 rounded-2xl">
              {(['all', 'admin', 'driver', 'customer'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                    roleFilter === r ? "bg-white text-[#5A5A40] shadow-sm" : "text-[#1a1a1a]/40 hover:text-[#1a1a1a]"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1a1a1a]/20" />
              <input 
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[#f5f5f0] border-none rounded-2xl text-sm font-serif focus:ring-2 focus:ring-[#5A5A40]/20"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/5">
                <th className="text-left py-4 text-[10px] font-serif text-[#1a1a1a]/40 uppercase tracking-widest">User</th>
                <th className="text-left py-4 text-[10px] font-serif text-[#1a1a1a]/40 uppercase tracking-widest">Role</th>
                <th className="text-right py-4 text-[10px] font-serif text-[#1a1a1a]/40 uppercase tracking-widest">Balance</th>
                <th className="text-right py-4 text-[10px] font-serif text-[#1a1a1a]/40 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.uid} className="border-b border-black/5 last:border-0 hover:bg-[#f5f5f0]/30 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-[#f5f5f0] border border-black/5">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#5A5A40]">
                            <User className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-serif text-[#1a1a1a] truncate">{u.displayName || 'Anonymous'}</p>
                        <p className="text-[10px] text-[#1a1a1a]/40 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4">
                    <select 
                      value={u.role}
                      disabled={updatingRole === u.uid || u.email === 'ranjithkumarmanickam05@gmail.com'}
                      onChange={(e) => handleUpdateRole(u.uid, e.target.value as any)}
                      className="bg-[#f5f5f0] border-none rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] focus:ring-2 focus:ring-[#5A5A40]/20 disabled:opacity-50"
                    >
                      <option value="customer">Customer</option>
                      <option value="driver">Driver</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="py-4 text-right font-serif text-[#1a1a1a]">{formatCurrency(u.initialBalance || 0)}</td>
                  <td className="py-4 text-right">
                    <button 
                      onClick={() => setSelectedUser(u)}
                      className="p-2 hover:bg-[#5A5A40]/10 rounded-xl text-[#5A5A40] transition-all"
                      title="View Details"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-8 md:p-12 rounded-[40px] border border-black/5 shadow-sm">
        <h3 className="text-2xl font-serif text-[#1a1a1a] mb-8">Recent Global Activity</h3>
        <div className="space-y-4">
          {allExpenses.slice(0, 10).map((e) => {
            const user = users.find(u => u.uid === e.uid);
            return (
              <div key={e.id} className="flex items-center justify-between p-6 bg-[#f5f5f0] rounded-3xl hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-black/5">
                <div className="flex items-center gap-6">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    e.type === 'income' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                  )}>
                    {e.type === 'income' ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-serif text-lg text-[#1a1a1a]">{e.title}</p>
                      <span className="text-[10px] px-2 py-0.5 bg-white/50 text-[#1a1a1a]/40 rounded-full uppercase font-bold tracking-tighter">
                        {e.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full overflow-hidden bg-white">
                          {user?.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-2.5 h-2.5 text-[#5A5A40]/40" />
                          )}
                        </div>
                        <p className="text-xs text-[#1a1a1a]/40 font-serif">{user?.displayName || 'Anonymous'}</p>
                      </div>
                      <span className="text-[#1a1a1a]/10">•</span>
                      <p className="text-xs text-[#1a1a1a]/40 font-serif italic">{format(parseISO(e.date), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "font-serif text-xl",
                    e.type === 'income' ? "text-emerald-600" : "text-red-600"
                  )}>
                    {e.type === 'income' ? '+' : '-'}{formatCurrency(e.amount)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <UserDetailModal 
        user={selectedUser}
        expenses={allExpenses}
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <Database className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-serif text-[#1a1a1a]/40 uppercase tracking-widest">Database</p>
            <p className="text-sm font-serif text-[#1a1a1a]">Connected & Healthy</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-serif text-[#1a1a1a]/40 uppercase tracking-widest">Authentication</p>
            <p className="text-sm font-serif text-[#1a1a1a]">Service Operational</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <Zap className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-serif text-[#1a1a1a]/40 uppercase tracking-widest">AI Insights</p>
            <p className="text-sm font-serif text-[#1a1a1a]">Gemini 3.1 Ready</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ expenses, profile, onSaveBudget }: { expenses: Expense[], profile: UserProfile | null, onSaveBudget: (budget: number) => Promise<void> }) {
  const [fromDate, setFromDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const filteredExpenses = expenses.filter(e => {
    const date = parseISO(e.date);
    return isWithinInterval(date, {
      start: parseISO(fromDate),
      end: parseISO(toDate)
    });
  });

  const totalIncome = filteredExpenses.filter(e => e.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = filteredExpenses.filter(e => e.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const allTimeTotalExpense = expenses.filter(e => e.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

  const budgetProgress = profile?.monthlyBudget ? (totalExpense / profile.monthlyBudget) * 100 : 0;

  const categoryData = filteredExpenses
    .filter(e => e.type === 'expense')
    .reduce((acc: any[], curr) => {
      const existing = acc.find(a => a.name === curr.category);
      if (existing) existing.value += curr.amount;
      else acc.push({ name: curr.category, value: curr.amount });
      return acc;
    }, []);

  const monthlyData = filteredExpenses.reduce((acc: any[], curr) => {
    const month = format(parseISO(curr.date), 'MMM');
    const existing = acc.find(a => a.name === month);
    if (existing) {
      if (curr.type === 'income') existing.income += curr.amount;
      else existing.expense += curr.amount;
    } else {
      acc.push({ 
        name: month, 
        income: curr.type === 'income' ? curr.amount : 0, 
        expense: curr.type === 'expense' ? curr.amount : 0 
      });
    }
    return acc;
  }, []).reverse();

  return (
    <div className="space-y-8">
      {/* Date Filters */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-black/5 shadow-sm flex flex-col md:flex-row items-end gap-6">
        <div className="flex-1 w-full">
          <label className="block text-xs font-serif text-[#1a1a1a]/40 mb-2 uppercase tracking-wider">From Date</label>
          <input 
            type="date" 
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full bg-[#f5f5f0] border-none rounded-2xl px-6 py-3 focus:ring-2 focus:ring-[#5A5A40]/20 font-serif text-sm"
          />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-serif text-[#1a1a1a]/40 mb-2 uppercase tracking-wider">To Date</label>
          <input 
            type="date" 
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full bg-[#f5f5f0] border-none rounded-2xl px-6 py-3 focus:ring-2 focus:ring-[#5A5A40]/20 font-serif text-sm"
          />
        </div>
        <div className="flex items-center gap-2 text-[#1a1a1a]/40 text-sm font-serif italic pb-3">
          <Filter className="w-4 h-4" />
          Filtering {filteredExpenses.length} records
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <StatCard title="Total Balance" amount={balance} icon={Wallet} color="bg-[#5A5A40]" />
        <StatCard title="Total Income" amount={totalIncome} icon={TrendingUp} color="bg-emerald-500" />
        <StatCard title="Monthly Expenses" amount={totalExpense} icon={TrendingDown} color="bg-rose-500" />
        <StatCard title="All-Time Expenses" amount={allTimeTotalExpense} icon={TrendingDown} color="bg-rose-900" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-10 rounded-[40px] border border-black/5 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-serif text-[#1a1a1a]">Budget Overview</h3>
              {profile?.monthlyBudget && (
                <span className="text-sm font-serif text-[#1a1a1a]/40 italic">
                  {formatCurrency(totalExpense)} of {formatCurrency(profile.monthlyBudget)}
                </span>
              )}
            </div>
            {profile?.monthlyBudget ? (
              <div className="space-y-4">
                <div className="w-full h-4 bg-[#f5f5f0] rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(budgetProgress, 100)}%` }}
                    className={cn(
                      "h-full transition-all",
                      budgetProgress > 90 ? "bg-rose-500" : budgetProgress > 70 ? "bg-amber-500" : "bg-[#5A5A40]"
                    )}
                  />
                </div>
                <p className="text-sm font-serif text-[#1a1a1a]/60">
                  {budgetProgress > 100 
                    ? `You've exceeded your budget by ${formatCurrency(totalExpense - profile.monthlyBudget)}!` 
                    : `You have ${formatCurrency(profile.monthlyBudget - totalExpense)} remaining for this period.`}
                </p>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-[#1a1a1a]/40 font-serif italic mb-4">No monthly budget set yet.</p>
              </div>
            )}
          </div>
          
          <div className="bg-white p-10 rounded-[40px] border border-black/5 shadow-sm">
            <h3 className="text-2xl font-serif mb-8 text-[#1a1a1a]">Monthly Overview</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#1a1a1a', opacity: 0.4, fontSize: 12 }} />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ fill: '#f5f5f0' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <BudgetSetter profile={profile} onSave={onSaveBudget} />
          
          <div className="bg-white p-10 rounded-[40px] border border-black/5 shadow-sm">
            <h3 className="text-2xl font-serif mb-8 text-[#1a1a1a]">Spending by Category</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Transactions({ expenses, onEdit, onDelete }: { expenses: Expense[], onEdit: (e: Expense) => void, onDelete: (id: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || e.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const exportToCSV = () => {
    const headers = ['Date', 'Title', 'Category', 'Type', 'Amount'];
    const rows = filteredExpenses.map(e => [
      format(parseISO(e.date), 'yyyy-MM-dd'),
      e.title,
      e.category,
      e.type,
      e.amount
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-[32px] md:rounded-[40px] border border-black/5 shadow-sm overflow-hidden">
      <div className="p-6 md:p-10 border-b border-black/5 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <h3 className="text-xl md:text-2xl font-serif text-[#1a1a1a]">Recent Transactions</h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <button 
            onClick={exportToCSV}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#f5f5f0] text-[#5A5A40] rounded-2xl hover:bg-[#5A5A40] hover:text-white transition-all font-serif text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1a1a1a]/40" />
            <input 
              type="text" 
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-3 bg-[#f5f5f0] border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40]/20 font-serif text-sm w-full lg:w-64"
            />
          </div>
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-6 py-3 bg-[#f5f5f0] border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40]/20 font-serif text-sm appearance-none"
          >
            <option value="All">All Categories</option>
            {['Food', 'Travel', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Salary', 'Other'].map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="bg-[#f5f5f0]/50">
              <th className="px-6 md:px-10 py-5 text-left text-xs font-serif text-[#1a1a1a]/40 uppercase tracking-wider">Date</th>
              <th className="px-6 md:px-10 py-5 text-left text-xs font-serif text-[#1a1a1a]/40 uppercase tracking-wider">Transaction</th>
              <th className="px-6 md:px-10 py-5 text-left text-xs font-serif text-[#1a1a1a]/40 uppercase tracking-wider">Category</th>
              <th className="px-6 md:px-10 py-5 text-right text-xs font-serif text-[#1a1a1a]/40 uppercase tracking-wider">Amount</th>
              <th className="px-6 md:px-10 py-5 text-right text-xs font-serif text-[#1a1a1a]/40 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            <AnimatePresence>
              {filteredExpenses.map((expense) => (
                <motion.tr 
                  key={expense.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="hover:bg-[#f5f5f0]/30 transition-colors group"
                >
                  <td className="px-6 md:px-10 py-6 text-sm font-serif text-[#1a1a1a]/60">
                    {format(parseISO(expense.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 md:px-10 py-6">
                    <p className="text-sm font-bold text-[#1a1a1a]">{expense.title}</p>
                  </td>
                  <td className="px-6 md:px-10 py-6">
                    <span className="px-4 py-1.5 rounded-full bg-[#f5f5f0] text-[#1a1a1a]/60 text-xs font-serif">
                      {expense.category}
                    </span>
                  </td>
                  <td className={cn(
                    "px-6 md:px-10 py-6 text-right text-sm font-bold",
                    expense.type === 'income' ? "text-emerald-600" : "text-[#1a1a1a]"
                  )}>
                    {expense.type === 'income' ? '+' : '-'}{formatCurrency(expense.amount)}
                  </td>
                  <td className="px-6 md:px-10 py-6 text-right">
                    <div className="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onEdit(expense)}
                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-xl transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onDelete(expense.id)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {filteredExpenses.length === 0 && (
          <div className="p-10 md:p-20 text-center">
            <div className="w-16 h-16 md:w-20 h-20 bg-[#f5f5f0] rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="text-[#1a1a1a]/20 w-8 h-8 md:w-10 h-10" />
            </div>
            <p className="text-[#1a1a1a]/40 font-serif italic">No transactions found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmDialog({ isOpen, onClose, onConfirm, title, message }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, title: string, message: string }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[32px] w-full max-w-md p-10 shadow-2xl"
      >
        <h2 className="text-2xl font-serif text-[#1a1a1a] mb-4">{title}</h2>
        <p className="text-[#1a1a1a]/60 font-serif mb-8">{message}</p>
        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 rounded-full font-serif border border-black/5 hover:bg-[#f5f5f0] transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 py-4 rounded-full font-serif bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Reports({ expenses }: { expenses: Expense[] }) {
  const [fromDate, setFromDate] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const filteredExpenses = expenses.filter(e => {
    const date = parseISO(e.date);
    return isWithinInterval(date, {
      start: parseISO(fromDate),
      end: parseISO(toDate)
    });
  });

  const categoryData = filteredExpenses
    .filter(e => e.type === 'expense')
    .reduce((acc: any[], curr) => {
      const existing = acc.find(a => a.name === curr.category);
      if (existing) existing.value += curr.amount;
      else acc.push({ name: curr.category, value: curr.amount });
      return acc;
    }, []);

  const monthlyData = filteredExpenses.reduce((acc: any[], curr) => {
    const month = format(parseISO(curr.date), 'MMM yyyy');
    const existing = acc.find(a => a.name === month);
    if (existing) {
      if (curr.type === 'income') existing.income += curr.amount;
      else existing.expense += curr.amount;
    } else {
      acc.push({ 
        name: month, 
        income: curr.type === 'income' ? curr.amount : 0, 
        expense: curr.type === 'expense' ? curr.amount : 0 
      });
    }
    return acc;
  }, []).reverse();

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <h2 className="text-3xl font-serif text-[#1a1a1a]">Financial Reports</h2>
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div>
              <label className="block text-xs font-serif text-[#1a1a1a]/40 mb-2 uppercase tracking-wider">From</label>
              <input 
                type="date" 
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-[#f5f5f0] border-none rounded-2xl px-6 py-3 focus:ring-2 focus:ring-[#5A5A40]/20 font-serif text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-serif text-[#1a1a1a]/40 mb-2 uppercase tracking-wider">To</label>
              <input 
                type="date" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-[#f5f5f0] border-none rounded-2xl px-6 py-3 focus:ring-2 focus:ring-[#5A5A40]/20 font-serif text-sm"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            <h3 className="text-xl font-serif text-[#1a1a1a]/60">Expense Distribution</h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    innerRadius={100}
                    outerRadius={140}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-serif text-[#1a1a1a]/60">Income vs Expenses</h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#1a1a1a', opacity: 0.4, fontSize: 12 }} />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ fill: '#f5f5f0' }}
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="income" fill="#10b981" radius={[8, 8, 0, 0]} barSize={30} />
                  <Bar dataKey="expense" fill="#ef4444" radius={[8, 8, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const unsubscribe = expenseService.subscribeToExpenses(user.uid, setExpenses);
      return unsubscribe;
    }
  }, [user]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isModalOpen || editingExpense) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isModalOpen, editingExpense]);

  const handleSaveExpense = async (data: any) => {
    try {
      if (editingExpense && editingExpense.id) {
        await expenseService.updateExpense(editingExpense.id, data);
        toast.success("Transaction updated successfully!");
      } else {
        await expenseService.addExpense({ ...data, uid: user!.uid });
        toast.success("Transaction added successfully!");
      }
      setIsModalOpen(false);
      setEditingExpense(null);
    } catch (error) {
      console.error("Error saving expense:", error);
      toast.error("Failed to save transaction. Please try again.");
    }
  };

  const handleSaveBudget = async (budget: number) => {
    if (user) {
      try {
        const updatedProfile: UserProfile = { 
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          role: profile?.role || 'customer',
          initialBalance: profile?.initialBalance || 0,
          ...profile,
          monthlyBudget: budget 
        };
        await expenseService.saveUserProfile(updatedProfile);
        toast.success("Budget updated successfully!");
      } catch (error) {
        console.error("Error saving budget:", error);
        toast.error("Failed to update budget.");
        throw error;
      }
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      try {
        await expenseService.deleteExpense(deleteId);
        toast.success("Transaction deleted successfully!");
        setDeleteId(null);
      } catch (error) {
        console.error("Error deleting expense:", error);
        toast.error("Failed to delete transaction.");
      }
    }
  };

  const handleParsedInput = async (data: any[]) => {
    if (data.length === 1) {
      setEditingExpense(null);
      setIsModalOpen(true);
      // Pre-fill form with parsed data
      setEditingExpense({ id: '', ...data[0], uid: user!.uid });
      toast.success("Transaction recognized!");
    } else if (data.length > 1) {
      // For multiple transactions (e.g. from a statement), add them all
      const loadingToast = toast.loading(`Adding ${data.length} transactions...`);
      try {
        const promises = data.map(item => 
          expenseService.addExpense({ ...item, uid: user!.uid })
        );
        await Promise.all(promises);
        toast.success(`Successfully added ${data.length} transactions from statement`, { id: loadingToast });
      } catch (error) {
        console.error("Error adding batch transactions:", error);
        toast.error("Failed to add some transactions", { id: loadingToast });
      }
    }
  };

  if (!user) return <Login />;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#f5f5f0]">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      
      <main className="flex-1 p-4 md:p-8 lg:p-12 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 md:mb-12 gap-6">
          <div className="flex items-center justify-between w-full md:w-auto">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-3 bg-white rounded-2xl border border-black/5 shadow-sm"
            >
              <LayoutDashboard className="w-6 h-6 text-[#5A5A40]" />
            </button>
            <div className="text-right md:text-left flex-1 md:flex-none ml-4 md:ml-0">
              <h1 className="text-2xl md:text-4xl font-serif text-[#1a1a1a] mb-1">Welcome back, {user.displayName?.split(' ')[0] || 'User'}</h1>
              <p className="text-xs md:text-sm text-[#1a1a1a]/40 font-serif italic">Here's your financial overview.</p>
            </div>
          </div>
          <div className="flex items-center justify-center md:justify-end gap-3 md:gap-4">
            {activeTab !== 'profile' && activeTab !== 'admin' && (
              <>
                <button 
                  onClick={() => setIsScannerOpen(true)}
                  className="w-14 h-14 rounded-full bg-white border border-black/5 flex items-center justify-center transition-all shadow-lg hover:bg-[#f5f5f0] text-[#5A5A40]"
                  title="Scan Receipt"
                >
                  <Camera className="w-6 h-6" />
                </button>
                <FileUpload onParsed={handleParsedInput} />
                <VoiceInput onParsed={handleParsedInput} />
                <button 
                  onClick={() => { setEditingExpense(null); setIsModalOpen(true); }}
                  className="bg-[#5A5A40] text-white px-6 md:px-8 py-3 md:py-4 rounded-full font-serif flex items-center gap-2 md:gap-3 hover:bg-[#4a4a35] transition-all shadow-lg text-sm md:text-base"
                >
                  <Plus className="w-4 h-4 md:w-5 h-5" />
                  Add Transaction
                </button>
              </>
            )}
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Dashboard expenses={expenses} profile={profile} onSaveBudget={handleSaveBudget} />
              <div className="mt-8 md:mt-12">
                <Transactions 
                  expenses={expenses.slice(0, 5)} 
                  onEdit={(e) => { setEditingExpense(e); setIsModalOpen(true); }}
                  onDelete={handleDeleteExpense}
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'expenses' && (
            <motion.div 
              key="expenses"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Transactions 
                expenses={expenses} 
                onEdit={(e) => { setEditingExpense(e); setIsModalOpen(true); }}
                onDelete={handleDeleteExpense}
              />
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Reports expenses={expenses} />
            </motion.div>
          )}

          {activeTab === 'insights' && (
            <motion.div 
              key="insights"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Insights expenses={expenses} profile={profile} />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Profile profile={profile} />
            </motion.div>
          )}

          {activeTab === 'admin' && profile?.role === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AdminView />
            </motion.div>
          )}
        </AnimatePresence>

        <ExpenseModal 
          isOpen={isModalOpen} 
          onClose={() => { setIsModalOpen(false); setEditingExpense(null); }}
          onSave={handleSaveExpense}
          initialData={editingExpense}
        />

        <AnimatePresence>
          {isScannerOpen && (
            <CameraScanner 
              onParsed={handleParsedInput}
              onClose={() => setIsScannerOpen(false)}
            />
          )}
        </AnimatePresence>

        <ConfirmDialog 
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={confirmDelete}
          title="Delete Transaction"
          message="Are you sure you want to delete this transaction? This action cannot be undone."
        />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" richColors />
      <AppContent />
    </AuthProvider>
  );
}
