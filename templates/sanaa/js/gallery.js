// Gallery implementation - loads from Cloudflare API
let VIDEOS = [];
let currentVideoIndex = 0;
const galleryContainer = document.getElementById('gallery');
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lb-img');
const lbVideo = document.getElementById('lb-video');
const lbVideoSource = document.getElementById('lb-video-source');
const lbClose = document.getElementById('lb-close');
const lbPrev = document.getElementById('lb-prev');
const lbNext = document.getElementById('lb-next');

async function loadGallery() {
  if (!galleryContainer) return;
  
  // Wait for cloudflare config to be ready
  if (typeof window.db === 'undefined') {
    setTimeout(loadGallery, 100);
    return;
  }
  
  galleryContainer.innerHTML = '<p style="color: #bdbdbd; text-align: center; padding: 48px;">Loading gallery...</p>';
  
  // Initialize 3D viewer in the hero-content section
  setTimeout(() => init3DViewer(), 100);
  
  try {
    const siteName = window.SITE_NAME || 'demo';
    
    VIDEOS = [];
    let mediaIndex = 0;
    const loadedUrls = new Set(); // Track loaded URLs to avoid duplicates
    
    // Load from collections
    const collections = await window.db.getAll('collections', { username: siteName });
    
    if (collections && collections.length > 0) {
      // Load all media from collections (both videos and images)
      for (const collection of collections) {
        if (collection.mediaUrls && collection.mediaUrls.length > 0) {
          collection.mediaUrls.forEach((url, idx) => {
            // Skip GLB files - they're handled by the 3D viewer
            if (!loadedUrls.has(url) && !url.match(/\.glb$/i)) {
              loadedUrls.add(url);
              VIDEOS.push({
                id: `${collection.id}-${idx}`,
                url: url,
                src: url,
                title: collection.title || 'Untitled',
                description: collection.description || '',
                software: collection.software || [],
                equipment: collection.equipment || [],
                order: mediaIndex++
              });
            }
          });
        }
      }
    }
    
    // Fallback: try to load from gallery_images
    if (VIDEOS.length === 0) {
      const galleryImages = await window.db.getAll('gallery_images', { siteName: siteName, orderBy: 'order' });
      
      if (galleryImages && galleryImages.length > 0) {
        galleryImages.forEach(data => {
          const url = data.url || data.src;
          if (url && !loadedUrls.has(url) && !url.match(/\.glb$/i)) {
            loadedUrls.add(url);
            VIDEOS.push({
              id: data.id,
              url: url,
              src: url,
              title: data.title || 'Untitled',
              description: data.description || '',
              order: data.order || VIDEOS.length
            });
          }
        });
      }
    if (VIDEOS.length === 0) {
      galleryContainer.innerHTML = '<p style="color: #bdbdbd; text-align: center; padding: 48px;">No media yet. Upload some from the admin panel.</p>';
      return;
    }
    
    // Final safety filter: Remove any GLB files that made it through
    VIDEOS = VIDEOS.filter(video => {
      const url = video.url || video.src;
      return url && !url.match(/\.glb$/i);
    });
    
    if (VIDEOS.length === 0) {
      galleryContainer.innerHTML = '<p style="color: #bdbdbd; text-align: center; padding: 48px;">No media yet. Upload some from the admin panel.</p>';
      return;
    }
    
    galleryContainer.innerHTML = '';
    
    VIDEOS.forEach((mediaData, index) => {
      // Create container for media and description
      const container = document.createElement('div');
      container.style.marginBottom = '32px';
      
      const url = mediaData.url || mediaData.src;
      if (!url) {
        console.warn('No URL found for media item:', mediaData);
        return;
      }
      
      const isVideo = url.match(/\.(mp4|webm|mov)/i);
      const is3DModel = url.match(/\.glb$/i);
      
      // Skip 3D models in gallery - they're handled by the hero 3D viewer
      if (is3DModel) {
        return;
      }
      
      if (isVideo) {
        // Create video element for gallery
        const video = document.createElement('video');
        video.src = url;
        video.muted = true;
        video.preload = 'metadata';
        video.style.cursor = 'pointer';
        video.style.width = '100%';
        video.style.borderRadius = '4px';
        
        // Load metadata to set initial position
        video.addEventListener('loadedmetadata', () => {
          if (video.duration) {
            video.currentTime = video.duration / 2; // Set to middle of video
          }
        });
        
        // Play on hover (muted)
        video.addEventListener('mouseenter', () => {
          video.muted = true;
          video.currentTime = 0;
          video.play();
        });
        
        // Pause on mouse leave
        video.addEventListener('mouseleave', () => {
          video.pause();
          if (video.duration) {
            video.currentTime = video.duration / 2;
          }
        });
        
        // Open fullscreen lightbox on click
        video.addEventListener('click', () => openLightbox(index));
        
        // Error handling
        video.addEventListener('error', (e) => {
          console.error('Video load error:', e, url);
          video.parentElement.innerHTML = '<p style="color: #f44336;">Error loading video</p>';
        });
        
        container.appendChild(video);
      } else {
        // Create image element for gallery
        const img = document.createElement('img');
        img.src = url;
        img.style.cursor = 'pointer';
        img.style.width = '100%';
        img.style.borderRadius = '4px';
        
        // Open fullscreen lightbox on click
        img.addEventListener('click', () => openLightbox(index));
        
        // Error handling
        img.addEventListener('error', (e) => {
          console.error('Image load error:', e, url);
          img.parentElement.innerHTML = '<p style="color: #f44336;">Error loading image</p>';
        });
        
        container.appendChild(img);
      }
      
      // Create description text with title, tags, and description
      const description = document.createElement('div');
      description.style.marginTop = '12px';
      
      // Title
      const title = document.createElement('h3');
      title.style.cssText = 'margin: 0 0 6px 0; color: #757575; font-size: 1.1rem; font-weight: 500;';
      title.textContent = mediaData.title || 'Untitled';
      description.appendChild(title);
      
      // Tags
      const allTags = [];
      if (mediaData.software && mediaData.software.length > 0) {
        allTags.push(...mediaData.software);
      }
      if (mediaData.equipment && mediaData.equipment.length > 0) {
        allTags.push(...mediaData.equipment);
      }
      
      if (allTags.length > 0) {
        const tags = document.createElement('div');
        tags.style.cssText = 'color: #9e9e9e; font-size: 0.85rem; margin-bottom: 8px;';
        tags.textContent = allTags.join(' • ');
        description.appendChild(tags);
      }
      
      // Description text
      const descText = document.createElement('p');
      descText.style.cssText = 'margin: 0; color: #bdbdbd; font-size: 0.95rem; line-height: 1.5;';
      descText.textContent = mediaData.description || '';
      description.appendChild(descText);
      
      container.appendChild(description);
      
      galleryContainer.appendChild(container);
    });
  } catch (error) {
    console.error('Error loading videos:', error);
    galleryContainer.innerHTML = '<p style="color: #f44336; text-align: center; padding: 48px;">Error loading gallery. Please try again later.</p>';
  }
}

// 3D Viewer initialization
function init3DViewer() {
  const container = document.getElementById('viewer3d');
  if (!container || typeof THREE === 'undefined') {
    console.error('3D viewer container or THREE not found');
    return;
  }
  
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff); // White background
  
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 0, 3);
  
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientWidth);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);
  
  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);
  
  // Create gradient background plane for refraction
  const gradientScene = new THREE.Scene();
  const gradientPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4, 1, 128), // Add vertical segments for smooth gradient
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
  );
  gradientScene.add(gradientPlane);
  
  // Store gradient plane globally for color sampling
  renderer.domElement.__gradientPlane = gradientPlane;
  
  // Render target for gradient
  const renderTarget = new THREE.WebGLRenderTarget(512, 512);
  const gradientCamera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
  gradientCamera.position.z = 1;
  
  let model = null;
  let mixer = null;
  let originalMaterials = new Map(); // Store original materials
  
  // Mouse interaction variables
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  
  // Load model from Cloudflare R2
  const loader = new GLTFLoader();
  
  // Configure loader for CORS
  loader.setCrossOrigin('anonymous');
  
  // Get 3D model URL from collections
  if (typeof SideyAPI !== 'undefined') {
    const siteName = window.SITE_NAME || 'demo';
    
    // Search for GLB files in user's collections and uploads
    async function findGLBModel() {
      let glbUrl = null;
      
      try {
        // First check collections
        const collections = await SideyAPI.data.list('collections', { siteName });
        
        for (const collection of (collections || [])) {
          if (collection.mediaUrls && collection.mediaUrls.length > 0) {
            for (const url of collection.mediaUrls) {
              if (url.match(/\.glb$/i)) {
                glbUrl = url;
                break;
              }
            }
            if (glbUrl) break;
          }
        }
        
        // If not found in collections, check uploads folder
        if (!glbUrl) {
          const files = await SideyAPI.storage.list(siteName, 'uploads');
          for (const file of (files || [])) {
            if (file.name && file.name.match(/\.glb$/i)) {
              glbUrl = file.url;
              break;
            }
          }
        }
      } catch (error) {
        console.log('Error checking for GLB model:', error);
      }
      
      return glbUrl;
    }
    
    findGLBModel()
      .then(glbUrl => {
        if (glbUrl) {
          loader.load(glbUrl, (gltf) => {
            loadModelData(gltf);
          }, undefined, (error) => {
            console.error('Error loading 3D model:', error);
          });
        } else {
          console.log('No GLB model found');
          if (container) container.style.display = 'none';
        }
      })
      .catch(error => {
        console.error('Error finding 3D model:', error);
        if (container) container.style.display = 'none';
      });
  } else {
    console.error('SideyAPI not initialized');
  }
  
  function loadModelData(gltf) {
    model = gltf.scene;
    
    // Center and scale model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 0.75 / maxDim; // Reduced to 0.75 for half the original size
    model.scale.multiplyScalar(scale);
    model.position.sub(center.multiplyScalar(scale));
    model.position.y -= size.y * scale * 0.5; // Move down by half its height
    
    scene.add(model);
    
    // Store original materials and make model available globally for color sampling
    window.currentModel = model;
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        originalMaterials.set(child, child.material.clone());
        
        // Create glass material with transmission
        const glassMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 0,
          roughness: 0.1,
          transmission: 1, // Full transmission for glass effect
          thickness: 0.5,
          envMapIntensity: 1,
          clearcoat: 1,
          clearcoatRoughness: 0,
          ior: 1.5, // Index of refraction for glass
          transparent: true,
          side: THREE.DoubleSide
        });
        
        if (Array.isArray(child.material)) {
          child.material = glassMaterial;
        } else {
          child.material = glassMaterial;
        }
      }
    });
    
    // Animation
    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach(clip => {
        const action = mixer.clipAction(clip);
        action.play();
        action.paused = true; // Start paused
      });
    }
    
    // Render loop
    function animate() {
      requestAnimationFrame(animate);
      if (mixer) mixer.update(0.016);
      
      // Render gradient to render target first
      renderer.setRenderTarget(renderTarget);
      renderer.render(gradientScene, gradientCamera);
      renderer.setRenderTarget(null);
      
      // Update glass material to use gradient as environment map
      if (model) {
        model.traverse((child) => {
          if (child.isMesh && child.material && child.material.isMeshPhysicalMaterial) {
            child.material.envMap = renderTarget.texture;
          }
        });
      }
      
      renderer.render(scene, camera);
    }
    animate();
  }
  
  // Mouse events for drag-to-rotate
  renderer.domElement.addEventListener('mousedown', (e) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });
  
  renderer.domElement.addEventListener('mouseenter', () => {
    // Resume animation on hover
    if (mixer) {
      mixer._actions.forEach(action => {
        action.paused = false;
      });
    }
  });
  
  renderer.domElement.addEventListener('mouseleave', () => {
    isDragging = false;
    // Pause animation when not hovering
    if (mixer) {
      mixer._actions.forEach(action => {
        action.paused = true;
      });
    }
  });
  
  renderer.domElement.addEventListener('mousemove', (e) => {
    if (isDragging && model) {
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      
      // Rotate around Y axis (left-right drag)
      model.rotation.y += deltaX * 0.01;
      
      // Rotate around X axis (up-down drag)
      model.rotation.x += deltaY * 0.01;
      
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  });
  
  renderer.domElement.addEventListener('mouseup', () => {
    isDragging = false;
  });
  
  // Touch events for mobile
  renderer.domElement.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      previousMousePosition = { 
        x: e.touches[0].clientX, 
        y: e.touches[0].clientY 
      };
    }
  });
  
  renderer.domElement.addEventListener('touchmove', (e) => {
    if (isDragging && model && e.touches.length === 1) {
      e.preventDefault();
      const deltaX = e.touches[0].clientX - previousMousePosition.x;
      const deltaY = e.touches[0].clientY - previousMousePosition.y;
      
      model.rotation.y += deltaX * 0.01;
      model.rotation.x += deltaY * 0.01;
      
      previousMousePosition = { 
        x: e.touches[0].clientX, 
        y: e.touches[0].clientY 
      };
    }
  });
  
  renderer.domElement.addEventListener('touchend', () => {
    isDragging = false;
  });
  
  // Handle resize
  window.addEventListener('resize', () => {
    if (container.clientWidth > 0) {
      camera.aspect = 1;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientWidth);
    }
  });
  
  // Color sampling disabled to avoid CORS issues
  // startColorSampling();
}

