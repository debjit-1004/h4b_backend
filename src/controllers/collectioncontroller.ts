import { Request, Response } from 'express';
import Collection from '../models/Collection.js';
import { CollectionMember, CollectionMedia } from '../models/CollectionRelations.js';
import MediaItem from '../models/MediaItem.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import CollectionUtils from '../models/CollectionUtils.js';
import { 
  generatePostsCollectionSummary,
  Post as GeminiPost,
  MediaItem as GeminiMediaItem,
  SummaryOptions
} from '../utils/geminiSummary.js';
import mongoose from 'mongoose';

// Create a new collection
export const createCollection = async (req: Request, res: Response) => {
    try {
        const { name, description, isPrivate, slug, coverImage, icon } = req.body;
        
        const user = await req.civicAuth.getUser();
        if (!user?.name) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const existingUser = await User.findOne({ name: user.name });
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found in database' });
        }
        
        // Check if collection with same name already exists
        const existingCollection = await Collection.findOne({ name });
        if (existingCollection) {
            return res.status(400).json({ message: 'Collection with this name already exists' });
        }
        
        const collection = await CollectionUtils.createCollection(
            name,
            description,
            existingUser._id as mongoose.Types.ObjectId,
            isPrivate,
            slug,
            coverImage,
            icon
        );
        
        res.status(201).json({
            message: 'Collection created successfully',
            collection
        });
        
    } catch (error) {
        console.error('Error creating collection:', error);
        res.status(500).json({
            message: 'Error creating collection',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Get all collections (with filtering)
export const getCollections = async (req: Request, res: Response) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            userId,
            featured = 'false',
            isPrivate = 'false',
            search
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        // Build filter
        const filter: any = {};
        
        if (userId) {
            // Find collections where user is a member
            const memberships = await CollectionMember.find({ userId });
            const collectionIds = memberships.map(m => m.collectionId);
            filter._id = { $in: collectionIds };
        }
        
        if (featured === 'true') filter.featured = true;
        if (isPrivate === 'true') filter.isPrivate = true;
        if (isPrivate === 'false') filter.isPrivate = false;
        
        // If search term provided, use text search
        let collections;
        if (search) {
            collections = await Collection.find(
                { $text: { $search: search as string }, ...filter },
                { score: { $meta: 'textScore' } }
            )
            .sort({ score: { $meta: 'textScore' } })
            .skip(skip)
            .limit(limitNum);
        } else {
            collections = await Collection.find(filter)
                .sort({ memberCount: -1 })
                .skip(skip)
                .limit(limitNum);
        }

        const total = search 
            ? await Collection.countDocuments({ $text: { $search: search as string }, ...filter })
            : await Collection.countDocuments(filter);

        res.json({
            collections,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });

    } catch (error) {
        console.error('Error getting collections:', error);
        res.status(500).json({
            message: 'Error retrieving collections',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Get a collection by ID or slug
export const getCollectionByIdOrSlug = async (req: Request, res: Response) => {
    try {
        const { identifier } = req.params; // can be ID or slug
        
        // Try to find by ID first
        let collection;
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            collection = await Collection.findById(identifier);
        }
        
        // If not found by ID, try by slug
        if (!collection) {
            collection = await Collection.findOne({ slug: identifier });
        }
        
        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }
        
        // Get media items in this collection
        const mediaItems = await CollectionUtils.getCollectionMedia(collection._id as mongoose.Types.ObjectId);
        
        // Get member information
        const members = await CollectionMember.find({ collectionId: collection._id })
            .populate('userId', 'name email');
        
        res.json({
            collection,
            mediaItems,
            members
        });
        
    } catch (error) {
        console.error('Error getting collection:', error);
        res.status(500).json({
            message: 'Error retrieving collection',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Add media to collection
export const addMediaToCollection = async (req: Request, res: Response) => {
    try {
        const { collectionId } = req.params;
        const { mediaId, featured = false } = req.body;
        
        const user = await req.civicAuth.getUser();
        if (!user?.name) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const existingUser = await User.findOne({ name: user.name });
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found in database' });
        }
        
        // Check if user is a member of this collection
        const membership = await CollectionMember.findOne({
            collectionId,
            userId: existingUser._id
        });
        
        if (!membership) {
            return res.status(403).json({ message: 'You are not a member of this collection' });
        }
        
        // Add media to collection
        const result = await CollectionUtils.addMediaToCollection(
            new mongoose.Types.ObjectId(collectionId),
            new mongoose.Types.ObjectId(mediaId),
            existingUser._id as mongoose.Types.ObjectId,
            featured
        );
        
        res.json({
            message: 'Media added to collection successfully',
            result
        });
        
    } catch (error) {
        console.error('Error adding media to collection:', error);
        res.status(500).json({
            message: 'Error adding media to collection',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Remove media from collection
export const removeMediaFromCollection = async (req: Request, res: Response) => {
    try {
        const { collectionId, mediaId } = req.params;
        
        const user = await req.civicAuth.getUser();
        if (!user?.name) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const existingUser = await User.findOne({ name: user.name });
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found in database' });
        }
        
        // Check if user is a member with sufficient rights
        const membership = await CollectionMember.findOne({
            collectionId,
            userId: existingUser._id
        });
        
        if (!membership || (membership.role !== 'admin' && membership.role !== 'moderator')) {
            return res.status(403).json({ message: 'You do not have permission to remove media from this collection' });
        }
        
        // Remove media from collection
        await CollectionUtils.removeMediaFromCollection(
            new mongoose.Types.ObjectId(collectionId),
            new mongoose.Types.ObjectId(mediaId)
        );
        
        res.json({
            message: 'Media removed from collection successfully'
        });
        
    } catch (error) {
        console.error('Error removing media from collection:', error);
        res.status(500).json({
            message: 'Error removing media from collection',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Generate collection summary for multiple posts
export const generateCollectionSummary = async (req: Request, res: Response) => {
    try {
        const { postIds, collectionId, options = {} } = req.body;

        // If collectionId is provided, get all posts in that collection
        let posts;
        if (collectionId) {
            const mediaItems = await CollectionUtils.getCollectionMedia(
                new mongoose.Types.ObjectId(collectionId),
                100 // limit to 100 items for performance
            );
            
            const mediaIds = mediaItems.map(item => item._id);
            posts = await Post.find({
                mediaItems: { $in: mediaIds }
            }).populate('mediaItems');
        } else if (postIds && Array.isArray(postIds) && postIds.length > 0) {
            // Otherwise use directly provided post IDs
            posts = await Post.find({ _id: { $in: postIds } }).populate('mediaItems');
        } else {
            return res.status(400).json({ 
                message: 'Either collectionId or postIds array is required' 
            });
        }

        if (posts.length === 0) {
            return res.status(404).json({ message: 'No posts found for analysis' });
        }

        // Convert to Gemini format
        const geminiPosts: GeminiPost[] = posts.map(post => ({
            id: post._id.toString(),
            title: post.title,
            description: post.description,
            media: post.mediaItems.map((item: any) => ({
                url: item.uri,
                type: item.type === 'photo' ? 'image' : 'video',
                description: item.description
            })),
            tags: post.tags,
            location: post.location?.name,
            timestamp: post.createdAt,
            author: post.userId.toString()
        }));

        const summaryOptions: SummaryOptions = {
            style: 'detailed',
            language: 'bilingual',
            maxLength: 500,
            ...options
        };

        const summary = await generatePostsCollectionSummary(geminiPosts, summaryOptions);

        res.json({
            message: 'Collection summary generated successfully',
            summary,
            postsAnalyzed: posts.length
        });

    } catch (error) {
        console.error('Error generating collection summary:', error);
        res.status(500).json({
            message: 'Error generating collection summary',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Join a collection (add user as member)
export const joinCollection = async (req: Request, res: Response) => {
    try {
        const { collectionId } = req.params;
        
        const user = await req.civicAuth.getUser();
        if (!user?.name) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const existingUser = await User.findOne({ name: user.name });
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found in database' });
        }
        
        // Check if collection exists and is not private
        const collection = await Collection.findById(collectionId);
        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }
        
        if (collection.isPrivate) {
            return res.status(403).json({ message: 'This collection is private' });
        }
        
        // Add user as member
        await CollectionUtils.addMemberToCollection(
            new mongoose.Types.ObjectId(collectionId),
            existingUser._id as mongoose.Types.ObjectId,
            'member'
        );
        
        res.json({ message: 'Successfully joined collection' });
        
    } catch (error) {
        console.error('Error joining collection:', error);
        res.status(500).json({
            message: 'Error joining collection',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Leave a collection (remove user as member)
export const leaveCollection = async (req: Request, res: Response) => {
    try {
        const { collectionId } = req.params;
        
        const user = await req.civicAuth.getUser();
        if (!user?.name) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const existingUser = await User.findOne({ name: user.name });
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found in database' });
        }
        
        // Check if user is not the creator (creators can't leave)
        const collection = await Collection.findById(collectionId);
        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }
        
        if (collection.createdBy.equals(String(existingUser._id))) {
            return res.status(400).json({ 
                message: 'Collection creator cannot leave. Transfer ownership first.' 
            });
        }
        
        // Remove user as member
        await CollectionUtils.removeMemberFromCollection(
            new mongoose.Types.ObjectId(collectionId),
            existingUser._id as mongoose.Types.ObjectId
        );
        
        res.json({ message: 'Successfully left collection' });
        
    } catch (error) {
        console.error('Error leaving collection:', error);
        res.status(500).json({
            message: 'Error leaving collection',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
