import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

// Initialize Google Calendar client
const oauth2Client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
});

// Set credentials from environment variables
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// Validation schemas
const schemas = {
  toolInputs: {
    listEvents: z.object({
      timeMin: z.string().optional(),
      timeMax: z.string().optional(),
      maxResults: z.number().optional(),
    }),
    createEvent: z.object({
      summary: z.string(),
      description: z.string().optional(),
      startTime: z.string(),
      endTime: z.string(),
      attendees: z.array(z.string()).optional(),
    }),
    updateEvent: z.object({
      eventId: z.string(),
      summary: z.string().optional(),
      description: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
    }),
    deleteEvent: z.object({
      eventId: z.string(),
    }),
    findFreeTime: z.object({
      timeMin: z.string(),
      timeMax: z.string(),
      duration: z.number(), // duration in minutes
    })
  }
};

// Tool definitions
const TOOL_DEFINITIONS = [
  {
    name: "list_events",
    description: "List calendar events within a specified time range",
    inputSchema: {
      type: "object",
      properties: {
        timeMin: {
          type: "string",
          description: "Start time (ISO string)",
        },
        timeMax: {
          type: "string",
          description: "End time (ISO string)",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of events to return",
        },
      },
    },
  },
  {
    name: "create_event",
    description: "Create a new calendar event",
    inputSchema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "Event title",
        },
        description: {
          type: "string",
          description: "Event description",
        },
        startTime: {
          type: "string",
          description: "Event start time (ISO string)",
        },
        endTime: {
          type: "string",
          description: "Event end time (ISO string)",
        },
        attendees: {
          type: "array",
          items: {
            type: "string",
          },
          description: "List of attendee email addresses",
        },
      },
      required: ["summary", "startTime", "endTime"],
    },
  },
  {
    name: "update_event",
    description: "Update an existing calendar event",
    inputSchema: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          description: "ID of the event to update",
        },
        summary: {
          type: "string",
          description: "New event title",
        },
        description: {
          type: "string",
          description: "New event description",
        },
        startTime: {
          type: "string",
          description: "New start time (ISO string)",
        },
        endTime: {
          type: "string",
          description: "New end time (ISO string)",
        },
      },
      required: ["eventId"],
    },
  },
  {
    name: "delete_event",
    description: "Delete a calendar event",
    inputSchema: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          description: "ID of the event to delete",
        },
      },
      required: ["eventId"],
    },
  },
  {
    name: "find_free_time",
    description: "Find available time slots in the calendar",
    inputSchema: {
      type: "object",
      properties: {
        timeMin: {
          type: "string",
          description: "Start of time range (ISO string)",
        },
        timeMax: {
          type: "string",
          description: "End of time range (ISO string)",
        },
        duration: {
          type: "number",
          description: "Desired duration in minutes",
        },
      },
      required: ["timeMin", "timeMax", "duration"],
    },
  },
];

