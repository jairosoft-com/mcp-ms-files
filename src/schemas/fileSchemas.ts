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
 * Type for the list files input
 */
export type ListFilesInput = z.infer<typeof listFilesSchema>;
