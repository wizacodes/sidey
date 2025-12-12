-- Sidey CMS Database Schema for Cloudflare D1

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  site_name TEXT UNIQUE NOT NULL,
  full_name TEXT,
  is_pro INTEGER DEFAULT 0,
  is_admin INTEGER DEFAULT 0,
  custom_domain TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sites table
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  template TEXT DEFAULT 'sanaa',
  custom_domain TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  site_id TEXT PRIMARY KEY,
  full_name TEXT,
  about TEXT,
  resume_url TEXT,
  instagram TEXT,
  linkedin TEXT,
  imdb TEXT,
  artstation TEXT,
  show_instagram INTEGER DEFAULT 0,
  show_linkedin INTEGER DEFAULT 0,
  show_imdb INTEGER DEFAULT 0,
  show_artstation INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  software TEXT, -- JSON array
  equipment TEXT, -- JSON array
  order_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

-- Collection media table
CREATE TABLE IF NOT EXISTS collection_media (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL, -- 'image', 'video', '3d'
  filename TEXT,
  order_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

-- Gallery images table
CREATE TABLE IF NOT EXISTS gallery_images (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  url TEXT NOT NULL,
  filename TEXT,
  type TEXT DEFAULT 'image', -- 'image' or 'video'
  order_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

-- BTS (Behind The Scenes) images table
CREATE TABLE IF NOT EXISTS bts_images (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  url TEXT NOT NULL,
  filename TEXT,
  order_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

-- Blog posts table
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  slug TEXT,
  published INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

-- Sessions table for auth tokens
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Site settings table
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  key TEXT NOT NULL,
  url TEXT,
  value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  UNIQUE(site_id, key)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  collection_id TEXT,
  content_id TEXT,
  author_id TEXT NOT NULL,
  author_name TEXT,
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_site_name ON users(site_name);
CREATE INDEX IF NOT EXISTS idx_sites_owner_id ON sites(owner_id);
CREATE INDEX IF NOT EXISTS idx_sites_custom_domain ON sites(custom_domain);
CREATE INDEX IF NOT EXISTS idx_collections_site_id ON collections(site_id);
CREATE INDEX IF NOT EXISTS idx_collection_media_collection_id ON collection_media(collection_id);
CREATE INDEX IF NOT EXISTS idx_gallery_images_site_id ON gallery_images(site_id);
CREATE INDEX IF NOT EXISTS idx_bts_images_site_id ON bts_images(site_id);
CREATE INDEX IF NOT EXISTS idx_posts_site_id ON posts(site_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_comments_collection_id ON comments(collection_id);
CREATE INDEX IF NOT EXISTS idx_comments_content_id ON comments(content_id);
CREATE INDEX IF NOT EXISTS idx_settings_site_id ON settings(site_id);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
