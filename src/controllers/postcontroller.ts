import { Request, Response } from 'express';
import { uploadToCloudinary } from '../utils/cloudinaryConfig.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import fs from 'fs';

// Create a new post
export const createPost = async (req, res) => {
  try {
    // Get user information
    const user = await req.civicAuth.getUser();
    if (!user?.email) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const existingUser = await User.findOne({ email: user.email });
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found in database' });
    }

    // Check if post content exists
    if (!req.body.content && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ message: 'Post must contain content or attachments' });
    }

    const attachments = [];
    
    // Upload attachments to Cloudinary if any
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.path, 'bengali_heritage_posts');
          attachments.push({
            url: result.secure_url,
            publicId: result.public_id,
            type: file.mimetype.startsWith('image/') ? 'image' : 'document',
            originalName: file.originalname
          });
        } catch (error) {
          console.error(`Error uploading attachment ${file.originalname}:`, error);
        } finally {
          // Clean up the local file
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }
    }

    // Parse tags
    let tags = [];
    if (req.body.tags) {
      tags = Array.isArray(req.body.tags) 
        ? req.body.tags 
        : req.body.tags.split(',').map(tag => tag.trim());
    }

    // Create the post
    const newPost = new Post({
      userId: existingUser._id,
      title: req.body.title || 'Untitled Post',
      content: req.body.content || '',
      attachments,
      tags,
      timestamp: Date.now(),
      likes: [],
      comments: [],
      status: req.body.status || 'published'
    });

    const savedPost = await newPost.save();

    res.status(201).json({
      message: 'Post created successfully',
      data: savedPost
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all posts (with pagination)
export const getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const query = { status: 'published' }; // Only published posts by default
    
    // Add filters if needed
    if (req.query.userId) query.userId = req.query.userId;
    if (req.query.tag) query.tags = req.query.tag;
    
    // If requesting user is admin or viewing own posts, allow seeing drafts
    if (req.query.showAll === 'true') {
      const user = await req.civicAuth.getUser();
      const existingUser = await User.findOne({ email: user.email });
      
      if (existingUser && (existingUser.role === 'admin' || existingUser._id.toString() === req.query.userId)) {
        delete query.status;
      }
    }
    
    const totalCount = await Post.countDocuments(query);
    const posts = await Post.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email');
    
    res.status(200).json({
      data: posts,
      pagination: {
        total: totalCount,
        page,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({
      message: 'Error fetching posts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get a single post by ID
export const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('userId', 'name email');
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Check if post is published or user has access
    if (post.status !== 'published') {
      const user = await req.civicAuth.getUser();
      const existingUser = await User.findOne({ email: user.email });
      
      if (!existingUser || 
          (existingUser.role !== 'admin' && 
           post.userId.toString() !== existingUser._id.toString())) {
        return res.status(403).json({ message: 'Access denied to this post' });
      }
    }
    
    res.status(200).json({ data: post });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({
      message: 'Error fetching post',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update a post
export const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Check ownership
    const user = await req.civicAuth.getUser();
    const existingUser = await User.findOne({ email: user.email });
    
    if (!existingUser || 
        (existingUser.role !== 'admin' && 
         post.userId.toString() !== existingUser._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to update this post' });
    }
    
    // Handle new attachments if provided
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.path, 'bengali_heritage_posts');
          post.attachments.push({
            url: result.secure_url,
            publicId: result.public_id,
            type: file.mimetype.startsWith('image/') ? 'image' : 'document',
            originalName: file.originalname
          });
        } catch (error) {
          console.error(`Error uploading attachment ${file.originalname}:`, error);
        } finally {
          // Clean up the local file
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }
    }
    
    // Handle attachment deletions
    if (req.body.removeAttachments) {
      const attachmentsToRemove = Array.isArray(req.body.removeAttachments) 
        ? req.body.removeAttachments 
        : [req.body.removeAttachments];
      
      for (const attachmentId of attachmentsToRemove) {
        const attachment = post.attachments.id(attachmentId);
        if (attachment && attachment.publicId) {
          await deleteFromCloudinary(attachment.publicId);
        }
      }
      
      post.attachments = post.attachments.filter(
        attachment => !attachmentsToRemove.includes(attachment._id.toString())
      );
    }
    
    // Handle other updates
    if (req.body.title) post.title = req.body.title;
    if (req.body.content) post.content = req.body.content;
    if (req.body.status) post.status = req.body.status;
    
    if (req.body.tags) {
      post.tags = Array.isArray(req.body.tags) 
        ? req.body.tags 
        : req.body.tags.split(',').map(tag => tag.trim());
    }
    
    // Update the post
    await post.save();
    
    res.status(200).json({
      message: 'Post updated successfully',
      data: post
    });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({
      message: 'Error updating post',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete a post
export const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Check ownership
    const user = await req.civicAuth.getUser();
    const existingUser = await User.findOne({ email: user.email });
    
    if (!existingUser || 
        (existingUser.role !== 'admin' && 
         post.userId.toString() !== existingUser._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }
    
    // Delete attachments from Cloudinary
    for (const attachment of post.attachments) {
      if (attachment.publicId) {
        await deleteFromCloudinary(attachment.publicId);
      }
    }
    
    // Delete from database
    await Post.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({
      message: 'Error deleting post',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};