import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import http from 'http';
import url from 'url';

import {google} from 'googleapis'
import fs from 'fs'
import readline from "readline";
import type { SpreadsheetContext } from "./types";
import { addColumns, addRows, batchUpdate, copySheet, createSheet, createSpreadSheet, listSheets, listSpreadsheets, renameSheet, shareSpreadsheet, sheetData, spreadsheetInfo, updateCells } from './sheets';

console.error("Starting Google Sheets MCP server...");

//sound to confirm its working
const platform = process.platform;

if (platform === "darwin") {
  Bun.spawn(["afplay", "positive.wav"]); //for macOS
} else if (platform === "linux") {
  Bun.spawn(["aplay", "positive.wav"]);  //for Linux
} else if (platform === "win32") {
  Bun.spawn([
    "powershell",
    "-c",
    "(New-Object Media.SoundPlayer 'positive.wav').PlaySync();"
  ]); //for Windows
}

const server = new McpServer({
  name: "Demo",
  version: "1.0.0"
});

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file'
];

const CREDENTIALS_CONFIG = process.env.CREDENTIALS_CONFIG;

const TOKEN_PATH = "token.json";
const CREDENTIALS_PATH = "credentials.json";
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || "";

let context: SpreadsheetContext;

async function authenticateAndSaveCredentials(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url || '', true);
      if (parsedUrl.query.code) {
        try {
          const { tokens } = await oAuth2Client.getToken(parsedUrl.query.code);
          oAuth2Client.setCredentials(tokens);

          const envPath = './.env';
          let envContent = fs.readFileSync(envPath, 'utf-8');
          envContent = envContent.replace('{G1_REFRESH}', tokens.refresh_token || '');
          fs.writeFileSync(envPath, envContent, 'utf-8');
          console.log('✅ .env file updated with refresh token.');

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication successful! You can close this tab.</h1>');

          server.close();
          resolve(tokens);
        } catch (err) {
          console.error('❌ Token Error:', err);
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication failed.</h1>');
          reject(err);
        }
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(80, () => {
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file'
        ],
        prompt: 'consent',
      });
      console.log('🌐 Authorize this app by visiting this URL:', authUrl);
    });
  });
}

async function initContext(){
  try {
    if (CREDENTIALS_CONFIG) {
      try {
        const credentialsJson = Buffer.from(CREDENTIALS_CONFIG, 'base64').toString('utf-8');
        const key = JSON.parse(credentialsJson);
        
        const authClient = new google.auth.JWT(
          key.client_email,
          undefined,
          key.private_key,
          SCOPES
        );
        
        await authClient.authorize();
        
        context = {
          sheets: google.sheets({ version: 'v4', auth: authClient }),
          drive: google.drive({ version: 'v3', auth: authClient }),
          folderId: DRIVE_FOLDER_ID || undefined
        };
        return;
      } catch (error) {
        console.error("Error with credentials from environment:", error);
      }
    }
      
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
      try {
        console.error("Attempting OAuth with environment variables...");
        const oAuth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );
        
        oAuth2Client.setCredentials({
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN
        });
        
        // Test the authentication
        try {
          const drive = google.drive({ version: 'v3', auth: oAuth2Client });
          await drive.files.list({ pageSize: 1 });
          
          context = {
            sheets: google.sheets({ version: 'v4', auth: oAuth2Client }),
            drive: drive,
            folderId: DRIVE_FOLDER_ID || undefined
          };
          console.error("Successfully authenticated with environment variables");
          return;
        } catch (testError) {
          console.error("Environment variable token test failed:", testError);
          // Continue to next auth method
        }
      } catch (error) {
        console.error("Error with environment variable OAuth:", error);
        // Continue to next auth method
      }
    }
    
    // Priority 3: Use OAuth credentials
    if (fs.existsSync(CREDENTIALS_PATH)) {
      console.error("Creds already found!", CREDENTIALS_PATH);   
      try {
        const credentialContent = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
        const credentials = JSON.parse(credentialContent);
        
        // Check if we have installed or web credentials
        const clientConfig = credentials.installed || credentials.web;
        if (!clientConfig) {
          throw new Error("Invalid credentials format - missing installed or web configuration");
        }
        
        const { client_secret, client_id, redirect_uris } = clientConfig;
        const oAuth2Client = new google.auth.OAuth2(
          client_id, 
          client_secret, 
          redirect_uris[0]
        );

        // Check if we have a saved token
        if (fs.existsSync(TOKEN_PATH)) {
          const tokenContent = fs.readFileSync(TOKEN_PATH, 'utf-8');
          oAuth2Client.setCredentials(JSON.parse(tokenContent));
          
          // Test the authentication
          try {
            const drive = google.drive({ version: 'v3', auth: oAuth2Client });
            await drive.files.list({ pageSize: 1 });
            
            context = {
              sheets: google.sheets({ version: 'v4', auth: oAuth2Client }),
              drive: drive,
              folderId: DRIVE_FOLDER_ID || undefined
            };
            console.error("Successfully found token");
            return;
          } catch (tokenError) {
            console.error("Saved token is invalid, generating new one:", tokenError);
            // Continue to token generation
          }
        }
        
        // If no token or token is invalid, get a new one
        const tokens = await authenticateAndSaveCredentials(oAuth2Client);
        
        try {
          oAuth2Client.setCredentials(tokens);
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
          console.log('Token stored to', TOKEN_PATH);
          
          context = {
            sheets: google.sheets({ version: 'v4', auth: oAuth2Client }),
            drive: google.drive({ version: 'v3', auth: oAuth2Client }),
            folderId: DRIVE_FOLDER_ID || undefined
          };
          return;
        } catch (tokenError) {
          console.error("Error getting token:", tokenError);
          throw new Error("Authentication failed: Could not get valid token");
        }
      } catch (error) {
        console.error("Error in OAuth flow:", error);
        throw new Error("Authentication failed: OAuth process error");
      }
    }
    
    throw new Error("No valid authentication method available");
    
  } catch (error) {
    console.error("Failed to initialize context:", error);
    process.exit(1);
  }
}

