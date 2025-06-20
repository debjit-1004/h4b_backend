import { Request, Response, Router } from 'express';
import { 
  handleGoogleAuthSuccess, 
  handleLogout, 
  getCurrentUser, 
  updateUserProfile
} from '../controllers/authcontroller.js';
import passport from 'passport';
import User from '../models/User.js';

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

// Handle Google OAuth token from mobile app
router.post('/google/mobile', async (req: Request, res: Response) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ 
        error: 'Missing access token',
        message: 'Google access token is required'
      });
    }

    // Verify the token with Google
    const response = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
    
    if (!response.ok) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Could not verify Google access token'
      });
    }

    const userData = await response.json();
    
    // Find or create user
    let user = await User.findOne({ googleId: userData.sub });
    
    if (!user) {
      // Check if user with same email exists
      if (userData.email) {
        user = await User.findOne({ email: userData.email });
        
        if (user) {
          // Update existing user with Google ID
          user.googleId = userData.sub;
          await user.save();
        }
      }
      
      // If user still not found, create new user
      if (!user) {
        user = new User({
          googleId: userData.sub,
          name: userData.name || 'Heritage User',
          email: userData.email || `user-${userData.sub}@example.com`,
          profilePicture: userData.picture
        });
        
        await user.save();
      }
    }    // Log in the user (manually create session without using passport login)
    // In a real app, you would generate a JWT token here
    const userObj = {
      id: user._id,
      name: user.name,
      email: user.email,
      googleId: user.googleId,
      profilePicture: user.profilePicture
    };
    
    // Return user data and token
    return res.status(200).json({
      message: 'Login successful',
      user: userObj,
      token: 'mobileapp-' + accessToken.substring(0, 10) // Simplified token for demo
    });
  } catch (error) {
    console.error('Error handling mobile Google auth:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router;