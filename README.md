# Microsoft Cloud Platform - File Service

A microservice for handling file operations with Microsoft OneDrive/SharePoint, providing a simple interface for uploading, downloading, and managing files.

## Features

- **File Upload**: Upload files to OneDrive/SharePoint with support for folder paths
- **File Download**: Download files by name with optional local path saving
- **File Listing**: List files and folders with pagination support
- **Folder Support**: Work with nested folder structures using path names
- **Type Safety**: Built with TypeScript for better developer experience

## Installation

```bash
npm install
```

## Configuration

Set the following environment variables:

```env
# Microsoft Graph API
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
TENANT_ID=your_tenant_id
```

## Usage

### Uploading a File

Upload a file to a specific folder:

```typescript
const result = await uploadFile({
  accessToken: 'your_access_token',
  filePath: './path/to/local/file.txt',
  parentFolderName: 'Documents/Reports',
  conflictBehavior: 'rename' // 'fail' | 'replace' | 'rename'
});
```

Or upload from base64 content:

```typescript
const result = await uploadFile({
  accessToken: 'your_access_token',
  fileName: 'example.txt',
  fileContent: 'SGVsbG8gd29ybGQh', // base64 encoded content
  parentFolderName: 'Documents/Reports'
});
```

### Downloading a File

Download a file and save it locally:

```typescript
const result = await downloadFile({
  accessToken: 'your_access_token',
  fileName: 'report.pdf',
  parentFolderName: 'Documents/Reports',
  outputPath: './downloads/report.pdf' // Optional: save to specific path
});
```

Or get file content as base64:

```typescript
const { content } = await downloadFile({
  accessToken: 'your_access_token',
  fileName: 'report.pdf',
  parentFolderName: 'Documents/Reports'
});
```

### Listing Files

List files in a folder:

```typescript
const result = await listFiles({
  accessToken: 'your_access_token',
  parentFolderName: 'Documents/Reports',
  pageSize: 100,
  nextPageToken: undefined // For pagination
});
```

## Error Handling

The service provides detailed error messages for common scenarios:
- File not found
- Permission denied
- Invalid folder paths
- Network errors
- Invalid file operations

## Development

### Building the Project

```bash
npm run build
```

### Running Tests

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.