import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPaths = {
  calendar: path.join(__dirname, '/SERVERS/google-calendar-mcp/.env'),
  sheets: path.join(__dirname, '/SERVERS/mcp-google-sheets-main/.env'),
  gdrive: path.join(__dirname, '/SERVERS/mcp-gdrive-main/.env'),
};

//gpt gen parse env files :>
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex).trim();
      const val = trimmed.substring(eqIndex + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

const calendarEnv = parseEnvFile(envPaths.calendar);
const sheetsEnv = parseEnvFile(envPaths.sheets);
const gdriveEnv = parseEnvFile(envPaths.gdrive);

//specific to mcp-google-sheets-main/token.json
const tokenPath = path.join(__dirname, '/SERVERS/mcp-google-sheets-main/token.json');
let refreshToken = '';
try {
  const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
  refreshToken = token.refresh_token;
  console.log("Refresh token loaded:", refreshToken);
} catch (err) {
  console.error('Error reading refresh token:', err.message);
}

console.log("SHEETTT", sheetsEnv.EMAIL_ID)
//final config!
const config = {
  mcpServers: {
    "google-calendar": {
      command: "node",
      args: [
        path.join(__dirname, "/SERVERS/google-calendar-mcp/build/index.js")
      ],
      env: {
        GOOGLE_CLIENT_ID: calendarEnv.GOOGLE_CLIENT_ID || "",
        GOOGLE_CLIENT_SECRET: calendarEnv.GOOGLE_CLIENT_SECRET || "",
        GOOGLE_REDIRECT_URI: "http://localhost:3000/callback",
        GOOGLE_REFRESH_TOKEN: calendarEnv.GOOGLE_REFRESH_TOKEN || ""
      }
    },
    "google-sheets": {
      command: "/Users/dristiroy/.bun/bin/bun",
      args: [
        path.join(__dirname, "mcp-google-sheets-main/index.ts")
      ],
      env: {
        GOOGLE_CLIENT_ID: calendarEnv.GOOGLE_CLIENT_ID || "",
        GOOGLE_CLIENT_SECRET: calendarEnv.GOOGLE_CLIENT_SECRET || "",
        GOOGLE_REDIRECT_URI: "http://localhost:3000/callback",
        GOOGLE_REFRESH_TOKEN: refreshToken || "",
        DRIVE_FOLDER_ID: sheetsEnv.DRIVE_FOLDER_ID || "",
        EMAIL_ID: sheetsEnv.EMAIL_ID || "",
        TOKEN_PATH:"token.json",
        CREDENTIALS_PATH:"credentials.json"
      }
    },
    "gdrive": {
      command: "node",
      args: [
        path.join(__dirname, "mcp-gdrive-main/dist/index.js")
      ],
      env: {
        GDRIVE_CREDS_DIR: path.join(__dirname, "/SERVERS/mcp-gdrive-main/AUTH"),
        CLIENT_ID: gdriveEnv.CLIENT_ID || "",
        CLIENT_SECRET: gdriveEnv.CLIENT_SECRET || ""
      }
    }
  }
};

//save config
const outputPath = path.join(__dirname, 'final_config.json');
fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf-8');
console.log(JSON.stringify(config, null, 2));
console.log(__dirname)