// Showreel video that appears between hero and blog sections
(function() {
  function createVideoElement(url) {
    // Check if video already exists
    let existingVideo = document.getElementById('showreel-video-container');
    if (existingVideo) return;
    
    // Find the blog section
    const blogSection = document.querySelector('.blog-section');
    if (!blogSection) return;
    
    // Create video container
    const container = document.createElement('div');
    container.id = 'showreel-video-container';
    container.style.cssText = `
      padding: 48px;
      max-width: 1200px;
      margin: 0 auto;
    `;
    
    const video = document.createElement('video');
    video.id = 'showreel-video';
    video.style.cssText = `
      width: 100%;
      height: auto;
      border-radius: 4px;
    `;
    video.controls = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    
    container.appendChild(video);
    
    // Insert before blog section
    blogSection.parentNode.insertBefore(container, blogSection);
  }
  
  async function loadShowreel() {
    if (typeof SideyAPI === 'undefined') {
      setTimeout(loadShowreel, 100);
      return;
    }
    
    const SITE_ID = window.SITE_NAME || 'demo';
    try {
      const settings = await SideyAPI.data.get('settings', `${SITE_ID}-backgroundVideo`);
      if (settings && settings.url) {
        createVideoElement(settings.url);
      }
    } catch (err) {
      console.error('Error loading showreel:', err);
    }
  }
  
  loadShowreel();
})();
