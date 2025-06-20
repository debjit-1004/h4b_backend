import { Request, Response, NextFunction } from 'express';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Auth middleware checking login status');
    
    // Using Passport's isAuthenticated method (added by Passport during initialization)
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      // For debugging only in development
      if (process.env.NODE_ENV !== 'production' && req.headers['x-debug-auth'] === 'true') {
        console.log('Debug auth enabled, bypassing authentication');
        return next();
      }
      return res.status(401).json({ error: 'Unauthorized - Please log in' });
    }
    
    // User is already attached to request by Passport
    console.log('User info:', req.user);
    
    return next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ error: 'Authentication error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};
