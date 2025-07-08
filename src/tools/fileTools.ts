import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listFilesSchema, type ListFilesInput } from '../schemas/fileSchemas.js';
import type { DriveItem } from '../interfaces/files.js';
import FileService from '../services/fileService.js';
import { Client } from '@microsoft/microsoft-graph-client';

/**
 * Formats a file/folder size in a human-readable format
 */
function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formats a date string to a readable format
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

/**
 * Formats a file/folder item for display
 */
function formatDriveItem(item: DriveItem): string {
  const type = item.file ? 'File' : 'Folder';
  const size = item.file ? `\n  Size: ${formatFileSize(item.size)}` : '';
  const children = item.folder ? `\n  Items: ${item.folder.childCount}` : '';
  
  return `[${type}] ${item.name}
  URL: ${item.webUrl}${size}${children}\n  Created: ${formatDate(item.createdDateTime)}\n  Modified: ${formatDate(item.lastModifiedDateTime)}`;
}

/**
 * Registers the file tools with the MCP server
 * @param server - The MCP server instance
 */
export function registerFileTools(server: McpServer): void {
  // Create a new instance of the FileService
  const fileService = new FileService();

  // Register the listFiles tool
  server.tool(
    'listFiles',
    'List files and folders from OneDrive/SharePoint',
    listFilesSchema.shape,
    async (input: ListFilesInput) => {
      try {
        const result = await fileService.listFiles(input);
        
        if (result.items.length === 0) {
          return {
            content: [{ type: 'text', text: 'No files or folders found.' }]
          };
        }
        
        const formattedItems = result.items.map(item => formatDriveItem(item)).join('\n\n');
        const moreInfo = result.nextPageToken 
          ? '\\n\\nThere are more items available. Use the nextPageToken to fetch the next page.'
          : '';
        
        return {
          content: [{
            type: 'text',
            text: `Found ${result.items.length} items:\\n\\n${formattedItems}${moreInfo}`
          }],
          metadata: {
            nextPageToken: result.nextPageToken,
            itemCount: result.items.length
          }
        };
      } catch (error: unknown) {
        console.error('Error in listFiles tool:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new Error(`Failed to list files: ${errorMessage}`);
      }
    }
  );
}

export default {
  registerFileTools
};
