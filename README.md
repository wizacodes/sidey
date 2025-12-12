# 🎬 Sidey CMS

A multi-user portfolio platform built on **Cloudflare** that allows creators to build and manage their own portfolio websites using customizable templates.

## 🚀 Tech Stack

- **Cloudflare Workers** - Serverless API backend
- **Cloudflare D1** - SQLite database
- **Cloudflare R2** - Object storage for media files
- **Cloudflare KV** - Session/cache storage
- **Cloudflare Pages** - Static site hosting (optional)

## 📁 Project Structure

```
sidey/
├── worker/                 # Cloudflare Worker API
│   ├── src/
│   │   ├── index.js        # Main entry point
│   │   ├── routes/         # API route handlers
│   │   │   ├── auth.js     # Authentication
│   │   │   ├── data.js     # Database operations
│   │   │   ├── site.js     # Site management
│   │   │   └── storage.js  # R2 file storage
│   │   └── utils/          # Utilities
│   ├── schema.sql          # D1 database schema
│   └── wrangler.toml       # Worker configuration
├── js/
│   └── cloudflare-config.js # Client-side Cloudflare SDK
├── templates/              # Portfolio templates
│   ├── robcine/            # Cinematography template
│   └── sanaa/              # Artist portfolio template
└── *.html                  # Main app pages
```

## 🛠️ Setup

### 1. Prerequisites

```bash
npm install -g wrangler
wrangler login
```

### 2. Configure Worker

```bash
cd worker

# Create D1 database
wrangler d1 create sidey-db

# Create R2 bucket
wrangler r2 bucket create sidey-assets

# Create KV namespace
wrangler kv:namespace create sidey-kv

# Update wrangler.toml with the IDs from above commands
```

### 3. Set Secrets

```bash
cd worker
wrangler secret put JWT_SECRET
# Enter a secure random string
```

### 4. Initialize Database

```bash
wrangler d1 execute sidey-db --file=schema.sql
```

### 5. Deploy

```bash
# Deploy worker
npm run worker:deploy

# Or for local development
npm run worker:dev
```

## 🔧 Development

### Local Development

```bash
# Start the worker locally
npm run worker:dev

# Start the frontend server
npm run dev
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Create new user |
| `/api/auth/signin` | POST | Sign in user |
| `/api/auth/me` | GET | Get current user |
| `/api/data/{collection}` | GET/POST | CRUD operations |
| `/api/storage/upload` | POST | Upload files to R2 |
| `/api/storage/{key}` | GET/DELETE | Get/delete files |
| `/api/site/{siteName}` | GET | Get site info |

## 🌐 Custom Domains

Domains are managed directly through Cloudflare:

1. Register/transfer domain to Cloudflare
2. Add domain in Sidey dashboard
3. Worker automatically handles routing

## 📊 Database Schema

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  site_name TEXT UNIQUE,
  is_admin INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sites table  
CREATE TABLE sites (
  site_name TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  template TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  custom_domain TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Posts, BTS, Settings per site...
```

## 🔒 Security

- JWT-based authentication
- Password hashing with bcrypt
- CORS protection
- Per-user data isolation

## 📦 Scripts

```bash
npm run dev           # Start local dev server
npm run worker:dev    # Start worker locally
npm run worker:deploy # Deploy worker to Cloudflare
npm run worker:tail   # View worker logs
```

## 🎨 Templates

### Robcine
Cinematography portfolio with video backgrounds, blog, rental equipment listings.

### Sanaa
Artist portfolio with 3D elements, gallery, and resume.

---

**Built with ❤️ using Cloudflare Workers, D1, and R2**
