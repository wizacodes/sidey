// Data routes - handles all database operations

import { jsonResponse } from '../index.js';
import { authenticateRequest, requireAuth } from '../utils/auth.js';
import { generateId } from '../utils/crypto.js';

export async function handleData(request, env, url) {
  const path = url.pathname.replace('/api/data', '');
  const method = request.method;
  const pathParts = path.split('/').filter(p => p);

  // Parse collection and document ID
  const collection = pathParts[0];
  const docId = pathParts[1];

  if (!collection) {
    return jsonResponse({ error: 'Collection name required' }, 400);
  }

  // Route to appropriate handler
  switch (collection) {
    case 'profiles':
      return await handleProfiles(request, env, method, docId, url);
    case 'collections':
      return await handleCollections(request, env, method, docId, url);
    case 'gallery':
      return await handleGallery(request, env, method, docId, url);
    case 'bts':
      return await handleBTS(request, env, method, docId, url);
    case 'posts':
      return await handlePosts(request, env, method, docId, url);
    case 'comments':
      return await handleComments(request, env, method, docId, url);
    case 'settings':
      return await handleSettings(request, env, method, docId, url);
    case 'users':
      return await handleUsers(request, env, method, docId, url);
    case 'sites':
      return await handleSites(request, env, method, docId, url);
    default:
      return jsonResponse({ error: 'Unknown collection' }, 404);
  }
}

