import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';

/**
 * Interface representing a video segment with start and end times
 */
interface VideoSegment {
  start: number;
  end: number;
}

/**
 * Class for handling Cloudinary video operations including
 * downloading, splitting by timestamps, and merging
 */
export class CloudinaryVideoSplitter {
  private tempDir: string;
  
  constructor() {
    // Create a unique temp directory for this instance
    this.tempDir = path.join(os.tmpdir(), `video-splitter-${uuidv4()}`);
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }
  
  /**
   * Downloads a video from Cloudinary URL
   * 
   * @param cloudinaryUrl The Cloudinary URL of the video
   * @returns Path to the downloaded video file
   */
  async downloadVideo(cloudinaryUrl: string): Promise<string> {
    console.log(`Downloading video from ${cloudinaryUrl}...`);
    
    const response = await axios({
      method: 'get',
      url: cloudinaryUrl,
      responseType: 'stream'
    });
    
    const videoPath = path.join(this.tempDir, `original-${uuidv4()}.mp4`);
    const writer = fs.createWriteStream(videoPath);
    
    response.data.pipe(writer);
    
    return new Promise<string>((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Video downloaded to ${videoPath}`);
        resolve(videoPath);
      });
      writer.on('error', (err) => {
        console.error('Error downloading video:', err);
        reject(err);
      });
    });
  }
  
  /**
   * Splits a video into segments based on the provided timestamps
   * 
   * @param videoPath Path to the input video file
   * @param segments Array of start and end times for each segment
   * @returns Array of paths to the created segment files
   */
  async splitVideo(videoPath: string, segments: VideoSegment[]): Promise<string[]> {
    console.log(`Splitting video into ${segments.length} segments...`);
    
    const segmentPaths: string[] = [];
    
    for (let i = 0; i < segments.length; i++) {
      const { start, end } = segments[i];
      const duration = end - start;
      
      if (duration <= 0) {
        console.warn(`Skipping segment ${i+1} as duration is invalid: ${duration}`);
        continue;
      }
      
      const outputPath = path.join(this.tempDir, `segment-${i+1}-${uuidv4()}.mp4`);
      
      await this.executeFFmpeg([
        '-ss', start.toString(),
        '-i', videoPath,
        '-t', duration.toString(),
        '-c:v', 'copy',
        '-c:a', 'copy',
        outputPath
      ]);
      
      segmentPaths.push(outputPath);
      console.log(`Created segment ${i+1}: ${start}s to ${end}s at ${outputPath}`);
    }
    
    return segmentPaths;
  }
  
  /**
   * Merges multiple video segments into a single video
   * 
   * @param segmentPaths Array of paths to the segment files
   * @param outputFilename Optional name for the output file
   * @returns Path to the merged video file
   */
  async mergeSegments(segmentPaths: string[], outputFilename?: string): Promise<string> {
    if (segmentPaths.length === 0) {
      throw new Error('No segments provided for merging');
    }
    
    console.log(`Merging ${segmentPaths.length} segments...`);
    
    // Create a file that lists all segments to merge
    const listFilePath = path.join(this.tempDir, 'segments.txt');
    const listContent = segmentPaths.map(p => `file '${p}'`).join('\n');
    fs.writeFileSync(listFilePath, listContent);
    
    // Output path for the merged video
    const outputPath = path.join(this.tempDir, outputFilename || `merged-${uuidv4()}.mp4`);
    
    await this.executeFFmpeg([
      '-f', 'concat',
      '-safe', '0',
      '-i', listFilePath,
      '-c', 'copy',
      outputPath
    ]);
    
    console.log(`Merged video created at ${outputPath}`);
    return outputPath;
  }
  
  /**
   * Cleans up temporary files and directories
   */
  cleanup(): void {
    console.log(`Cleaning up temporary files in ${this.tempDir}...`);
    if (fs.existsSync(this.tempDir)) {
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.tempDir, file));
      }
      fs.rmdirSync(this.tempDir);
    }
    console.log('Cleanup complete');
  }
  
  /**
   * Helper method to execute FFmpeg commands
   * 
   * @param args Array of command line arguments for FFmpeg
   * @returns Promise that resolves when the command completes
   */
  private executeFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args);
      
      // Collect error output
      let errorOutput = '';
      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          console.error(`FFmpeg process exited with code ${code}`);
          console.error(errorOutput);
          reject(new Error(`FFmpeg process failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (err) => {
        console.error('Failed to start FFmpeg process:', err);
        reject(err);
      });
    });
  }
  
  /**
   * Main function to process a Cloudinary video: download, split, and merge
   * 
   * @param cloudinaryUrl URL of the video on Cloudinary
   * @param timestamps Array of timestamp pairs [start, end] in seconds
   * @param outputFilename Optional name for the output file
   * @returns Path to the processed video file
   */
  async processVideo(
    cloudinaryUrl: string, 
    timestamps: [number, number][], 
    outputFilename?: string
  ): Promise<string> {
    try {
      // Download the video
      const videoPath = await this.downloadVideo(cloudinaryUrl);
      
      // Convert timestamps to segments
      const segments: VideoSegment[] = timestamps.map(([start, end]) => ({ start, end }));
      
      // Split the video
      const segmentPaths = await this.splitVideo(videoPath, segments);
      
      // Merge the segments
      const outputPath = await this.mergeSegments(segmentPaths, outputFilename);
      
      return outputPath;
    } catch (error) {
      console.error('Error processing video:', error);
      throw error;
    }
  }
}

/**
 * Example usage:
 *
 * const splitter = new CloudinaryVideoSplitter();
 * 
 * async function extractHighlights() {
 *   try {
 *     const cloudinaryUrl = "https://res.cloudinary.com/demo/video/upload/v1234567890/sample.mp4";
 *     const timestamps: [number, number][] = [
 *       [10, 15],  // 10s to 15s
 *       [30, 40],  // 30s to 40s
 *       [60, 70]   // 60s to 70s
 *     ];
 *     
 *     const highlightsVideoPath = await splitter.processVideo(cloudinaryUrl, timestamps, "highlights.mp4");
 *     console.log(`Highlights video created at: ${highlightsVideoPath}`);
 *     
 *     // Don't forget to clean up when done
 *     splitter.cleanup();
 *   } catch (error) {
 *     console.error("Failed to extract highlights:", error);
 *   }
 * }
 * 
 * extractHighlights();
 */

