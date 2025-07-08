import { z } from 'zod';

/**
 * Base authentication schema that requires an access token
 */
const authSchema = z.object({
  /**
   * Access token obtained through OAuth 2.0 authentication
   * @example "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   */
  accessToken: z.string({
    required_error: 'Access token is required',
    invalid_type_error: 'Access token must be a string',
  })
  .min(1, 'Access token cannot be empty')
  .describe('A valid OAuth 2.0 access token obtained through user authentication')
});

/**
 * Schema for listing files
 */
export const listFilesSchema = authSchema.extend({
  /**
   * The ID of the folder to list files from. If not provided, lists from the root.
   * @example "01MZZXK5BQZCJ3S2DFFHQIS4N2JS7DMBNU"
   */
  folderId: z.string()
    .optional()
    .describe('The ID of the folder to list files from. If not provided, lists from the root.'),
    
  /**
   * Number of items to return per page (1-200)
   * @default 100
   */
  pageSize: z.number()
    .int()
    .positive()
    .max(200)
    .optional()
    .default(100)
    .describe('Number of items to return per page (1-200)'),
    
  /**
   * Token to retrieve the next page of results
   * @example "AQAD-62HgkAAAY4vS5ZZxItzL/example"
   */
  nextPageToken: z.string()
    .optional()
    .describe('Token to retrieve the next page of results')
});

/**
 * Schema for uploading a file
 */
export const uploadFileSchema = authSchema.extend({
  /**
   * The ID of the parent folder where the file will be uploaded
   * @example "01MZZXK5BQZCJ3S2DFFHQIS4N2JS7DMBNU"
   */
  parentFolderId: z.string()
    .optional()
    .describe('The ID of the parent folder. If not provided, the file will be uploaded to the root folder.'),
    
  /**
   * The name of the file to be created (required if filePath is not provided)
   * @example "document.pdf"
   */
  fileName: z.string({
    required_error: 'File name is required when filePath is not provided',
    invalid_type_error: 'File name must be a string',
  })
  .min(1, 'File name cannot be empty')
  .optional()
  .describe('The name of the file to be created, including the file extension'),
  
  /**
   * The file content as a base64-encoded string (alternative to filePath)
   * @example "JVBERi0xLjMKJcTl8uXrp/Og0MTGCjMgMCBvYmoKPDwvRmlsdGVyL0ZsYXRlRGVjb2RlL0xlbmd0aCA0Nzk+PnN0cmVhbQp4nJVUXYvbMBB8..."
   */
  fileContent: z.string({
    invalid_type_error: 'File content must be a base64-encoded string',
  })
  .min(1, 'File content cannot be empty')
  .optional()
  .describe('The file content as a base64-encoded string (alternative to filePath)'),
  
  /**
   * The path to the local file to upload (alternative to fileContent)
   * @example "/path/to/local/file.pdf"
   */
  filePath: z.string({
    invalid_type_error: 'File path must be a string',
  })
  .min(1, 'File path cannot be empty')
  .optional()
  .describe('The path to the local file to upload (alternative to fileContent)'),
  
  /**
   * Conflict behavior when a file with the same name exists
   * @default "rename"
   * @example "rename"
   */
  conflictBehavior: z.enum(['fail', 'replace', 'rename'])
    .optional()
    .default('rename')
    .describe('What to do if a file with the same name already exists')
}).refine(
  (data) => data.filePath || (data.fileName && data.fileContent),
  {
    message: 'Either filePath or both fileName and fileContent must be provided',
    path: ['filePath']
  }
);

/**
 * Type for the list files input
 */
export type ListFilesInput = z.infer<typeof listFilesSchema>;

/**
 * Type for the upload file input
 */
export type UploadFileInput = z.infer<typeof uploadFileSchema>;
