/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, TrendingUp, AlertCircle, History, Play, StopCircle, Coins, Menu, Gamepad2, Landmark, Banknote, Shield, Minus, Plus, Clock, RotateCcw, Plane, X, ChevronLeft, User, UserPlus, Eye, EyeOff, Zap } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

type ViewState = 'HOME' | 'LOGIN' | 'REGISTER' | 'LANDING' | 'LOADING' | 'GAME' | 'DEPOSIT' | 'WITHDRAW' | 'PAYMENT' | 'ADMIN';
type GameStatus = 'WAITING' | 'FLYING' | 'CRASHED';

interface HistoryItem {
  id: number;
  multiplier: number;
  time: string;
}

interface BetState {
  amount: number;
  isPlaced: boolean;
  isCashedOut: boolean;
  cashedOutAt?: number;
}

interface LiveBet {
  id: string;
  user: string;
  avatar: string;
  amount: number;
  multiplier?: number;
  win?: number;
  isCashedOut: boolean;
}

const generateMockHistory = (count: number): HistoryItem[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    multiplier: parseFloat((Math.random() * 5 + 1).toFixed(2)),
    time: new Date(Date.now() - i * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }));
};

const MOCK_AVATARS = [
  'https://picsum.photos/seed/10/32/32',
  'https://picsum.photos/seed/11/32/32',
  'https://picsum.photos/seed/12/32/32',
  'https://picsum.photos/seed/13/32/32',
  'https://picsum.photos/seed/14/32/32',
];

const MOCK_NAMES = ['Rahul', 'Amit', 'Sanjay', 'Priya', 'Anjali', 'Vikram', 'Deepak', 'Neha'];

