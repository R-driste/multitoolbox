// getToken.js (ESM version)
import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const scopes = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

const saveToken = (token) => {
  const savePath = path.join(__dirname, 'refresh_token.txt');
  fs.writeFileSync(savePath, token, 'utf-8');
  console.log(`✅ Refresh token saved to ${savePath}`);
};

async function getRefreshToken() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const query = url.parse(req.url, true).query;
      if (query.code) {
        try {
          const { tokens } = await oauth2Client.getToken(query.code);
          console.log('\n[REFRESH TOKEN]:', tokens.refresh_token, '');
          res.end('✅ Success! You can close this window.');
          server.close();
          resolve(tokens);
        } catch (err) {
          console.error('❌ Token Error:', err);
          res.end('Authentication failed.');
          reject(err);
        }
      }
    }).listen(3000, () => {
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
      });
      fs.writeFileSync('auth-url.txt', authUrl); // for frontend or logging
      console.log('🌐 Authorize this app by visiting this [URL]:', authUrl);
    });
  });
}

getRefreshToken()
  .then((tokens) => {
    if (tokens.refresh_token) {
      saveToken(tokens.refresh_token);
    } else {
      console.warn('⚠️ No refresh token received!');
    }
  })
  .catch(console.error);
