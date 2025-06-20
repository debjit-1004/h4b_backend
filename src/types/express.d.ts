// types/express.d.ts
import { IUser } from '../models/User.js';

declare global {
  namespace Express {
    interface User extends IUser {
      _id: string;
      name?: string;
      email: string;
      googleId?: string;
    }
  }
}

export {};