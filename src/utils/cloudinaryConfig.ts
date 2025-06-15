import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME || '',
  api_key: process.env.CLOUD_API_KEY || '',
  api_secret: process.env.CLOUD_API_SECRET || ''
});

/**
 * Upload a file to Cloudinary
 * @param filePath - Path to the local file
 * @param folder - Cloudinary folder to store in
 * @returns Promise with Cloudinary upload result
 */
export const uploadToCloudinary = async (filePath: string, folder: string = 'bengali_heritage'): Promise<any> => {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'auto',
      folder: folder,
      transformation: [
        { quality: 'auto:good' }
      ]
    });
    
    return result;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

/**
 * Delete a file from Cloudinary
 * @param publicId - Cloudinary public ID
 * @returns Promise with deletion result
 */
export const deleteFromCloudinary = async (publicId: string): Promise<any> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

// For backward compatibility with existing code
export const uploadtocloudinary = async (localfilepath: string) => {
  const mainFolderName = "BANGALIANA";
  try {
    const result = await cloudinary.uploader.upload(localfilepath, {
      resource_type: "auto",
      folder: mainFolderName,
      allowed_formats: ["jpg", "pdf", "png", "mp4", "jpeg"]
    });
    fs.unlinkSync(localfilepath); // Remove file from local uploads folder
    return {
      message: "Success",
      result: result
    };
  } catch (err) {
    fs.unlinkSync(localfilepath);
    return {
      message: "Failed",
      error: err
    };
  }
};

export default {
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadtocloudinary
};
