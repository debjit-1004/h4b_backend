import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';

// Cloudinary configuration 
cloudinary.config({ 
    cloud_name:process.env.CLOUD_NAME, 
    api_key:process.env.CLOUD_API_KEY,
    api_secret:process.env.CLOUD_API_SECRET
  });

export const uploadtocloudinary=async(localfilepath : string)=>{
    const mainFolderName="BANGALIANA";
    // folder to set when it is uploaded to cloudinary 
    try {
        const result = await cloudinary.uploader.upload(localfilepath, {
            resource_type: "auto",
            folder:mainFolderName,
            allowed_formats:["jpg", "pdf", "png", "mp4", "jpeg"]
        });
        fs.unlinkSync(localfilepath); // Remove file from local uploads folder
        return {
            message: "Success",
            result : result
        };
    } catch (err) {
        fs.unlinkSync(localfilepath);
        return {
            message: "Failed",
            error: err
        };
    }
};
