const { app, BrowserWindow, ipcMain } = require('electron');

const fs = require('fs');
const path = require('path');
const os = require('os');

//get and distribute the credentials files
ipcMain.on('credentials-uploaded', (event, { json, filename }) => {
  //google calendar
  let destFolder1 = path.join(__dirname, 'SERVERS/google-calendar-mcp');
  if (!fs.existsSync(destFolder1)) {
    fs.mkdirSync(destFolder1, { recursive: true });
  }
  const destPath1 = path.join(destFolder1, "credentials.json");
  fs.writeFile(destPath1, JSON.stringify(json, null, 2), (err) => {
    if (err) {
      console.error('Error writing file to Calendar MCP:', err);
    } else {
      console.log(`File saved to ${destPath1}`);
    }
  });
  //google sheets
  let destFolder2 = path.join(__dirname, 'SERVERS/mcp-google-sheets-main');
  if (!fs.existsSync(destFolder2)) {
    fs.mkdirSync(destFolder2, { recursive: true });
  }
  const destPath2 = path.join(destFolder2, "credentials.json");
  fs.writeFile(destPath2, JSON.stringify(json, null, 2), (err) => {
    if (err) {
      console.error('Error writing file to Sheets MCP:', err);
    } else {
      console.log(`File saved to ${destPath2}`);
    }
  });
  //google drive
  let destFolder3 = path.join(__dirname, 'SERVERS/mcp-gdrive-main/AUTH');
  if (!fs.existsSync(destFolder3)) {
    fs.mkdirSync(destFolder3, { recursive: true });
  }
  const destPath3 = path.join(destFolder3, "gcp-oauth.keys.json");
  fs.writeFile(destPath3, JSON.stringify(json, null, 2), (err) => {
    if (err) {
      console.error('Error writing file to Drive MCP:', err);
    } else {
      console.log(`File saved to ${destPath3}`);
    }
  });
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// url update handling
const { spawn } = require('child_process');

let runningScript = null;

ipcMain.handle('run-script', async (event, { scriptName }) => {
  let cmd, args, cwd;

  switch (scriptName) {
    case 'sheets':
      cmd = 'bun';
      args = ['index.ts'];
      cwd = path.join(__dirname, 'SERVERS/mcp-google-sheets-main');
      break;
    case 'drive':
      cmd = 'node';
      args = ['dist/index.js'];
      cwd = path.join(__dirname, 'SERVERS/mcp-gdrive-main');
      break;
    case 'calendar':
      cmd = 'node';
      args = ['rungetcreds.js'];
      cwd = path.join(__dirname, 'SERVERS/google-calendar-mcp');
      break;
    default:
      throw new Error('Unknown script');
  }

  const child = spawn(cmd, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });

  // Store globally to use stdin later
  runningScript = child;

  // Send output back to renderer
  child.stdout.on('data', (data) => {
    event.sender.send('script-output', data.toString());
  });

  child.stderr.on('data', (data) => {
    event.sender.send('script-error', data.toString());
  });

  child.on('close', (code) => {
    event.sender.send('script-exit', `Process exited with code ${code}`);
    runningScript = null;
  });

  return 'Script started';
});

// This handles input from the renderer textbox
ipcMain.on('send-input', (event, input) => {
  if (runningScript && !runningScript.killed) {
    runningScript.stdin.write(input + '\n');
  }
});
