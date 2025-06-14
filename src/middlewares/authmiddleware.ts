import { Request, Response, NextFunction } from 'express';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Auth middleware checking login status');
    console.log('Cookies in request:', req.cookies);
    console.log('Cookie header:', req.headers.cookie);
    
    const isLoggedIn = await req.civicAuth.isLoggedIn();
    console.log('Is logged in?', isLoggedIn);
    
    if (!isLoggedIn) {
      // For debugging only in development
      if (process.env.NODE_ENV !== 'production' && req.headers['x-debug-auth'] === 'true') {
        console.log('Debug auth enabled, bypassing authentication');
        return next();
      }
      return res.status(401).json({ error: 'Unauthorized - Please log in' });
    }
    
    // Add user info to request for route handlers
    try {
      const user = await req.civicAuth.getUser();
      console.log('User info:', user);
    } catch (userError) {
      console.error('Error getting user info:', userError);
    }
    
    return next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ error: 'Authentication error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};