export default function App() {
  const [view, setView] = useState<ViewState>('HOME');
  const [user, setUser] = useState<{ name: string, mobile: string, balance: number } | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus>('WAITING');
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [balance, setBalance] = useState<number>(0);
  const [history, setHistory] = useState<HistoryItem[]>(generateMockHistory(1000));
  const [liveBets, setLiveBets] = useState<LiveBet[]>([]);
  const [myBetHistory, setMyBetHistory] = useState<LiveBet[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'MY'>('ALL');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [waitingTime, setWaitingTime] = useState(5);
  const [showFullHistory, setShowFullHistory] = useState(false);
  
  // Auth States
  const [authData, setAuthData] = useState({ name: '', mobile: '', password: '', otp: '' });
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [authError, setAuthError] = useState('');
  const [debugOtp, setDebugOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Admin States
  const [adminSettings, setAdminSettings] = useState({
    manualCrashPoint: null as number | null,
    isAutoMode: true,
  });
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);

  // Deposit State
  const [depositAmount, setDepositAmount] = useState<number>(500);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Withdraw State
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawData, setWithdrawData] = useState({
    name: '',
    bank: '',
    ifsc: '',
    upi: '',
    amount: ''
  });

  // Auth States
  const [showPassword, setShowPassword] = useState(false);
  const [withdrawalUsers, setWithdrawalUsers] = useState([
    { name: 'ANUSHA', amount: '56,874' },
    { name: 'MEGHNA', amount: '55,277' },
    { name: 'VIDYA', amount: '55,720' },
    { name: 'ANJALI', amount: '58,290' },
    { name: 'KIRAN', amount: '57,121' }
  ]);

  // Two independent bets
  const [bet1, setBet1] = useState<BetState>({ amount: 10, isPlaced: false, isCashedOut: false });
  const [bet2, setBet2] = useState<BetState>({ amount: 10, isPlaced: false, isCashedOut: false });
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // Clock effect & Auth Check
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setBalance(data.user.balance);
          setView('LANDING');
        }
      } catch (e) {
        console.error("Auth check failed", e);
      }
    };
    checkAuth();

    // Connect to Socket.io
    socketRef.current = io();

    socketRef.current.on("connect", () => setIsConnected(true));
    socketRef.current.on("disconnect", () => setIsConnected(false));

    socketRef.current.on("gameUpdate", (data) => {
      setGameStatus(data.gameStatus);
      setMultiplier(data.multiplier);
      setWaitingTime(data.waitingTime);
      setHistory(data.history);
      setLiveBets(data.liveBets);

      // Handle round reset
      if (data.gameStatus === 'WAITING') {
        setBet1(prev => ({ ...prev, isPlaced: false, isCashedOut: false, cashedOutAt: undefined }));
        setBet2(prev => ({ ...prev, isPlaced: false, isCashedOut: false, cashedOutAt: undefined }));
      }
    });

    // Dynamic Withdrawal Users
    const userTimer = setInterval(() => {
        const names = ['ANUSHA', 'MEGHNA', 'VIDYA', 'ANJALI', 'KIRAN', 'PRIYA', 'SNEHA', 'POOJA', 'RITU', 'NEHA', 'SONIA', 'REKHA', 'MAMTA', 'GEETA', 'SITA'];
        const newUsers = Array.from({ length: 5 }, () => ({
            name: names[Math.floor(Math.random() * names.length)],
            amount: (Math.floor(Math.random() * 50000) + 10000).toLocaleString()
        }));
        setWithdrawalUsers(newUsers);
    }, 3000);

    return () => {
        clearInterval(timer);
        clearInterval(userTimer);
        socketRef.current?.disconnect();
    };
  }, []);

  const handleSendOtp = async () => {
    if (!authData.mobile) return setAuthError("Mobile number required");
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: authData.mobile })
      });
      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
        setOtpTimer(60);
        setAuthError('');
        if (data.debugOtp) {
          setDebugOtp(data.debugOtp);
        }
      } else {
        setAuthError(data.message);
      }
    } catch (e) {
      setAuthError("Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (otpTimer > 0) {
      const t = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [otpTimer]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authData)
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setBalance(data.user.balance);
        setView('LANDING');
      } else {
        setAuthError(data.message);
      }
    } catch (e) {
      setAuthError("Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: authData.mobile, password: authData.password })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setBalance(data.user.balance);
        setView('LANDING');
      } else {
        setAuthError(data.message);
      }
    } catch (e) {
      setAuthError("Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setBalance(0);
    setView('HOME');
  };

  const placeBet = (betNum: 1 | 2) => {
    const bet = betNum === 1 ? bet1 : bet2;
    if (balance < bet.amount || gameStatus !== 'WAITING') return;
    
    setBalance(prev => prev - bet.amount);
    const newBetState = { ...bet, isPlaced: true };
    if (betNum === 1) setBet1(newBetState);
    else setBet2(newBetState);

    // Emit to server
    socketRef.current?.emit("placeBet", {
      user: 'You',
      avatar: 'https://picsum.photos/seed/me/32/32',
      amount: bet.amount,
    });
  };

  const cashOut = (betNum: 1 | 2) => {
    const bet = betNum === 1 ? bet1 : bet2;
    if (gameStatus !== 'FLYING' || !bet.isPlaced || bet.isCashedOut) return;

    const won = bet.amount * multiplier;
    setBalance(prev => prev + won);
    if (betNum === 1) setBet1(prev => ({ ...prev, isCashedOut: true, cashedOutAt: multiplier }));
    else setBet2(prev => ({ ...prev, isCashedOut: true, cashedOutAt: multiplier }));

    // Find the bet ID in liveBets to cash out on server
    const myLiveBet = liveBets.find(b => b.user === 'You' && !b.isCashedOut);
    if (myLiveBet) {
      socketRef.current?.emit("cashOut", {
        betId: myLiveBet.id,
        multiplier: multiplier
      });
    }
  };

  const handlePlayNow = () => {
    setView('LOADING');
    setTimeout(() => {
      setView('GAME');
    }, 2500);
  };

  const handleDepositClick = () => {
    setIsRedirecting(true);
    setTimeout(() => {
      setIsRedirecting(false);
      setView('PAYMENT');
    }, 2500);
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(withdrawData.amount);
    if (amount > balance) {
        alert("Insufficient balance!");
        return;
    }
    setBalance(prev => prev - amount);
    const newRequest = {
        id: Math.random().toString(36).substr(2, 9).toUpperCase(),
        ...withdrawData,
        status: 'PENDING',
        date: new Date().toLocaleString()
    };
    setPendingWithdrawals(prev => [newRequest, ...prev]);
    alert('Withdraw Request Submitted Successfully!');
    setShowWithdrawForm(false);
    setView('LANDING');
  };

  const handleBack = () => {
    if (view === 'GAME' || view === 'DEPOSIT' || view === 'WITHDRAW') {
      setView('LANDING');
    } else if (view === 'PAYMENT') {
      setView('DEPOSIT');
    }
  };

  if (view === 'HOME') {
    return (
      <div className="min-h-screen bg-[#0d0d1f] text-white flex flex-col items-center">
        {/* Header */}
        <header className="w-full bg-[#16162d] px-4 py-3 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center">
            <span className="text-[#98ff00] font-bold text-xl italic">elite</span>
            <span className="text-[#f7e018] font-bold text-xl ml-1">AVIATOR</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView('REGISTER')} className="bg-[#00a3ff] text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase">Register</button>
            <button onClick={() => setView('LOGIN')} className="bg-[#00a3ff] text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase">Login</button>
          </div>
        </header>

        <div className="w-full max-w-md p-4 space-y-6">
          {/* Main Auth Buttons */}
          <div className="bg-[#16162d] p-8 rounded-[32px] flex justify-around items-center shadow-2xl border border-zinc-800/50">
            <button onClick={() => setView('LOGIN')} className="w-32 h-32 rounded-full bg-gradient-to-br from-[#00ff85] to-[#00a3ff] text-black font-black text-xl shadow-[0_0_30px_rgba(0,255,133,0.4)] active:scale-95 transition-transform">
              Login
            </button>
            <button onClick={() => setView('REGISTER')} className="w-32 h-32 rounded-full bg-gradient-to-br from-[#ff7a00] to-[#f7e018] text-black font-black text-xl shadow-[0_0_30px_rgba(255,122,0,0.4)] active:scale-95 transition-transform">
              Register
            </button>
          </div>

          {/* Banner */}
          <div className="bg-[#16162d] p-6 rounded-3xl border-2 border-[#00ff85]/30 flex flex-col items-center justify-center text-center space-y-2 shadow-lg">
            <div className="flex items-center gap-2 text-[#f7e018] font-black text-lg italic">
              <Zap className="w-6 h-6 fill-[#f7e018]" />
              INSTANT AUTOMATIC
            </div>
            <div className="text-[#f7e018] font-black text-lg italic uppercase">
              Deposit and Withdrawal
            </div>
          </div>

          {/* Withdrawal List */}
          <div className="bg-[#16162d] rounded-[32px] border-2 border-[#00ff85]/30 overflow-hidden shadow-xl">
            <div className="p-6 text-center border-b border-zinc-800/50">
              <h2 className="text-2xl font-black tracking-tighter uppercase">Today Withdrawal Users</h2>
            </div>
            <div className="p-4 space-y-3">
              {withdrawalUsers.map((user, idx) => (
                <div key={idx} className="bg-black/20 p-4 rounded-2xl flex flex-col items-center justify-center text-center space-y-1 border border-zinc-800/30">
                  <p className="text-[#f7e018] font-black text-lg uppercase tracking-tight">{user.name} WITHDRAW RS.</p>
                  <p className="text-[#f7e018] font-black text-xl">{user.amount}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'LANDING') {
    return (
      <div className="min-h-screen bg-[#120d24] text-white font-sans flex flex-col items-center">
        <header className="w-full px-4 py-4 flex items-center justify-between max-w-md">
          <div className="flex items-center">
            <span className="text-[#98ff00] font-bold text-2xl italic">elite</span>
            <span className="text-[#f7e018] font-bold text-2xl ml-1">AVIATOR</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleLogout} className="text-[10px] font-bold text-zinc-500 uppercase hover:text-white transition-colors">Logout</button>
            <div className="bg-[#00a3ff] rounded-full px-4 py-1.5 flex items-center gap-2 shadow-lg shadow-[#00a3ff]/20">
              <Wallet className="w-4 h-4 text-white" />
              <span className="font-bold text-sm">₹{balance.toFixed(0)} DEPOSIT</span>
            </div>
            <Menu className="w-8 h-8 text-white cursor-pointer" />
          </div>
        </header>

        <div className="mt-4 px-4 w-full max-w-md">
          <p className="text-zinc-400 text-sm font-bold">Welcome, <span className="text-[#f7e018]">{user?.name}</span></p>
        </div>

        <div className="mt-4 w-[90%] max-w-md bg-[#1a1535] border-2 border-[#00ff85] rounded-[32px] p-8 shadow-[0_0_20px_rgba(0,255,133,0.2)]">
          <h2 className="text-[#ff5c00] text-xl font-bold flex items-center justify-center gap-2 mb-6">
            🔥 3X BONUS ON RECHARGE
          </h2>
          <div className="space-y-4 text-center">
            <p className="text-[#f7e018] text-lg font-bold">₹1,000 = ₹2,000 Bonus</p>
            <p className="text-[#f7e018] text-lg font-bold">₹5,000 = ₹10,000 Bonus</p>
            <p className="text-[#f7e018] text-lg font-bold">₹10,000 = ₹20,000 Bonus</p>
          </div>
        </div>

        <div className="mt-20 flex flex-col gap-8 w-full max-w-xs">
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={handlePlayNow}
            className="bg-[#f7e018] text-black font-black text-2xl py-5 rounded-full shadow-[0_0_30px_rgba(247,224,24,0.4)] flex items-center justify-center gap-3"
          >
            <Gamepad2 className="w-8 h-8" />
            Play Now
            <Gamepad2 className="w-8 h-8" />
          </motion.button>

          <motion.button 
            whileTap={{ scale: 0.95 }} 
            onClick={() => setView('DEPOSIT')}
            className="bg-[#00d1ff] text-black font-black text-2xl py-5 rounded-full shadow-[0_0_30px_rgba(0,209,255,0.4)] flex items-center justify-center gap-3"
          >
            <Landmark className="w-8 h-8" /> Deposit
          </motion.button>

          <motion.button 
            whileTap={{ scale: 0.95 }} 
            onClick={() => setView('WITHDRAW')}
            className="bg-[#ff7a00] text-black font-black text-2xl py-5 rounded-full shadow-[0_0_30px_rgba(255,122,0,0.4)] flex items-center justify-center gap-3"
          >
            <Banknote className="w-8 h-8" /> Withdraw
          </motion.button>
        </div>
      </div>
    );
  }

  if (view === 'LOGIN') {
    return (
      <div className="min-h-screen bg-[#0d0d1f]/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#1a1a4d] rounded-[32px] p-8 relative shadow-2xl border border-zinc-700">
          <button onClick={() => setView('HOME')} className="absolute top-6 right-6 text-zinc-400"><X className="w-6 h-6" /></button>
          
          <form onSubmit={handleLogin} className="flex flex-col items-center space-y-6">
            <div className="flex items-center gap-2 text-[#f7e018] text-2xl font-black uppercase italic">
              <User className="w-8 h-8" />
              Site Entrance
            </div>

            {authError && <div className="w-full bg-red-500/20 border border-red-500 text-red-500 p-3 rounded-xl text-xs font-bold text-center">{authError}</div>}

            <div className="w-full space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-300 ml-1">Mobile Number</label>
                <input 
                  required
                  type="text" 
                  placeholder="Enter mobile number" 
                  value={authData.mobile}
                  onChange={(e) => setAuthData({...authData, mobile: e.target.value})}
                  className="w-full bg-[#2a2a6d] border border-zinc-600 rounded-2xl p-4 outline-none focus:border-[#f7e018] text-white" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-300 ml-1">Password</label>
                <div className="relative">
                  <input 
                    required
                    type={showPassword ? "text" : "password"} 
                    placeholder="Enter password" 
                    value={authData.password}
                    onChange={(e) => setAuthData({...authData, password: e.target.value})}
                    className="w-full bg-[#2a2a6d] border border-zinc-600 rounded-2xl p-4 outline-none focus:border-[#f7e018] text-white" 
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#f7e018] text-black font-black text-xl py-4 rounded-[32px] shadow-lg shadow-[#f7e018]/20 active:scale-95 transition-transform disabled:opacity-50"
            >
              {isLoading ? "LOGGING IN..." : "LOGIN"}
            </button>

            <button type="button" className="text-[#f7e018] font-bold text-sm underline underline-offset-4">Forgot your password?</button>

            <div className="w-full flex items-center justify-between pt-4 border-t border-zinc-700/50">
              <span className="text-sm font-bold text-zinc-300">Not registered yet?</span>
              <button type="button" onClick={() => setView('REGISTER')} className="bg-[#f7e018] text-black px-6 py-2 rounded-full font-black text-sm active:scale-95 transition-transform">REGISTER</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'REGISTER') {
    return (
      <div className="min-h-screen bg-[#0d0d1f]/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#1a1a4d] rounded-[32px] p-8 relative shadow-2xl border border-zinc-700 max-h-[90vh] overflow-y-auto no-scrollbar">
          <button onClick={() => setView('HOME')} className="absolute top-6 right-6 text-zinc-400"><X className="w-6 h-6" /></button>
          
          <form onSubmit={handleRegister} className="flex flex-col items-center space-y-6">
            <div className="flex items-center gap-2 text-[#f7e018] text-2xl font-black uppercase italic">
              <UserPlus className="w-8 h-8" />
              Register
            </div>

            {authError && <div className="w-full bg-red-500/20 border border-red-500 text-red-500 p-3 rounded-xl text-xs font-bold text-center">{authError}</div>}

            <div className="w-full space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-300 ml-1">Name</label>
                <input 
                  required
                  type="text" 
                  placeholder="Your name" 
                  value={authData.name}
                  onChange={(e) => setAuthData({...authData, name: e.target.value})}
                  className="w-full bg-[#2a2a6d] border border-zinc-600 rounded-2xl p-4 outline-none focus:border-[#f7e018] text-white" 
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-300 ml-1">Mobile</label>
                <div className="flex gap-2">
                  <input 
                    required
                    type="text" 
                    placeholder="Mobile number" 
                    value={authData.mobile}
                    onChange={(e) => setAuthData({...authData, mobile: e.target.value})}
                    className="flex-1 bg-[#2a2a6d] border border-zinc-600 rounded-2xl p-4 outline-none focus:border-[#f7e018] text-white" 
                  />
                  <button 
                    type="button"
                    disabled={otpTimer > 0 || isLoading}
                    onClick={handleSendOtp}
                    className="bg-[#f7e018] text-black px-4 rounded-2xl font-bold text-xs disabled:opacity-50"
                  >
                    {otpTimer > 0 ? `${otpTimer}s` : "SEND OTP"}
                  </button>
                </div>
              </div>

              {otpSent && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-sm font-bold text-zinc-300">Enter OTP</label>
                    {debugOtp && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono animate-pulse">DEBUG OTP: {debugOtp}</span>}
                  </div>
                  <input 
                    required
                    type="text" 
                    placeholder="6-digit OTP" 
                    value={authData.otp}
                    onChange={(e) => setAuthData({...authData, otp: e.target.value})}
                    className="w-full bg-[#2a2a6d] border border-zinc-600 rounded-2xl p-4 outline-none focus:border-[#f7e018] text-white" 
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-300 ml-1">Password</label>
                <div className="relative">
                  <input 
                    required
                    type={showPassword ? "text" : "password"} 
                    placeholder="Password" 
                    value={authData.password}
                    onChange={(e) => setAuthData({...authData, password: e.target.value})}
                    className="w-full bg-[#2a2a6d] border border-zinc-600 rounded-2xl p-4 outline-none focus:border-[#f7e018] text-white" 
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-start gap-2 ml-1">
                <input type="checkbox" id="age" required className="mt-1 w-4 h-4 accent-[#f7e018]" />
                <label htmlFor="age" className="text-xs text-zinc-300 font-bold leading-tight">
                  I confirm that I am of legal age and agree with the <span className="text-[#f7e018]">site rules</span>
                </label>
              </div>
            </div>

            <button 
              type="submit"
              disabled={!otpSent || isLoading}
              className="w-full bg-[#f7e018] text-black font-black text-xl py-4 rounded-[32px] shadow-lg shadow-[#f7e018]/20 active:scale-95 transition-transform disabled:opacity-50"
            >
              {isLoading ? "REGISTERING..." : "Start Game"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'ADMIN') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col max-w-md mx-auto">
        <header className="px-4 py-4 flex items-center justify-between border-b border-zinc-800 bg-zinc-900">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-500" />
            <h1 className="text-xl font-black tracking-tighter">MASTER ADMIN</h1>
          </div>
          <button onClick={() => setView('LANDING')} className="bg-zinc-800 p-2 rounded-lg"><X className="w-5 h-5" /></button>
        </header>
        
        <div className="p-4 space-y-6 overflow-y-auto no-scrollbar">
          {/* Game Control */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Game Control</h2>
            <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
              <p className="text-sm mb-2">Next Crash Point (Manual)</p>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="e.g. 1.50"
                  className="flex-1 bg-black border border-zinc-800 rounded-xl p-3 outline-none focus:border-red-500"
                  id="manualCrashInput"
                />
                <button 
                  onClick={() => {
                    const el = document.getElementById('manualCrashInput') as HTMLInputElement;
                    const val = parseFloat(el.value);
                    if (val >= 1) {
                      socketRef.current?.emit("adminSetCrash", val);
                      alert(`Next crash set to ${val}x`);
                    }
                  }}
                  className="bg-red-600 px-4 rounded-xl font-bold"
                >
                  SET
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 mt-2">* Leave empty for random crash.</p>
            </div>
          </section>

          {/* Wallet Control */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Wallet Control</h2>
            <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
              <p className="text-sm mb-2">Edit User Balance</p>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={balance}
                  onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-black border border-zinc-800 rounded-xl p-3 outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </section>

          {/* Withdrawal Requests */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Withdrawal Requests ({pendingWithdrawals.length})</h2>
            <div className="space-y-2">
              {pendingWithdrawals.length === 0 ? (
                <p className="text-center text-zinc-600 py-4 text-sm italic">No pending requests</p>
              ) : (
                pendingWithdrawals.map((req, i) => (
                  <div key={i} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-emerald-400 text-lg">₹{req.amount}</p>
                        <p className="text-[10px] text-zinc-500">{req.date}</p>
                      </div>
                      <span className="bg-yellow-500/10 text-yellow-500 text-[8px] font-bold px-2 py-1 rounded uppercase">{req.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <p><span className="text-zinc-500">User:</span> {req.name}</p>
                      <p><span className="text-zinc-500">Bank:</span> {req.bank}</p>
                      <p><span className="text-zinc-500">IFSC:</span> {req.ifsc}</p>
                      <p><span className="text-zinc-500">UPI:</span> {req.upi}</p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button 
                        onClick={() => {
                          setPendingWithdrawals(prev => prev.filter((_, idx) => idx !== i));
                          alert("Withdrawal Approved!");
                        }}
                        className="flex-1 bg-emerald-600 py-2 rounded-lg font-bold text-xs"
                      >
                        APPROVE
                      </button>
                      <button 
                        onClick={() => {
                          setBalance(prev => prev + parseFloat(req.amount));
                          setPendingWithdrawals(prev => prev.filter((_, idx) => idx !== i));
                          alert("Withdrawal Rejected! Money returned to wallet.");
                        }}
                        className="flex-1 bg-red-600 py-2 rounded-lg font-bold text-xs"
                      >
                        REJECT
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (view === 'WITHDRAW') {
    return (
      <div className="min-h-screen bg-[#120d24] text-white font-sans flex flex-col items-center relative">
        <header className="w-full px-4 py-4 flex items-center justify-between max-w-md">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleBack}>
            <ChevronLeft className="w-6 h-6 text-white" />
            <div className="flex items-center">
              <span className="text-[#98ff00] font-bold text-2xl italic">elite</span>
              <span className="text-[#f7e018] font-bold text-2xl ml-1">AVIATOR</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-[#00a3ff] rounded-full px-4 py-1.5 flex items-center gap-2 shadow-lg shadow-[#00a3ff]/20">
              <Wallet className="w-4 h-4 text-white" />
              <span className="font-bold text-sm">₹0 DEPOSIT</span>
            </div>
            <Menu className="w-8 h-8 text-white cursor-pointer" />
          </div>
        </header>

        <div className="w-full max-w-md flex border-b border-zinc-800">
          <button onClick={() => setView('DEPOSIT')} className="flex-1 py-3 text-zinc-500 font-bold uppercase tracking-widest">Deposit</button>
          <button className="flex-1 py-3 text-[#f7e018] font-bold border-b-4 border-[#f7e018] uppercase tracking-widest">Withdraw</button>
        </div>

        <div className="w-full max-w-md px-4 mt-6">
          <div className="bg-[#1a1535] border-2 border-zinc-800 rounded-[24px] p-8 flex flex-col items-center justify-center shadow-lg mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-zinc-400 font-black text-3xl tracking-tighter">UPI</span>
              <div className="flex items-center">
                <div className="w-3 h-6 bg-[#ff7a00] ml-1 skew-x-12" />
                <div className="w-3 h-6 bg-[#00ff85] ml-0.5 skew-x-12" />
              </div>
            </div>
            <p className="text-zinc-600 text-[10px] font-bold tracking-widest uppercase">UNIFIED PAYMENTS INTERFACE</p>
            <p className="text-[#f7e018] font-bold text-sm mt-4">Fast Withdrawal in One Minute</p>
          </div>

          <motion.div 
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowWithdrawForm(true)}
            className="bg-white rounded-[24px] p-8 flex flex-col items-center justify-center shadow-xl cursor-pointer border-2 border-[#f7e018]"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-zinc-600 font-black text-3xl tracking-tighter">UPI</span>
              <div className="flex items-center">
                <div className="w-3 h-6 bg-[#ff7a00] ml-1 skew-x-12" />
                <div className="w-3 h-6 bg-[#00ff85] ml-0.5 skew-x-12" />
              </div>
            </div>
            <p className="text-zinc-400 text-[8px] font-bold tracking-widest uppercase mb-4">UNIFIED PAYMENTS INTERFACE</p>
            <h3 className="text-[#f7e018] font-black text-xl uppercase tracking-widest">WITHDRAWAL</h3>
          </motion.div>
        </div>

        <AnimatePresence>
          {showWithdrawForm && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute inset-0 z-[200] bg-[#120d24] flex flex-col"
            >
              <div className="p-4 flex items-center justify-between border-b border-zinc-800">
                <div className="w-6" />
                <h2 className="text-[#f7e018] font-bold text-lg">Withdraw Request</h2>
                <button onClick={() => setShowWithdrawForm(false)} className="p-1">
                  <X className="w-6 h-6 text-[#f7e018]" />
                </button>
              </div>

              <form onSubmit={handleWithdrawSubmit} className="flex-1 p-6 space-y-6 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-white font-bold text-sm block text-center">Account Holder Name</label>
                  <input 
                    required
                    type="text" 
                    value={withdrawData.name}
                    onChange={(e) => setWithdrawData({...withdrawData, name: e.target.value})}
                    className="w-full bg-[#1a1535] border-2 border-[#f7e018] rounded-xl py-4 px-4 text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-white font-bold text-sm block text-center">Bank Name</label>
                  <input 
                    required
                    type="text" 
                    value={withdrawData.bank}
                    onChange={(e) => setWithdrawData({...withdrawData, bank: e.target.value})}
                    className="w-full bg-[#1a1535] border-2 border-[#f7e018] rounded-xl py-4 px-4 text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-white font-bold text-sm block text-center">IFSC Code</label>
                  <input 
                    required
                    type="text" 
                    value={withdrawData.ifsc}
                    onChange={(e) => setWithdrawData({...withdrawData, ifsc: e.target.value})}
                    className="w-full bg-[#1a1535] border-2 border-[#f7e018] rounded-xl py-4 px-4 text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-white font-bold text-sm block text-center">UPI ID</label>
                  <input 
                    required
                    type="text" 
                    value={withdrawData.upi}
                    onChange={(e) => setWithdrawData({...withdrawData, upi: e.target.value})}
                    className="w-full bg-[#1a1535] border-2 border-[#f7e018] rounded-xl py-4 px-4 text-white focus:outline-none"
                  />
                </div>

                <div className="pt-4 flex justify-center">
                  <button 
                    type="submit"
                    className="bg-[#ff7a00] text-black font-black text-xl px-16 py-4 rounded-2xl shadow-lg shadow-[#ff7a00]/30 active:scale-95 transition-transform"
                  >
                    Submit
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (view === 'DEPOSIT') {
    return (
      <div className="min-h-screen bg-[#120d24] text-white font-sans flex flex-col items-center relative">
        {/* Header */}
        <header className="w-full px-4 py-4 flex items-center justify-between max-w-md">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleBack}>
            <ChevronLeft className="w-6 h-6 text-white" />
            <div className="flex items-center">
              <span className="text-[#98ff00] font-bold text-2xl italic">elite</span>
              <span className="text-[#f7e018] font-bold text-2xl ml-1">AVIATOR</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-[#00a3ff] rounded-full px-4 py-1.5 flex items-center gap-2 shadow-lg shadow-[#00a3ff]/20">
              <Wallet className="w-4 h-4 text-white" />
              <span className="font-bold text-sm">₹0 DEPOSIT</span>
            </div>
            <Menu className="w-8 h-8 text-white cursor-pointer" />
          </div>
        </header>

        {/* Tabs */}
        <div className="w-full max-w-md flex border-b border-zinc-800">
          <button className="flex-1 py-3 text-[#f7e018] font-bold border-b-4 border-[#f7e018] uppercase tracking-widest">Deposit</button>
          <button onClick={() => setView('WITHDRAW')} className="flex-1 py-3 text-zinc-500 font-bold uppercase tracking-widest">Withdraw</button>
        </div>

        <div className="w-full max-w-md px-4 mt-6">
          {/* Auto Pay UPI Card */}
          <div className="bg-[#1a1535] border-2 border-[#f7e018] rounded-[24px] p-8 flex flex-col items-center justify-center shadow-lg mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[#ff7a00] font-black text-3xl tracking-tighter">AUTO PAY</span>
              <div className="flex items-center">
                <span className="text-zinc-400 font-bold text-3xl italic">UPI</span>
                <div className="w-3 h-6 bg-[#ff7a00] ml-1 skew-x-12" />
                <div className="w-3 h-6 bg-[#00ff85] ml-0.5 skew-x-12" />
              </div>
            </div>
            <p className="text-zinc-500 text-[10px] font-bold tracking-widest uppercase">Instant Approval</p>
            <p className="text-zinc-600 text-[8px] mt-1">UNIFIED PAYMENTS INTERFACE</p>
          </div>

          {/* Amount Selection Area */}
          <div className="bg-white rounded-[32px] p-6 text-black shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#120d24] font-black text-sm uppercase tracking-tight">Minimum Recharge: <span className="text-[#00a3ff]">500</span></h3>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <input 
                  type="number" 
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                  className="w-full bg-[#008a8a] text-white font-bold text-xl py-3 px-6 rounded-full border-2 border-[#f7e018] focus:outline-none"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-black italic font-bold">INR</span>
              </div>
              <button 
                onClick={handleDepositClick}
                className="bg-[#00a3ff] text-white font-black text-sm px-8 py-3 rounded-full shadow-lg shadow-[#00a3ff]/30 active:scale-95 transition-transform"
              >
                DEPOSIT
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-6">
              {[500, 1000, 2000, 5000, 10000, 20000, 50000, 95000].map(amt => (
                <button 
                  key={amt}
                  onClick={() => setDepositAmount(amt)}
                  className="bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-bold py-2 rounded-full text-xs transition-colors"
                >
                  {amt}
                </button>
              ))}
            </div>

            <p className="text-zinc-500 font-bold text-xs mb-4">Recharge Amount Select: <span className="text-[#ff7a00]">₹{depositAmount}</span></p>

            {depositAmount < 1000 && (
              <div className="flex items-center gap-2 text-red-500 font-bold text-xs">
                <X className="w-4 h-4" />
                <span>No bonus offer on recharge below ₹1000.</span>
              </div>
            )}
          </div>
        </div>

        {/* Loading Overlay */}
        <AnimatePresence>
          {isRedirecting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mb-6" />
              <p className="text-white font-bold text-lg mb-2">Please wait, redirecting to payment...</p>
              <div className="flex items-center gap-2 text-zinc-400 font-bold tracking-widest text-sm">
                <span>PROCESSING...</span>
                <RotateCcw className="w-4 h-4 animate-spin" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (view === 'PAYMENT') {
    return (
      <div className="min-h-screen bg-[#f5f7fa] text-black font-sans flex flex-col items-center">
        {/* Top Security Bar */}
        <div className="w-full bg-white py-2 px-4 flex items-center justify-between max-w-md text-[10px] font-bold text-[#1b113a] shadow-sm">
          <button onClick={handleBack} className="flex items-center gap-1 text-zinc-600">
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              <span>100% Secure</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-500 fill-emerald-500" />
              <span>Verified</span>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="w-full bg-[#1b113a] p-4 flex items-center gap-4 text-white">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <Landmark className="w-6 h-6 text-[#1b113a]" />
          </div>
          <div>
            <h2 className="font-black text-lg tracking-tight">AUTO PAY</h2>
            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
              <Shield className="w-3 h-3 fill-emerald-400" />
              <span>Verified</span>
            </div>
          </div>
        </div>

        {/* Main Payment Card */}
        <div className="w-[90%] max-w-sm mt-8 bg-white rounded-[40px] p-8 shadow-2xl flex flex-col items-center">
          {/* QR Code Placeholder */}
          <div className="w-full aspect-square bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] mb-8 flex items-center justify-center p-8">
            <div className="w-full h-full border-4 border-dashed border-zinc-100 rounded-2xl flex items-center justify-center">
              <RotateCcw className="w-12 h-12 text-zinc-100" />
            </div>
          </div>

          <p className="text-zinc-500 font-bold text-sm mb-1">Payable Amount</p>
          <h1 className="text-[#1b113a] text-4xl font-black mb-8">₹{depositAmount.toFixed(2)}</h1>

          <p className="text-zinc-400 text-center text-xs font-medium leading-relaxed mb-8">
            Download or screenshot this QR code<br />& open any UPI app
          </p>

          {/* UPI Apps */}
          <div className="flex gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center p-2">
                <img src="https://www.gstatic.com/images/branding/product/2x/gpay_64dp.png" alt="GPay" className="w-full h-full object-contain" />
              </div>
              <span className="text-[10px] font-bold text-zinc-500">Google Pay</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center p-2">
                <div className="w-full h-full bg-[#5f259f] rounded flex items-center justify-center text-white font-bold text-xs">Pe</div>
              </div>
              <span className="text-[10px] font-bold text-zinc-500">PhonePe</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center p-2">
                <div className="w-full h-full bg-[#00baf2] rounded flex items-center justify-center text-white font-bold text-[8px]">Paytm</div>
              </div>
              <span className="text-[10px] font-bold text-zinc-500">Paytm</span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setView('GAME')}
          className="mt-8 text-zinc-400 font-bold text-sm underline underline-offset-4"
        >
          Cancel Payment
        </button>
      </div>
    );
  }

  if (view === 'LOADING') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden">
        <motion.div 
          initial={{ rotate: 0, x: -100, y: 100, opacity: 0 }}
          animate={{ 
            rotate: [0, 15, 15],
            x: [-100, 0, 800],
            y: [100, 0, -800],
            opacity: [0, 1, 1]
          }}
          transition={{ duration: 2.5, ease: "easeInOut" }}
          className="absolute"
        >
          <Plane className="w-32 h-32 text-red-600 fill-current drop-shadow-[0_0_20px_rgba(255,0,0,0.8)]" />
        </motion.div>

        <div className="z-10 text-center space-y-8">
          <div className="w-1 h-12 bg-red-600 mx-auto" />
          <motion.h2 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-3xl font-bold tracking-widest text-white drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]"
          >
            POWERED BY<br />
            <span className="text-4xl">Elite BETS INDIA</span>
          </motion.h2>
          
          <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold tracking-widest">
            <Shield className="w-6 h-6" />
            <span>SAFE & SECUREED</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] text-white font-sans flex flex-col max-w-md mx-auto border-x border-zinc-800 relative">
      {/* Full History Modal */}
      <AnimatePresence>
        {showFullHistory && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute inset-0 z-[100] bg-[#120d24] p-4 flex flex-col"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-6" />
              <h2 className="text-zinc-400 font-bold tracking-widest text-sm">ROUND HISTORY</h2>
              <button onClick={() => setShowFullHistory(false)} className="p-1 bg-zinc-800 rounded-full">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2 overflow-y-auto pr-2 no-scrollbar">
              {history.map((item, i) => (
                <div key={i} className={`px-2 py-1.5 rounded-full text-[10px] font-bold text-center ${
                  item.multiplier < 2 ? 'bg-[#4e61f2]' : 
                  item.multiplier < 10 ? 'bg-[#913ef8]' : 'bg-[#c017b3]'
                }`}>
                  {item.multiplier.toFixed(2)}x
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between bg-[#1b113a]">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('ADMIN')}>
          <ChevronLeft className="w-6 h-6 text-white" onClick={(e) => { e.stopPropagation(); handleBack(); }} />
          <div className="flex items-center">
            <span className="text-[#98ff00] font-bold text-xl italic">elite</span>
            <span className="text-[#f7e018] font-bold text-xl ml-1">AVIATOR</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
          <div className="bg-[#00a3ff] rounded-full px-3 py-1 flex items-center gap-1">
            <Wallet className="w-3 h-3" />
            <span className="font-bold text-xs">₹{balance.toFixed(0)}</span>
          </div>
          <Menu className="w-6 h-6" />
        </div>
      </header>

      {/* Sub Header */}
      <div className="px-4 py-2 flex items-center justify-between bg-[#120d24]">
        <span className="text-[#d91e4e] font-serif italic text-xl font-bold">Aviator</span>
        <div className="flex items-center gap-1 text-zinc-400 font-mono text-sm">
          <Clock className="w-3 h-3" />
          <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
        </div>
      </div>

      {/* History Bar */}
      <div className="px-2 py-2 bg-[#120d24] flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-zinc-800">
        {history.slice(0, 10).map((item, i) => (
          <div key={i} className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${
            item.multiplier < 2 ? 'bg-[#4e61f2] text-white' : 
            item.multiplier < 10 ? 'bg-[#913ef8] text-white' : 'bg-[#c017b3] text-white'
          }`}>
            {item.multiplier.toFixed(2)}x
          </div>
        ))}
        <button onClick={() => setShowFullHistory(true)} className="ml-auto p-1 bg-zinc-800 rounded-full flex items-center gap-1 px-2">
          <History className="w-3 h-3 text-zinc-400" />
          <RotateCcw className="w-3 h-3 text-red-500" />
        </button>
      </div>

      {/* Main Game Area */}
      <div className="relative aspect-video bg-[#050505] overflow-hidden flex flex-col items-center justify-center border-y border-zinc-900">
        {/* Background Effects */}
        <div className="absolute inset-0 opacity-40" 
             style={{ 
               background: 'radial-gradient(circle at 50% 50%, #1a2a4a 0%, transparent 70%), repeating-conic-gradient(from 0deg, #111 0deg 10deg, transparent 10deg 20deg)',
             }} />
        
        {/* Grid Dots */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Left Axis Dots */}
          <div className="absolute left-1 top-0 bottom-0 flex flex-col justify-between py-4">
            {[...Array(8)].map((_, i) => <div key={i} className="w-1 h-1 bg-blue-400 rounded-full opacity-50" />)}
          </div>
          {/* Bottom Axis Dots */}
          <div className="absolute bottom-1 left-0 right-0 flex justify-between px-4">
            {[...Array(12)].map((_, i) => <div key={i} className="w-1 h-1 bg-white rounded-full opacity-50" />)}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {gameStatus === 'WAITING' ? (
            <motion.div 
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="z-30 text-center"
            >
              <p className="text-zinc-400 text-xs uppercase tracking-widest mb-1">Next round in</p>
              <p className="text-4xl font-black text-[#f7e018]">{waitingTime}s</p>
            </motion.div>
          ) : (
            <motion.div 
              key="flying"
              className="z-30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none"
            >
              <h1 className="text-6xl font-black tabular-nums tracking-tighter text-white drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                {multiplier.toFixed(2)}x
              </h1>
              {gameStatus === 'CRASHED' && (
                <p className="text-red-600 font-bold text-lg uppercase tracking-widest mt-1 drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]">Flew Away!</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Curved Graph and Plane */}
        {gameStatus !== 'WAITING' && (
          <div className="absolute inset-0 z-10">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* The filled area - Solid Dark Red */}
              <motion.path
                d={`M 0 95 Q ${Math.min(multiplier * 8, 35)} 95, ${Math.min(multiplier * 15, 85)} ${Math.max(95 - multiplier * 15, 15)} L ${Math.min(multiplier * 15, 85)} 95 Z`}
                fill="#ff0000"
                fillOpacity="0.3"
              />
              {/* The curve path - Bright Red */}
              <motion.path
                d={`M 0 95 Q ${Math.min(multiplier * 8, 35)} 95, ${Math.min(multiplier * 15, 85)} ${Math.max(95 - multiplier * 15, 15)}`}
                stroke="#ff0000"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>

            {/* Plane at the end of the curve */}
            <motion.div 
              className="absolute"
              initial={false}
              animate={gameStatus === 'CRASHED' ? {
                left: '120%',
                top: '-20%',
                opacity: 0
              } : {
                left: `${Math.min(multiplier * 15, 85)}%`,
                top: `${Math.max(95 - multiplier * 15, 15)}%`,
                opacity: 1
              }}
              transition={gameStatus === 'CRASHED' ? { duration: 1.5, ease: "easeIn" } : { duration: 0.1 }}
              style={{
                transform: 'translate(-50%, -50%)'
              }}
            >
              <Plane className="w-12 h-12 text-red-600 fill-current drop-shadow-[0_0_15px_rgba(255,0,0,0.8)]" />
            </motion.div>
          </div>
        )}
      </div>

      {/* Betting Panels */}
      <div className="p-2 space-y-2 bg-[#120d24]">
        <BetPanel 
          bet={bet1} 
          setBet={(val) => setBet1(val)} 
          onPlace={() => placeBet(1)} 
          onCashOut={() => cashOut(1)} 
          gameStatus={gameStatus}
          multiplier={multiplier}
        />
        <BetPanel 
          bet={bet2} 
          setBet={(val) => setBet2(val)} 
          onPlace={() => placeBet(2)} 
          onCashOut={() => cashOut(2)} 
          gameStatus={gameStatus}
          multiplier={multiplier}
        />
      </div>

      {/* Bottom Stats */}
      <div className="flex-1 bg-[#120d24] mt-2 rounded-t-3xl p-4 overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-around mb-4 border-b border-zinc-800 pb-2">
          <button 
            onClick={() => setActiveTab('ALL')}
            className={`text-sm font-bold pb-1 transition-colors ${activeTab === 'ALL' ? 'text-white border-b-2 border-[#f7e018]' : 'text-zinc-500'}`}
          >
            All Bets
          </button>
          <button 
            onClick={() => setActiveTab('MY')}
            className={`text-sm font-bold pb-1 transition-colors ${activeTab === 'MY' ? 'text-white border-b-2 border-[#f7e018]' : 'text-zinc-500'}`}
          >
            My Bets
          </button>
        </div>
        
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase">
            {activeTab === 'ALL' ? `Total Bets : ${liveBets.length}` : `My Total Bets : ${myBetHistory.length}`}
          </span>
          <button className="flex items-center gap-1 bg-zinc-800 px-2 py-1 rounded text-[10px] text-zinc-400">
            <RotateCcw className="w-3 h-3" /> Previous hand
          </button>
        </div>

        <div className="space-y-2">
          {(() => {
            const currentMyBets = liveBets.filter(b => b.id.startsWith('me'));
            const displayList = activeTab === 'ALL' 
              ? liveBets 
              : [...currentMyBets, ...myBetHistory];

            return displayList.map((bet) => (
              <div key={bet.id} className={`flex items-center justify-between p-2 rounded-xl border transition-colors ${
                bet.isCashedOut ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-black/40 border-zinc-800/50'
              }`}>
                <div className="flex items-center gap-2">
                  <img src={bet.avatar} className="w-6 h-6 rounded-full" alt="" />
                  <div className="flex flex-col">
                    <span className={`text-[10px] font-bold ${bet.id.startsWith('me') ? 'text-[#f7e018]' : 'text-white'}`}>
                      {bet.user}
                    </span>
                    <span className="text-[8px] text-zinc-500">{bet.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-bold text-zinc-400">₹{bet.amount}</span>
                  {bet.isCashedOut ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[#f7e018]">{bet.multiplier?.toFixed(2)}x</span>
                      <span className="text-[10px] font-bold text-emerald-400">₹{bet.win}</span>
                    </div>
                  ) : (
                    <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 10, ease: "linear" }}
                        className="h-full bg-zinc-600"
                      />
                    </div>
                  )}
                </div>
              </div>
            ));
          })()}
          {(activeTab === 'ALL' ? liveBets : [...liveBets.filter(b => b.id.startsWith('me')), ...myBetHistory]).length === 0 && (
            <div className="text-center py-8 text-zinc-600 text-xs italic">
              No bets to show
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BetPanel({ bet, setBet, onPlace, onCashOut, gameStatus, multiplier }: { 
  bet: BetState, 
  setBet: (val: BetState) => void, 
  onPlace: () => void, 
  onCashOut: () => void,
  gameStatus: GameStatus,
  multiplier: number
}) {
  return (
    <div className="bg-[#1b113a] rounded-2xl p-3 border border-zinc-800">
      <div className="flex items-center justify-center gap-8 mb-3">
        <button className="text-[10px] font-bold text-white border-b border-white">Bet</button>
        <button className="text-[10px] font-bold text-zinc-500">Auto</button>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between bg-black rounded-full px-3 py-1 border border-zinc-800">
            <button onClick={() => setBet({ ...bet, amount: Math.max(1, bet.amount - 1) })} disabled={bet.isPlaced} className="text-zinc-400"><Minus className="w-4 h-4" /></button>
            <span className="font-bold font-mono">{bet.amount.toFixed(2)}</span>
            <button onClick={() => setBet({ ...bet, amount: bet.amount + 1 })} disabled={bet.isPlaced} className="text-zinc-400"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {[100, 200, 500, 1000].map(amt => (
              <button 
                key={amt} 
                onClick={() => setBet({ ...bet, amount: amt })} 
                disabled={bet.isPlaced}
                className="bg-zinc-900 text-[10px] font-bold py-1 rounded-lg border border-zinc-800"
              >
                {amt}₹
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          {bet.isPlaced ? (
            bet.isCashedOut ? (
              <div className="w-full h-full bg-zinc-800 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-zinc-500">CASHED OUT</span>
                <span className="text-emerald-400 font-bold">{bet.cashedOutAt?.toFixed(2)}x</span>
              </div>
            ) : (
              <button 
                onClick={onCashOut}
                disabled={gameStatus !== 'FLYING'}
                className="w-full h-full bg-[#f7e018] text-black font-black rounded-2xl flex flex-col items-center justify-center shadow-[0_0_20px_rgba(247,224,24,0.3)] disabled:opacity-50"
              >
                <span className="text-xs">CASH OUT</span>
                <span className="text-lg">{(bet.amount * multiplier).toFixed(2)}₹</span>
              </button>
            )
          ) : (
            <button 
              onClick={onPlace}
              className="w-full h-full bg-[#6c3ef8] hover:bg-[#7c4ef8] text-white font-black rounded-2xl flex flex-col items-center justify-center shadow-[0_0_20px_rgba(108,62,248,0.3)]"
            >
              <span className="text-lg">BET</span>
              <span className="text-[10px]">{bet.amount.toFixed(2)}₹</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