function startColorSampling() {
  const galleryVideos = document.querySelectorAll('.gallery video');
  if (galleryVideos.length === 0) return;
  
  const videoElement = galleryVideos[0];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 128;
  canvas.height = 128;
  
  function sampleVideoColor() {
    if (videoElement.readyState >= 2 && window.currentModel) {
      try {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        window.currentModel.traverse((child) => {
          if (child.isMesh && child.material) {
            const geometry = child.geometry;
            // Enable vertex colors on material
            if (!geometry.attributes.color) {
              const positions = geometry.attributes.position;
              const colors = new Float32Array(positions.count * 3);
              geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                  mat.vertexColors = true;
                  mat.needsUpdate = true;
                });
              } else {
                child.material.vertexColors = true;
                child.material.needsUpdate = true;
              }
            }
            const colors = geometry.attributes.color;
            const positions = geometry.attributes.position;
            // Compute bounding box for mapping
            if (!geometry.boundingBox) {
              geometry.computeBoundingBox();
            }
            const bbox = geometry.boundingBox;
            const sizeY = bbox.max.y - bbox.min.y;
            // Map each vertex to video gradient with smoothing
            for (let i = 0; i < positions.count; i++) {
              const y = positions.getY(i);
              // Normalize Y position (0 = bottom, 1 = top)
              const t = (y - bbox.min.y) / sizeY;
              // Sample multiple positions and blend for smoother gradient
              let r = 0, g = 0, b = 0;
              const samples = 5;
              const sampleRange = 0.1;
              for (let s = 0; s < samples; s++) {
                const offset = (s / (samples - 1) - 0.5) * sampleRange;
                const sampleT = Math.max(0, Math.min(1, t + offset));
                const videoY = Math.floor(sampleT * (canvas.height - 1));
                const videoX = Math.floor(canvas.width / 2);
                const pixelIndex = (videoY * canvas.width + videoX) * 4;
                r += imageData.data[pixelIndex] / 255;
                g += imageData.data[pixelIndex + 1] / 255;
                b += imageData.data[pixelIndex + 2] / 255;
              }
              r /= samples;
              g /= samples;
              b /= samples;
              colors.setXYZ(i, r, g, b);
            }
            colors.needsUpdate = true;
          }
        });
      } catch (e) {
        console.log('Color sampling error:', e);
      }
    }
    requestAnimationFrame(sampleVideoColor);
  }
  setTimeout(() => sampleVideoColor(), 500);
}

