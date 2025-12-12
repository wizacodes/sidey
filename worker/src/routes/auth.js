// Authentication routes

import { jsonResponse } from '../index.js';
import { hashPassword, verifyPassword, generateId, generateToken } from '../utils/crypto.js';
import { authenticateRequest } from '../utils/auth.js';

export async function handleAuth(request, env, url) {
  const path = url.pathname.replace('/api/auth', '');
  const method = request.method;

  // Sign up
  if (path === '/signup' && method === 'POST') {
    return await handleSignup(request, env);
  }

  // Sign in
  if (path === '/signin' && method === 'POST') {
    return await handleSignin(request, env);
  }

  // Sign out
  if (path === '/signout' && method === 'POST') {
    return await handleSignout(request, env);
  }

  // Get current user
  if (path === '/me' && method === 'GET') {
    return await handleGetCurrentUser(request, env);
  }

  // Reset password request
  if (path === '/reset-password' && method === 'POST') {
    return await handleResetPassword(request, env);
  }

  // Update password
  if (path === '/update-password' && method === 'POST') {
    return await handleUpdatePassword(request, env);
  }

  return jsonResponse({ error: 'Not Found' }, 404);
}

async function handleSignup(request, env) {
  const body = await request.json();
  const { email, password, siteName, fullName } = body;

  // Validation
  if (!email || !password || !siteName) {
    return jsonResponse({ error: 'Email, password, and site name are required' }, 400);
  }

  if (password.length < 6) {
    return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);
  }

  const normalizedSiteName = siteName.toLowerCase().trim();
  if (!/^[a-z0-9-]+$/.test(normalizedSiteName)) {
    return jsonResponse({ error: 'Site name can only contain lowercase letters, numbers, and hyphens' }, 400);
  }

  if (normalizedSiteName.length < 3) {
    return jsonResponse({ error: 'Site name must be at least 3 characters' }, 400);
  }

  try {
    // Check if email already exists
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (existingUser) {
      return jsonResponse({ error: 'Email already registered' }, 400);
    }

    // Check if site name is available
    const existingSite = await env.DB.prepare(
      'SELECT id FROM sites WHERE id = ?'
    ).bind(normalizedSiteName).first();

    if (existingSite) {
      return jsonResponse({ error: 'Site name already taken' }, 400);
    }

    // Create user
    const userId = generateId();
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO users (id, email, password_hash, site_name, full_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(userId, email.toLowerCase(), passwordHash, normalizedSiteName, fullName || null, now, now).run();

    // Create site
    await env.DB.prepare(`
      INSERT INTO sites (id, owner_id, owner_email, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(normalizedSiteName, userId, email.toLowerCase(), now, now).run();

    // Create empty profile
    await env.DB.prepare(`
      INSERT INTO profiles (site_id, full_name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).bind(normalizedSiteName, fullName || null, now, now).run();

    // Generate token
    const secret = env.JWT_SECRET || 'default-secret-change-in-production';
    const token = await generateToken({ userId, email: email.toLowerCase(), siteName: normalizedSiteName }, secret);

    return jsonResponse({
      token,
      user: {
        id: userId,
        email: email.toLowerCase(),
        siteName: normalizedSiteName,
        fullName: fullName || null,
        isPro: false,
        isAdmin: false
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    return jsonResponse({ error: 'Failed to create account' }, 500);
  }
}

async function handleSignin(request, env) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return jsonResponse({ error: 'Email and password are required' }, 400);
  }

  try {
    // Get user
    const user = await env.DB.prepare(`
      SELECT id, email, password_hash, site_name, full_name, is_pro, is_admin, custom_domain
      FROM users WHERE email = ?
    `).bind(email.toLowerCase()).first();

    if (!user) {
      return jsonResponse({ error: 'Invalid email or password' }, 401);
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return jsonResponse({ error: 'Invalid email or password' }, 401);
    }

    // Generate token
    const secret = env.JWT_SECRET || 'default-secret-change-in-production';
    const token = await generateToken({ 
      userId: user.id, 
      email: user.email, 
      siteName: user.site_name 
    }, secret);

    return jsonResponse({
      token,
      user: {
        id: user.id,
        email: user.email,
        siteName: user.site_name,
        fullName: user.full_name,
        isPro: !!user.is_pro,
        isAdmin: !!user.is_admin,
        customDomain: user.custom_domain
      }
    });

  } catch (error) {
    console.error('Signin error:', error);
    return jsonResponse({ error: 'Failed to sign in' }, 500);
  }
}

async function handleSignout(request, env) {
  // With JWT, signout is handled client-side by removing the token
  // We can optionally invalidate the token server-side using a blacklist
  return jsonResponse({ success: true });
}

async function handleGetCurrentUser(request, env) {
  const user = await authenticateRequest(request, env);
  
  if (!user) {
    return jsonResponse({ error: 'Not authenticated' }, 401);
  }

  return jsonResponse({ user });
}

async function handleResetPassword(request, env) {
  const body = await request.json();
  const { email } = body;

  if (!email) {
    return jsonResponse({ error: 'Email is required' }, 400);
  }

  // In a real implementation, you would:
  // 1. Generate a reset token
  // 2. Store it in the database with an expiration
  // 3. Send an email with a reset link
  // For now, we'll just acknowledge the request

  try {
    const user = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    // Always return success to prevent email enumeration
    return jsonResponse({ 
      success: true, 
      message: 'If an account exists with this email, a reset link will be sent.' 
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return jsonResponse({ error: 'Failed to process request' }, 500);
  }
}

async function handleUpdatePassword(request, env) {
  const user = await authenticateRequest(request, env);
  
  if (!user) {
    return jsonResponse({ error: 'Not authenticated' }, 401);
  }

  const body = await request.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return jsonResponse({ error: 'Current and new passwords are required' }, 400);
  }

  if (newPassword.length < 6) {
    return jsonResponse({ error: 'New password must be at least 6 characters' }, 400);
  }

  try {
    // Get current password hash
    const userData = await env.DB.prepare(
      'SELECT password_hash FROM users WHERE id = ?'
    ).bind(user.userId).first();

    // Verify current password
    const validPassword = await verifyPassword(currentPassword, userData.password_hash);
    if (!validPassword) {
      return jsonResponse({ error: 'Current password is incorrect' }, 401);
    }

    // Update password
    const newPasswordHash = await hashPassword(newPassword);
    await env.DB.prepare(
      'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
    ).bind(newPasswordHash, new Date().toISOString(), user.userId).run();

    return jsonResponse({ success: true, message: 'Password updated successfully' });

  } catch (error) {
    console.error('Update password error:', error);
    return jsonResponse({ error: 'Failed to update password' }, 500);
  }
}
