import { Client } from '@microsoft/microsoft-graph-client';
import { DriveItem, ListFilesResponse } from '../interfaces/files.js';
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
}

export default FileService;
