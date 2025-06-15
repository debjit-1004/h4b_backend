import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const clientId = process.env.CIVIC_AUTH_CLIENT_ID;

if (!clientId) {
  console.error('CIVIC_AUTH_CLIENT_ID not found in environment variables');
  console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('CIVIC')));
  throw new Error('CIVIC_AUTH_CLIENT_ID environment variable is required');
}

console.log('Civic Auth Client ID loaded:', clientId);

export const config = {
    clientId: clientId,
    redirectUrl: 'http://localhost:5000/auth/callback',
    postLogoutRedirectUrl: 'http://localhost:5000/'
};