// Profiles
async function handleProfiles(request, env, method, siteId, url) {
  if (method === 'GET') {
    if (!siteId) {
      return jsonResponse({ error: 'Site ID required' }, 400);
    }
    
    const profile = await env.DB.prepare(`
      SELECT * FROM profiles WHERE site_id = ?
    `).bind(siteId).first();
    
    if (!profile) {
      return jsonResponse({ error: 'Profile not found' }, 404);
    }
    
    return jsonResponse(transformProfile(profile));
  }

  if (method === 'POST' || method === 'PUT') {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    const targetSiteId = siteId || user.siteName;
    
    // Verify ownership
    if (targetSiteId !== user.siteName && !user.isAdmin) {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    const body = await request.json();
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO profiles (site_id, full_name, about, resume_url, instagram, linkedin, imdb, artstation,
        show_instagram, show_linkedin, show_imdb, show_artstation, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(site_id) DO UPDATE SET
        full_name = excluded.full_name,
        about = excluded.about,
        resume_url = COALESCE(excluded.resume_url, profiles.resume_url),
        instagram = excluded.instagram,
        linkedin = excluded.linkedin,
        imdb = excluded.imdb,
        artstation = excluded.artstation,
        show_instagram = excluded.show_instagram,
        show_linkedin = excluded.show_linkedin,
        show_imdb = excluded.show_imdb,
        show_artstation = excluded.show_artstation,
        updated_at = excluded.updated_at
    `).bind(
      targetSiteId,
      body.fullName || null,
      body.about || null,
      body.resumeUrl || null,
      body.instagram || null,
      body.linkedin || null,
      body.imdb || null,
      body.artstation || null,
      body.showInstagram ? 1 : 0,
      body.showLinkedin ? 1 : 0,
      body.showImdb ? 1 : 0,
      body.showArtstation ? 1 : 0,
      now,
      now
    ).run();

    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// Collections
async function handleCollections(request, env, method, collectionId, url) {
  if (method === 'GET') {
    const siteId = url.searchParams.get('siteId');
    const orderBy = url.searchParams.get('orderBy') || 'created_at';
    const orderDir = url.searchParams.get('orderDir') || 'DESC';
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    
    if (collectionId) {
      // Get single collection with media
      const collection = await env.DB.prepare(`
        SELECT * FROM collections WHERE id = ?
      `).bind(collectionId).first();
      
      if (!collection) {
        return jsonResponse({ error: 'Collection not found' }, 404);
      }

      const media = await env.DB.prepare(`
        SELECT * FROM collection_media WHERE collection_id = ? ORDER BY order_index
      `).bind(collectionId).all();

      return jsonResponse({
        ...transformCollection(collection),
        media: media.results.map(transformMedia)
      });
    }

    // If siteId provided, filter by site; otherwise return all (for global feed)
    let collections;
    if (siteId) {
      // Get all collections for a site
      collections = await env.DB.prepare(`
        SELECT * FROM collections WHERE site_id = ? ORDER BY order_index, created_at DESC LIMIT ?
      `).bind(siteId, limit).all();
    } else {
      // Get all collections globally (for homepage feed)
      const validOrderBy = ['created_at', 'updated_at', 'title'].includes(orderBy) ? orderBy : 'created_at';
      const validOrderDir = orderDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      collections = await env.DB.prepare(`
        SELECT * FROM collections ORDER BY ${validOrderBy} ${validOrderDir} LIMIT ?
      `).bind(limit).all();
    }

    // Get media for all collections
    const collectionsWithMedia = await Promise.all(
      collections.results.map(async (col) => {
        const media = await env.DB.prepare(`
          SELECT * FROM collection_media WHERE collection_id = ? ORDER BY order_index
        `).bind(col.id).all();
        
        return {
          ...transformCollection(col),
          media: media.results.map(transformMedia)
        };
      })
    );

    return jsonResponse(collectionsWithMedia);
  }

  if (method === 'POST') {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    const body = await request.json();
    const id = generateId();
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO collections (id, site_id, title, description, software, equipment, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      user.siteName,
      body.title,
      body.description || null,
      JSON.stringify(body.software || []),
      JSON.stringify(body.equipment || []),
      body.orderIndex || 0,
      now,
      now
    ).run();

    // Add media if provided
    if (body.media && body.media.length > 0) {
      for (let i = 0; i < body.media.length; i++) {
        const mediaItem = body.media[i];
        await env.DB.prepare(`
          INSERT INTO collection_media (id, collection_id, url, type, filename, order_index, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(generateId(), id, mediaItem.url, mediaItem.type, mediaItem.filename || null, i, now).run();
      }
    }

    return jsonResponse({ id, success: true });
  }

  if (method === 'PUT' && collectionId) {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    // Verify ownership
    const collection = await env.DB.prepare(
      'SELECT site_id FROM collections WHERE id = ?'
    ).bind(collectionId).first();

    if (!collection || (collection.site_id !== user.siteName && !user.isAdmin)) {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    const body = await request.json();
    const now = new Date().toISOString();

    // Build dynamic update query based on provided fields
    const updates = [];
    const values = [];
    
    if (body.title !== undefined) {
      updates.push('title = ?');
      values.push(body.title);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description || null);
    }
    if (body.software !== undefined) {
      updates.push('software = ?');
      values.push(JSON.stringify(body.software || []));
    }
    if (body.equipment !== undefined) {
      updates.push('equipment = ?');
      values.push(JSON.stringify(body.equipment || []));
    }
    if (body.orderIndex !== undefined) {
      updates.push('order_index = ?');
      values.push(body.orderIndex || 0);
    }
    
    updates.push('updated_at = ?');
    values.push(now);
    values.push(collectionId);

    if (updates.length > 1) {
      await env.DB.prepare(`
        UPDATE collections SET ${updates.join(', ')}
        WHERE id = ?
      `).bind(...values).run();
    }

    // Add new media if provided
    if (body.media && Array.isArray(body.media) && body.media.length > 0) {
      // Get current max order_index
      const maxOrder = await env.DB.prepare(`
        SELECT MAX(order_index) as max_idx FROM collection_media WHERE collection_id = ?
      `).bind(collectionId).first();
      
      let orderIndex = (maxOrder?.max_idx || 0) + 1;
      
      for (const mediaItem of body.media) {
        if (mediaItem.url) {
          await env.DB.prepare(`
            INSERT INTO collection_media (id, collection_id, url, type, filename, order_index, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            generateId(),
            collectionId,
            mediaItem.url,
            mediaItem.type || 'image',
            mediaItem.filename || null,
            orderIndex++,
            now
          ).run();
        }
      }
    }

    return jsonResponse({ success: true });
  }

  if (method === 'DELETE' && collectionId) {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    // Verify ownership
    const collection = await env.DB.prepare(
      'SELECT site_id FROM collections WHERE id = ?'
    ).bind(collectionId).first();

    if (!collection || (collection.site_id !== user.siteName && !user.isAdmin)) {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    // Delete media first (cascade should handle this, but let's be explicit)
    await env.DB.prepare('DELETE FROM collection_media WHERE collection_id = ?').bind(collectionId).run();
    await env.DB.prepare('DELETE FROM collections WHERE id = ?').bind(collectionId).run();

    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// Gallery images
async function handleGallery(request, env, method, imageId, url) {
  if (method === 'GET') {
    const siteId = url.searchParams.get('siteId');
    
    if (!siteId) {
      return jsonResponse({ error: 'Site ID required' }, 400);
    }

    const images = await env.DB.prepare(`
      SELECT * FROM gallery_images WHERE site_id = ? ORDER BY order_index, created_at DESC
    `).bind(siteId).all();

    return jsonResponse(images.results.map(transformGalleryImage));
  }

  if (method === 'POST') {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    const body = await request.json();
    const id = generateId();
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO gallery_images (id, site_id, url, filename, type, order_index, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, user.siteName, body.url, body.filename || null, body.type || 'image', body.orderIndex || 0, now).run();

    return jsonResponse({ id, success: true });
  }

  if (method === 'DELETE' && imageId) {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    // Verify ownership
    const image = await env.DB.prepare(
      'SELECT site_id FROM gallery_images WHERE id = ?'
    ).bind(imageId).first();

    if (!image || (image.site_id !== user.siteName && !user.isAdmin)) {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    await env.DB.prepare('DELETE FROM gallery_images WHERE id = ?').bind(imageId).run();

    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// BTS images
async function handleBTS(request, env, method, imageId, url) {
  if (method === 'GET') {
    const siteId = url.searchParams.get('siteId');
    
    if (!siteId) {
      return jsonResponse({ error: 'Site ID required' }, 400);
    }

    const images = await env.DB.prepare(`
      SELECT * FROM bts_images WHERE site_id = ? ORDER BY order_index, created_at DESC
    `).bind(siteId).all();

    return jsonResponse(images.results.map(transformBTSImage));
  }

  if (method === 'POST') {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    const body = await request.json();
    const id = generateId();
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO bts_images (id, site_id, url, filename, order_index, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, user.siteName, body.url, body.filename || null, body.orderIndex || 0, now).run();

    return jsonResponse({ id, success: true });
  }

  if (method === 'DELETE' && imageId) {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    const image = await env.DB.prepare(
      'SELECT site_id FROM bts_images WHERE id = ?'
    ).bind(imageId).first();

    if (!image || (image.site_id !== user.siteName && !user.isAdmin)) {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    await env.DB.prepare('DELETE FROM bts_images WHERE id = ?').bind(imageId).run();

    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// Blog posts
async function handlePosts(request, env, method, postId, url) {
  if (method === 'GET') {
    const siteId = url.searchParams.get('siteId');
    
    if (postId) {
      const post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(postId).first();
      if (!post) {
        return jsonResponse({ error: 'Post not found' }, 404);
      }
      return jsonResponse(transformPost(post));
    }

    if (!siteId) {
      return jsonResponse({ error: 'Site ID required' }, 400);
    }

    const posts = await env.DB.prepare(`
      SELECT * FROM posts WHERE site_id = ? ORDER BY created_at DESC
    `).bind(siteId).all();

    return jsonResponse(posts.results.map(transformPost));
  }

  if (method === 'POST') {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    const body = await request.json();
    const id = generateId();
    const now = new Date().toISOString();
    const slug = body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    await env.DB.prepare(`
      INSERT INTO posts (id, site_id, title, content, slug, published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, user.siteName, body.title, body.content || '', slug, body.published !== false ? 1 : 0, now, now).run();

    return jsonResponse({ id, success: true });
  }

  if (method === 'PUT' && postId) {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    const post = await env.DB.prepare('SELECT site_id FROM posts WHERE id = ?').bind(postId).first();
    if (!post || (post.site_id !== user.siteName && !user.isAdmin)) {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    const body = await request.json();
    const now = new Date().toISOString();

    await env.DB.prepare(`
      UPDATE posts SET title = ?, content = ?, published = ?, updated_at = ? WHERE id = ?
    `).bind(body.title, body.content || '', body.published !== false ? 1 : 0, now, postId).run();

    return jsonResponse({ success: true });
  }

  if (method === 'DELETE' && postId) {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    const post = await env.DB.prepare('SELECT site_id FROM posts WHERE id = ?').bind(postId).first();
    if (!post || (post.site_id !== user.siteName && !user.isAdmin)) {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(postId).run();

    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// Comments
async function handleComments(request, env, method, commentId, url) {
  if (method === 'GET') {
    const collectionId = url.searchParams.get('collectionId');
    const contentId = url.searchParams.get('contentId');
    
    if (commentId) {
      // Get single comment
      const comment = await env.DB.prepare(`
        SELECT * FROM comments WHERE id = ?
      `).bind(commentId).first();
      
      if (!comment) {
        return jsonResponse({ error: 'Comment not found' }, 404);
      }
      
      return jsonResponse(transformComment(comment));
    }
    
    // Get comments by collection or content
    let query = 'SELECT * FROM comments';
    let params = [];
    
    if (collectionId) {
      query += ' WHERE collection_id = ?';
      params.push(collectionId);
    } else if (contentId) {
      query += ' WHERE content_id = ?';
      params.push(contentId);
    } else {
      return jsonResponse({ error: 'collectionId or contentId required' }, 400);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const comments = params.length > 0 
      ? await env.DB.prepare(query).bind(...params).all()
      : await env.DB.prepare(query).all();
    
    return jsonResponse(comments.results.map(transformComment));
  }

  if (method === 'POST') {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    const body = await request.json();
    
    if (!body.text) {
      return jsonResponse({ error: 'Comment text required' }, 400);
    }
    
    if (!body.collectionId && !body.contentId) {
      return jsonResponse({ error: 'collectionId or contentId required' }, 400);
    }

    const id = generateId();
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO comments (id, collection_id, content_id, author_id, author_name, text, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.collectionId || null,
      body.contentId || null,
      user.userId,
      body.authorName || user.siteName || user.email,
      body.text,
      now
    ).run();

    return jsonResponse({ success: true, id });
  }

  if (method === 'DELETE' && commentId) {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    // Get comment to check ownership
    const comment = await env.DB.prepare(
      'SELECT * FROM comments WHERE id = ?'
    ).bind(commentId).first();

    if (!comment) {
      return jsonResponse({ error: 'Comment not found' }, 404);
    }

    // Only author or admin can delete
    if (comment.author_id !== user.userId && !user.isAdmin) {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();

    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// Settings
async function handleSettings(request, env, method, settingId, url) {
  if (method === 'GET') {
    const siteId = url.searchParams.get('siteId');
    const key = url.searchParams.get('key');
    
    if (settingId) {
      const setting = await env.DB.prepare(`
        SELECT * FROM settings WHERE id = ?
      `).bind(settingId).first();
      
      if (!setting) {
        return jsonResponse({ error: 'Setting not found' }, 404);
      }
      
      return jsonResponse(transformSetting(setting));
    }
    
    if (!siteId) {
      return jsonResponse({ error: 'siteId required' }, 400);
    }
    
    let query = 'SELECT * FROM settings WHERE site_id = ?';
    let params = [siteId];
    
    if (key) {
      query += ' AND key = ?';
      params.push(key);
    }
    
    const settings = await env.DB.prepare(query).bind(...params).all();
    return jsonResponse(settings.results.map(transformSetting));
  }

  if (method === 'POST') {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    const body = await request.json();
    
    if (!body.siteId || !body.key) {
      return jsonResponse({ error: 'siteId and key required' }, 400);
    }
    
    // Verify user owns the site
    const site = await env.DB.prepare(
      'SELECT * FROM sites WHERE id = ? OR owner_id = ?'
    ).bind(body.siteId, user.userId).first();
    
    if (!site && !user.isAdmin) {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    const id = generateId();
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO settings (id, site_id, key, url, value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.siteId,
      body.key,
      body.url || null,
      body.value || null,
      now,
      now
    ).run();

    return jsonResponse({ success: true, id });
  }

  if (method === 'PUT' && settingId) {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    const body = await request.json();
    const now = new Date().toISOString();

    await env.DB.prepare(`
      UPDATE settings SET url = ?, value = ?, updated_at = ? WHERE id = ?
    `).bind(
      body.url || null,
      body.value || null,
      now,
      settingId
    ).run();

    return jsonResponse({ success: true });
  }

  if (method === 'DELETE' && settingId) {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    await env.DB.prepare('DELETE FROM settings WHERE id = ?').bind(settingId).run();
    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// Users (limited access)
async function handleUsers(request, env, method, userId, url) {
  if (method === 'GET') {
    // Check if looking up by site name (public endpoint for profile pages)
    const siteName = url.searchParams.get('siteName');
    
    if (siteName) {
      // Public lookup by site name - only return public info (isPro status)
      const userData = await env.DB.prepare(`
        SELECT id, site_name, is_pro FROM users WHERE site_name = ?
      `).bind(siteName).first();
      
      if (!userData) {
        return jsonResponse({ error: 'User not found' }, 404);
      }
      
      // Return limited public info
      return jsonResponse([{
        id: userData.id,
        siteName: userData.site_name,
        isPro: !!userData.is_pro
      }]);
    }
    
    if (userId) {
      // Private lookup by ID - requires auth
      const user = await authenticateRequest(request, env);
      
      // Can only get own user data unless admin
      if (!user || (userId !== user.userId && !user.isAdmin)) {
        return jsonResponse({ error: 'Unauthorized' }, 403);
      }

      const userData = await env.DB.prepare(`
        SELECT id, email, site_name, full_name, is_pro, is_admin, custom_domain, created_at
        FROM users WHERE id = ?
      `).bind(userId).first();

      if (!userData) {
        return jsonResponse({ error: 'User not found' }, 404);
      }

      return jsonResponse(transformUser(userData));
    }
    
    return jsonResponse({ error: 'userId or siteName required' }, 400);
  }

  if (method === 'PUT' && userId) {
    if (!user || (userId !== user.userId && !user.isAdmin)) {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    const body = await request.json();
    const now = new Date().toISOString();

    // Only allow updating certain fields
    const updates = [];
    const values = [];

    if (body.fullName !== undefined) {
      updates.push('full_name = ?');
      values.push(body.fullName);
    }
    if (body.customDomain !== undefined) {
      updates.push('custom_domain = ?');
      values.push(body.customDomain);
      
      // Also update in sites table
      await env.DB.prepare(
        'UPDATE sites SET custom_domain = ?, updated_at = ? WHERE owner_id = ?'
      ).bind(body.customDomain, now, userId).run();
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(now);
      values.push(userId);

      await env.DB.prepare(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...values).run();
    }

    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// Sites
async function handleSites(request, env, method, siteId, url) {
  if (method === 'GET' && siteId) {
    const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(siteId).first();
    
    if (!site) {
      return jsonResponse({ error: 'Site not found' }, 404);
    }

    return jsonResponse(transformSite(site));
  }

  if (method === 'PUT' && siteId) {
    const user = await authenticateRequest(request, env);
    requireAuth(user);

    const site = await env.DB.prepare('SELECT owner_id FROM sites WHERE id = ?').bind(siteId).first();
    if (!site || (site.owner_id !== user.userId && !user.isAdmin)) {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    const body = await request.json();
    const now = new Date().toISOString();

    const updates = [];
    const values = [];

    if (body.template !== undefined) {
      updates.push('template = ?');
      values.push(body.template);
    }
    if (body.customDomain !== undefined) {
      updates.push('custom_domain = ?');
      values.push(body.customDomain);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(now);
      values.push(siteId);

      await env.DB.prepare(
        `UPDATE sites SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...values).run();
    }

    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// Transform functions (convert DB snake_case to camelCase)
function transformProfile(p) {
  return {
    siteId: p.site_id,
    fullName: p.full_name,
    about: p.about,
    resumeUrl: p.resume_url,
    instagram: p.instagram,
    linkedin: p.linkedin,
    imdb: p.imdb,
    artstation: p.artstation,
    showInstagram: !!p.show_instagram,
    showLinkedin: !!p.show_linkedin,
    showImdb: !!p.show_imdb,
    showArtstation: !!p.show_artstation,
    createdAt: p.created_at,
    updatedAt: p.updated_at
  };
}

function transformCollection(c) {
  return {
    id: c.id,
    siteId: c.site_id,
    title: c.title,
    description: c.description,
    software: JSON.parse(c.software || '[]'),
    equipment: JSON.parse(c.equipment || '[]'),
    orderIndex: c.order_index,
    createdAt: c.created_at,
    updatedAt: c.updated_at
  };
}

function transformMedia(m) {
  return {
    id: m.id,
    collectionId: m.collection_id,
    url: m.url,
    type: m.type,
    filename: m.filename,
    orderIndex: m.order_index,
    createdAt: m.created_at
  };
}

function transformGalleryImage(i) {
  return {
    id: i.id,
    siteId: i.site_id,
    url: i.url,
    filename: i.filename,
    type: i.type,
    orderIndex: i.order_index,
    createdAt: i.created_at
  };
}

function transformBTSImage(i) {
  return {
    id: i.id,
    siteId: i.site_id,
    url: i.url,
    filename: i.filename,
    orderIndex: i.order_index,
    createdAt: i.created_at
  };
}

function transformPost(p) {
  return {
    id: p.id,
    siteId: p.site_id,
    title: p.title,
    content: p.content,
    slug: p.slug,
    published: !!p.published,
    createdAt: p.created_at,
    updatedAt: p.updated_at
  };
}

function transformComment(c) {
  return {
    id: c.id,
    collectionId: c.collection_id,
    contentId: c.content_id,
    authorId: c.author_id,
    authorName: c.author_name,
    text: c.text,
    createdAt: c.created_at
  };
}

function transformSetting(s) {
  return {
    id: s.id,
    siteId: s.site_id,
    key: s.key,
    url: s.url,
    value: s.value,
    createdAt: s.created_at,
    updatedAt: s.updated_at
  };
}

function transformUser(u) {
  return {
    id: u.id,
    email: u.email,
    siteName: u.site_name,
    fullName: u.full_name,
    isPro: !!u.is_pro,
    isAdmin: !!u.is_admin,
    customDomain: u.custom_domain,
    createdAt: u.created_at
  };
}

function transformSite(s) {
  return {
    id: s.id,
    ownerId: s.owner_id,
    ownerEmail: s.owner_email,
    template: s.template,
    customDomain: s.custom_domain,
    status: s.status,
    createdAt: s.created_at,
    updatedAt: s.updated_at
  };
}
