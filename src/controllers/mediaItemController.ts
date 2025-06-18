import { Request, Response } from 'express';
import { uploadToCloudinary } from '../utils/cloudinaryConfig.js';
import MediaItem from '../models/MediaItem.js';
import User from '../models/User.js';
import fs from 'fs';

// Create a new media item
export const createMediaItem = async (req: Request & { files?: Express.Multer.File[] }, res: Response) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    // Get user information
    const user = await req.civicAuth.getUser();
    if (!user?.email) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const existingUser = await User.findOne({ email: user.email });
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found in database' });
    }

    const mediaUrls = [];
    const createdMediaItems = [];
    
    // Upload all files to Cloudinary
    for (const file of req.files) {
      try {
        const result = await uploadToCloudinary(file.path, 'bengali_heritage_media');
        mediaUrls.push(result.secure_url);
        
        // Determine media type
        const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'photo';
        
        // Parse additional data
        const title = req.body.title || `Heritage ${mediaType}`;
        const description = req.body.description || '';
        const aspectRatio = req.body.aspectRatio ? parseFloat(req.body.aspectRatio) : undefined;
        
        // Parse location if provided
        let location;
        if (req.body.latitude && req.body.longitude) {
          location = {
            latitude: parseFloat(req.body.latitude),
            longitude: parseFloat(req.body.longitude),
            name: req.body.locationName || undefined
          };
        }
        
        // Parse tags
        let tags = [];
        if (req.body.tags) {
          tags = Array.isArray(req.body.tags) 
            ? req.body.tags 
            : req.body.tags.split(',').map(tag => tag.trim());
        }

        // Create and save the media item
        const newMediaItem = new MediaItem({
          userId: existingUser._id,
          uri: result.secure_url,
          publicId: result.public_id,
          type: mediaType,
          timestamp: Date.now(),
          aspectRatio,
          title,
          description,
          likes: [],
          comments: [],
          location,
          tags,
          collections: [],
          featured: false
        });

        const savedItem = await newMediaItem.save();
        createdMediaItems.push(savedItem);
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
      } finally {
        // Clean up the local file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    if (createdMediaItems.length === 0) {
      return res.status(500).json({ 
        message: 'Failed to create any media items' 
      });
    }

    res.status(201).json({
      message: 'Media items created successfully',
      data: createdMediaItems,
      count: createdMediaItems.length
    });
  } catch (error) {
    console.error('Error creating media items:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all media items (with pagination)
export const getMediaItems = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const query = {};
    // Add filters if needed
    if (req.query.userId) query.userId = req.query.userId;
    if (req.query.type) query.type = req.query.type;
    if (req.query.featured) query.featured = req.query.featured === 'true';
    
    const totalCount = await MediaItem.countDocuments(query);
    const mediaItems = await MediaItem.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email');
    
    res.status(200).json({
      data: mediaItems,
      pagination: {
        total: totalCount,
        page,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching media items:', error);
    res.status(500).json({
      message: 'Error fetching media items',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get a single media item by ID
export const getMediaItemById = async (req, res) => {
  try {
    const mediaItem = await MediaItem.findById(req.params.id)
      .populate('userId', 'name email');
    
    if (!mediaItem) {
      return res.status(404).json({ message: 'Media item not found' });
    }
    
    res.status(200).json({ data: mediaItem });
  } catch (error) {
    console.error('Error fetching media item:', error);
    res.status(500).json({
      message: 'Error fetching media item',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update a media item
export const updateMediaItem = async (req, res) => {
  try {
    const mediaItem = await MediaItem.findById(req.params.id);
    
    if (!mediaItem) {
      return res.status(404).json({ message: 'Media item not found' });
    }
    
    // Check ownership
    const user = await req.civicAuth.getUser();
    const existingUser = await User.findOne({ email: user.email });
    
    if (!existingUser || mediaItem.userId.toString() !== existingUser._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this media item' });
    }
    
    // Handle file update if provided
    if (req.file) {
      // Delete old file from Cloudinary if it exists
      if (mediaItem.publicId) {
        await deleteFromCloudinary(mediaItem.publicId);
      }
      
      // Upload new file
      const result = await uploadToCloudinary(req.file.path, 'bengali_heritage_media');
      req.body.uri = result.secure_url;
      req.body.publicId = result.public_id;
      
      // Clean up the local file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
    
    // Handle other updates
    if (req.body.tags && typeof req.body.tags === 'string') {
      req.body.tags = req.body.tags.split(',').map(tag => tag.trim());
    }
    
    if (req.body.latitude && req.body.longitude) {
      req.body.location = {
        latitude: parseFloat(req.body.latitude),
        longitude: parseFloat(req.body.longitude),
        name: req.body.locationName || mediaItem.location?.name
      };
      
      // Remove these from req.body so they don't conflict with the location object
      delete req.body.latitude;
      delete req.body.longitude;
      delete req.body.locationName;
    }
    
    // Update the media item
    const updatedMediaItem = await MediaItem.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    
    res.status(200).json({
      message: 'Media item updated successfully',
      data: updatedMediaItem
    });
  } catch (error) {
    console.error('Error updating media item:', error);
    res.status(500).json({
      message: 'Error updating media item',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete a media item
export const deleteMediaItem = async (req, res) => {
  try {
    const mediaItem = await MediaItem.findById(req.params.id);
    
    if (!mediaItem) {
      return res.status(404).json({ message: 'Media item not found' });
    }
    
    // Check ownership
    const user = await req.civicAuth.getUser();
    const existingUser = await User.findOne({ email: user.email });
    
    if (!existingUser || mediaItem.userId.toString() !== existingUser._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this media item' });
    }
    
    // Delete from Cloudinary if publicId exists
    if (mediaItem.publicId) {
      await deleteFromCloudinary(mediaItem.publicId);
    }
    
    // Delete from database
    await MediaItem.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ message: 'Media item deleted successfully' });
  } catch (error) {
    console.error('Error deleting media item:', error);
    res.status(500).json({
      message: 'Error deleting media item',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
