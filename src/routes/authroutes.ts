import { Request, Response, Router} from 'express';
const router = Router();

router.get('/admin/hello', async (req: Request, res: Response) => {
  const user = await req.civicAuth.getUser();
  res.send(`Hello, ${user?.name}!`);
});

// Test endpoint for Civic Auth
router.get('/test', async (req: Request, res: Response) => {
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
});

export default router;