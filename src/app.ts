import express, { Request, Response, NextFunction } from 'express'; // Default import for express, named imports for types
import * as dotenv from 'dotenv';
import morgan from 'morgan';
import cors from 'cors';
import router from './routes/index.js';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from './authConfig.js';
import { authMiddleware } from './middlewares/authmiddleware.js';
import authrouter from './routes/authroutes.js';
import mediaProcessingRoutes from './routes/mediaProcessingRoutes.js';
import postroutes from './routes/postroutes.js';
import eventroutes from './routes/eventroutes.js';
import collectionroutes from './routes/collectionroutes.js';
import vectorSearchRoutes from './routes/vectorSearchRoutes.js';
import tagroutes from './routes/tagroutes.js';
import { connectDB } from './dbconfig/dbconnect.js';
import User from './models/User.js';

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(cookieParser());

// Session setup for Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'bengali-heritage-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(new GoogleStrategy({
    clientID: config.googleClientId,
    clientSecret: config.googleClientSecret,
    callbackURL: config.callbackURL
  },
  async (accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: any) => void) => {
    try {
      // Check if user exists in our database
      let user = await User.findOne({ googleId: profile.id });
      
      if (user) {
        // User exists, return the user
        return done(null, user);
      }
      
      // Check if user with same email exists (possible migration from previous auth system)
      if (profile.emails && profile.emails.length > 0) {
        const email = profile.emails[0].value;
        user = await User.findOne({ email: email });
        
        if (user) {
          // Update existing user with Google ID
          user.googleId = profile.id;
          await user.save();
          return done(null, user);
        }
      }
      
      // Create new user
      const newUser = new User({
        googleId: profile.id,
        name: profile.displayName || 'Heritage User',
        email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : `user-${profile.id}@example.com`, // Fallback if email not provided
      });
      
      await newUser.save();
      return done(null, newUser);
    } catch (error) {
      return done(error, false);
    }
  }
));

// Serialize and deserialize user for session management
passport.serializeUser((user: Express.User, done: (err: any, id?: string) => void) => {
  done(null, user._id);
});

passport.deserializeUser(async (id: string, done: (err: any, user?: any) => void) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Public routes
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'Sorbonash backend running',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Authentication routes (public - no auth middleware needed for login/logout/callback)
app.use('/auth', authrouter);

// Protected API routes that require authentication
interface ProtectedApiRequest extends Request {
  user?: any;
}

interface ProtectedApiResponse<T = any> extends Response<T> {}

app.use(
  '/api',
  (req: ProtectedApiRequest, res: ProtectedApiResponse, next: NextFunction) => {
    authMiddleware(req, res, next);
  },
  router
);

// Auth-protected routes for authenticated users only
interface AuthProtectedRequest extends Request {
  user?: any;
}

interface AuthProtectedResponse<T = any> extends Response<T> {}

app.use(
  '/api/auth',
  (req: AuthProtectedRequest, res: AuthProtectedResponse, next: NextFunction) => {
    authMiddleware(req, res, next);
  },
  authrouter
);

// Post routes with auth middleware - directly mounted
interface AuthenticatedRequest extends Request {
  user?: any;
}

interface TypedResponse<T = any> extends Response<T> {}

app.use(
  '/api/posts',
  (req: AuthenticatedRequest, res: TypedResponse, next: NextFunction) => {
    // authMiddleware(req, res, next);
  },
  postroutes
);

// Event routes
app.use(
  '/api/events',
  (req: AuthenticatedRequest, res: TypedResponse, next: NextFunction) => {
    // authMiddleware(req, res, next);
  },
  eventroutes
);

// Collection routes
app.use(
  '/api/collections',
  (req: AuthenticatedRequest, res: TypedResponse, next: NextFunction) => {
    // authMiddleware(req, res, next);
  },
  collectionroutes
);

// Media processing routes with auth middleware
interface MediaProcessingRequest extends Request {
  user?: any;
}

interface MediaProcessingResponse<T = any> extends Response<T> {}

app.use(
  '/api/processing',
  (req: MediaProcessingRequest, res: MediaProcessingResponse, next: NextFunction) => {
    authMiddleware(req, res, next);
  },
  mediaProcessingRoutes
);

// Vector search routes
app.use(
  '/api/vector',
  (req: AuthenticatedRequest, res: TypedResponse, next: NextFunction) => {
    next(); // No auth required for search endpoints
  },
  vectorSearchRoutes
);

// Tag routes
app.use('/api/tags', tagroutes);

// Google OAuth authentication routes
// ...existing code...

// Global error handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
