import { IncomingMessage, ServerResponse } from 'http';
import { getAccessTokenFromHeader } from './authService.js';
import { sseServer } from '../index.js';


// Mock data - replace with actual file service implementation
const files: Record<string, any> = {};

import { URL } from 'url';
import { z } from 'zod';
import FileService from './fileService.js';

// Define the schema for list files input
const listFilesQuerySchema = z.object({
  folderId: z.string().optional(),
  pageSize: z.coerce.number().int().positive().max(1000).optional().default(100),
  nextPageToken: z.string().optional()
});

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
function formatDriveItem(item: any): string {
  const type = item.file ? 'File' : 'Folder';
  const size = item.file ? `\n  Size: ${formatFileSize(item.size)}` : '';
  const children = item.folder ? `\n  Items: ${item.folder.childCount}` : '';
  
  return `[${type}] ${item.name}\n  URL: ${item.webUrl}${size}${children}\n  Created: ${formatDate(item.createdDateTime)}\n  Modified: ${formatDate(item.lastModifiedDateTime)}`;
}

export async function handleListFiles(req: IncomingMessage, res: ServerResponse) {
  try {
    console.log('Handling list files request');
    const token = getAccessTokenFromHeader(req);
    
    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: No access token provided' }));
      return;
    }

    // Secure token logging (only log first 8 chars for security)
    const tokenSuffix = token ? `...${token.slice(-8)}` : 'none';
    console.log(`Processing request with token suffix: ${tokenSuffix}`);
    
    // Parse query parameters
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    // Validate and parse query parameters
    const { success, data, error } = listFilesQuerySchema.safeParse(queryParams);
    
    if (!success) {
      console.error('Invalid query parameters:', error.format());
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        status: 'error',
        error: 'Invalid query parameters', 
        details: process.env.NODE_ENV === 'development' ? error.format() : undefined
      }));
    }

    const { folderId, pageSize, nextPageToken } = data;
    const fileService = new FileService();
    
    try {
      // Call the file service
      const result = await fileService.listFiles({
        accessToken: token,
        folderId,
        pageSize,
        nextPageToken
      });
      
      // Format the response
      if (result.items.length === 0) {
        const emptyResponse = {
          status: 'success',
          data: {
            items: [],
            pagination: {
              total_items: 0,
              page_size: pageSize,
              has_more: false
            }
          },
          metadata: {
            formatted_text: '## No files or folders found',
            timestamp: new Date().toISOString()
          }
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(emptyResponse));
      }
      
      // Format items for both structured and human-readable output
      const formattedItems = result.items.map(item => ({
        type: item.file ? 'file' : 'folder',
        name: item.name,
        url: item.webUrl,
        size: item.file ? formatFileSize(item.size) : undefined,
        item_count: item.folder?.childCount,
        created: item.createdDateTime,
        modified: item.lastModifiedDateTime
      }));
      
      // Create markdown formatted text
      const markdownItems = result.items.map(item => {
        const type = item.file ? 'File' : 'Folder';
        const size = item.file ? `\n- Size: ${formatFileSize(item.size)}` : '';
        const items = item.folder ? `\n- Items: ${item.folder.childCount}` : '';
        
        return `### ${item.name} (${type})
- [Open in Browser](${item.webUrl})${size}${items}
- Created: ${formatDate(item.createdDateTime)}
- Modified: ${formatDate(item.lastModifiedDateTime)}`;
      }).join('\n\n');
      
      const response = {
        status: 'success',
        data: {
          items: formattedItems,
          pagination: {
            total_items: result.items.length,
            page_size: pageSize,
            has_more: !!result.nextPageToken,
            next_page_token: result.nextPageToken
          }
        },
        metadata: {
          formatted_text: `## File Listing (${result.items.length} items)\n\n${markdownItems}`,
          timestamp: new Date().toISOString()
        }
      };
      
      // Log successful response (without sensitive data)
      console.log(`Successfully retrieved ${result.items.length} items for token suffix: ${tokenSuffix}`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      
    } catch (error: any) {
      console.error('Error listing files:', error);
      const statusCode = error.statusCode || 500;
      const message = error.message || 'Failed to list files';
      
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'error',
        error: message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }));
    }
  } catch (error: any) {
    console.error('Error in handleListFiles:', error);
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Failed to process list files request';
    
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'error',
      error: message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }));
  }
}

