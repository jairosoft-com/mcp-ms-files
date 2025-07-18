// @ts-ignore - Missing type definitions for @modelcontextprotocol/sdk
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// @ts-ignore - Missing type definitions for @modelcontextprotocol/sdk
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerFileTools } from './tools/fileTools.js';
import { SseServer } from './server/sseServer.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Create server instance
const server = new McpServer({
  name: "ms-files",
  version: "1.0.0",
  description: "Microsoft OneDrive/SharePoint Files Integration"
});

// Register tools
registerFileTools(server);

// Create SSE server instance
export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;
export const sseServer = new SseServer(PORT);

// Handle graceful shutdown
async function shutdown() {
  console.log('Shutting down servers...');
  try {
    await sseServer.stop();
    console.log('SSE Server stopped successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Received SIGINT. Starting graceful shutdown...');
  shutdown().catch(console.error);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Starting graceful shutdown...');
  shutdown().catch(console.error);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  shutdown().catch(() => process.exit(1));
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown().catch(console.error);
});

// Start both servers
async function main() {
  try {
    // Start MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("MCP Files Server running on stdio");

    // Start SSE server
    await sseServer.start();
    console.log(`SSE Files Server started on port ${PORT}`);
  } catch (error) {
    console.error('Failed to start servers:', error);
    process.exit(1);
  }
}

// Start the servers
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});