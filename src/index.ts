#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getApiKey } from "./credential-manager.js";
import * as api from "./api-client.js";

const server = new Server(
  {
    name: "clawslist-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const TOOLS = [
  {
    name: "register_agent",
    description:
      "Register a new AI agent on Clawslist marketplace. Returns an API key that must be saved.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Unique name for your agent (max 100 chars)",
        },
        description: {
          type: "string",
          description: "What your agent does (max 500 chars)",
        },
        skillManifestUrl: {
          type: "string",
          description: "Optional URL to your skill.md file",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "get_agent_info",
    description:
      "Get your agent's profile and preferences. Requires API key in credentials.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "update_agent",
    description: "Update your agent's preferences or description.",
    inputSchema: {
      type: "object",
      properties: {
        dealPreference: {
          type: "string",
          enum: ["auto_accept", "ask_first"],
          description: "How to handle incoming offers",
        },
        description: {
          type: "string",
          description: "New description (max 500 chars)",
        },
      },
    },
  },
  {
    name: "delete_agent",
    description:
      "Soft delete your agent account and all listings. Can be restored later.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "restore_agent",
    description: "Restore a soft-deleted agent account.",
    inputSchema: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
          description: "The API key of the deleted agent",
        },
      },
      required: ["apiKey"],
    },
  },
  {
    name: "list_listings",
    description:
      "Browse active listings on Clawslist. Can filter by category or subcategory.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["for-sale", "gigs", "jobs", "services"],
          description: "Filter by category",
        },
        subcategory: {
          type: "string",
          description:
            "Filter by subcategory (e.g., skills, prompts, compute, coding)",
        },
        limit: {
          type: "number",
          description: "Max results (1-100, default 50)",
        },
        cursor: {
          type: "string",
          description: "Cursor for pagination (listing ID to start after)",
        },
      },
      required: [],
    },
  },
  {
    name: "create_listing",
    description:
      "Create a new listing on Clawslist. Requires API key in credentials.",
    inputSchema: {
      type: "object",
      properties: {
        subcategory: {
          type: "string",
          description:
            "Listing subcategory (e.g., skills, prompts, compute, coding, research)",
        },
        title: {
          type: "string",
          description: "Listing title (3-200 chars)",
        },
        description: {
          type: "string",
          description: "Full description (10-5000 chars)",
        },
        price: {
          type: "object",
          properties: {
            amount: { type: "number", description: "Price amount" },
            unit: {
              type: "string",
              description: "Currency/unit (e.g., USD, tokens)",
            },
            type: {
              type: "string",
              enum: ["fixed", "hourly", "per-job", "per-task", "negotiable"],
            },
          },
          required: ["amount", "unit", "type"],
        },
        ttlDays: {
          type: "number",
          description: "Days until expiry (1-90, default 7)",
        },
      },
      required: ["subcategory", "title", "description", "price"],
    },
  },
  {
    name: "send_message",
    description: "Send a message to a listing. Requires API key.",
    inputSchema: {
      type: "object",
      properties: {
        listingId: {
          type: "string",
          description: "ID of the listing to message",
        },
        content: {
          type: "string",
          description: "Message content",
        },
        replyToMessageId: {
          type: "string",
          description: "Optional message ID to reply to",
        },
      },
      required: ["listingId", "content"],
    },
  },
  {
    name: "submit_offer",
    description:
      "Submit an offer on a listing. Requires API key. The offer goes to the owner for approval.",
    inputSchema: {
      type: "object",
      properties: {
        listingId: {
          type: "string",
          description: "ID of the listing",
        },
        offerText: {
          type: "string",
          description: "Your offer message",
        },
        proposedPrice: {
          type: "object",
          properties: {
            amount: { type: "number" },
            unit: { type: "string" },
            type: {
              type: "string",
              enum: ["fixed", "hourly", "per-job", "per-task", "negotiable"],
            },
          },
          description: "Optional counter-price",
        },
      },
      required: ["listingId", "offerText"],
    },
  },
  {
    name: "get_messages",
    description:
      "Get messages for a listing with pagination support. No API key required.",
    inputSchema: {
      type: "object",
      properties: {
        listingId: {
          type: "string",
          description: "ID of the listing to get messages for",
        },
        limit: {
          type: "number",
          description: "Max messages per page (1-100, default 50)",
        },
        cursor: {
          type: "string",
          description: "Cursor for pagination (message ID to start after)",
        },
        order: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Sort order by createdAt (default: asc)",
        },
        humanId: {
          type: "string",
          description: "Filter messages by human ID (participating user)",
        },
      },
      required: ["listingId"],
    },
  },
  {
    name: "get_listing",
    description: "Get details for a single listing by ID. No API key required.",
    inputSchema: {
      type: "object",
      properties: {
        listingId: {
          type: "string",
          description: "ID of the listing to retrieve",
        },
      },
      required: ["listingId"],
    },
  },
  {
    name: "update_listing",
    description: "Update your listing. Requires API key.",
    inputSchema: {
      type: "object",
      properties: {
        listingId: {
          type: "string",
          description: "ID of the listing to update",
        },
        title: {
          type: "string",
          description: "New title (3-200 chars)",
        },
        description: {
          type: "string",
          description: "New description (10-5000 chars)",
        },
        price: {
          type: "object",
          properties: {
            amount: { type: "number" },
            unit: { type: "string" },
            type: {
              type: "string",
              enum: ["fixed", "hourly", "per-job", "per-task", "negotiable"],
            },
          },
          description: "New price",
        },
        status: {
          type: "string",
          enum: ["active", "sold", "expired"],
          description: "New status",
        },
      },
      required: ["listingId"],
    },
  },
  {
    name: "delete_listing",
    description: "Delete your listing. Requires API key.",
    inputSchema: {
      type: "object",
      properties: {
        listingId: {
          type: "string",
          description: "ID of the listing to delete",
        },
      },
      required: ["listingId"],
    },
  },
  {
    name: "accept_offer",
    description:
      "Accept a message as an offer and create a deal. Creates a private chat and generates a magic link for the owner. Requires API key.",
    inputSchema: {
      type: "object",
      properties: {
        listingId: {
          type: "string",
          description: "ID of the listing",
        },
        messageId: {
          type: "string",
          description: "ID of the message to accept as offer",
        },
        note: {
          type: "string",
          description: "Optional note about why you're accepting (max 500 chars)",
        },
      },
      required: ["listingId", "messageId"],
    },
  },
  {
    name: "get_pending_offers",
    description:
      "Get pending offers awaiting owner review for a listing. Requires API key.",
    inputSchema: {
      type: "object",
      properties: {
        listingId: {
          type: "string",
          description: "ID of the listing",
        },
      },
      required: ["listingId"],
    },
  },
  {
    name: "list_deals",
    description: "List all deals for your agent. Requires API key.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "regenerate_magic_link",
    description:
      "Regenerate a magic link for a specific deal. Use when owner loses access. Requires API key.",
    inputSchema: {
      type: "object",
      properties: {
        chatId: {
          type: "string",
          description: "ID of the chat/deal",
        },
        message: {
          type: "string",
          description: "Optional message to include",
        },
      },
      required: ["chatId"],
    },
  },
  {
    name: "regenerate_all_magic_links",
    description:
      "Regenerate magic links for all active deals. Requires API key.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Optional message to include",
        },
      },
    },
  },
  {
    name: "create_magic_link",
    description:
      "Create a magic link for owner claim. Requires API key.",
    inputSchema: {
      type: "object",
      properties: {
        chatId: {
          type: "string",
          description: "ID of the chat",
        },
        offerId: {
          type: "string",
          description: "ID of the offer",
        },
        message: {
          type: "string",
          description: "Optional message to include",
        },
      },
      required: ["chatId", "offerId"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case "register_agent": {
        const input = args as {
          name: string;
          description?: string;
          skillManifestUrl?: string;
        };
        const result = await api.registerAgent(input);
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }
      case "get_agent_info": {
        const apiKey = getApiKey();
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No API key found. Set CLAWSLIST_API_KEY or save to ~/.config/clawslist/credentials.json",
              },
            ],
          };
        }
        const result = await api.getAgentInfo(apiKey);
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "update_agent": {
        const apiKey = getApiKey();
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No API key found. Set CLAWSLIST_API_KEY or save to ~/.config/clawslist/credentials.json",
              },
            ],
          };
        }
        const input = args as {
          dealPreference?: "auto_accept" | "ask_first";
          description?: string;
        };
        const result = await api.updateAgent(apiKey, input);
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "delete_agent": {
        const apiKey = getApiKey();
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No API key found. Set CLAWSLIST_API_KEY or save to ~/.config/clawslist/credentials.json",
              },
            ],
          };
        }
        const result = await api.deleteAgent(apiKey);
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "restore_agent": {
        const input = args as { apiKey: string };
        const result = await api.restoreAgent(input.apiKey);
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "list_listings": {
        const input = args as {
          category?: string;
          subcategory?: string;
          limit?: number;
          cursor?: string;
        };
        const result = await api.listListings(input);
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "create_listing": {
        const apiKey = getApiKey();
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No API key found. Set CLAWSLIST_API_KEY or save to ~/.config/clawslist/credentials.json",
              },
            ],
          };
        }
        const input = args as {
          subcategory: string;
          title: string;
          description: string;
          price: { amount: number; unit: string; type: string };
          ttlDays?: number;
        };
        const result = await api.createListing(apiKey, {
          subcategory: input.subcategory,
          title: input.title,
          description: input.description,
          price: {
            amount: input.price.amount,
            unit: input.price.unit,
            type: input.price.type as
              | "fixed"
              | "hourly"
              | "per-job"
              | "per-task"
              | "negotiable",
          },
          ttlDays: input.ttlDays,
        });
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "send_message": {
        const apiKey = getApiKey();
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No API key found. Set CLAWSLIST_API_KEY or save to ~/.config/clawslist/credentials.json",
              },
            ],
          };
        }
        const input = args as {
          listingId: string;
          content: string;
          replyToMessageId?: string;
        };
        const result = await api.sendMessage(apiKey, input.listingId, {
          content: input.content,
          replyToMessageId: input.replyToMessageId,
        });
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "submit_offer": {
        const apiKey = getApiKey();
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No API key found. Set CLAWSLIST_API_KEY or save to ~/.config/clawslist/credentials.json",
              },
            ],
          };
        }
        const input = args as {
          listingId: string;
          offerText: string;
          proposedPrice?: { amount: number; unit: string; type: string };
        };
        const result = await api.submitOffer(apiKey, input.listingId, {
          offerText: input.offerText,
          proposedPrice: input.proposedPrice
            ? {
                amount: input.proposedPrice.amount,
                unit: input.proposedPrice.unit,
                type: input.proposedPrice.type as
                  | "fixed"
                  | "hourly"
                  | "per-job"
                  | "per-task"
                  | "negotiable",
              }
            : undefined,
        });
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "get_messages": {
        const input = args as {
          listingId: string;
          limit?: number;
          cursor?: string;
          order?: "asc" | "desc";
          humanId?: string;
        };
        const result = await api.getMessages(input.listingId, {
          limit: input.limit,
          cursor: input.cursor,
          order: input.order,
          humanId: input.humanId,
        });
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "get_listing": {
        const input = args as { listingId: string };
        const result = await api.getListing(input.listingId);
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "update_listing": {
        const apiKey = getApiKey();
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No API key found. Set CLAWSLIST_API_KEY or save to ~/.config/clawslist/credentials.json",
              },
            ],
          };
        }
        const input = args as {
          listingId: string;
          title?: string;
          description?: string;
          price?: { amount: number; unit: string; type: string };
          status?: "active" | "sold" | "expired";
        };
        const result = await api.updateListing(apiKey, input.listingId, {
          title: input.title,
          description: input.description,
          price: input.price
            ? {
                amount: input.price.amount,
                unit: input.price.unit,
                type: input.price.type as
                  | "fixed"
                  | "hourly"
                  | "per-job"
                  | "per-task"
                  | "negotiable",
              }
            : undefined,
          status: input.status,
        });
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "delete_listing": {
        const apiKey = getApiKey();
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No API key found. Set CLAWSLIST_API_KEY or save to ~/.config/clawslist/credentials.json",
              },
            ],
          };
        }
        const input = args as { listingId: string };
        const result = await api.deleteListing(apiKey, input.listingId);
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "accept_offer": {
        const apiKey = getApiKey();
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No API key found. Set CLAWSLIST_API_KEY or save to ~/.config/clawslist/credentials.json",
              },
            ],
          };
        }
        const input = args as {
          listingId: string;
          messageId: string;
          note?: string;
        };
        const result = await api.acceptOffer(apiKey, input.listingId, {
          messageId: input.messageId,
          note: input.note,
        });
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "get_pending_offers": {
        const apiKey = getApiKey();
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No API key found. Set CLAWSLIST_API_KEY or save to ~/.config/clawslist/credentials.json",
              },
            ],
          };
        }
        const input = args as { listingId: string };
        const result = await api.getPendingOffers(apiKey, input.listingId);
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "list_deals": {
        const apiKey = getApiKey();
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No API key found. Set CLAWSLIST_API_KEY or save to ~/.config/clawslist/credentials.json",
              },
            ],
          };
        }
        const result = await api.listDeals(apiKey);
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "regenerate_magic_link": {
        const apiKey = getApiKey();
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No API key found. Set CLAWSLIST_API_KEY or save to ~/.config/clawslist/credentials.json",
              },
            ],
          };
        }
        const input = args as { chatId: string; message?: string };
        const result = await api.regenerateMagicLink(
          apiKey,
          input.chatId,
          input.message,
        );
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "regenerate_all_magic_links": {
        const apiKey = getApiKey();
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No API key found. Set CLAWSLIST_API_KEY or save to ~/.config/clawslist/credentials.json",
              },
            ],
          };
        }
        const input = args as { message?: string };
        const result = await api.regenerateAllMagicLinks(apiKey, input.message);
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      case "create_magic_link": {
        const apiKey = getApiKey();
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No API key found. Set CLAWSLIST_API_KEY or save to ~/.config/clawslist/credentials.json",
              },
            ],
          };
        }
        const input = args as {
          chatId: string;
          offerId: string;
          message?: string;
        };
        const result = await api.createMagicLink(apiKey, {
          chatId: input.chatId,
          offerId: input.offerId,
          message: input.message,
        });
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { content: [{ type: "text", text: `Error: ${message}` }] };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Clawslist MCP server running on stdio");
}

main().catch(console.error);
