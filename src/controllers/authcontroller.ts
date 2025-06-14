import { Request, Response } from 'express';
import User from '../models/User.js';
import bcrypt from 'bcrypt';

/**
 * Handle user registration/login after successful Civic Auth
 * This is called after the OAuth callback to ensure user exists in our database
 */
export const handleCivicAuthSuccess = async (req: Request, res: Response) => {
  try {
    // Get user info from Civic Auth
    const civicUser = await req.civicAuth.getUser();
    
    if (!civicUser) {
      return res.status(401).json({ 
        error: 'No user information from Civic Auth' 
      });
    }

    // Extract user info from Civic Auth response
    const { 
      email, 
      name = 'Heritage User', 
      id: civicId 
    } = civicUser;

    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required from Civic Auth' 
      });
    }

    // Check if user already exists in our database
    let existingUser = await User.findOne({ email });

    if (existingUser) {
      // User exists, just log the successful login
      console.log(`Existing user logged in: ${email}`);
      
      return res.status(200).json({
        message: 'Login successful',
        user: {
          id: existingUser._id,
          name: existingUser.name,
          email: existingUser.email,
          createdAt: existingUser.createdAt
        },
        isNewUser: false
      });
    }

    // Create new user in our database
    // Generate a temporary password hash (since we're using Civic Auth)
    const tempPassword = `civic_auth_${civicId}_${Date.now()}`;
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword, // This won't be used for login, just for schema compliance
    });

    const savedUser = await newUser.save();
    console.log(`New user created: ${email}`);

    return res.status(201).json({
      message: 'User created and logged in successfully',
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        createdAt: savedUser.createdAt
      },
      isNewUser: true
    });

  } catch (error) {
    console.error('Error handling Civic Auth success:', error);
    return res.status(500).json({
      error: 'Failed to process user login',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Handle user logout
 * Clean up any additional user session data if needed
 */
export const handleLogout = async (req: Request, res: Response) => {
  try {
    // Get user info before logout for logging
    const civicUser = await req.civicAuth.getUser();
    
    if (civicUser?.email) {
      console.log(`User logged out: ${civicUser.email}`);
      
      // Optional: Update user's last activity
      try {
        await User.findOneAndUpdate(
          { email: civicUser.email },
          { lastLogout: new Date() }
        );
      } catch (updateError) {
        console.error('Error updating user logout time:', updateError);
        // Don't fail the logout for this
      }
    }

    return res.status(200).json({
      message: 'Logout successful',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error during logout:', error);
    return res.status(500).json({
      error: 'Error during logout',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get current user information from our database
 */
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const civicUser = await req.civicAuth.getUser();
    
    if (!civicUser?.email) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await User.findOne({ email: civicUser.email })
      .select('-password'); // Exclude password from response

    if (!user) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      civicInfo: {
        name: civicUser.name,
        email: civicUser.email,
        id: civicUser.id
      }
    });

  } catch (error) {
    console.error('Error getting current user:', error);
    return res.status(500).json({
      error: 'Failed to get user information',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update user profile information
 */
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const civicUser = await req.civicAuth.getUser();
    
    if (!civicUser?.email) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const updatedUser = await User.findOneAndUpdate(
      { email: civicUser.email },
      { name: name.trim() },
      { new: true, select: '-password' }
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
