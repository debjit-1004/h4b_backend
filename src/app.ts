import express, { Request, Response, NextFunction } from 'express'; // Default import for express, named imports for types
import * as dotenv from 'dotenv';
import morgan from 'morgan';
import cors from 'cors';
import router from './routes/index.js';
import { CookieStorage, CivicAuth } from '@civic/auth/server';
import cookieParser from 'cookie-parser';
import { config } from './authConfig.js';
import { authMiddleware } from './middlewares/authmiddleware.js';
import authrouter from './routes/authroutes.js';
import mediaProcessingRoutes from './routes/mediaProcessingRoutes.js';
import postroutes from './routes/postroutes.js';
import { connectDB } from './dbconfig/dbconnect.js';

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(morgan('dev'));
app.use(cors());
app.use(cookieParser());

class ExpressCookieStorage extends CookieStorage {
  constructor(private req: Request, private res: Response) {
    super({
      // secure: process.env.NODE_ENV === 'production', // Example: make secure based on env
      secure: false, // Keep as per original for now
      // httpOnly: true, // Recommended for security
      // sameSite: 'lax' // Recommended for security
    });
  }

  async get(key: string): Promise<string | null> {
    // First check normal cookies
    const cookieValue = this.req.cookies[key];
    if (cookieValue) {
      return Promise.resolve(cookieValue);
    }
    
    // If not found, try to parse from the Cookie header
    try {
      const cookieHeader = this.req.headers.cookie;
      if (cookieHeader && typeof cookieHeader === 'string') {
        console.log(`Looking for cookie: ${key} in header: ${cookieHeader}`);
        const cookies = cookieHeader.split(';').map(c => c.trim());
        for (const cookie of cookies) {
          const [name, value] = cookie.split('=');
          if (name === key && value) {
            console.log(`Found ${key} in Cookie header: ${value}`);
            return Promise.resolve(value);
          }
        }
      }
    } catch (error) {
      console.error('Error parsing Cookie header:', error);
    }
    
    return Promise.resolve(null);
  }

  async set(key: string, value: string): Promise<void> {
    // Use this.settings from the base class
    this.res.cookie(key, value, this.settings);
  }

  async delete(key: string): Promise<void> {
    // Use this.settings from the base class
    this.res.clearCookie(key, this.settings);
  }
}

// Add Civic Auth middleware before routes
// Add CivicAuth properties via type intersection in middleware, not by extending Request interface
type CivicAuthRequest = Request & {
  storage?: ExpressCookieStorage;
  civicAuth?: CivicAuth;
};

interface CivicAuthResponse extends Response {}

app.use(
  '/',
  ((
    req: CivicAuthRequest,
    res: CivicAuthResponse,
    next: NextFunction
  ) => {
    try {
      req.storage = new ExpressCookieStorage(req, res);

      // Validate config before creating CivicAuth
      if (!config.clientId) {
        console.error('Config validation failed - clientId is missing');
        return next(new Error('Civic Auth configuration error'));
      }

      req.civicAuth = new CivicAuth(req.storage, config);
      console.log(
        'Civic Auth initialized successfully with client ID:',
        config.clientId?.substring(0, 10) + '...'
      );
      next();
    } catch (error) {
      console.error('Error initializing Civic Auth:', error);
      next(error);
    }
  }) as express.RequestHandler
);

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
