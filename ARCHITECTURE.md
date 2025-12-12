# 🏗️ Sidey CMS - System Architecture

## Overview

Sidey CMS is a multi-tenant portfolio platform built entirely on **Cloudflare's edge infrastructure**, allowing multiple users to create and manage their own portfolio websites using pre-built templates.

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   SIDEY CMS PLATFORM                         │
│              (Cloudflare Infrastructure)                     │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   User A     │      │   User B     │      │   User C     │
│ (john-doe)   │      │ (jane-smith) │      │ (bob-jones)  │
│              │      │              │      │              │
│ Template:    │      │ Template:    │      │ Template:    │
│ Robcine      │      │ Sanaa        │      │ Robcine      │
└──────────────┘      └──────────────┘      └──────────────┘
```

## Technology Stack

### Frontend
- **HTML5/CSS3/JavaScript** - Core web technologies
- **cloudflare-config.js** - Client-side API wrapper
- **Responsive Design** - Mobile-first approach

### Backend (Cloudflare)
- **Workers** - Serverless API (edge computing)
- **D1** - SQLite database at the edge
- **R2** - S3-compatible object storage
- **KV** - Key-value store for sessions/cache

## Infrastructure Components

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE EDGE                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Workers    │───▶│      D1      │    │      R2      │   │
│  │   (API)      │    │  (Database)  │    │  (Storage)   │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│         │                                       │            │
│         │            ┌──────────────┐          │            │
│         └───────────▶│      KV      │◀─────────┘            │
│                      │  (Sessions)  │                       │
│                      └──────────────┘                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Data Architecture

### D1 Database Schema

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  site_name TEXT UNIQUE,
  is_admin INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sites table
CREATE TABLE sites (
  site_name TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  owner_email TEXT,
  template TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  custom_domain TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Posts table (per-site content)
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  slug TEXT,
  author_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_name) REFERENCES sites(site_name)
);

-- BTS (Behind-the-scenes) images
CREATE TABLE bts (
  id TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  url TEXT NOT NULL,
  filename TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_name) REFERENCES sites(site_name)
);

-- Site settings
CREATE TABLE settings (
  site_name TEXT PRIMARY KEY,
  settings_json TEXT DEFAULT '{}',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_name) REFERENCES sites(site_name)
);
```

### R2 Storage Structure

```
sidey-assets/
├── sites/
│   ├── {siteName}/
│   │   ├── images/
│   │   │   ├── hero.jpg
│   │   │   └── gallery/
│   │   ├── videos/
│   │   │   └── background.mp4
│   │   └── documents/
│   └── {anotherSiteName}/
│       └── ...
└── public/
    └── templates/
```

## API Architecture

### Worker Routes

```
/api/
├── auth/
│   ├── POST /signup      # Create new user
│   ├── POST /signin      # Authenticate user
│   ├── POST /signout     # Clear session
│   └── GET  /me          # Get current user
├── data/
│   ├── GET    /{collection}           # List items
│   ├── POST   /{collection}           # Create item
│   ├── GET    /{collection}/{id}      # Get item
│   ├── PUT    /{collection}/{id}      # Update item
│   └── DELETE /{collection}/{id}      # Delete item
├── storage/
│   ├── POST   /upload                 # Upload file to R2
│   ├── GET    /{key}                  # Get file
│   └── DELETE /{key}                  # Delete file
├── site/
│   ├── GET    /{siteName}             # Get site info
│   ├── POST   /create                 # Create new site
│   └── PUT    /{siteName}             # Update site
└── health                             # Health check
```

## Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│  Worker  │────▶│    D1    │────▶│    KV    │
│          │◀────│          │◀────│          │◀────│ (tokens) │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │
     │  JWT Token     │
     │◀───────────────│
     │                │
     │  Auth Header   │
     │───────────────▶│
```

1. User submits credentials
2. Worker validates against D1
3. JWT token generated and optionally stored in KV
4. Token returned to client (stored in localStorage)
5. Subsequent requests include Bearer token

## Custom Domains

Since everything is on Cloudflare, domain management is seamless:

```
┌─────────────────────────────────────────────────────────────┐
│                  CLOUDFLARE DNS                              │
├─────────────────────────────────────────────────────────────┤
│  sidey.app          → Worker (main app)                     │
│  *.sidey.app        → Worker (user sites)                   │
│  custom-domain.com  → Worker (CNAME to sidey.app)           │
└─────────────────────────────────────────────────────────────┘
```

### Domain Routing Logic

```javascript
// Worker handles routing based on hostname
if (hostname === 'sidey.app') {
  // Main application
  return serveMainApp();
} else if (hostname.endsWith('.sidey.app')) {
  // User subdomain (e.g., john-doe.sidey.app)
  const siteName = hostname.split('.')[0];
  return serveSite(siteName);
} else {
  // Custom domain lookup
  const site = await lookupCustomDomain(hostname);
  return serveSite(site.siteName);
}
```

## Security Model

### Authentication
- JWT tokens with configurable expiration
- Password hashing using Web Crypto API
- Secure token storage in KV (optional)

### Authorization
- Per-user data isolation via SQL queries
- Site ownership verification on mutations
- Admin role for platform management

### Data Protection
- All traffic over HTTPS (Cloudflare enforced)
- CORS headers configured per environment
- Rate limiting via Cloudflare

## Benefits of Cloudflare Stack

| Feature | Benefit |
|---------|---------|
| **Edge Computing** | Low latency globally |
| **D1 Database** | SQLite at the edge, familiar SQL |
| **R2 Storage** | S3-compatible, no egress fees |
| **KV Store** | Fast session/cache storage |
| **Domains** | Integrated DNS management |
| **SSL** | Automatic HTTPS everywhere |
| **Cost** | Generous free tier, predictable pricing |

## Deployment

```bash
# Deploy worker
cd worker
wrangler deploy

# Run database migrations
wrangler d1 execute sidey-db --file=schema.sql

# Set secrets
wrangler secret put JWT_SECRET
```

## Monitoring

- **Worker Analytics** - Request metrics, errors
- **D1 Analytics** - Query performance
- **R2 Metrics** - Storage usage
- **Real-time Logs** - `wrangler tail`

---

**Architecture Version: 2.0 (Cloudflare Native)**
