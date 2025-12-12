// Gallery script - loads user profile and gallery from Cloudflare
(function(){
  const gallery = document.getElementById('gallery');
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbClose = document.getElementById('lb-close');
  const lbPrev = document.getElementById('lb-prev');
  const lbNext = document.getElementById('lb-next');
  const siteTitle = document.getElementById('site-title');
  const siteDescription = document.getElementById('site-description');

  let imageList = [];
  let currentIndex = 0;

  function makeThumb(src, i){
    const img = document.createElement('img');
    img.className = 'thumb';
    img.alt = `Still ${i+1}`;
    img.dataset.index = i;
    img.src = src;
    img.addEventListener('click', ()=>openLightbox(i));
    return img;
  }

  function openLightbox(i){
    currentIndex = i;
    lbImg.src = imageList[currentIndex];
    lbImg.alt = `Still ${currentIndex+1}`;
    lb.classList.remove('hidden');
    lb.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox(){
    lb.classList.add('hidden');
    lb.setAttribute('aria-hidden','true');
    lbImg.src = '';
    document.body.style.overflow = '';
  }

  function showPrev(){
    currentIndex = (currentIndex - 1 + imageList.length) % imageList.length;
    lbImg.src = imageList[currentIndex];
  }
  function showNext(){
    currentIndex = (currentIndex + 1) % imageList.length;
    lbImg.src = imageList[currentIndex];
  }

  // Load all site content
  async function loadSiteContent() {
    if (typeof SideyAPI === 'undefined') {
      setTimeout(loadSiteContent, 100);
      return;
    }

    // Get siteName from URL parameter or window.SITE_NAME
    const urlParams = new URLSearchParams(window.location.search);
    const siteName = urlParams.get('siteName') || window.SITE_NAME_FROM_WORKER || window.SITE_NAME || 'demo';
    
    console.log('Loading site content for:', siteName);
    
    try {
      // Load profile info
      try {
        const profile = await SideyAPI.db.get('profiles', siteName);
        if (profile) {
          if (siteTitle && profile.fullName) {
            siteTitle.textContent = profile.fullName;
            document.title = profile.fullName + ' - Portfolio';
          }
          if (siteDescription && profile.about) {
            siteDescription.textContent = profile.about;
          }
        }
      } catch (profileErr) {
        console.log('No profile found, using defaults');
      }
      
      // Check if user is Pro
      try {
        const siteInfo = await SideyAPI.site.get(siteName);
        if (siteInfo) {
          const isPro = siteInfo.is_pro || false;
          // Show footer only for non-Pro users
          const footer = document.getElementById('sidey-footer');
          if (footer && !isPro) {
            footer.style.display = 'block';
          }
        }
      } catch (siteErr) {
        console.log('Could not fetch site info');
      }
      
      // Load collections first - these are the main portfolio content
      try {
        const collections = await SideyAPI.db.getAll('collections', { 
          where: { siteId: siteName },
          orderBy: 'createdAt',
          orderDir: 'desc'
        });
        
        if (collections && collections.length > 0) {
          // Extract all media from collections
          collections.forEach(collection => {
            if (collection.media && collection.media.length > 0) {
              collection.media.forEach(m => {
                if (m.url && m.type !== 'video') {
                  imageList.push(m.url);
                }
              });
            }
          });
          
          // Display images in gallery
          imageList.forEach((url, i) => {
            gallery.appendChild(makeThumb(url, i));
          });
        }
      } catch (collErr) {
        console.log('No collections found, trying gallery images');
      }
      
      // If no collection images, try loading from gallery
      if (imageList.length === 0) {
        try {
          const galleryImages = await SideyAPI.db.getAll('gallery', { 
            where: { siteId: siteName } 
          });
          
          if (galleryImages && galleryImages.length > 0) {
            galleryImages.forEach(img => {
              if (img.url && img.type !== 'video') {
                imageList.push(img.url);
              }
            });
            
            imageList.forEach((url, i) => {
              gallery.appendChild(makeThumb(url, i));
            });
          }
        } catch (galErr) {
          console.log('No gallery images found');
        }
      }
      
      // Still no images? Try R2 storage directly
      if (imageList.length === 0) {
        try {
          const files = await SideyAPI.storage.list(siteName, 'uploads');
          if (files && files.length > 0) {
            imageList = files.filter(f => !f.url.includes('video')).map(f => f.url);
            imageList.forEach((url, i) => {
              gallery.appendChild(makeThumb(url, i));
            });
          }
        } catch (storageErr) {
          console.log('No storage files found');
        }
      }
      
      if (imageList.length === 0) {
        gallery.innerHTML = '<p style="color: #999; text-align: center; padding: 40px;">No images yet. Add content from your dashboard.</p>';
      }
      
    } catch (err) {
      console.error('Error loading site content:', err);
    }
  }

  loadSiteContent();

  // events
  lbClose.addEventListener('click', closeLightbox);
  lbPrev.addEventListener('click', showPrev);
  lbNext.addEventListener('click', showNext);

  document.addEventListener('keydown', (e)=>{
    if(lb.classList.contains('hidden')) return;
    if(e.key === 'Escape') closeLightbox();
    if(e.key === 'ArrowLeft') showPrev();
    if(e.key === 'ArrowRight') showNext();
  });

  // click outside image closes
  lb.addEventListener('click', (e)=>{
    if(e.target === lb) closeLightbox();
  });
})();
