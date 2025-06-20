import { Request, Response } from 'express';
import User from '../models/User.js';
import * as bcrypt from 'bcrypt';
import { config } from '../authConfig.js';
// var GoogleStrategy = require('passport-google-oauth20').Strategy;

/**
 * Handle successful Google OAuth login
 * Called after the OAuth callback to ensure user exists in our database
 */
export const handleGoogleAuthSuccess = (req: Request, res: Response) => {
  try {
    // User is already attached to the request by Passport
    if (!req.user) {
      return res.status(401).json({ 
        error: 'No user information from Google Auth' 
      });
    }

    const user = req.user as Express.User;
    
    // Check if redirect is requested via query parameter or header
    const redirectRequested = req.query.redirect === 'true' || 
                             req.headers['x-want-redirect'] === 'true';
    
    if (redirectRequested) {
      // Redirect to frontend home page or dashboard
      const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(redirectUrl);
    }

    // Otherwise return JSON response
    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        googleId: user.googleId
      }
    });
  } catch (error) {
    console.error('Error handling Google Auth success:', error);
    return res.status(500).json({
      error: 'Failed to process user login',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Handle user logout
 */
export const handleLogout = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get user info before logout for logging
    const userEmail = req.user?.email;
    
    // Passport logout
    req.logout((err: Error) => {
      if (err) {
        console.error('Error during logout:', err);
        return res.status(500).json({
          error: 'Failed to logout',
          details: err instanceof Error ? err.message : 'Unknown error'
        });
      }
      
      console.log(`User logged out: ${userEmail || 'Unknown user'}`);
      
      // Return a JSON response
      res.status(200).json({
        message: 'Logged out successfully',
        redirectUrl: config.postLogoutRedirectUrl
      });
    });
    
    if (userEmail) {
      console.log(`User logging out: ${userEmail}`);
      
      // Optional: Update user's last activity
      try {
        await User.findOneAndUpdate(
          { email: userEmail },
          { lastLogout: new Date() }
        );
      } catch (updateError) {
        console.error('Error updating user logout time:', updateError);
        // Don't fail the logout for this
      }
    } else {
      console.log('Logout initiated for a user not identified via session or session already cleared.');
    }
  } catch (error) {
    console.error('Error in handleLogout:', error);
    res.status(500).json({
      error: 'Failed to logout',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get current user info
 */
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const user = req.user as Express.User;
    
    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    res.status(500).json({
      error: 'Failed to get current user',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const user = req.user as Express.User;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      user._id, 
      { name },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({
      error: 'Failed to update profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
