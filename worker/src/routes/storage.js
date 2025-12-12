// Storage routes - handles R2 file uploads

import { jsonResponse } from '../index.js';
import { authenticateRequest, requireAuth } from '../utils/auth.js';
import { generateId } from '../utils/crypto.js';
import { corsHeaders } from '../utils/cors.js';

export async function handleStorage(request, env, url) {
  const path = url.pathname.replace('/api/storage', '');
  const method = request.method;

  // Upload file
  if (path === '/upload' && method === 'POST') {
    return await handleUpload(request, env);
  }

  // Delete file
  if (path === '/delete' && method === 'DELETE') {
    return await handleDelete(request, env);
  }

  // List files
  if (path === '/list' && method === 'GET') {
    return await handleList(request, env, url);
  }

  // Get signed URL for upload (for large files)
  if (path === '/signed-url' && method === 'POST') {
    return await handleSignedUrl(request, env);
  }

  return jsonResponse({ error: 'Not Found' }, 404);
}

async function handleUpload(request, env) {
  const user = await authenticateRequest(request, env);
  requireAuth(user);

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const customPath = formData.get('path');
    const contentType = formData.get('contentType');

    if (!file) {
      return jsonResponse({ error: 'No file provided' }, 400);
    }

    // Validate file size based on Pro status
    const maxSize = user.isPro ? 1024 * 1024 * 1024 : 100 * 1024 * 1024; // 1GB for Pro, 100MB for free
    if (file.size > maxSize) {
      return jsonResponse({ 
        error: `File too large. Max size: ${user.isPro ? '1GB' : '100MB'}` 
      }, 400);
    }

    // Generate file path
    const fileId = generateId();
    const extension = file.name.split('.').pop() || '';
    const fileName = customPath || `${user.siteName}/${fileId}.${extension}`;

    // Determine content type
    const mimeType = contentType || file.type || 'application/octet-stream';

    // Upload to R2
    await env.R2.put(fileName, file.stream(), {
      httpMetadata: {
        contentType: mimeType,
      },
      customMetadata: {
        originalName: file.name,
        uploadedBy: user.userId,
        siteName: user.siteName,
      },
    });

    // Generate public URL (using r2.dev public URL)
    const publicUrl = `https://pub-47e131f92cf145cb94f5cd6e263508a9.r2.dev/${fileName}`;

    return jsonResponse({
      success: true,
      url: publicUrl,
      path: fileName,
      filename: file.name,
      size: file.size,
      type: mimeType
    });

  } catch (error) {
    console.error('Upload error:', error);
    return jsonResponse({ error: 'Upload failed: ' + error.message }, 500);
  }
}

async function handleDelete(request, env) {
  const user = await authenticateRequest(request, env);
  requireAuth(user);

  try {
    const body = await request.json();
    const { path } = body;

    if (!path) {
      return jsonResponse({ error: 'Path required' }, 400);
    }

    // Verify the file belongs to the user's site
    if (!path.startsWith(`${user.siteName}/`) && !user.isAdmin) {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    // Delete from R2
    await env.R2.delete(path);

    return jsonResponse({ success: true });

  } catch (error) {
    console.error('Delete error:', error);
    return jsonResponse({ error: 'Delete failed: ' + error.message }, 500);
  }
}

async function handleList(request, env, url) {
  const user = await authenticateRequest(request, env);
  requireAuth(user);

  try {
    const prefix = url.searchParams.get('prefix') || `${user.siteName}/`;
    
    // Only allow listing own files unless admin
    if (!prefix.startsWith(`${user.siteName}/`) && !user.isAdmin) {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    const listed = await env.R2.list({
      prefix: prefix,
      limit: 1000,
    });

    const files = listed.objects.map(obj => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
      url: `https://assets.sidey.app/${obj.key}`,
    }));

    return jsonResponse({ files });

  } catch (error) {
    console.error('List error:', error);
    return jsonResponse({ error: 'List failed: ' + error.message }, 500);
  }
}

async function handleSignedUrl(request, env) {
  const user = await authenticateRequest(request, env);
  requireAuth(user);

  try {
    const body = await request.json();
    const { filename, contentType } = body;

    if (!filename) {
      return jsonResponse({ error: 'Filename required' }, 400);
    }

    const fileId = generateId();
    const extension = filename.split('.').pop() || '';
    const path = `${user.siteName}/${fileId}.${extension}`;

    // For R2, we can create a presigned URL for direct uploads
    // This is useful for large files to avoid Worker memory limits
    // Note: Requires R2 bucket to have public access or signed URLs configured

    return jsonResponse({
      uploadUrl: `https://assets.sidey.app/${path}`,
      path: path,
      method: 'PUT',
      headers: {
        'Content-Type': contentType || 'application/octet-stream'
      }
    });

  } catch (error) {
    console.error('Signed URL error:', error);
    return jsonResponse({ error: 'Failed to generate signed URL' }, 500);
  }
}
