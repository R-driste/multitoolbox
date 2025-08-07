import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

import playerFactory from 'play-sound';
const player = playerFactory();

player.play('positive.wav', function(err){
  if (err) console.error('Error playing sound:', err);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, 'credentials.json');
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(configPath)) {
  console.error('ERROR: credentials.json not found at:', configPath);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (err) {
  console.error('ERROR: Failed to parse credentials.json:', err);
  process.exit(1);
}

if (!config.installed?.client_id || !config.installed?.client_secret) {
  console.error('ERROR: client_id or client_secret missing in credentials.json');
  process.exit(1);
}

console.log('Loaded credentials:', {
  client_id: config.installed.client_id,
  client_secret: '***hidden***',
});

if (fs.existsSync(envPath)) {
  let envContent = fs.readFileSync(envPath, 'utf-8');
  envContent = envContent
    .replace('{CLIENT_ID}', config.installed.client_id)
    .replace('{CLIENT_SECRET}', config.installed.client_secret);
  fs.writeFileSync(envPath, envContent, 'utf-8');
  console.log('✅ .env updated with client ID and secret.');
} else {
  console.warn('⚠️ .env file not found at:', envPath);
}

const env = {
  ...process.env,
  CLIENT_ID: config.installed.client_id,
  CLIENT_SECRET: config.installed.client_secret,
};

const child = spawn('node', ['getToken.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env,
});

child.on('error', (err) => {
  console.error('Failed to start child process:', err);
});

child.on('exit', (code, signal) => {
  if (code !== 0) {
    console.error(`Child process exited with code ${code} and signal ${signal}`);
  }
});