export async function handleGetFile(req: IncomingMessage, res: ServerResponse) {
  try {
    const token = getAccessTokenFromHeader(req);
    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: No access token provided' }));
      return;
    }

    const fileId = req.url?.split('/').pop();
    if (!fileId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File ID is required' }));
      return;
    }

    // In a real implementation, this would call the actual file service
    // const file = await fileService.getFile(token, fileId);
    const file = files[fileId];
    
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(file));
  } catch (error: any) {
    console.error('Error getting file:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message || 'Failed to get file' }));
  }
}

interface UploadRequest {
  filePath: string;
  fileName?: string;
  parentFolderId?: string;
  parentFolderName?: string; // For backward compatibility
  conflictBehavior?: 'fail' | 'replace' | 'rename';
}

export async function handleUploadFile(req: IncomingMessage, res: ServerResponse) {
  let body = '';
  
  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const token = getAccessTokenFromHeader(req);
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: No access token provided' }));
        return;
      }

      // Parse the request body
      let requestData: UploadRequest;
      try {
        requestData = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
        return;
      }

      // Validate required fields
      if (!requestData.filePath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'filePath is required' }));
        return;
      }

      const fileService = new FileService();
      
      // Upload the file
      const result = await fileService.uploadFile({
        accessToken: token,
        filePath: requestData.filePath,
        fileName: requestData.fileName,
        parentFolderId: requestData.parentFolderId,
        parentFolderName: requestData.parentFolderName,
        conflictBehavior: requestData.conflictBehavior || 'rename'
      });

      // Send SSE notification about the new file
      sseServer.sendEventToAll({
        type: 'file_created',
        data: result,
        timestamp: new Date().toISOString()
      });

      // Return the uploaded file info
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        data: result,
        metadata: {
          message: 'File uploaded successfully',
          timestamp: new Date().toISOString()
        }
      }));
    } catch (error: any) {
      console.error('Error uploading file:', error);
      const statusCode = error.statusCode || 500;
      const message = error.message || 'Failed to upload file';
      
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'error',
        error: message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }));
    }
  });
}

export async function handleDeleteFile(req: IncomingMessage, res: ServerResponse) {
  try {
    const token = getAccessTokenFromHeader(req);
    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: No access token provided' }));
      return;
    }

    const fileId = req.url?.split('/').pop();
    if (!fileId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File ID is required' }));
      return;
    }

    // In a real implementation, this would call the actual file service
    // await fileService.deleteFile(token, fileId);
    const file = files[fileId];
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return;
    }

    delete files[fileId];

    // Notify all connected clients about the deleted file
    sseServer.sendEventToAll({
      type: 'file_deleted',
      data: { id: fileId },
      timestamp: new Date().toISOString()
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'File deleted successfully' }));
  } catch (error: any) {
    console.error('Error deleting file:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message || 'Failed to delete file' }));
  }
}

interface DownloadRequest {
  fileId: string;
  outputPath?: string;
  fileName?: string;
}

/**
 * Handles file download requests
 */
export async function handleDownloadFile(
  req: IncomingMessage, 
  res: ServerResponse, 
  options: DownloadRequest
) {
  try {
    const token = getAccessTokenFromHeader(req);
    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'error',
        error: 'Unauthorized: No access token provided' 
      }));
      return;
    }

    const { fileId, outputPath, fileName } = options;
    if (!fileId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'error',
        error: 'File ID is required' 
      }));
      return;
    }

    const fileService = new FileService();
    const result = await fileService.downloadFile({
      accessToken: token,
      fileId,
      outputPath,
      fileName: fileName || undefined
    });

    // If outputPath was provided, return file info as JSON
    if (outputPath) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        data: {
          fileName: result.fileName,
          filePath: result.filePath,
          mimeType: result.mimeType,
          size: result.size
        },
        metadata: {
          message: 'File downloaded successfully',
          timestamp: new Date().toISOString()
        }
      }));
    } else {
      // If no outputPath, stream the file directly
      res.writeHead(200, {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
        'Content-Length': Buffer.byteLength(result.content, 'base64')
      });
      res.end(Buffer.from(result.content, 'base64'));
    }
  } catch (error: any) {
    console.error('Error downloading file:', error);
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Failed to download file';
    
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'error',
      error: message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }));
  }
}

// All handler functions are already exported individually above
