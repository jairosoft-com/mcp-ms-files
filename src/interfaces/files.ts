/**
 * Represents a file or folder in OneDrive/SharePoint
 */
export interface DriveItem {
  id: string;
  name: string;
  webUrl: string;
  size?: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  file?: {
    mimeType: string;
    hashes?: {
      quickXorHash?: string;
    };
  };
  folder?: {
    childCount: number;
  };
  parentReference?: {
    driveId: string;
    id: string;
    path: string;
  };
}

/**
 * Input parameters for listing files
 */
export interface ListFilesInput {
  /**
   * The ID of the parent folder. If not provided, lists files from the root.
   */
  folderId?: string;
  
  /**
   * Number of items to return per page
   */
  pageSize?: number;
  
  /**
   * The token to retrieve the next page of results
   */
  nextPageToken?: string;
}

/**
 * Response for listing files
 */
export interface ListFilesResponse {
  items: DriveItem[];
  nextPageToken?: string;
}
