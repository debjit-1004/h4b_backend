import { Request, Response } from 'express';
import { uploadtocloudinary } from '../cloudconfig.js';
import MediaItem from '../models/MediaItem.js';
import User from '../models/User.js';

export const createposts = async (req: Request & { files?: Express.Multer.File[] }, res: Response) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        const posts = [];
        
        // Upload all files to Cloudinary
        for (let i = 0; i < req.files.length; i++) {
            const cloudinaryresult = await uploadtocloudinary(req.files[i].path);
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

        res.status(201).json({
            message: 'Media items created successfully',
            data: createdMediaItems,
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