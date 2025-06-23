import { NextRequest, NextResponse } from 'next/server';

// Backend API URL
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8080';

/**
 * Proxy handler for auth routes
 * Forwards /api/auth/* requests to backend /auth/*
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'DELETE');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'PATCH');
}

async function handleRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  try {
    // Construct the backend URL
    const backendPath = pathSegments.join('/');
    const backendUrl = `${BACKEND_API_URL}/auth/${backendPath}`;
    
    // Copy headers
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      // Skip host header to avoid conflicts
      if (key.toLowerCase() !== 'host') {
        headers.set(key, value);
      }
    });
    
    // Add CORS headers if not present
    if (!headers.has('Content-Type') && method !== 'GET' && method !== 'DELETE') {
      headers.set('Content-Type', 'application/json');
    }
    
    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers,
    };
    
    // Add body for non-GET requests
    if (method !== 'GET' && method !== 'DELETE') {
      try {
        const body = await request.json();
        requestOptions.body = JSON.stringify(body);
      } catch {
        // If body is not JSON, try to get it as text
        const body = await request.text();
        if (body) {
          requestOptions.body = body;
        }
      }
    }
    
    // Forward the request to the backend
    const response = await fetch(backendUrl, requestOptions);
    
    // Get response body
    let responseBody;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }
    
    // Return the response with appropriate headers
    const responseHeaders = new Headers();
    
    // Copy relevant headers from backend response
    ['content-type', 'cache-control', 'set-cookie'].forEach(header => {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });
    
    // Add CORS headers
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return NextResponse.json(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Auth proxy error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'PROXY_ERROR',
        message: 'Failed to connect to authentication service',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 503,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}