import { getPeakMoments } from "./video.time.js";
import { CloudinaryVideoSplitter } from "./videoSplitter.js";
//fix this imports ..amr matha kaaj kor6ena ..sorry 

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

/**
 * Analyzes a video using Gemini AI to identify peak moments,
 * then extracts those moments as a new video.
 * 
 * @param cloudinaryUrl URL of the video on Cloudinary
 * @param apiKey Optional Gemini API key (defaults to environment variable)
 * @param outputDir Optional directory to save the output file (defaults to temp dir)
 * @param outputFilename Optional filename for the output video (defaults to highlights-{uuid}.mp4)
 * @returns Path to the created highlights video
 */
export async function extractVideoHighlights(
  cloudinaryUrl: string,
  apiKey?: string,
  outputDir?: string,
  outputFilename?: string
): Promise<string> {
  console.log('Starting video highlights extraction process...');
  
  // Step 1: Analyze the video to get peak moments using Gemini
  console.log('Analyzing video to find peak moments...');
  const timestamps = await getPeakMoments(cloudinaryUrl, apiKey);
  
  if (!timestamps.length) {
    throw new Error('No peak moments detected in the video');
  }
  
  console.log(`Found ${timestamps.length} peak moments in the video:`);
  timestamps.forEach((moment: [number, number], i: number) => {
    const [start, end] = moment;
    console.log(`Moment ${i+1}: ${start.toFixed(2)}s - ${end.toFixed(2)}s (duration: ${(end-start).toFixed(2)}s)`);
  });
  
  // Step 2: Extract those moments using the video splitter
  console.log('Extracting peak moments from video...');
  const videoSplitter = new CloudinaryVideoSplitter();
  
  try {
    // Determine output location
    const finalOutputDir = outputDir || os.tmpdir();
    const finalOutputFilename = outputFilename || `highlights-${uuidv4()}.mp4`;
    const outputPath = path.join(finalOutputDir, finalOutputFilename);
    
    // Process the video
    const tempOutputPath = await videoSplitter.processVideo(
      cloudinaryUrl, 
      timestamps,
      finalOutputFilename
    );
    
    // If output directory is specified, move the file there
    if (outputDir && tempOutputPath !== outputPath) {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.copyFileSync(tempOutputPath, outputPath);
      console.log(`Copied highlights video to: ${outputPath}`);
    }
    
    return outputPath;
  } finally {
    // Clean up temporary files
    videoSplitter.cleanup();
  }
}

/**
 * Example usage
 */
async function example() {
  try {
    const cloudinaryUrl = "https://res.cloudinary.com/dgyiptxfq/video/upload/v1750076823/BANGALIANA/lqdcirgpismmsisnee4q.mp4"
    // Option 1: Basic usage with defaults (will save to temp directory)
    const highlightsPath = await extractVideoHighlights(cloudinaryUrl);
    console.log(`Highlights video created at: ${highlightsPath}`);
    
    // Option 2: Save to specific directory with custom filename
    /*
    const customHighlightsPath = await extractVideoHighlights(
      cloudinaryUrl,
      undefined, // Use environment variable for API key
      '/path/to/your/videos', // Custom output directory
      'my-highlights.mp4' // Custom filename
    );
    console.log(`Custom highlights video created at: ${customHighlightsPath}`);
    */
  } catch (error) {
    console.error('Error extracting highlights:', error);
  }
}

// Uncomment to run the example
example().catch(err => console.error('Unhandled error:', err));
