// Authentication middleware

import { verifyToken } from './crypto.js';

export async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const secret = env.JWT_SECRET || 'default-secret-change-in-production';
  
  const payload = await verifyToken(token, secret);
  
  if (!payload) {
    return null;
  }

  // Get user from database to ensure they still exist and get fresh data
  const user = await env.DB.prepare(
    'SELECT id, email, site_name, full_name, is_pro, is_admin, custom_domain FROM users WHERE id = ?'
  ).bind(payload.userId).first();

  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    siteName: user.site_name,
    fullName: user.full_name,
    isPro: !!user.is_pro,
    isAdmin: !!user.is_admin,
    customDomain: user.custom_domain
  };
}

export function requireAuth(user) {
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}
