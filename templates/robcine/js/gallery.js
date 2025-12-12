// Get siteName from URL parameter, worker injection, or default
const urlParams = new URLSearchParams(window.location.search);
const SITE_NAME = urlParams.get('siteName') || window.SITE_NAME_FROM_WORKER || window.SITE_NAME || 'demo';
window.SITE_NAME = SITE_NAME;