server.tool("create", "Creates a spreadsheet by taking the new sheet's name as input",
  { title: z.string() },
  async ({ title }) => {
    try {
      console.log(`Creating spreadsheet with title: ${title}`);
      const { id, link } = await createSpreadSheet(title, context);
      return {
        content: [{ 
          type: "text", 
          text: `Created spreadsheet successfully with id: ${id}. Visit at ${link}` 
        }]
      };
    } catch (error) {
      console.error("Error creating spreadsheet:", error);
      return {
        content: [{ 
          type: "text", 
          text: `Failed to create spreadsheet: ${error}` 
        }]
      };
    }
    
  }
);


server.tool("listSheets", "Lists all the sheets present in the spreadsheet. Accepts spreadsheet id as input argument",
  {spreadsheetId: z.string()},
  async ({spreadsheetId}) => {
    const res = await listSheets(spreadsheetId, context);
    return {
      content: [{
        type: "text",
        text: `List of all the sheets present: ${res}`
      }]
    }
  }
)

server.tool("renameSheet", "Renames the provided sheet. Accepts spreadsheet id, old name and new name of the sheet as input arguments",
  {spreadsheetId: z.string(), sheetTitle: z.string(), newSheetName: z.string()},
  async ({spreadsheetId, sheetTitle, newSheetName}) => {
    const res = await renameSheet(spreadsheetId, sheetTitle, newSheetName, context);
    if(res === "Cannot find the sheet with the specified name"){
      return {
        content: [{
          type: "text",
          text: `Cannot find the sheet with the provided name`
        }]  
      }
    }else{
      return {
        content: [{
          type: "text",
          text: `Sheet renamed successfully!`
        }]
      }
    }
    
  }
)


server.tool("createSheet", "Creates a new sheet in the spreadsheet provided as an argument. Accepts spreadsheet id and name of the sheet to be created as input arguments",
  {spreadsheetId: z.string(), title: z.string()},
  async ({spreadsheetId, title}) => {
    const res = await createSheet(spreadsheetId, title, context);
       return {
        content: [{
          type: "text",
          text: `Following sheet was created: ${res}`
        }]
      }
    }
)

server.tool("spreadsheetInfo", "Gives info about the spreadsheet. Accepts spreadsheetId as an argument.",
  {spreadsheetId: z.string()},
  async ({spreadsheetId}) => {
    const res = await spreadsheetInfo(spreadsheetId, context);
    return {
      content: [{
        type: 'text',
        text: `Spreadsheet Info: ${res}`
      }]
    }
  }
)

