import { Request, Response } from 'express';
import { uploadtocloudinary } from '../cloudconfig.js';
import MediaItem from '../models/MediaItem.js';
import Post from '../models/Post.js';
import CommunityEvent from '../models/CommunityEvent.js';
import User from '../models/User.js';
import { 
  generatePostSummary, 
  generatePostsCollectionSummary,
  generateCommunityEventSummary,
  generateCulturalHeritageSummary,
  generateCreativeStorySummary,
  generateTravelLocationSummary,
  MediaItem as GeminiMediaItem,
  Post as GeminiPost,
  CommunityEvent as GeminiCommunityEvent,
  SummaryOptions,
  generateSummaryType
} from '../utils/geminiSummary.js';
import mongoose from 'mongoose';

// Extend the Express Request type to include files
interface MulterRequest extends Request {
  files?: Express.Multer.File[]; // This should work if @types/multer is resolved
}

export const createposts = async (req: MulterRequest, res: Response) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        const posts = [];
        console.log(`Received ${req.files.length} files for upload.`);
        
        // Upload all files to Cloudinary
        for (let i = 0; i < req.files.length; i++) {
            const cloudinaryresult = await uploadtocloudinary(req.files[i].path);
            console.log(`Processing file ${i}:`, req.files[i].originalname);
            console.log(`Cloudinary result for file ${i}:`, req.files[i].path);
            console.log(`Cloudinary upload result for file ${i}:`, cloudinaryresult);
            console.log(`For file ${i} --- ${cloudinaryresult.message}`);
            
            if (cloudinaryresult.message !== "Success" || !cloudinaryresult.result?.url) {
                return res.status(500).json({ 
                    message: `Failed to upload file ${i}`, 
                    error: cloudinaryresult.error 
                });
            }
            
            const fileurl = cloudinaryresult.result.url;
            posts.push(fileurl);
            console.log("FILE URL", fileurl);
        }

        // Get user information
        const user = await req.civicAuth.getUser();
        if (!user?.name) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const existingUser = await User.findOne({ name: user.name });
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found in database' });
        }

        // Create media items for each uploaded file
        const createdMediaItems = [];
        
        for (let i = 0; i < posts.length; i++) {
            const fileUrl = posts[i];
            const file = req.files[i];
            
            // Determine media type based on file mimetype
            const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'photo';
            
            // Parse additional data from request body
            const title = req.body.title || `Heritage ${mediaType} ${Date.now()}`;
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
            
            // Parse tags if provided
            let tags: string[] = [];
            if (req.body.tags) {
                tags = Array.isArray(req.body.tags) ? req.body.tags : req.body.tags.split(',').map((tag: string) => tag.trim());
            }

            const newMediaItem = new MediaItem({
                userId: existingUser._id,
                uri: fileUrl,
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

            const savedMediaItem = await newMediaItem.save();
            createdMediaItems.push(savedMediaItem);
        }

        // Create a Post document that groups these media items
        const postTitle = req.body.postTitle || req.body.title || 'Heritage Collection';
        const postDescription = req.body.postDescription || req.body.description || '';
        const postTags = req.body.postTags ? 
            (Array.isArray(req.body.postTags) ? req.body.postTags : req.body.postTags.split(',').map((tag: string) => tag.trim())) 
            : [];

        // Parse location if provided
        let postLocation;
        if (req.body.latitude && req.body.longitude) {
            postLocation = {
                latitude: parseFloat(req.body.latitude),
                longitude: parseFloat(req.body.longitude),
                name: req.body.locationName || undefined
            };
        }

        const newPost = new Post({
            userId: existingUser._id,
            title: postTitle,
            description: postDescription,
            mediaItems: createdMediaItems.map(item => item._id),
            tags: postTags,
            location: postLocation,
            likes: [],
            comments: [],
            collections: [],
            featured: false,
            visibility: req.body.visibility || 'public'
        });

        const savedPost = await newPost.save();

        const summaryType = await generateSummaryType(createdMediaItems);
        console.log(`Determined summary type for post: ${summaryType}`);

        // Generate AI summary for the post (async, don't block response)
        generatePostSummaryAsync(savedPost, createdMediaItems, summaryType);

        res.status(201).json({
            message: 'Post created successfully',
            post: savedPost,
            mediaItems: createdMediaItems,
            count: createdMediaItems.length
        });

    } catch (error) {
        console.error('Error creating posts:', error);
        res.status(500).json({
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Async function to generate and save post summary
async function generatePostSummaryAsync(post: any, mediaItems: any[], summaryType: string) {
    try {
        // Convert database models to Gemini interface format
        const geminiMediaItems: GeminiMediaItem[] = mediaItems.map(item => ({
            url: item.uri,
            type: item.type === 'photo' ? 'image' : 'video',
            description: item.description
        }));

        const geminiPost: GeminiPost = {
            id: post._id.toString(),
            title: post.title,
            description: post.description,
            media: geminiMediaItems,
            tags: post.tags,
            location: post.location?.name,
            timestamp: post.createdAt,
            author: post.userId.toString()
        };

        const options: SummaryOptions = {
            style: 'detailed',
            language: 'bilingual',
            includeHashtags: true,
            maxLength: 300
        };

        let summary;
        let updateData: any = {};

        switch (summaryType) {
            case 'cultural':
                const culturalSummary = await generateCulturalHeritageSummary(
                    geminiMediaItems,
                    {
                        title: post.title,
                        location: post.location?.name,
                        culturalContext: 'Bengali heritage'
                    },
                    options
                );
                if (culturalSummary) {
                    updateData.culturalContext = {
                        significance: culturalSummary.culturalSignificance,
                        historicalContext: culturalSummary.historicalContext,
                        preservation: culturalSummary.preservation
                    };
                    updateData.aiSummary = {
                        summary: culturalSummary.summary,
                        hashtags: ['#heritage', '#culture', '#bengali'],
                        mood: 'respectful',
                        themes: ['cultural heritage'],
                        generatedAt: new Date(),
                        summaryType: 'cultural'
                    };
                }
                break;

            case 'creative':
                const creativeSummary = await generateCreativeStorySummary(
                    geminiMediaItems,
                    {
                        title: post.title,
                        theme: 'artistic expression'
                    },
                    options
                );
                if (creativeSummary) {
                    updateData.creativeContext = {
                        narrative: creativeSummary.narrative,
                        artisticElements: creativeSummary.artisticElements
                    };
                    updateData.aiSummary = {
                        summary: creativeSummary.summary,
                        hashtags: ['#creative', '#art', '#expression'],
                        mood: 'inspiring',
                        themes: creativeSummary.themes,
                        generatedAt: new Date(),
                        summaryType: 'creative'
                    };
                }
                break;

            case 'travel':
                const travelSummary = await generateTravelLocationSummary(
                    geminiMediaItems,
                    {
                        location: post.location?.name || 'Unknown location'
                    },
                    options
                );
                if (travelSummary) {
                    updateData.travelContext = {
                        attractions: travelSummary.attractions,
                        recommendations: travelSummary.recommendations,
                        travelTips: travelSummary.travelTips
                    };
                    updateData.aiSummary = {
                        summary: travelSummary.summary,
                        hashtags: ['#travel', '#explore', '#destination'],
                        mood: 'adventurous',
                        themes: ['travel', 'exploration'],
                        generatedAt: new Date(),
                        summaryType: 'travel'
                    };
                }
                break;

            default:
                summary = await generatePostSummary(geminiPost, options);
                if (summary) {
                    updateData.aiSummary = {
                        summary: summary.summary,
                        hashtags: summary.hashtags || [],
                        mood: summary.mood || 'neutral',
                        themes: ['general'],
                        generatedAt: new Date(),
                        summaryType: 'post'
                    };
                }
        }

        // Update the post with generated summary
        if (Object.keys(updateData).length > 0) {
            await Post.findByIdAndUpdate(post._id, updateData);
            console.log(`Summary generated for post: ${post._id}`);
        }

    } catch (error) {
        console.error('Error generating post summary:', error);
    }
}

// Get posts with optional filtering and summary
export const getPosts = async (req: Request, res: Response) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            userId, 
            featured, 
            summaryType,
            tags,
            location 
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        // Build filter
        const filter: any = { visibility: 'public' };
        
        if (userId) filter.userId = userId;
        if (featured === 'true') filter.featured = true;
        if (summaryType) filter['aiSummary.summaryType'] = summaryType;
        if (tags) filter.tags = { $in: (tags as string).split(',') };
        if (location) filter['location.name'] = new RegExp(location as string, 'i');

        const posts = await Post.find(filter)
            .populate('mediaItems')
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        const total = await Post.countDocuments(filter);

        res.json({
            posts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });

    } catch (error) {
        console.error('Error getting posts:', error);
        res.status(500).json({
            message: 'Error retrieving posts',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Generate summary for existing post
export const generatePostSummaryEndpoint = async (req: Request, res: Response) => {
    try {
        const { postId } = req.params;
        if (!postId) {
            return res.status(400).json({ message: 'Post ID is required' });
        }
        let summaryType;

        const post = await Post.findById(postId).populate('mediaItems');
        if(post){
            summaryType = await generateSummaryType(post.mediaItems);
            console.log(`Determined summary type for post ${postId}: ${summaryType}`);
        } 
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check if user owns the post or is admin
        const user = await req.civicAuth.getUser();
        if (!user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const existingUser = await User.findOne({ name: user.name });
        if (!existingUser) {
            return res.status(403).json({ message: 'Access denied' });
        }
        // Ensure both IDs are ObjectId for comparison
        const postUserId = typeof post.userId === 'object' && post.userId !== null && 'equals' in post.userId
            ? post.userId
            : new mongoose.Types.ObjectId(post.userId);
        const existingUserId = typeof existingUser._id === 'object' && existingUser._id !== null && 'equals' in existingUser._id
            ? existingUser._id
            : new mongoose.Types.ObjectId(String(existingUser._id));

        if (!postUserId.equals(String(existingUserId))) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Generate summary
        await generatePostSummaryAsync(post, post.mediaItems, summaryType as string);

        // Return updated post
        const updatedPost = await Post.findById(postId).populate('mediaItems');
        res.json({
            message: 'Summary generated successfully',
            post: updatedPost
        });

    } catch (error) {
        console.error('Error generating post summary:', error);
        res.status(500).json({
            message: 'Error generating summary',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Create community event
export const createCommunityEvent = async (req: Request, res: Response) => {
    try {
        const user = await req.civicAuth.getUser();
        if (!user?.name) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const existingUser = await User.findOne({ name: user.name });
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found in database' });
        }

        const {
            name,
            description,
            eventType,
            date,
            endDate,
            location,
            maxParticipants,
            registrationRequired,
            registrationDeadline,
            tags,
            culturalTags,
            visibility = 'public'
        } = req.body;

        const event = new CommunityEvent({
            organizerId: existingUser._id,
            name,
            description,
            eventType,
            date: new Date(date),
            endDate: endDate ? new Date(endDate) : undefined,
            location,
            maxParticipants,
            registrationRequired: registrationRequired || false,
            registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : undefined,
            tags: tags || [],
            culturalTags: culturalTags || [],
            visibility,
            participants: [],
            mediaItems: [],
            status: 'draft',
            likes: [],
            shares: 0,
            views: 0,
            feedback: []
        });

        const savedEvent = await event.save();

        res.status(201).json({
            message: 'Community event created successfully',
            event: savedEvent
        });

    } catch (error) {
        console.error('Error creating community event:', error);
        res.status(500).json({
            message: 'Error creating community event',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Generate summary for community event
export const generateEventSummary = async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const { options = {} } = req.body;

        const event = await CommunityEvent.findById(eventId).populate('mediaItems');
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Convert to Gemini format
        const geminiMediaItems: GeminiMediaItem[] = event.mediaItems.map((item: any) => ({
            url: item.uri,
            type: item.type === 'photo' ? 'image' : 'video',
            description: item.description
        }));

        const geminiEvent: GeminiCommunityEvent = {
            id: event._id.toString(),
            name: event.name,
            description: event.description,
            date: event.date,
            location: event.location.name,
            media: geminiMediaItems,
            participants: event.participants.map(p => p.toString()),
            eventType: event.eventType
        };

        const summaryOptions: SummaryOptions = {
            style: 'detailed',
            language: 'bilingual',
            maxLength: 400,
            ...options
        };

        const summary = await generateCommunityEventSummary(geminiEvent, summaryOptions);

        if (summary) {
            const updateData = {
                aiSummary: {
                    summary: summary.summary,
                    highlights: summary.highlights,
                    participation: summary.participation,
                    impact: summary.impact,
                    generatedAt: new Date()
                }
            };

            await CommunityEvent.findByIdAndUpdate(eventId, updateData);

            res.json({
                message: 'Event summary generated successfully',
                summary
            });
        } else {
            res.status(500).json({ message: 'Failed to generate summary' });
        }

    } catch (error) {
        console.error('Error generating event summary:', error);
        res.status(500).json({
            message: 'Error generating event summary',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Generate collection summary for multiple posts
export const generateCollectionSummary = async (req: Request, res: Response) => {
    try {
        const { postIds, options = {} } = req.body;

        if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
            return res.status(400).json({ message: 'Post IDs array is required' });
        }

        const posts = await Post.find({ _id: { $in: postIds } }).populate('mediaItems');

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