import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

interface TimestampPair {
  start: number;
  end: number;
}

/**
 * Analyzes a video from Cloudinary using Google's Gemini and returns timestamp pairs
 * of peak moments.
 * 
 * @param cloudinaryUrl URL to the video hosted on Cloudinary
 * @param apiKey Optional Gemini API key (defaults to environment variable)
 * @returns Array of timestamp pairs [start_time, end_time] in seconds
 */
export async function getPeakMoments(
  cloudinaryUrl: string,
  apiKey?: string
): Promise<[number, number][]> {
  // Configure Gemini API
  const geminiApiKey = apiKey || process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('Gemini API key is required. Set GEMINI_API_KEY environment variable or pass as parameter.');
  }

  // Set up Gemini API
  const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  // Download video from Cloudinary to a temporary file
  console.log(`Downloading video from ${cloudinaryUrl}...`);
  const response = await axios({
    method: 'get',
    url: cloudinaryUrl,
    responseType: 'stream'
  });

  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `video-${uuidv4()}.mp4`);
  const writer = fs.createWriteStream(tempFilePath);

  response.data.pipe(writer);
  await new Promise<void>((resolve, reject) => {
    writer.on('finish', () => resolve());
    writer.on('error', () => reject());
  });

  try {
    // Create a Gemini model instance
    const generativeModel = model;

    // Create prompt for peak moment detection
    const prompt = `
      Analyze this video and identify the peak moments or highlights.
      Return your response as a JSON array of timestamp pairs, where each pair contains:
      [start_time_in_seconds, end_time_in_seconds]
      
      Only return the JSON array, nothing else.
    `;

    // Read video file as base64
    const videoBytes = fs.readFileSync(tempFilePath);
    const videoBase64 = videoBytes.toString('base64');

    // Process video with Gemini
    console.log('Analyzing video with Gemini...');
    const result = await generativeModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'video/mp4',
                data: videoBase64
              }
            }
          ]
        }
      ]
    });

    // Extract JSON array from response
    try {
      // Get the response text
      const responseText = result.response.text().trim();
      let jsonText = responseText;

      // Clean the response text to extract just the JSON array
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.substring(7);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.substring(0, jsonText.length - 3);
      }

      const timestamps: [number, number][] = JSON.parse(jsonText.trim());
      return timestamps;
    } catch (error) {
      console.error(`Failed to parse Gemini response: ${error}`);
      return [];
    }
  } finally {
    // Clean up temporary file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

// Example usage
async function main() {
  console.log("Starting main function");
  const cloudinaryUrl = "https://res.cloudinary.com/dgyiptxfq/video/upload/v1750076823/BANGALIANA/lqdcirgpismmsisnee4q.mp4";
  try {
    console.log("API Key:", process.env.GEMINI_API_KEY ? "Set (value hidden)" : "Not set");
    console.log("About to call getPeakMoments");
    const peakMoments = await getPeakMoments(cloudinaryUrl);
    console.log("Peak moments detected:");
    peakMoments.forEach((moment, i) => {
      const [start, end] = moment;
      console.log(`Moment ${i+1}: ${start.toFixed(2)}s - ${end.toFixed(2)}s (duration: ${(end-start).toFixed(2)}s)`);
    });
  } catch (error) {
    console.error("Error analyzing video:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
  }
}

// Run the example
main().catch(err => console.error('Error executing script:', err));