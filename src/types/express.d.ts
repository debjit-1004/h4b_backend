// types/express.d.ts
import { CookieStorage, CivicAuth } from '@civic/auth/server';

declare global {
  namespace Express {
    interface Request {
      storage: CookieStorage;
      civicAuth: CivicAuth;
    }
  }
}