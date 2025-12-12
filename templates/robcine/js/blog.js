// Load blog posts from Cloudflare D1 and display below gallery
function initBlog() {
  if (typeof SideyAPI === 'undefined') {
    setTimeout(initBlog, 100);
    return;
  }

  let allPosts = [];

  async function loadBlog() {
    try {
      // Get siteName from URL parameter, worker injection, or window.SITE_NAME
      const urlParams = new URLSearchParams(window.location.search);
      const siteName = urlParams.get('siteName') || window.SITE_NAME_FROM_WORKER || window.SITE_NAME || 'demo';
      const posts = await SideyAPI.data.list('posts', { siteName, orderBy: 'updated_at', order: 'desc' });
      allPosts = posts || [];
      
      displayPosts(allPosts);
      
      // Add search listener
      const searchInput = document.getElementById("blog-search");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          const query = e.target.value.toLowerCase();
          const filtered = allPosts.filter(p => 
            p.title.toLowerCase().includes(query) || 
            p.content.toLowerCase().includes(query)
          );
          displayPosts(filtered);
        });
      }
    } catch (error) {
      console.error("Error loading blog:", error);
    }
  }

  function displayPosts(posts) {
    const container = document.getElementById("blog-container");
    
    if (posts.length === 0) {
      container.innerHTML = "<p style='color: var(--muted);'>No posts found.</p>";
      return;
    }

    let html = posts.map((p, index) => `
      <div class="blog-item" data-post-id="${index}">
        <h3 style="cursor: pointer; user-select: none;" onclick="togglePost(${index})">${p.title}</h3>
        <div class="blog-meta">${p.updated_at ? new Date(p.updated_at).toLocaleDateString() : 'Just now'}</div>
        <div class="blog-content" id="blog-content-${index}" style="display: none;">
          <p style="white-space: pre-wrap;">${p.content}</p>
        </div>
        <p class="blog-preview" id="blog-preview-${index}">${p.content.substring(0, 300)}${p.content.length > 300 ? "..." : ""}</p>
      </div>
    `).join("");
    
    container.innerHTML = html;
  }

  // Make togglePost available globally
  window.togglePost = function(index) {
    const content = document.getElementById(`blog-content-${index}`);
    const preview = document.getElementById(`blog-preview-${index}`);
    
    if (content.style.display === "none") {
      content.style.display = "block";
      preview.style.display = "none";
    } else {
      content.style.display = "none";
      preview.style.display = "block";
    }
  };

  loadBlog();
}

initBlog();
