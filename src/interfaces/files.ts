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

/**
 * Input parameters for uploading a file
 */
export interface UploadFileInput {
  /**
   * Access token for authentication
   */
  accessToken: string;
  
  /**
   * The name of the parent folder where the file will be uploaded
   * If not provided, the file will be uploaded to the root folder
   */
  parentFolderName?: string;
  
  /**
   * The name of the file to be created (required if filePath is not provided)
   */
  fileName?: string;
  
  /**
   * The file content as a base64-encoded string (alternative to filePath)
   */
  fileContent?: string;
  
  /**
   * The path to the local file to upload (alternative to fileContent)
   */
  filePath?: string;
  
  /**
   * Conflict behavior when a file with the same name exists
   * @default 'rename'
   */
  conflictBehavior?: 'fail' | 'replace' | 'rename';
}

/**
 * Response from a file upload operation
 */
export interface UploadFileResponse {
  /**
   * The ID of the uploaded file
   */
  id: string;
  
  /**
   * The web URL of the uploaded file
   */
  webUrl: string;
  
  /**
   * The name of the uploaded file
   */
  name: string;
  
  /**
   * The size of the uploaded file in bytes
   */
  size: number;
  
  /**
   * The MIME type of the file
   */
  mimeType: string;
}

/**
 * Input parameters for downloading a file
 */
export interface DownloadFileInput {
  /**
   * Access token for authentication
   */
  accessToken: string;
  
  /**
   * The name of the file to download (exact match required)
   */
  fileName: string;
  
  /**
   * The name of the parent folder where the file is located
   * If not provided, searches in the root folder
   */
  parentFolderName?: string;
  
  /**
   * Local filesystem path where the file should be saved
   * If not provided, the file content will be returned as base64
   */
  outputPath?: string;
}

/**
 * Response from a file download operation
 */
export interface DownloadFileResponse {
  /**
   * The file content as a base64-encoded string (only if outputPath was not provided)
   */
  content?: string;
  
  /**
   * The name of the downloaded file
   */
  fileName: string;
  
  /**
   * The MIME type of the file
   */
  mimeType: string;
  
  /**
   * The local filesystem path where the file was saved (only if outputPath was provided)
   */
  filePath?: string;
}
