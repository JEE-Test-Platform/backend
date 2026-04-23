import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { registerTimerSocket } from './socket/timerSocket';
import authRoutes from './routes/authRoutes';
import studentRoutes from './routes/studentRoutes';
import instituteRoutes from './routes/instituteRoutes';
import operatorRoutes from './routes/operatorRoutes';
import leaderboardRoutes from './routes/leaderboardRoutes';
import superadminRoutes from './routes/superadminRoutes';
import teacherRoutes from './routes/teacherRoutes';
import blobStorageService from './services/blobStorageService';
import './workers/reportWorker'; // Initialize BullMQ worker
import './workers/testExpiryWorker'; // Initialize test expiry worker

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'https://jeerankup.com',
  'https://www.jeerankup.com',
].filter(Boolean) as string[];

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// Rate limiting — auth endpoints are brute-force targets
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// Submission limiter — prevents hammering answer/submit endpoints
const submitLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// Attach Socket.io to the HTTP server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});
registerTimerSocket(io);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({
    message: 'JEE Test Platform API Server is running!',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
// Submit limiter must be registered before the student router so it runs first
app.use('/api/student/attempts', submitLimiter);
app.use('/api/student', studentRoutes);
app.use('/api/institute', instituteRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/teacher', teacherRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message,
  });
});

// 404 handler - must be last
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.method} ${req.originalUrl} does not exist on this server`,
  });
});

// Initialize Azure Blob Storage container
blobStorageService.initializeContainer()
  .then(() => console.log('✅ Azure Blob Storage initialized'))
  .catch((error) => console.error('❌ Blob Storage initialization failed:', error));

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 API URL: http://localhost:${PORT}`);
  console.log(`🔌 Socket.io listening on ws://localhost:${PORT}`);
});