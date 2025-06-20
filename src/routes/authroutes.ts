import { Request, Response, Router } from 'express';
import { 
  handleGoogleAuthSuccess, 
  handleLogout, 
  getCurrentUser, 
  updateUserProfile
} from '../controllers/authcontroller.js';
import passport from 'passport';

const router = Router();

// Async handler utility
const asyncHandler = (fn: any) => (req: Request, res: Response, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Google OAuth login route
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email'] 
}));

// Google OAuth callback route
router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/auth/login-failed'
  }),
  (req: Request, res: Response) => {
    // Successful authentication, redirect to home or another frontend page
    // Using handleGoogleAuthSuccess for additional processing
    handleGoogleAuthSuccess(req, res);
  }
);

// Login failed route
router.get('/login-failed', (req: Request, res: Response) => {
  res.status(401).json({
    error: 'Failed to authenticate with Google',
    message: 'Please try again or contact support'
  });
});

// Logout route
router.get('/logout', handleLogout);

// Get current user info
router.get('/me', asyncHandler(getCurrentUser));

// Update user profile
router.put('/profile', asyncHandler(updateUserProfile));

// Admin hello route (requires authentication)
router.get('/admin/hello', asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const user = req.user as Express.User;
    
    res.json({
      message: `Hello, ${user?.name || 'User'}!`,
      user: user
    });
  } catch (error) {
    console.error('Error getting user in admin hello:', error);
    res.status(500).json({
      error: 'Failed to get user information',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}));

// Check authentication status (public route)
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  try {
    res.json({
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.json({
      isAuthenticated: false,
      error: 'Failed to check authentication status'
    });
  }
}));

// Add a root auth route for debugging
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    message: 'Auth routes are working',
    availableRoutes: [
      'GET /auth/google',
      'GET /auth/google/callback',
      'GET /auth/login-failed',
      'GET /auth/logout', 
      'GET /api/auth/status',
      'GET /api/auth/me',
      'GET /api/auth/admin/hello',
      'PUT /api/auth/profile'
    ],
    passportConfigured: !!req.isAuthenticated
  });
}));

export default router;