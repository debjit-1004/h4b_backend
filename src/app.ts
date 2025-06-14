import express, { Request, Response, NextFunction }from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import cors from 'cors';
import router from './routes/index.js';
import { CookieStorage, CivicAuth } from '@civic/auth/server';
import cookieParser from 'cookie-parser';
import { config } from './authConfig.js';
import {authMiddleware} from './middlewares/authmiddleware.js';
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
    return Promise.resolve(this.req.cookies[key] ?? null);
  }

  async set(key: string, value: string): Promise<void> {
    await this.res.cookie(key, value, this.settings);
  }

  async delete(key: string): Promise<void> {
    this.res.clearCookie(key, this.settings);
  }
}

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

app.use('/', authMiddleware);

//callback
app.get('/auth/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query as { code: string; state: string };

  await req.civicAuth.resolveOAuthAccessCode(code, state);
  res.redirect('/');
});

app.get('/', (req : Request, res : Response) => {
  res.json({ message: 'Sorbonash backend running' });
});

// Routes
app.use('/api', router);

app.use('/api/auth', authrouter);

app.use((req, res, next) => {
  // add an instance of the cookie storage and civicAuth api to each request
  req.storage = new ExpressCookieStorage(req, res);
  req.civicAuth = new CivicAuth(req.storage, config);
  next();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
