const { google } = require('googleapis');
const http = require('http');
const url = require('url');

// Replace these with your OAuth 2.0 credentials
const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

// Configure OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Define scopes
const scopes = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

async function getRefreshToken() {
  return new Promise((resolve, reject) => {
    try {
      // Create server to handle OAuth callback
      const server = http.createServer(async (req, res) => {
        try {
          const queryParams = url.parse(req.url, true).query;
          
          if (queryParams.code) {
            // Get tokens from code
            const { tokens } = await oauth2Client.getToken(queryParams.code);
            console.log('\n=================');
            console.log('Refresh Token:', tokens.refresh_token);
            console.log('=================\n');
            console.log('Save this refresh token in your configuration!');
            
            // Send success response
            res.end('Authentication successful! You can close this window.');
            
            // Close server
            server.close();
            resolve(tokens);
          }
        } catch (error) {
          console.error('Error getting tokens:', error);
          res.end('Authentication failed! Please check console for errors.');
          reject(error);
        }
      }).listen(3000, () => {
        // Generate auth url
        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: scopes,
          prompt: 'consent'  // Force consent screen to ensure refresh token
        });

        console.log('1. Copy this URL and paste it in your browser:');
        console.log('\n', authUrl, '\n');
        console.log('2. Follow the Google authentication process');
        console.log('3. Wait for the refresh token to appear here');
      });

    } catch (error) {
      console.error('Server creation error:', error);
      reject(error);
    }
  });
}

// Run the token retrieval
getRefreshToken().catch(console.error);