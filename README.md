# multitoolbox
A connection between multiple google interfaces with LLM

+ needs claude desktop

+ needs google developer details

This script will assist your Gsuite MCP setup process


To enable use of google APIs, there is still a primarily manual part you must do first online. You need to create a google project, then enable the following apis:
- Google Calendar https://console.cloud.google.com/marketplace/product/google/calendar-json.googleapis.com?inv=1&invt=Abx53A&orgonly=true&project=deft-bazaar-417916&supportedpurview=organizationId
- Google Drive https://console.cloud.google.com/marketplace/product/google/drive.googleapis.com?q=search&referrer=search&inv=1&invt=Abx53A&orgonly=true&project=deft-bazaar-417916&supportedpurview=organizationId
- Google sheets
- Google Docs


Then setup OAuth and add the following scope string:
https://www.googleapis.com/auth/drive.readonly, https://www.googleapis.com/auth/spreadsheets

Download OAuth JSON and
save as "package-lock.json"

get keys and insert into the GDRIV_CREDS_DIR folder

Include a .env with:
get your client ID detailss

GDRIVE_CREDS_DIR=/path/to/config/directory
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GOOGLE_REFRESH_TOKEN=

STEP 1:
ask use to check box which tools they want

STEP 2:
prompt user to create a project (they wille let you know when done)

STEP 3:
ask user for their authentication details. [while this might seem like a security risk initially a majority of the scripts are local and I promise not to irresponsibly handle their keys].

They will give: folder path, client ID, client secret

STEP 3.5 tel user they need to enable
- given apis
- given scopes https://www.googleapis.com/auth/drive.readonly, https://www.googleapis.com/auth/spreadsheets

STEP 4:
npm run build on my side

STEP 5:
node ./dist/index.js on my side

npm install @google-cloud/local-auth @googleapis/drive @googleapis/docs @googleapis/sheets

careful access token needs to be grabbed in time.

needs to authenticate very quickly or else it will run out of time (extend authentication refresh period.)

Rewrite to the claude config file the new stuff.
Claude will read the MCP servers section.

"google-calendar": {
        "command": "node",
        "args": ["/Users/dristiroy/MULTITOOLBOX/multitoolbox/OVERALL_PROJECT/google-calendar-mcp/build/index.js"]
        },
        
Final STEP:
Ask user to click claude and navigate to the config file.
Give them this to paste to the config:



Ask for a refresh and the user is good to go.

Suggest a retry if it doesn't work immediately.
yayy the integration worked!

how about i create two apps, one that does the auth and then one that runs the servers.

gitignore the npm modules

run individual servers based on whether user wants