server.tool("listSpreadsheets", "Returns a list of all the spreadsheets present within the current context. Returns the spreadsheet data in the form of [{spreadsheetId, spreadsheet name},...]",
  {},
  async() => {
    const res = await listSpreadsheets(context);
    return {
      content: [{
        type: 'text',
        text: `List of spreadsheets: ${res}`
      }]
    }
  }
)

server.tool("shareSpreadsheet", "Shares the provided spreadsheet to the recipients provided as an argument. Accepts recipients as an array of objects in the form of {email_address, role}. Also, sends a notification email to the users informing them about the access granted to them.",
  {spreadsheetId: z.string(), recipients: z.array(z.object({email_address: z.string(), role: z.string()}))},
  async({spreadsheetId, recipients}) => {
   const {successes, failures} = await shareSpreadsheet(spreadsheetId, recipients, context);
    return {
      content: [{
        type: 'text',
        text: `Following are the successes: ${successes} and failures: ${failures}`
      }]
    }
  }
)


server.tool("sheetData", "Returns the data present in the specified sheet, in the given range. If the range is not provided, it gives the data of the full sheet. Accepts spreadsheetId, sheet name, range as an argument",
  {spreadsheetId: z.string(), sheetName: z.string(), range: z.string()},
  async({spreadsheetId, sheetName, range}) => {
    const res = await sheetData(spreadsheetId, sheetName, range, context);
    return {
      content: [{
        type: 'text',
        text: `The data is: ${res}`
      }]
    }
  })


server.tool("updateCells", "Updates the values present in the cells specified in the given range for the provided sheet. Accepts spreadsheetId, sheetname, range and data to be entered, as arguments.",
  {spreadsheetId: z.string(), sheet: z.string(), range: z.string(), data: z.array(z.array(z.string()))},
  async({spreadsheetId, sheet, range, data}) => {
    const res = updateCells(spreadsheetId, sheet, range, data, context);
    return {
      content: [{
        type: 'text',
        text: `Data was updated successfully.${res}`
      }]
    }
  }
)

server.tool("batchUpdate", "Updates a range of values using the batchUpdate function of google sheets. The ranges are provided along with the values to be updated, in an array. It accepts spreadsheetId, sheet, and ranges as arguments.",
  {spreadsheetId: z.string(), sheet: z.string(), ranges: z.array(z.array(z.string()))},
  async({spreadsheetId, sheet, ranges}) => {
    const res = batchUpdate(spreadsheetId, sheet, ranges, context);
    return {
      content: [{
        type: 'text',
        text: `The values were updated: ${res}`
      }]
    }
  }
)

server.tool("addRows", "Adds the specified number of rows to the specified sheet. Accepts spreadsheetId, sheetname, count of rows to be added, startRow as arguments",
  {spreadsheetId: z.string(), sheet: z.string(), count: z.number(), startRow: z.number()},
 async({spreadsheetId, sheet, count, startRow}) => {
  const res = addRows(spreadsheetId, sheet, count, startRow, context);
  return {
    content: [{
      type: 'text',
      text: 'The rows were added successfully!'
    }]
  }
  }
)

server.tool("addColumns", "Adds the specified number of columns to the specified sheet. Accepts spreadsheetId, sheetname, count of columns to be added, startColumn as arguments",
  {spreadsheetId: z.string(), sheet: z.string(), count: z.number(), startColumn: z.number()},
 async({spreadsheetId, sheet, count, startColumn}) => {
  const res = addColumns(spreadsheetId, sheet, count, startColumn, context);
  return {
    content: [{
      type: 'text',
      text: 'The columns were added successfully!'
    }]
  }
  }
)

server.tool("copySheet", "Copies the contents of the source sheet to destination sheet. Accepts srcSpreadsheet, srcSheet, dstSpreadsheet, dstSheet as arguments.",
  {srcSpreadsheet: z.string(), srcSheet: z.string(), dstSpreadsheet: z.string(), dstSheet: z.string()},
  async ({srcSpreadsheet, srcSheet, dstSpreadsheet, dstSheet}) => {
    const res = copySheet(srcSpreadsheet, srcSheet, dstSpreadsheet, dstSheet, context);
    return {
      content: [{
        type: 'text',
        text: `Sheet was successfully copied to destination sheet. ${res}`
      }]
    }
  }
)

async function startServer() {
  try {
    await initContext();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

console.error("Registering tools and starting server...");
await startServer();
console.error("✅ MCP Google Sheets server is running and listening for requests!");