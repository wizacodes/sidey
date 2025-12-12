// Site routes - handles site lookup and public data

import { jsonResponse } from '../index.js';

export async function handleSite(request, env, url) {
  const path = url.pathname.replace('/api/site', '');
  const method = request.method;

  // Get site by domain (for custom domain lookup)
  if (path === '/by-domain' && method === 'GET') {
    return await handleGetByDomain(request, env, url);
  }

  // Get site public data
  if (path.startsWith('/public/') && method === 'GET') {
    const siteId = path.replace('/public/', '');
    return await handleGetPublicData(request, env, siteId);
  }

  // Get all sites (admin only or limited public data)
  if (path === '/all' && method === 'GET') {
    return await handleGetAllSites(request, env, url);
  }

  return jsonResponse({ error: 'Not Found' }, 404);
}

async function handleGetByDomain(request, env, url) {
  const domain = url.searchParams.get('domain');
  
  if (!domain) {
    return jsonResponse({ error: 'Domain parameter required' }, 400);
  }

  // Normalize domain
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');

  try {
    // Look up site by custom domain
    const site = await env.DB.prepare(`
      SELECT s.*, u.full_name, u.is_pro
      FROM sites s
      JOIN users u ON s.owner_id = u.id
      WHERE s.custom_domain = ? OR s.custom_domain = ?
    `).bind(normalizedDomain, `www.${normalizedDomain}`).first();

    if (!site) {
      return jsonResponse({ error: 'Site not found for domain' }, 404);
    }

    return jsonResponse({
      siteId: site.id,
      template: site.template,
      customDomain: site.custom_domain,
      ownerName: site.full_name
    });

  } catch (error) {
    console.error('Domain lookup error:', error);
    return jsonResponse({ error: 'Failed to look up domain' }, 500);
  }
}

async function handleGetPublicData(request, env, siteId) {
  try {
    // Get site
    const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(siteId).first();
    
    if (!site) {
      return jsonResponse({ error: 'Site not found' }, 404);
    }

    // Get profile
    const profile = await env.DB.prepare('SELECT * FROM profiles WHERE site_id = ?').bind(siteId).first();

    // Get collections with media
    const collections = await env.DB.prepare(`
      SELECT * FROM collections WHERE site_id = ? ORDER BY order_index, created_at DESC
    `).bind(siteId).all();

    const collectionsWithMedia = await Promise.all(
      collections.results.map(async (col) => {
        const media = await env.DB.prepare(`
          SELECT * FROM collection_media WHERE collection_id = ? ORDER BY order_index
        `).bind(col.id).all();
        
        return {
          id: col.id,
          title: col.title,
          description: col.description,
          software: JSON.parse(col.software || '[]'),
          equipment: JSON.parse(col.equipment || '[]'),
          media: media.results.map(m => ({
            id: m.id,
            url: m.url,
            type: m.type,
            filename: m.filename
          }))
        };
      })
    );

    // Get gallery images
    const gallery = await env.DB.prepare(`
      SELECT * FROM gallery_images WHERE site_id = ? ORDER BY order_index, created_at DESC
    `).bind(siteId).all();

    // Get BTS images
    const bts = await env.DB.prepare(`
      SELECT * FROM bts_images WHERE site_id = ? ORDER BY order_index, created_at DESC
    `).bind(siteId).all();

    // Get published posts
    const posts = await env.DB.prepare(`
      SELECT * FROM posts WHERE site_id = ? AND published = 1 ORDER BY created_at DESC
    `).bind(siteId).all();

    return jsonResponse({
      site: {
        id: site.id,
        template: site.template,
        customDomain: site.custom_domain
      },
      profile: profile ? {
        fullName: profile.full_name,
        about: profile.about,
        resumeUrl: profile.resume_url,
        instagram: profile.show_instagram ? profile.instagram : null,
        linkedin: profile.show_linkedin ? profile.linkedin : null,
        imdb: profile.show_imdb ? profile.imdb : null,
        artstation: profile.show_artstation ? profile.artstation : null
      } : null,
      collections: collectionsWithMedia,
      gallery: gallery.results.map(i => ({
        id: i.id,
        url: i.url,
        type: i.type,
        filename: i.filename
      })),
      bts: bts.results.map(i => ({
        id: i.id,
        url: i.url,
        filename: i.filename
      })),
      posts: posts.results.map(p => ({
        id: p.id,
        title: p.title,
        content: p.content,
        slug: p.slug,
        createdAt: p.created_at
      }))
    });

  } catch (error) {
    console.error('Get public data error:', error);
    return jsonResponse({ error: 'Failed to get site data' }, 500);
  }
}

async function handleGetAllSites(request, env, url) {
  try {
    // For custom domain lookups - get all sites with custom domains
    // This is used by the Cloudflare Worker that handles routing
    const sites = await env.DB.prepare(`
      SELECT id, template, custom_domain FROM sites WHERE custom_domain IS NOT NULL
    `).all();

    return jsonResponse({
      sites: sites.results.map(s => ({
        id: s.id,
        template: s.template,
        customDomain: s.custom_domain
      }))
    });

  } catch (error) {
    console.error('Get all sites error:', error);
    return jsonResponse({ error: 'Failed to get sites' }, 500);
  }
}
