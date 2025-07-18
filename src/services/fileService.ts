import { Client } from '@microsoft/microsoft-graph-client';
import { promises as fs } from 'fs';
import path from 'path';
import { 
  DriveItem, 
  ListFilesResponse, 
  UploadFileInput, 
  UploadFileResponse,
  DownloadFileInput,
  DownloadFileResponse 
} from '../interfaces/files.js';
import { ListFilesInput } from '../schemas/fileSchemas.js';

/**
 * Service for handling file operations with Microsoft Graph API
 */
export class FileService {
  /**
   * Creates a new instance of FileService
   */
  constructor() {}

  /**
   * Creates a Graph client with the provided access token
   * @param accessToken The OAuth 2.0 access token
   * @returns A configured Graph client instance
   */
  private getGraphClient(accessToken: string): Client {
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
  }

  /**
   * Downloads a file from OneDrive/SharePoint
   * @param input The download parameters including file ID and optional output path
   * @returns A promise that resolves to the download response
   */
  async downloadFile(input: DownloadFileInput): Promise<DownloadFileResponse> {
    const { accessToken, fileId, outputPath, fileName } = input;
    
    if (!fileId) {
      throw new Error('File ID is required for download');
    }

    const graphClient = this.getGraphClient(accessToken);

    try {
      // Get file metadata first
      const fileItem = await graphClient
        .api(`/me/drive/items/${fileId}`)
        .get();

      // Download file content
      const content = await graphClient
        .api(`/me/drive/items/${fileId}/content`)
        .responseType('arraybuffer' as any) // Using 'any' to bypass TypeScript type checking for responseType
        .get();

      const contentBuffer = Buffer.from(content);
      const base64Content = contentBuffer.toString('base64');
      const finalFileName = fileName || fileItem.name;

      // If output path is provided, save the file
      if (outputPath) {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // Create directory if it doesn't exist
        await fs.mkdir(outputPath, { recursive: true });
        
        const filePath = path.join(outputPath, finalFileName);
        await fs.writeFile(filePath, contentBuffer);

        return {
          content: base64Content,
          fileName: finalFileName,
          mimeType: fileItem.file?.mimeType || 'application/octet-stream',
          filePath,
          size: contentBuffer.length
        };
      }

      // If no output path, return the content directly
      return {
        content: base64Content,
        fileName: finalFileName,
        mimeType: fileItem.file?.mimeType || 'application/octet-stream',
        size: contentBuffer.length,
        filePath: undefined
      };
    } catch (error: any) {
      console.error('Error downloading file:', error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Lists files and folders from OneDrive/SharePoint
   * @param input The input parameters for listing files, including the access token
   * @returns A promise that resolves to the list of files and folders
   */
  async listFiles(input: ListFilesInput): Promise<ListFilesResponse> {
    const { accessToken, folderId, pageSize = 100, nextPageToken } = input;
    const graphClient = this.getGraphClient(accessToken);
    
    try {
      
      // Construct the base URL
      let url = folderId 
        ? `/me/drive/items/${folderId}/children`
        : '/me/drive/root/children';
      
      // Add query parameters
      const params = new URLSearchParams();
      params.append('$top', pageSize.toString());
      params.append('$select', 'id,name,size,webUrl,createdDateTime,lastModifiedDateTime,file,folder,parentReference');
      params.append('$orderby', 'name');
      
      if (nextPageToken) {
        params.append('$skiptoken', nextPageToken);
      }
      
      // Get the response from Microsoft Graph
      const response = await this.getGraphClient(accessToken)
        .api(`${url}?${params.toString()}`)
        .get();
      
      // Format the response
      const items = response.value.map((item: any) => ({
        id: item.id,
        name: item.name,
        webUrl: item.webUrl,
        size: item.size,
        createdDateTime: item.createdDateTime,
        lastModifiedDateTime: item.lastModifiedDateTime,
        file: item.file ? {
          mimeType: item.file.mimeType,
          hashes: item.file.hashes
        } : undefined,
        folder: item.folder ? {
          childCount: item.folder.childCount
        } : undefined,
        parentReference: item.parentReference
      }));
      
      return {
        items,
        nextPageToken: response['@odata.nextLink']?.match(/[&?]\$skiptoken=([^&]+)/)?.[1]
      };
    } catch (error: unknown) {
      console.error('Error listing files:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to list files: ${errorMessage}`);
    }
  }

  /**
   * Extracts the skip token from a nextLink URL
   * @param nextLink The nextLink URL from Microsoft Graph API
   * @returns The skip token or undefined if not found
   */
  private extractSkipToken(nextLink: string): string | undefined {
    try {
      const url = new URL(nextLink);
      return url.searchParams.get('$skiptoken') || undefined;
    } catch (error) {
      console.error('Error extracting skip token:', error);
      return undefined;
    }
  }

  /**
   * Reads a file from the local filesystem and returns it as a base64 string
   * @param filePath Path to the file to read
   * @returns Base64-encoded file content and file name
   */
  private async readFileAsBase64(filePath: string): Promise<{ content: string; fileName: string }> {
    try {
      const absolutePath = path.resolve(filePath);
      const fileName = path.basename(absolutePath);
      const fileBuffer = await fs.readFile(absolutePath);
      return {
        content: fileBuffer.toString('base64'),
        fileName
      };
    } catch (error) {
      console.error('Error reading file:', error);
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Uploads a file to OneDrive/SharePoint
   * @param input The upload parameters including file content or file path
   * @returns Information about the uploaded file
   */
  /**
   * Resolves a folder path to its ID
   * @param accessToken The OAuth 2.0 access token
   * @param folderPath The folder path (e.g., 'Documents/Reports')
   * @returns The folder ID or undefined if not found
   */
  private async resolveFolderId(accessToken: string, folderPath?: string): Promise<string | undefined> {
    if (!folderPath) return undefined;
    
    const graphClient = this.getGraphClient(accessToken);
    const folders = folderPath.split('/').filter(Boolean);
    let currentId = 'root';
    
    try {
      for (const folder of folders) {
        const response = await graphClient
          .api(`/me/drive/items/${currentId}/children`)
          .filter(`name eq '${folder}' and folder ne null`)
          .select('id')
          .get();
          
        if (!response.value || response.value.length === 0) {
          throw new Error(`Folder '${folder}' not found in path '${folderPath}'`);
        }
        
        currentId = response.value[0].id;
      }
      
      return currentId === 'root' ? undefined : currentId;
    } catch (error) {
      console.error('Error resolving folder path:', error);
      throw new Error(`Failed to resolve folder path '${folderPath}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadFile(input: UploadFileInput): Promise<UploadFileResponse> {
    const { accessToken, parentFolderName, filePath, fileName: inputFileName, fileContent, conflictBehavior = 'rename' } = input;
    const graphClient = this.getGraphClient(accessToken);
    
    try {
      let finalFileName = inputFileName;
      let finalFileContent = fileContent;

      // If filePath is provided, read the file and get its content and name
      if (filePath) {
        const { content, fileName } = await this.readFileAsBase64(filePath);
        finalFileContent = content;
        finalFileName = finalFileName || fileName;
      }

      // Ensure we have both file name and content
      if (!finalFileName) {
        throw new Error('File name is required when filePath is not provided');
      }
      if (!finalFileContent) {
        throw new Error('File content is required when filePath is not provided');
      }

      // Resolve folder name to ID if provided
      const parentFolderId = parentFolderName 
        ? await this.resolveFolderId(accessToken, parentFolderName)
        : undefined;

      // Determine the upload URL based on whether a parent folder is specified
      const uploadUrl = parentFolderId 
        ? `/me/drive/items/${parentFolderId}:/${encodeURIComponent(finalFileName)}:/content`
        : `/me/drive/root:/${encodeURIComponent(finalFileName)}:/content`;
      
      // Add conflict behavior to query parameters
      const params = new URLSearchParams();
      params.append('@microsoft.graph.conflictBehavior', conflictBehavior);
      
      // Convert base64 to ArrayBuffer
      const buffer = Buffer.from(finalFileContent, 'base64');
      
      // Upload the file
      const response = await graphClient
        .api(`${uploadUrl}?${params.toString()}`)
        .header('Content-Type', 'application/octet-stream')
        .put(buffer);
      
      return {
        id: response.id,
        webUrl: response.webUrl,
        name: response.name,
        size: response.size,
        mimeType: response.file?.mimeType || 'application/octet-stream'
      };
      
    } catch (error: unknown) {
      console.error('Error uploading file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to upload file: ${errorMessage}`);
    }
  }

  /**
   * Downloads a file from OneDrive/SharePoint
   * @param input The download parameters including file name and optional output path
   * @returns File information and content or saved file path
   */
  async downloadFile(input: DownloadFileInput): Promise<DownloadFileResponse> {
    const { accessToken, fileName, parentFolderName, outputPath } = input;
    const graphClient = this.getGraphClient(accessToken);
    
    try {
      // Resolve folder name to ID if provided
      const parentFolderId = parentFolderName
        ? await this.resolveFolderId(accessToken, parentFolderName)
        : undefined;

      // Build the search query
      let searchUrl = parentFolderId
        ? `/me/drive/items/${parentFolderId}:/${encodeURIComponent(fileName)}`
        : `/me/drive/root:/${encodeURIComponent(fileName)}`;

      // First, get the file metadata to check if it exists and get its download URL
      const fileMetadata = await graphClient
        .api(searchUrl)
        .select('id,name,size,file')
        .get();

      if (!fileMetadata || !fileMetadata.file) {
        throw new Error(`File '${fileName}' not found`);
      }

      // Get the download URL
      const downloadUrl = `/me/drive/items/${fileMetadata.id}/content`;
      
      // Download the file content
      const fileContent = await graphClient
        .api(downloadUrl)
        .get();
      
      // Convert the response to a Buffer
      const fileBuffer = Buffer.from(await fileContent.arrayBuffer());
      
      // If outputPath is provided, save the file to disk
      if (outputPath) {
        // Check if outputPath is a directory (no extension)
        const isDirectory = !path.extname(outputPath);
        const finalPath = isDirectory 
          ? path.join(outputPath, fileMetadata.name) // Append filename if outputPath is a directory
          : outputPath;
          
        // Ensure the directory exists
        await fs.mkdir(path.dirname(finalPath), { recursive: true });
        
        // Save the file
        await fs.writeFile(finalPath, fileBuffer);
        
        return {
          fileName: fileMetadata.name,
          mimeType: fileMetadata.file.mimeType || 'application/octet-stream',
          filePath: path.resolve(finalPath)
        };
      }
      
      // Otherwise, return the content as base64
      return {
        fileName: fileMetadata.name,
        mimeType: fileMetadata.file.mimeType || 'application/octet-stream',
        content: fileBuffer.toString('base64')
      };
      
    } catch (error: unknown) {
      console.error('Error downloading file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to download file '${fileName}': ${errorMessage}`);
    }
  }
}

export default FileService;
