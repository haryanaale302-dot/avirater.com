import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_FILE = path.join(__dirname, "users.json");
const JWT_SECRET = "aviator-secret-key-123";

// Load users from file
let users = [];
if (fs.existsSync(USERS_FILE)) {
  users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
}

const saveUsers = () => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  const PORT = 3000;

  // Temporary OTP storage
  const otps = new Map<string, { otp: string, expires: number }>();

  // Auth Routes
  app.post("/api/auth/send-otp", async (req, res) => {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ message: "Mobile number required" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otps.set(mobile, { otp, expires: Date.now() + 5 * 60 * 1000 }); // 5 mins expiry

    console.log(`[OTP] Generated for ${mobile}: ${otp}`);

    const apiKey = process.env.FAST2SMS_API_KEY;
    
    if (apiKey) {
      try {
        // Real SMS sending using Fast2SMS
        const response = await fetch(`https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&route=otp&variables_values=${otp}&numbers=${mobile}`, {
          method: 'GET'
        });
        const result = await response.json();
        console.log("[SMS API Response]", result);
        
        if (result.return) {
          return res.json({ message: "OTP sent to your mobile number" });
        } else {
          return res.status(500).json({ message: "SMS Gateway Error: " + result.message });
        }
      } catch (error) {
        console.error("[SMS Error]", error);
        return res.status(500).json({ message: "Failed to connect to SMS Gateway" });
      }
    } else {
      // Fallback for testing without API Key
      res.json({ 
        message: "OTP sent (SIMULATION MODE)", 
        debugOtp: otp,
        warning: "Set FAST2SMS_API_KEY in environment for real SMS"
      });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    const { name, mobile, password, otp } = req.body;
    
    // Verify OTP
    const stored = otps.get(mobile);
    if (!stored || stored.otp !== otp || stored.expires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Check if user exists
    if (users.find(u => u.mobile === mobile)) {
      return res.status(400).json({ message: "User already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(),
      name,
      mobile,
      password: hashedPassword,
      balance: 500, // Starting bonus
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers();
    otps.delete(mobile);

    const token = jwt.sign({ id: newUser.id }, JWT_SECRET);
    res.cookie("token", token, { httpOnly: true });
    res.json({ user: { name: newUser.name, mobile: newUser.mobile, balance: newUser.balance } });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { mobile, password } = req.body;
    const user = users.find(u => u.mobile === mobile);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid mobile or password" });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.cookie("token", token, { httpOnly: true });
    res.json({ user: { name: user.name, mobile: user.mobile, balance: user.balance } });
  });

  app.get("/api/auth/me", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: "Not logged in" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = users.find(u => u.id === decoded.id);
      if (!user) return res.status(401).json({ message: "User not found" });
      res.json({ user: { name: user.name, mobile: user.mobile, balance: user.balance } });
    } catch (e) {
      res.status(401).json({ message: "Invalid token" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ message: "Logged out" });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/mobile", (req, res) => {
    res.sendFile(path.join(__dirname, "aviator_mobile.html"));
  });

  // Game State
  let gameStatus: 'WAITING' | 'FLYING' | 'CRASHED' = 'WAITING';
  let multiplier = 1.0;
  let waitingTime = 5;
  let crashPoint = 2.0;
  let history: any[] = [];
  let liveBets: any[] = [];
  let startTime = Date.now();

  const MOCK_NAMES = ['Rahul', 'Amit', 'Sanjay', 'Priya', 'Anjali', 'Vikram', 'Deepak', 'Neha', 'Arjun', 'Karan', 'Meera', 'Sneha', 'Rohan', 'Aditya', 'Ishani', 'Tanvi'];

  const generateCrashPoint = () => {
    const rand = Math.random();
    if (rand < 0.03) return 1.0;
    return parseFloat((0.98 / (1 - Math.random())).toFixed(2));
  };

  const broadcastState = () => {
    // console.log("Broadcasting state, liveBets count:", liveBets.length);
    io.emit("gameUpdate", {
      gameStatus,
      multiplier,
      waitingTime,
      history: history.slice(0, 50),
      liveBets,
    });
  };

  const startRound = () => {
    crashPoint = generateCrashPoint();
    multiplier = 1.0;
    gameStatus = 'FLYING';
    startTime = Date.now();

    // Generate dummy bets at start of round
    const dummyCount = Math.floor(Math.random() * 15) + 10;
    const dummyBets = Array.from({ length: dummyCount }, (_, i) => ({
      id: 'dummy_' + Math.random().toString(36).substr(2, 5),
      user: MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)],
      avatar: `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/32/32`,
      amount: Math.floor(Math.random() * 5000) + 100,
      isCashedOut: false
    }));
    liveBets = [...liveBets, ...dummyBets];
    
    broadcastState();

    const interval = setInterval(() => {
      if (gameStatus !== 'FLYING') {
        clearInterval(interval);
        return;
      }

      const elapsed = (Date.now() - startTime) / 1000;
      const currentMultiplier = Math.pow(1.08, elapsed * 2);
      multiplier = parseFloat(currentMultiplier.toFixed(2));

      // Randomly cash out dummy bets
      let changed = false;
      liveBets = liveBets.map(bet => {
        if (bet.id.startsWith('dummy_') && !bet.isCashedOut && Math.random() < 0.05 && multiplier > 1.2) {
          changed = true;
          return { 
            ...bet, 
            isCashedOut: true, 
            multiplier: multiplier, 
            win: Math.floor(bet.amount * multiplier) 
          };
        }
        return bet;
      });

      if (multiplier >= crashPoint) {
        endRound();
        clearInterval(interval);
      } else {
        broadcastState();
      }
    }, 100);
  };

  const endRound = () => {
    gameStatus = 'CRASHED';
    history.unshift({
      id: Date.now(),
      multiplier: crashPoint,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    broadcastState();

    setTimeout(() => {
      gameStatus = 'WAITING';
      waitingTime = 5;
      liveBets = [];
      broadcastState();
      startWaiting();
    }, 3000);
  };

  const startWaiting = () => {
    // Generate some initial dummy bets for the waiting period
    const initialDummyCount = Math.floor(Math.random() * 5) + 5;
    const initialDummies = Array.from({ length: initialDummyCount }, () => ({
      id: 'dummy_' + Math.random().toString(36).substr(2, 5),
      user: MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)],
      avatar: `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/32/32`,
      amount: Math.floor(Math.random() * 5000) + 100,
      isCashedOut: false
    }));
    liveBets = [...initialDummies];
    broadcastState();

    const waitInterval = setInterval(() => {
      if (waitingTime > 0) {
        waitingTime--;
        
        // Add more dummy bets during waiting
        if (Math.random() < 0.8) {
          liveBets.push({
            id: 'dummy_' + Math.random().toString(36).substr(2, 5),
            user: MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)],
            avatar: `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/32/32`,
            amount: Math.floor(Math.random() * 5000) + 100,
            isCashedOut: false
          });
        }
        
        // Randomly add 1-2 more bets sometimes
        if (Math.random() < 0.3) {
          liveBets.push({
            id: 'dummy_' + Math.random().toString(36).substr(2, 5),
            user: MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)],
            avatar: `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/32/32`,
            amount: Math.floor(Math.random() * 5000) + 100,
            isCashedOut: false
          });
        }
        
        broadcastState();
      } else {
        clearInterval(waitInterval);
        startRound();
      }
    }, 1000);
  };

  // Start the first cycle
  startWaiting();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    socket.emit("gameUpdate", { gameStatus, multiplier, waitingTime, history, liveBets });

    socket.on("placeBet", (bet) => {
      if (gameStatus === 'WAITING') {
        liveBets.push({ ...bet, id: socket.id + Math.random(), isCashedOut: false });
        broadcastState();
      }
    });

    socket.on("cashOut", ({ betId, multiplier: cashOutMultiplier }) => {
      const bet = liveBets.find(b => b.id === betId);
      if (bet && !bet.isCashedOut && gameStatus === 'FLYING') {
        bet.isCashedOut = true;
        bet.multiplier = cashOutMultiplier;
        bet.win = Math.floor(bet.amount * cashOutMultiplier);
        broadcastState();
      }
    });

    socket.on("adminSetCrash", (point) => {
      crashPoint = point;
      console.log("Admin set crash point to:", point);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
