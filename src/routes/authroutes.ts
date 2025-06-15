import { Request, Response, Router } from 'express';
import { 
  handleCivicAuthSuccess, 
  handleLogout, 
  getCurrentUser, 
  updateUserProfile
} from '../controllers/authcontroller.js';

const router = Router();

// Async handler utility
const asyncHandler = (fn: any) => (req: Request, res: Response, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Login route - Build and redirect to Civic Auth login URL
router.get('/login', asyncHandler(async (req: Request, res: Response) => {
  try {
    const url = await req.civicAuth.buildLoginUrl();
    res.redirect(url.toString());
  } catch (error) {
    console.error('Error building login URL:', error);
    res.status(500).json({
      error: 'Failed to initiate login',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}));

// Logout route - Handle internal logout then redirect to Civic Auth logout
router.get('/logout', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Handle our internal logout logic first.
    // This function should now be async and not send a response itself.
    await handleLogout(req, res);
    
    // Then redirect to Civic Auth logout if response hasn't been sent by handleLogout (e.g. due to critical error)
    if (!res.headersSent) {
      const url = await req.civicAuth.buildLogoutRedirectUrl();
      res.redirect(url.toString());
    }
  } catch (error) {
    console.error('Error during logout route processing:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to logout',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
}));

// OAuth callback route - Handle the OAuth response from Civic and register user
router.get('/callback', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query as { code: string; state: string };
    
    if (!code || !state) {
      return res.status(400).json({
        error: 'Missing required OAuth parameters (code or state)'
      });
    }
    
    // Resolve OAuth with Civic first
    await req.civicAuth.resolveOAuthAccessCode(code, state);
    
    // Then handle user registration/login in our database
    await handleCivicAuthSuccess(req, res);
    
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'OAuth callback failed',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
}));

// Admin hello route (requires authentication)
router.get('/admin/hello', asyncHandler(async (req: Request, res: Response) => {
  try {
    const user = await req.civicAuth.getUser();
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

// Test endpoint for Civic Auth (requires authentication)
router.get('/test', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Debug information
    const cookieHeader = req.headers.cookie;
    const parsedCookies = req.cookies;
    const authStorage = req.storage;
    
    // Check if tokens exist
    const accessToken = await authStorage.get('access_token');
    const idToken = await authStorage.get('id_token');
    const refreshToken = await authStorage.get('refresh_token');
    
    // Check login status
    const isLoggedIn = await req.civicAuth.isLoggedIn();
    const user = isLoggedIn ? await req.civicAuth.getUser() : null;
    
    res.json({
      isLoggedIn,
      user,
      message: isLoggedIn ? 'Successfully authenticated with Civic' : 'Not authenticated with Civic',
      debug: {
        cookieHeader,
        parsedCookies,
        tokensFound: {
          accessToken: !!accessToken,
          idToken: !!idToken, 
          refreshToken: !!refreshToken
        }
      }
    });
  } catch (error) {
    console.error('Error in Civic Auth test endpoint:', error);
    res.status(500).json({
      error: 'Civic Auth test failed',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}));

// User profile endpoints
router.get('/me', asyncHandler(getCurrentUser));
router.put('/profile', asyncHandler(updateUserProfile));

// Check authentication status (public route)
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  try {
    const isLoggedIn = await req.civicAuth.isLoggedIn();
    res.json({
      isAuthenticated: isLoggedIn,
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
      'GET /auth/login',
      'GET /auth/logout', 
      'GET /auth/callback',
      'GET /api/auth/status',
      'GET /api/auth/me',
      'GET /api/auth/test',
      'UPDATE /api/auth/profile',
      'GET /api/auth/admin/hello'
    ],
    civicAuthConfigured: !!req.civicAuth
  });
}));

export default router;