function openLightbox(index) {
  currentVideoIndex = index;
  if (!VIDEOS[currentVideoIndex]) return;
  
  const currentMedia = VIDEOS[currentVideoIndex];
  const url = currentMedia.url || currentMedia.src;
  const isVideo = url.match(/\.(mp4|webm|mov)/i);
  
  // Show appropriate media type
  if (isVideo) {
    lbImg.style.display = 'none';
    lbVideo.style.display = 'block';
    lbVideoSource.src = url;
    lbVideoSource.type = 'video/mp4';
    lbVideo.muted = false;
    lbVideo.load();
    lbVideo.play().catch(() => {});
  } else {
    lbVideo.style.display = 'none';
    lbImg.style.display = 'block';
    lbImg.src = url;
  }
  
  // Update collection info
  const lbTitle = document.getElementById('lb-title');
  const lbDescription = document.getElementById('lb-description');
  const lbTags = document.getElementById('lb-tags');
  
  if (lbTitle) lbTitle.textContent = currentMedia.title || 'Untitled';
  if (lbDescription) lbDescription.textContent = currentMedia.description || '';
  
  // Display tags as grey text with separators
  if (lbTags) {
    const allTags = [];
    
    // Combine software and equipment tags
    if (currentMedia.software && currentMedia.software.length > 0) {
      allTags.push(...currentMedia.software);
    }
    if (currentMedia.equipment && currentMedia.equipment.length > 0) {
      allTags.push(...currentMedia.equipment);
    }
    
    // Display as text separated by bullets
    if (allTags.length > 0) {
      lbTags.textContent = allTags.join(' • ');
    } else {
      lbTags.textContent = '';
    }
  }
  
  lightbox.classList.remove('hidden');
  lightbox.setAttribute('aria-hidden', 'false');
}

