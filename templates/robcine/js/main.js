// Gallery script - loads images from Cloudflare R2
(function(){
  const gallery = document.getElementById('gallery');
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbClose = document.getElementById('lb-close');
  const lbPrev = document.getElementById('lb-prev');
  const lbNext = document.getElementById('lb-next');

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

  // Load images from Cloudflare R2
  async function loadGallery() {
    if (typeof SideyAPI === 'undefined') {
      setTimeout(loadGallery, 100);
      return;
    }

    // Get siteName from URL parameter, worker injection, or window.SITE_NAME
    const urlParams = new URLSearchParams(window.location.search);
    const siteName = urlParams.get('siteName') || window.SITE_NAME_FROM_WORKER || window.SITE_NAME || 'demo';
    
    try {
      // Check if user is Pro
      const siteInfo = await SideyAPI.site.get(siteName);
      if (siteInfo) {
        const isPro = siteInfo.is_pro || false;
        // Show footer only for non-Pro users
        const footer = document.getElementById('sidey-footer');
        if (footer && !isPro) {
          footer.style.display = 'block';
        }
      }
      
      // Load images from R2 storage
      const files = await SideyAPI.storage.list(siteName, 'uploads');
      if (files && files.length > 0) {
        imageList = files.map(f => f.url);
        imageList.forEach((url, i) => {
          gallery.appendChild(makeThumb(url, i));
        });
      }
    } catch (err) {
      console.error('Error loading gallery:', err);
    }
  }

  loadGallery();

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
