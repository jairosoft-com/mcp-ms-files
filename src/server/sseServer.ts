import http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
// Import handlers directly from the services directory
import { 
  handleListFiles, 
  handleGetFile,
  handleUploadFile,
  handleDeleteFile,
  handleDownloadFile
} from '../services/fileHandlers.js';

type SseEvent = {
  type: 'file_created' | 'file_updated' | 'file_deleted' | 'error';
  data: any;
  timestamp: string;
};

export class SseServer {
  private server: http.Server;
  private clients: Map<string, ServerResponse> = new Map();
  private port: number;

  constructor(port: number = 3002) {
    this.port = port;
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = req.url || '/';
    const { pathname } = parse(url, true);
    
    console.log(`\n=== New Request ===`);
    console.log(`Method: ${req.method}`);
    console.log(`URL: ${url}`);
    console.log('Headers:', req.headers);

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Request-Method', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, DELETE');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      console.log('Handling OPTIONS preflight request');
      res.writeHead(200);
      res.end();
      return;
    }

    console.log(`Matching route for ${req.method} ${pathname}`);
    
    if (pathname === '/events' && req.method === 'GET') {
      console.log('Handling SSE connection');
      this.handleSseConnection(req, res);
      return;
    }

    if (pathname === '/api/files' && req.method === 'GET') {
      console.log('Handling list files request');
      await handleListFiles(req, res);
      return;
    }

    if (pathname && pathname.startsWith('/api/files/') && req.method === 'GET') {
      const fileId = pathname.split('/').pop();
      console.log(`Handling get file request for ID: ${fileId}`);
      await handleGetFile(req, res);
      return;
    }

    if (pathname === '/api/files' && req.method === 'POST') {
      console.log('Handling file upload request');
      await handleUploadFile(req, res);
      return;
    }

    if (pathname && pathname.startsWith('/api/files/') && req.method === 'DELETE') {
      const fileId = pathname.split('/').pop();
      console.log(`Handling delete file request for ID: ${fileId}`);
      await handleDeleteFile(req, res);
      return;
    }

    // Handle file download
    if (pathname && pathname.startsWith('/api/files/') && pathname.endsWith('/download') && req.method === 'POST') {
      const fileId = pathname.split('/')[3]; // Get the file ID from /api/files/{id}/download
      console.log(`Handling download file request for ID: ${fileId}`);
      
      // Parse the request body for download options
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const options = body ? JSON.parse(body) : {};
          // Forward the request to the download handler
          await handleDownloadFile(req, res, { ...options, fileId });
        } catch (error) {
          console.error('Error parsing download request:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            status: 'error', 
            error: 'Invalid request body',
            details: error instanceof Error ? error.message : 'Unknown error'
          }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }

  private handleSseConnection(req: IncomingMessage, res: ServerResponse) {
    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Generate a unique ID for this client
    const clientId = Date.now().toString();
    
    // Add client to the map
    this.clients.set(clientId, res);

    // Send initial connection message
    this.sendEvent(res, 'connected', { 
      clientId,
      message: 'Connected to files server',
      timestamp: new Date().toISOString()
    });

    // Handle client disconnect
    req.on('close', () => {
      this.clients.delete(clientId);
      console.log(`Client ${clientId} disconnected`);
    });
  }

  public sendEventToAll(event: SseEvent) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    
    this.clients.forEach((clientRes, clientId) => {
      try {
        clientRes.write(data);
      } catch (error) {
        console.error(`Error sending event to client ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    });
  }

  private sendEvent(res: ServerResponse, type: string, data: any) {
    const event: SseEvent = {
      type: type as any,
      data,
      timestamp: new Date().toISOString()
    };
    
    try {
      res.write(`event: ${type}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error('Error sending SSE event:', error);
    }
  }

  public async start(port: number = this.port): Promise<number> {
    return new Promise((resolve, reject) => {
      const onError = (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          // Try the next port if this one is in use
          console.log(`Port ${port} is in use, trying port ${port + 1}...`);
          this.server.removeAllListeners();
          this.server.listen(port + 1, () => {
            this.port = port + 1;
            console.log(`SSE Files Server running on port ${this.port}`);
            resolve(this.port);
          }).on('error', onError);
        } else {
          console.error('Failed to start SSE server:', error);
          reject(error);
        }
      };

      this.server.listen(port, () => {
        this.port = port;
        console.log(`SSE Files Server running on port ${this.port}`);
        resolve(this.port);
      }).on('error', onError);
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Close all client connections
      this.clients.forEach((clientRes) => {
        clientRes.end();
      });
      this.clients.clear();

      // Close the server
      this.server.close((error) => {
        if (error) {
          console.error('Error stopping SSE server:', error);
          reject(error);
        } else {
          console.log('SSE server stopped');
          resolve();
        }
      });
    });
  }
}

export default SseServer;