function closeLightbox() {
  // Pause video if playing
  if (lbVideo && !lbVideo.paused) {
    lbVideo.pause();
  }
  lightbox.classList.add('hidden');
  lightbox.setAttribute('aria-hidden', 'true');
}

function showPrevious() {
  currentVideoIndex = (currentVideoIndex - 1 + VIDEOS.length) % VIDEOS.length;
  openLightbox(currentVideoIndex);
}

function showNext() {
  currentVideoIndex = (currentVideoIndex + 1) % VIDEOS.length;
  openLightbox(currentVideoIndex);
}

// Event listeners
if (lbClose) lbClose.addEventListener('click', closeLightbox);
if (lbPrev) {
  lbPrev.style.display = 'block';
  lbPrev.addEventListener('click', showPrevious);
}
if (lbNext) {
  lbNext.style.display = 'block';
  lbNext.addEventListener('click', showNext);
}

// Close lightbox on escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !lightbox.classList.contains('hidden')) {
    closeLightbox();
  }
});

// Arrow key navigation
document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('hidden')) {
    if (e.key === 'ArrowLeft') showPrevious();
    if (e.key === 'ArrowRight') showNext();
  }
});

// Close lightbox when clicking outside the image
lightbox?.addEventListener('click', (e) => {
  if (e.target === lightbox) {
    closeLightbox();
  }
});

