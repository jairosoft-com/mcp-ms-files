import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { 
  listFilesSchema, 
  type ListFilesInput, 
  type UploadFileInput, 
  downloadFileSchema, 
  type DownloadFileInput 
} from '../schemas/fileSchemas.js';
import type { DriveItem, DownloadFileResponse } from '../interfaces/files.js';
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

  // Register the uploadFile tool with proper type safety
  server.tool(
    'uploadFile',
    'Upload a file to OneDrive/SharePoint',
    {
      accessToken: z.string().describe('Microsoft Graph API access token with Files.ReadWrite scope'),
      parentFolderName: z.string().optional().describe('Name/path of the parent folder (e.g., "Documents/Reports")'),
      fileName: z.string().optional().describe('Name of the file (required if filePath not provided)'),
      fileContent: z.string().optional().describe('Base64-encoded file content (required if filePath not provided)'),
      filePath: z.string().optional().describe('Local file path to upload (alternative to fileContent)'),
      conflictBehavior: z.enum(['fail', 'replace', 'rename']).default('rename')
        .describe('What to do if a file with the same name exists')
    } as const,
    async (input: UploadFileInput) => {
      try {
        const result = await fileService.uploadFile(input);
        
        return {
          content: [{
            type: 'text',
            text: `✅ File uploaded successfully!\n` +
                  `  Name: ${result.name}\n` +
                  `  Size: ${formatFileSize(result.size)}\n` +
                  `  Type: ${result.mimeType}\n` +
                  `  URL: ${result.webUrl}`
          }],
          metadata: {
            fileId: result.id,
            webUrl: result.webUrl,
            fileName: result.name,
            fileSize: result.size,
            mimeType: result.mimeType
          }
        };
      } catch (error) {
        console.error('Error in uploadFile tool:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new Error(`Failed to upload file: ${errorMessage}`);
      }
    }
  );

  // Register the downloadFile tool
  server.tool(
    'downloadFile',
    'Download a file from OneDrive/SharePoint by name',
    {
      accessToken: z.string().describe('Microsoft Graph API access token with Files.Read scope'),
      fileName: z.string().describe('Name of the file to download (including extension)'),
      parentFolderName: z.string().optional().describe('Name/path of the parent folder (e.g., "Documents/Reports")'),
      outputPath: z.string().optional().describe('Local path where to save the downloaded file (optional)')
    } as const,
    async (input: DownloadFileInput) => {
      try {
        const result = await fileService.downloadFile(input);
        
        if (result.filePath) {
          // File was saved to disk
          return {
            content: [{
              type: 'text',
              text: `✅ File downloaded successfully!\n` +
                    `  Name: ${result.fileName}\n` +
                    `  Type: ${result.mimeType}\n` +
                    `  Saved to: ${result.filePath}`
            }],
            metadata: {
              fileName: result.fileName,
              filePath: result.filePath,
              mimeType: result.mimeType
            }
          };
        } else {
          // File content is returned as base64
          return {
            content: [{
              type: 'text',
              text: `✅ File downloaded successfully!\n` +
                    `  Name: ${result.fileName}\n` +
                    `  Type: ${result.mimeType}\n` +
                    `  Size: ${formatFileSize(Buffer.from(result.content || '', 'base64').length)}`
            }],
            metadata: {
              fileName: result.fileName,
              mimeType: result.mimeType,
              fileSize: Buffer.from(result.content || '', 'base64').length,
              content: result.content
            }
          };
        }
      } catch (error) {
        console.error('Error in downloadFile tool:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new Error(`Failed to download file: ${errorMessage}`);
      }
    }
  );
}

export default {
  registerFileTools
};
