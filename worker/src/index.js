// Sidey CMS - Cloudflare Workers API
// Main entry point

import { handleAuth } from './routes/auth.js';
import { handleData } from './routes/data.js';
import { handleStorage } from './routes/storage.js';
import { handleSite } from './routes/site.js';
import { corsHeaders, handleCors } from './utils/cors.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors(env);
    }

    try {
      // Route handling
      if (url.pathname.startsWith('/api/auth')) {
        return await handleAuth(request, env, url);
      }
      
      if (url.pathname.startsWith('/api/data')) {
        return await handleData(request, env, url);
      }
      
      if (url.pathname.startsWith('/api/storage')) {
        return await handleStorage(request, env, url);
      }
      
      if (url.pathname.startsWith('/api/site')) {
        return await handleSite(request, env, url);
      }

      // Health check
      if (url.pathname === '/api/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
      }

      return jsonResponse({ error: 'Not Found' }, 404);
      
    } catch (error) {
      console.error('API Error:', error);
      return jsonResponse({ error: error.message || 'Internal Server Error' }, 500);
    }
  }
};

export function jsonResponse(data, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...additionalHeaders
    }
  });
}