// Load gallery on page load
document.addEventListener('DOMContentLoaded', loadGallery);

// Initialize 3D viewer for gallery models
function initGallery3DViewer(container, modelUrl) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 0, 3);
  
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const size = container.clientWidth;
  renderer.setSize(size, size);
  renderer.setPixelRatio(window.devicePixelRatio);
  
  // Clear container and add renderer
  container.innerHTML = '';
  container.appendChild(renderer.domElement);
  
  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);
  
  let model = null;
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  
  // Load model
  const loader = new GLTFLoader();
  loader.load(modelUrl, (gltf) => {
    model = gltf.scene;
    
    // Center and scale model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;
    model.scale.multiplyScalar(scale);
    model.position.sub(center.multiplyScalar(scale));
    
    scene.add(model);
  }, undefined, (error) => {
    console.error('Error loading 3D model:', error);
    container.innerHTML = '<p style="color: #f44336; padding: 20px; text-align: center;">Error loading 3D model</p>';
  });
  
  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    if (model && !isDragging) {
      model.rotation.y += 0.005; // Auto-rotate
    }
    renderer.render(scene, camera);
  }
  animate();
  
  // Mouse controls
  renderer.domElement.addEventListener('mousedown', (e) => {
    isDragging = true;
    container.style.cursor = 'grabbing';
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });
  
  renderer.domElement.addEventListener('mouseup', () => {
    isDragging = false;
    container.style.cursor = 'grab';
  });
  
  renderer.domElement.addEventListener('mouseleave', () => {
    isDragging = false;
    container.style.cursor = 'grab';
  });
  
  renderer.domElement.addEventListener('mousemove', (e) => {
    if (isDragging && model) {
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      
      model.rotation.y += deltaX * 0.01;
      model.rotation.x += deltaY * 0.01;
      
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  });
  
  // Touch controls
  renderer.domElement.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  });
  
  renderer.domElement.addEventListener('touchmove', (e) => {
    if (isDragging && model && e.touches.length === 1) {
      e.preventDefault();
      const deltaX = e.touches[0].clientX - previousMousePosition.x;
      const deltaY = e.touches[0].clientY - previousMousePosition.y;
      
      model.rotation.y += deltaX * 0.01;
      model.rotation.x += deltaY * 0.01;
      
      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  });
  
  renderer.domElement.addEventListener('touchend', () => {
    isDragging = false;
  });
  
  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    const newSize = container.clientWidth;
    if (newSize > 0) {
      renderer.setSize(newSize, newSize);
    }
  });
  resizeObserver.observe(container);
}