// Tool implementation handlers
const toolHandlers = {
  async list_events(args: unknown) {
    const { timeMin, timeMax, maxResults = 10 } = schemas.toolInputs.listEvents.parse(args);
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin || new Date().toISOString(),
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    const formattedEvents = events.map(event => {
      return `• ${event.summary}\n  Start: ${event.start?.dateTime || event.start?.date}\n  End: ${event.end?.dateTime || event.end?.date}\n  ID: ${event.id}`;
    }).join('\n\n');

    return {
      content: [{
        type: "text" as const,
        text: events.length ? 
          `Found ${events.length} events:\n\n${formattedEvents}` :
          "No events found in the specified time range."
      }]
    };
  },

  async create_event(args: unknown) {
    const { summary, description, startTime, endTime, attendees } = schemas.toolInputs.createEvent.parse(args);

    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        description,
        start: {
          dateTime: startTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        attendees: attendees?.map(email => ({ email })),
      },
    });

    return {
      content: [{
        type: "text" as const,
        text: `Event created successfully!\nID: ${event.data.id}\nLink: ${event.data.htmlLink}`
      }]
    };
  },

  async update_event(args: unknown) {
    const { eventId, summary, description, startTime, endTime } = schemas.toolInputs.updateEvent.parse(args);

    // Get existing event
    const existingEvent = await calendar.events.get({
      calendarId: 'primary',
      eventId,
    });

    // Prepare update payload
    const updatePayload: any = {
      summary: summary || existingEvent.data.summary,
      description: description || existingEvent.data.description,
    };

    if (startTime) {
      updatePayload.start = {
        dateTime: startTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }

    if (endTime) {
      updatePayload.end = {
        dateTime: endTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }

    await calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: updatePayload,
    });

    return {
      content: [{
        type: "text" as const,
        text: `Event ${eventId} updated successfully!`
      }]
    };
  },

  async delete_event(args: unknown) {
    const { eventId } = schemas.toolInputs.deleteEvent.parse(args);

    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });

    return {
      content: [{
        type: "text" as const,
        text: `Event ${eventId} deleted successfully!`
      }]
    };
  },

  async find_free_time(args: unknown) {
    const { timeMin, timeMax, duration } = schemas.toolInputs.findFreeTime.parse(args);

    // Get existing events in the time range
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    const freeTimes: { start: string; end: string }[] = [];
    
    let currentTime = new Date(timeMin);
    const endTime = new Date(timeMax);
    const durationMs = duration * 60000; // Convert minutes to milliseconds

    // Find free time slots
    for (const event of events) {
      const eventStart = new Date(event.start?.dateTime || event.start?.date || '');
      
      // Check if there's enough time before the event
      if (eventStart.getTime() - currentTime.getTime() >= durationMs) {
        freeTimes.push({
          start: currentTime.toISOString(),
          end: new Date(eventStart.getTime() - 1).toISOString(),
        });
      }
      
      currentTime = new Date(event.end?.dateTime || event.end?.date || '');
    }

    // Check for free time after the last event
    if (endTime.getTime() - currentTime.getTime() >= durationMs) {
      freeTimes.push({
        start: currentTime.toISOString(),
        end: endTime.toISOString(),
      });
    }

    const formattedTimes = freeTimes.map(slot => 
      `• ${new Date(slot.start).toLocaleString()} - ${new Date(slot.end).toLocaleString()}`
    ).join('\n');

    return {
      content: [{
        type: "text" as const,
        text: freeTimes.length ?
          `Found ${freeTimes.length} available time slots:\n\n${formattedTimes}` :
          `No available time slots found for duration of ${duration} minutes in the specified range.`
      }]
    };
  },
};

// Initialize MCP server
const server = new Server(
  {
    name: "google-calendar-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error("Tools requested by client");
  return { tools: TOOL_DEFINITIONS };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error("Tools requested by client");
    console.error("Returning tools:", JSON.stringify(TOOL_DEFINITIONS, null, 2));
    return { tools: TOOL_DEFINITIONS };
  });

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    const handler = toolHandlers[name as keyof typeof toolHandlers];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    return await handler(args);
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    throw error;
  }
});

// Start the server
async function main() {
    try {
      // Check for required environment variables
      const requiredEnvVars = [
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_REDIRECT_URI',
        'GOOGLE_REFRESH_TOKEN'
      ];
  
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      if (missingVars.length > 0) {
        console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
        process.exit(1);
      }
  
      console.error("Starting server with env vars:", {
        clientId: process.env.GOOGLE_CLIENT_ID?.substring(0, 5) + '...',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET?.substring(0, 5) + '...',
        redirectUri: process.env.GOOGLE_REDIRECT_URI,
        hasRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN
      });
  
      const transport = new StdioServerTransport();
      console.error("Created transport");
      
      await server.connect(transport);
      console.error("Connected to transport");
      
      console.error("Google Calendar MCP Server running on stdio");
    } catch (error) {
      console.error("Startup error:", error);
      process.exit(1);
    }
  }

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});