import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import cors from 'cors';
import router from './routes/index.js';
import { CookieStorage, CivicAuth } from '@civic/auth/server';
import cookieParser from 'cookie-parser';
import { config } from './authConfig.js';
import { authMiddleware } from './middlewares/authmiddleware.js';
import authrouter from './routes/authroutes.js';

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(morgan('dev'));
app.use(cors());
app.use(cookieParser());

class ExpressCookieStorage extends CookieStorage {
  constructor(private req: Request, private res: Response) {
    super({
      secure: false
    })
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
    await this.res.cookie(key, value, this.settings);
  }

  async delete(key: string): Promise<void> {
    this.res.clearCookie(key, this.settings);
  }
}

// Add Civic Auth middleware before routes
app.use((req, res, next) => {
  // add an instance of the cookie storage and civicAuth api to each request
  try {
    req.storage = new ExpressCookieStorage(req, res);
    req.civicAuth = new CivicAuth(req.storage, config);
    console.log('Civic Auth initialized successfully with client ID:', config.clientId);
    next();
  } catch (error) {
    console.error('Error initializing Civic Auth:', error);
    next(error);
  }
});

//login
app.get('/login', async (req: Request, res: Response) => {
  const url = await req.civicAuth.buildLoginUrl();

  res.redirect(url.toString());
});

//logout
app.get('/auth/logout', async (req: Request, res: Response) => {
  const url = await req.civicAuth.buildLogoutRedirectUrl();
  res.redirect(url.toString());
});

//callback
app.get('/auth/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query as { code: string; state: string };

  await req.civicAuth.resolveOAuthAccessCode(code, state);
  res.redirect('/');
});

// Public routes
app.get('/', (req : Request, res : Response) => {
  res.json({ message: 'Sorbonash backend running' });
});

// Apply middleware to specific routes that need authentication
app.use('/api', (req, res, next) => {
  authMiddleware(req, res, next);
}, router);

app.use('/api/auth', (req, res, next) => {
  authMiddleware(req, res, next);
}, authrouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
