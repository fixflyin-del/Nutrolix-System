// Nutrolix SEO, Sitemap, Robots, Merchant Feed, Structured Data & SSR Meta Engine
// Canonical domain: https://nutrolix.in

const SITE_ORIGIN = 'https://nutrolix.in';
const BRAND_NAME = 'Nutrolix';
const BRAND_LEGAL_NAME = 'Nutrolix Wellness Pvt. Ltd.';
const BRAND_TAGLINE = 'Nutrition That Works';
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/assets/aistudio/image_6061bdc8.png`;
const BRAND_LOGO_URL = `${SITE_ORIGIN}/assets/nutrolix-logo.png`;
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.aistudio.nutrolix.fooddelivery';

const OFFICIAL_SOCIAL_LINKS = [
  'https://www.facebook.com/people/Nutrolix/61593206843289/',
  'https://www.instagram.com/nutrolix.wellness/',
  'https://www.youtube.com/@Nutrolix',
  'https://share.google/VKolmxSnf5D05l7pu'
];

const DEFAULT_PAGE_SEO = {
  '/': {
    title: 'Nutrolix – Nutrition That Works | Functional Foods, High Protein Atta & Healthy Kitchen',
    description: 'Shop Nutrolix functional nutrition staples including High Protein Atta, Complete Nutri Meal, Talbeenah, and order fresh high-protein meals from Nutrolix Healthy Food Kitchen.',
    ogType: 'website',
    breadcrumb: 'Home'
  },
  '/shop': {
    title: 'Shop Functional Nutrition & High Protein Products | Nutrolix',
    description: 'Browse Nutrolix packaged functional nutrition: High Protein Atta, Superfood Blends, Talbeenah, Millet Flakes, and daily clean-label protein staples delivered across India.',
    ogType: 'website',
    breadcrumb: 'Shop'
  },
  '/food': {
    title: 'Healthy Food Delivery & Fresh Protein Kitchen Menu | Nutrolix',
    description: 'Order fresh, macro-balanced healthy meals, protein bowls, wraps, salads, and nutritious shakes prepared daily by the Nutrolix Smart Food Kitchen.',
    ogType: 'website',
    breadcrumb: 'Healthy Food'
  },
  '/smart-food-kitchen': {
    title: 'Nutrolix Smart Food Kitchen – Fresh High-Protein Meals & Healthy Delivery',
    description: 'Discover the Nutrolix Smart Food Kitchen: freshly cooked high-protein meals, millet bowls, balanced wraps, and wholesome shakes crafted with clean ingredients.',
    ogType: 'website',
    breadcrumb: 'Smart Food Kitchen'
  },
  '/blogs': {
    title: 'Nutrition Science, Healthy Recipes & Wellness Blog | Nutrolix',
    description: 'Read evidence-based articles on functional nutrition, high-protein Indian staples, glycemic health, gut wellness, and whole-food ingredients from the Nutrolix team.',
    ogType: 'website',
    breadcrumb: 'Blogs'
  },
  '/about': {
    title: 'About Nutrolix Wellness – Clean Functional Nutrition & Food Science',
    description: 'Learn about Nutrolix Wellness Pvt. Ltd., our FSSAI-certified functional nutrition standards, clean ingredients, and mission to make high-protein everyday food accessible.',
    ogType: 'website',
    breadcrumb: 'About Us'
  },
  '/contact': {
    title: 'Contact Nutrolix – Customer Support, WhatsApp & Wholesale Inquiries',
    description: 'Reach Nutrolix Wellness support via WhatsApp (+91 90762 54354), email, or our inquiry form for product guidance, order assistance, and distributor partnerships.',
    ogType: 'website',
    breadcrumb: 'Contact Us'
  },
  '/faqs': {
    title: 'Frequently Asked Questions (FAQs) – Products, Delivery & Quality | Nutrolix',
    description: 'Find answers about Nutrolix High Protein Atta, Talbeenah, Complete Nutri Meal, FSSAI certifications, shipping timelines, and healthy food kitchen delivery.',
    ogType: 'website',
    breadcrumb: 'FAQs'
  },
  '/privacy': {
    title: 'Privacy Policy | Nutrolix Wellness',
    description: 'Read how Nutrolix Wellness Pvt. Ltd. collects, uses, and protects your personal information across nutrolix.in and the Nutrolix mobile application.',
    ogType: 'website',
    breadcrumb: 'Privacy Policy'
  },
  '/terms': {
    title: 'Terms & Conditions | Nutrolix Wellness',
    description: 'Review the terms and conditions governing purchases, healthy food orders, and use of Nutrolix Wellness digital platforms.',
    ogType: 'website',
    breadcrumb: 'Terms & Conditions'
  },
  '/refund': {
    title: 'Return & Refund Policy | Nutrolix Wellness',
    description: 'Understand Nutrolix return eligibility, damaged-item replacements, and refund timelines for packaged nutrition and fresh food orders.',
    ogType: 'website',
    breadcrumb: 'Return & Refund Policy'
  },
  '/shipping': {
    title: 'Shipping & Delivery Policy | Nutrolix Wellness',
    description: 'View pan-India dispatch timelines, shipping charges, free delivery thresholds, and order tracking information for Nutrolix orders.',
    ogType: 'website',
    breadcrumb: 'Shipping Policy'
  },
  '/cancellation': {
    title: 'Order Cancellation Policy | Nutrolix Wellness',
    description: 'Check how and when you can cancel packaged nutrition or fresh kitchen orders placed on Nutrolix.',
    ogType: 'website',
    breadcrumb: 'Cancellation Policy'
  }
};

const DEFAULT_SEO_SETTINGS = {
  siteName: BRAND_NAME,
  siteTagline: BRAND_TAGLINE,
  canonicalOrigin: SITE_ORIGIN,
  defaultOgImage: DEFAULT_OG_IMAGE,
  googleSiteVerification: '',
  ga4MeasurementId: '',
  gtmContainerId: '',
  businessPhone: '+91 90762 54354',
  businessEmail: 'support@nutrolix.com',
  businessAddress: 'Smart Food & Wellness Hub, Sector 14, Dwarka, New Delhi – 110078, India',
  businessLocality: 'New Delhi',
  businessRegion: 'Delhi',
  businessPostalCode: '110078',
  businessCountry: 'IN',
  googleBusinessProfileUrl: 'https://share.google/VKolmxSnf5D05l7pu',
  pages: JSON.parse(JSON.stringify(DEFAULT_PAGE_SEO)),
  updatedAt: ''
};

// Private / utility paths that must NEVER be indexed by Google
const PRIVATE_NOINDEX_PATHS = new Set([
  '/admin',
  '/admin.html',
  '/cart',
  '/cart.html',
  '/checkout',
  '/checkout.html',
  '/orders',
  '/orders.html',
  '/track',
  '/tracking',
  '/account',
  '/account.html',
  '/wishlist',
  '/login',
  '/register',
  '/signup',
  '/download',
  '/download.html',
  '/delete-account',
  '/delete-account.html',
  '/app',
  '/app.html',
  '/customer',
  '/customer.html'
]);

// Permanent 301 redirect map: old URLs, .html duplicates, broken legacy slugs -> clean canonical destinations
const PERMANENT_REDIRECT_MAP = {
  '/index.html': '/',
  '/home': '/',
  '/home.html': '/',
  '/app': '/',
  '/app.html': '/',
  '/customer': '/',
  '/customer.html': '/',
  '/shop.html': '/shop',
  '/store': '/shop',
  '/products': '/shop',
  '/nutrition': '/shop',
  '/food.html': '/food',
  '/healthy-food': '/food',
  '/menu': '/food',
  '/cloud-kitchen': '/smart-food-kitchen',
  '/kitchen': '/smart-food-kitchen',
  '/smart-food-kitchen.html': '/smart-food-kitchen',
  '/blogs.html': '/blogs',
  '/blog': '/blogs',
  '/articles': '/blogs',
  '/about.html': '/about',
  '/about-us': '/about',
  '/our-story': '/about',
  '/our-story.html': '/about',
  '/story': '/about',
  '/vision': '/about',
  '/contact.html': '/contact',
  '/contact-us': '/contact',
  '/faqs.html': '/faqs',
  '/faq': '/faqs',
  '/faq.html': '/faqs',
  '/privacy.html': '/privacy',
  '/privacy-policy': '/privacy',
  '/privacy-policy.html': '/privacy',
  '/terms.html': '/terms',
  '/terms-and-conditions': '/terms',
  '/terms-of-service': '/terms',
  '/refund.html': '/refund',
  '/refund-policy': '/refund',
  '/refund-policy.html': '/refund',
  '/return-policy': '/refund',
  '/shipping.html': '/shipping',
  '/shipping-policy': '/shipping',
  '/shipping-policy.html': '/shipping',
  '/cancellation.html': '/cancellation',
  '/cancellation-policy': '/cancellation',
  '/cancellation-policy.html': '/cancellation'
};

// Genuinely obsolete legacy paths (e.g. old WordPress/CMS endpoints) -> 410 Gone
const GONE_410_PREFIXES = [
  '/wp-admin',
  '/wp-login.php',
  '/wp-content',
  '/wp-includes',
  '/xmlrpc.php',
  '/cgi-bin',
  '/feed',
  '/comments/feed',
  '/my-account'
];

// Verified FAQs matching public/faqs.html verbatim (zero fabricated claims)
const VERIFIED_FAQS = [
  {
    question: 'How does Nutrolix High Protein Atta taste compared to regular wheat flour?',
    answer: 'It tastes naturally earthy, nutty, and soft. Because we use sprouted finger millet (ragi), roasted peanut flour, and isolated plant proteins without bitter additives or chemicals, your rotis puff up beautifully, remain soft for hours, and do not taste like chalk or medicine.'
  },
  {
    question: 'Is High Protein Atta safe for people with Diabetes?',
    answer: 'With over 12g of dietary fiber and 46g of plant protein per 100g, it significantly reduces the glycemic index (GI) compared to standard wheat or maida rotis.'
  },
  {
    question: 'What is the difference between the Packaged Store and Healthy Food?',
    answer: 'Nutrolix Store ships shelf-stable packaged functional nutrition (High Protein Atta, Nutri Meals, Talbeenah, Superfoods) across India via express courier. Healthy Food is our fresh cloud-kitchen delivery service that prepares and delivers hot meals, protein bowls, wraps, and salads fresh to your doorstep.'
  },
  {
    question: 'What is Talbeenah and how should it be consumed?',
    answer: 'Talbeenah is a traditional food made from slow-roasted whole pearl barley, almond meal, and natural date sweetness, rich in beta-glucan fibers. Mix 2 tablespoons in warm milk or plant milk and simmer for 3 minutes.'
  },
  {
    question: 'How fast is delivery and how much is shipping?',
    answer: 'Packaged orders are dispatched within 24-48 hours and arrive in 2 to 5 business days across India. Shipping is free on eligible orders above the free-delivery threshold, with a standard nominal shipping fee below it. Fresh kitchen meals are prepared and delivered directly.'
  },
  {
    question: 'Are Nutrolix products lab-tested and FSSAI certified?',
    answer: 'Every batch is produced under ISO 9001:2015 and GMP certified conditions under FSSAI License number 21526024003044, with routine third-party laboratory testing.'
  }
];

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripHtmlTags(str) {
  return String(str == null ? '' : str).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncateText(str, maxLen = 160) {
  const clean = stripHtmlTags(str);
  if (clean.length <= maxLen) return clean;
  const cut = clean.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 90);
}

function toAbsoluteUrl(maybeUrl, fallback = DEFAULT_OG_IMAGE) {
  const raw = String(maybeUrl || '').trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('data:')) return fallback;
  return `${SITE_ORIGIN}/${raw.replace(/^\/+/, '')}`;
}

function isTestOrPlaceholderProduct(p) {
  if (!p || typeof p !== 'object') return true;
  const id = String(p.id || '').trim().toLowerCase();
  const title = String(p.name || p.title || '').trim();
  if (!title) return true;
  if (id === 'prod_mwbytsx8') return true;
  if (/^test\s+resilience\s+product$/i.test(title)) return true;
  return false;
}

function getProductSlug(product) {
  if (!product) return '';
  if (product.slug && slugify(product.slug)) return slugify(product.slug);
  const titleSlug = slugify(product.name || product.title || '');
  if (titleSlug) return titleSlug;
  return slugify(product.id || '');
}

function getBlogSlug(blog) {
  if (!blog) return '';
  if (blog.slug && slugify(blog.slug)) return slugify(blog.slug);
  const titleSlug = slugify(blog.title || '');
  if (titleSlug) return titleSlug;
  return slugify(blog.id || '');
}

function findProductBySlugOrId(products, slugOrId) {
  if (!Array.isArray(products) || !slugOrId) return null;
  const raw = decodeURIComponent(String(slugOrId)).trim().toLowerCase();
  const clean = slugify(raw);
  return (
    products.find((p) => {
      if (!p) return false;
      const pId = String(p.id || '').trim().toLowerCase();
      const pSlug = getProductSlug(p);
      const pName = String(p.name || p.title || '').trim().toLowerCase();
      return pSlug === raw || pSlug === clean || pId === raw || pName === raw;
    }) || null
  );
}

function findBlogBySlugOrId(blogs, slugOrId) {
  if (!Array.isArray(blogs) || !slugOrId) return null;
  const raw = decodeURIComponent(String(slugOrId)).trim().toLowerCase();
  const clean = slugify(raw);
  return (
    blogs.find((b) => {
      if (!b) return false;
      const bId = String(b.id || '').trim().toLowerCase();
      const bSlug = getBlogSlug(b);
      return bSlug === raw || bSlug === clean || bId === raw;
    }) || null
  );
}

function sanitizeVerificationCode(val) {
  const raw = String(val || '').trim();
  if (!raw) return '';
  // If user pasted the full <meta ... content="CODE" />, extract just the content token
  const metaMatch = raw.match(/content\s*=\s*["']([^"']+)["']/i);
  const extracted = metaMatch ? metaMatch[1].trim() : raw;
  return extracted.replace(/[^a-zA-Z0-9._=-]/g, '').slice(0, 128);
}

function sanitizeGa4Id(val) {
  const raw = String(val || '').trim().toUpperCase();
  return /^G-[A-Z0-9]{4,20}$/.test(raw) ? raw : '';
}

function sanitizeGtmId(val) {
  const raw = String(val || '').trim().toUpperCase();
  return /^GTM-[A-Z0-9]{4,20}$/.test(raw) ? raw : '';
}

function normalizeSeoSettings(raw = {}, prev = {}) {
  const basePages = JSON.parse(JSON.stringify(DEFAULT_PAGE_SEO));
  const mergedPages = {};
  for (const [route, def] of Object.entries(basePages)) {
    const prevPage = (prev && prev.pages && prev.pages[route]) || {};
    const rawPage = (raw && raw.pages && raw.pages[route]) || {};
    mergedPages[route] = {
      title: String(rawPage.title ?? prevPage.title ?? def.title).trim() || def.title,
      description: String(rawPage.description ?? prevPage.description ?? def.description).trim() || def.description,
      ogType: def.ogType,
      breadcrumb: def.breadcrumb
    };
  }

  // Env vars take precedence only if admin field is blank, OR allow explicit env fallback
  const envGsc = sanitizeVerificationCode(process.env.GOOGLE_SITE_VERIFICATION || '');
  const envGa4 = sanitizeGa4Id(process.env.GA4_MEASUREMENT_ID || '');
  const envGtm = sanitizeGtmId(process.env.GTM_CONTAINER_ID || '');

  const savedGsc = sanitizeVerificationCode(
    raw.googleSiteVerification !== undefined ? raw.googleSiteVerification : (prev.googleSiteVerification || '')
  );
  const savedGa4 = sanitizeGa4Id(
    raw.ga4MeasurementId !== undefined ? raw.ga4MeasurementId : (prev.ga4MeasurementId || '')
  );
  const savedGtm = sanitizeGtmId(
    raw.gtmContainerId !== undefined ? raw.gtmContainerId : (prev.gtmContainerId || '')
  );

  return {
    siteName: String(raw.siteName ?? prev.siteName ?? DEFAULT_SEO_SETTINGS.siteName).trim() || BRAND_NAME,
    siteTagline: String(raw.siteTagline ?? prev.siteTagline ?? DEFAULT_SEO_SETTINGS.siteTagline).trim() || BRAND_TAGLINE,
    canonicalOrigin: SITE_ORIGIN,
    defaultOgImage: toAbsoluteUrl(raw.defaultOgImage ?? prev.defaultOgImage ?? DEFAULT_OG_IMAGE),
    googleSiteVerification: savedGsc || envGsc,
    ga4MeasurementId: savedGa4 || envGa4,
    gtmContainerId: savedGtm || envGtm,
    businessPhone: String(raw.businessPhone ?? prev.businessPhone ?? DEFAULT_SEO_SETTINGS.businessPhone).trim(),
    businessEmail: String(raw.businessEmail ?? prev.businessEmail ?? DEFAULT_SEO_SETTINGS.businessEmail).trim(),
    businessAddress: String(raw.businessAddress ?? prev.businessAddress ?? DEFAULT_SEO_SETTINGS.businessAddress).trim(),
    businessLocality: String(raw.businessLocality ?? prev.businessLocality ?? DEFAULT_SEO_SETTINGS.businessLocality).trim(),
    businessRegion: String(raw.businessRegion ?? prev.businessRegion ?? DEFAULT_SEO_SETTINGS.businessRegion).trim(),
    businessPostalCode: String(raw.businessPostalCode ?? prev.businessPostalCode ?? DEFAULT_SEO_SETTINGS.businessPostalCode).trim(),
    businessCountry: 'IN',
    googleBusinessProfileUrl: String(
      raw.googleBusinessProfileUrl ?? prev.googleBusinessProfileUrl ?? DEFAULT_SEO_SETTINGS.googleBusinessProfileUrl
    ).trim(),
    pages: mergedPages,
    updatedAt: new Date().toISOString()
  };
}

function isPrivateNoindexPath(reqPath) {
  const clean = String(reqPath || '/').toLowerCase().replace(/\/+$/, '') || '/';
  if (clean === '/api' || clean.startsWith('/api/')) return true;
  if (PRIVATE_NOINDEX_PATHS.has(clean)) return true;
  if (clean.startsWith('/admin/')) return true;
  return false;
}

function isGone410Path(reqPath) {
  const clean = String(reqPath || '/').toLowerCase();
  return GONE_410_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(prefix + '/'));
}

function getPermanentRedirectTarget(reqPath, search = '') {
  const normalized = String(reqPath || '/');
  // Strip trailing slash on non-root paths (consistent trailingSlash: false)
  if (normalized.length > 1 && normalized.endsWith('/')) {
    const withoutSlash = normalized.replace(/\/+$/, '');
    const mapped = PERMANENT_REDIRECT_MAP[withoutSlash.toLowerCase()];
    return (mapped || withoutSlash) + (search || '');
  }
  const mapped = PERMANENT_REDIRECT_MAP[normalized.toLowerCase()];
  if (mapped) {
    return mapped + (search || '');
  }
  return null;
}

function buildRobotsTxt() {
  return [
    '# Nutrolix Official Robots.txt — https://nutrolix.in',
    'User-agent: *',
    'Allow: /',
    'Allow: /assets/',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /admin.html',
    'Disallow: /api/',
    'Disallow: /account',
    'Disallow: /account.html',
    'Disallow: /orders',
    'Disallow: /orders.html',
    'Disallow: /cart',
    'Disallow: /cart.html',
    'Disallow: /checkout',
    'Disallow: /login',
    'Disallow: /delete-account',
    'Disallow: /download',
    'Disallow: /app',
    'Disallow: /customer',
    '',
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    ''
  ].join('\n');
}

function formatIsoDate(dateInput) {
  if (!dateInput) return new Date().toISOString().split('T')[0];
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().split('T')[0];
  return parsed.toISOString().split('T')[0];
}

function buildSitemapXml({ products = [], blogs = [] } = {}) {
  const today = new Date().toISOString().split('T')[0];
  const entries = [];
  const seenUrls = new Set();

  const addEntry = (pathPart, lastmod = today, changefreq = 'weekly', priority = '0.7') => {
    const loc = pathPart === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}/${String(pathPart).replace(/^\/+/, '')}`;
    if (seenUrls.has(loc)) return;
    seenUrls.add(loc);
    entries.push({ loc, lastmod: formatIsoDate(lastmod), changefreq, priority });
  };

  // Static public pages
  addEntry('/', today, 'daily', '1.0');
  addEntry('/shop', today, 'daily', '0.9');
  addEntry('/food', today, 'daily', '0.9');
  addEntry('/smart-food-kitchen', today, 'weekly', '0.85');
  addEntry('/blogs', today, 'weekly', '0.8');
  addEntry('/about', today, 'monthly', '0.7');
  addEntry('/contact', today, 'monthly', '0.7');
  addEntry('/faqs', today, 'monthly', '0.7');
  addEntry('/shipping', today, 'yearly', '0.4');
  addEntry('/refund', today, 'yearly', '0.4');
  addEntry('/cancellation', today, 'yearly', '0.4');
  addEntry('/privacy', today, 'yearly', '0.3');
  addEntry('/terms', today, 'yearly', '0.3');

  // Dynamic public products (canonical /products/<slug>)
  if (Array.isArray(products)) {
    for (const p of products) {
      if (isTestOrPlaceholderProduct(p)) continue;
      if (p.isHidden === true || p.status === 'draft' || p.status === 'archived') continue;
      const slug = getProductSlug(p);
      if (!slug) continue;
      addEntry(`/products/${slug}`, p.updatedAt || today, 'weekly', '0.85');
    }
  }

  // Dynamic published blog articles (canonical /blog/<slug>)
  if (Array.isArray(blogs)) {
    for (const b of blogs) {
      if (!b || !b.title) continue;
      if (b.status === 'draft' || b.isPublished === false) continue;
      const slug = getBlogSlug(b);
      if (!slug) continue;
      addEntry(`/blog/${slug}`, b.updatedAt || b.date || today, 'monthly', '0.75');
    }
  }

  const urlsXml = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${escapeXml(e.loc)}</loc>\n    <lastmod>${escapeXml(e.lastmod)}</lastmod>\n    <changefreq>${escapeXml(e.changefreq)}</changefreq>\n    <priority>${escapeXml(e.priority)}</priority>\n  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>\n`;
}

function buildGoogleMerchantFeedXml({ products = [], storeSettings = {} } = {}) {
  const deliveryFee = Number(storeSettings.deliveryFee !== undefined ? storeSettings.deliveryFee : 49);
  const itemsXml = [];

  if (Array.isArray(products)) {
    for (const p of products) {
      if (isTestOrPlaceholderProduct(p)) continue;
      if (p.isHidden === true || p.status === 'draft' || p.status === 'archived') continue;

      const title = stripHtmlTags(p.name || p.title || '').slice(0, 150);
      if (!title) continue;

      const slug = getProductSlug(p);
      if (!slug) continue;

      const link = `${SITE_ORIGIN}/products/${slug}`;
      const rawDesc = p.description || p.tagline || `${title} by ${BRAND_NAME}.`;
      const desc = stripHtmlTags(rawDesc).slice(0, 5000);

      const images = Array.isArray(p.images) ? p.images.filter(Boolean) : (p.image ? [p.image] : []);
      const primaryImg = toAbsoluteUrl(images[0] || '', DEFAULT_OG_IMAGE);
      const additionalImgs = images
        .slice(1, 5)
        .map((img) => toAbsoluteUrl(img, ''))
        .filter((u) => u && u !== primaryImg);

      const salePrice = Number(p.price || 0);
      const mrpPrice = Number(p.mrp || 0);
      if (!(salePrice > 0)) continue;

      const hasDiscount = mrpPrice > salePrice;
      const regularPrice = hasDiscount ? mrpPrice : salePrice;
      const inStock = p.inStock !== false && (p.stockQuantity === undefined || Number(p.stockQuantity) > 0);
      const availability = inStock ? 'in_stock' : 'out_of_stock';
      const category = stripHtmlTags(p.category || 'Functional Nutrition');

      const gtin = p.gtin ? String(p.gtin).trim() : '';
      const mpn = p.mpn ? String(p.mpn).trim() : (p.sku ? String(p.sku).trim() : '');

      const lines = [
        '    <item>',
        `      <g:id>${escapeXml(String(p.id || slug))}</g:id>`,
        `      <g:title>${escapeXml(title)}</g:title>`,
        `      <g:description>${escapeXml(desc)}</g:description>`,
        `      <g:link>${escapeXml(link)}</g:link>`,
        `      <g:image_link>${escapeXml(primaryImg)}</g:image_link>`
      ];

      for (const addImg of additionalImgs) {
        lines.push(`      <g:additional_image_link>${escapeXml(addImg)}</g:additional_image_link>`);
      }

      lines.push(`      <g:availability>${availability}</g:availability>`);
      lines.push(`      <g:price>${regularPrice.toFixed(2)} INR</g:price>`);
      if (hasDiscount) {
        lines.push(`      <g:sale_price>${salePrice.toFixed(2)} INR</g:sale_price>`);
      }
      lines.push(`      <g:brand>${escapeXml(BRAND_NAME)}</g:brand>`);
      lines.push('      <g:condition>new</g:condition>');
      lines.push(`      <g:product_type>${escapeXml(`Food, Beverages & Tobacco > ${category}`)}</g:product_type>`);
      lines.push('      <g:google_product_category>Food, Beverages &amp; Tobacco &gt; Food Items</g:google_product_category>');

      if (gtin) {
        lines.push(`      <g:gtin>${escapeXml(gtin)}</g:gtin>`);
      }
      if (mpn) {
        lines.push(`      <g:mpn>${escapeXml(mpn)}</g:mpn>`);
      }
      if (!gtin && !mpn) {
        lines.push('      <g:identifier_exists>no</g:identifier_exists>');
      }

      lines.push('      <g:shipping>');
      lines.push('        <g:country>IN</g:country>');
      lines.push('        <g:service>Standard Pan-India Delivery</g:service>');
      lines.push(`        <g:price>${deliveryFee.toFixed(2)} INR</g:price>`);
      lines.push('      </g:shipping>');
      lines.push('    </item>');

      itemsXml.push(lines.join('\n'));
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">',
    '  <channel>',
    `    <title>${escapeXml(`${BRAND_NAME} — ${BRAND_TAGLINE} Product Catalog`)}</title>`,
    `    <link>${SITE_ORIGIN}</link>`,
    `    <description>${escapeXml('Official Nutrolix functional nutrition and high-protein packaged food catalog feed for Google Merchant Center.')}</description>`,
    itemsXml.join('\n'),
    '  </channel>',
    '</rss>',
    ''
  ].join('\n');
}

function buildOrganizationSchema(seoSettings = DEFAULT_SEO_SETTINGS) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_ORIGIN}/#organization`,
    name: BRAND_NAME,
    legalName: BRAND_LEGAL_NAME,
    url: `${SITE_ORIGIN}/`,
    logo: {
      '@type': 'ImageObject',
      url: BRAND_LOGO_URL
    },
    description: 'Nutrolix Wellness Pvt. Ltd. is an Indian functional nutrition brand offering high-protein packaged staples and fresh healthy meals.',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: seoSettings.businessPhone || '+91 90762 54354',
        contactType: 'customer service',
        email: seoSettings.businessEmail || 'support@nutrolix.com',
        areaServed: 'IN',
        availableLanguage: ['English', 'Hindi']
      }
    ],
    sameAs: OFFICIAL_SOCIAL_LINKS.concat([PLAY_STORE_URL])
  };
}

function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_ORIGIN}/#website`,
    name: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    alternateName: BRAND_NAME,
    url: `${SITE_ORIGIN}/`,
    publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_ORIGIN}/shop?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  };
}

function buildLocalBusinessSchema(seoSettings = DEFAULT_SEO_SETTINGS) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'FoodEstablishment'],
    '@id': `${SITE_ORIGIN}/#localbusiness`,
    name: `${BRAND_NAME} Smart Food Kitchen & Wellness`,
    url: `${SITE_ORIGIN}/smart-food-kitchen`,
    image: DEFAULT_OG_IMAGE,
    logo: BRAND_LOGO_URL,
    telephone: seoSettings.businessPhone || '+91 90762 54354',
    email: seoSettings.businessEmail || 'support@nutrolix.com',
    servesCuisine: ['Healthy Food', 'High Protein Indian Meals', 'Functional Nutrition'],
    hasMenu: `${SITE_ORIGIN}/food`,
    sameAs: OFFICIAL_SOCIAL_LINKS
  };
  if (seoSettings.businessAddress) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: seoSettings.businessAddress,
      addressLocality: seoSettings.businessLocality || 'New Delhi',
      addressRegion: seoSettings.businessRegion || 'Delhi',
      postalCode: seoSettings.businessPostalCode || '110078',
      addressCountry: 'IN'
    };
  }
  return schema;
}

function buildBreadcrumbSchema(items = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url
    }))
  };
}

function buildProductSchema(product, canonicalUrl) {
  if (!product) return null;
  const name = stripHtmlTags(product.name || product.title || '');
  const description = stripHtmlTags(product.description || product.tagline || `${name} by ${BRAND_NAME}`);
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : (product.image ? [product.image] : []);
  const absImages = images.length ? images.map((i) => toAbsoluteUrl(i)) : [DEFAULT_OG_IMAGE];
  const price = Number(product.price || 0);
  const inStock = product.inStock !== false && (product.stockQuantity === undefined || Number(product.stockQuantity) > 0);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    sku: String(product.sku || product.id || getProductSlug(product)),
    image: absImages,
    brand: {
      '@type': 'Brand',
      name: BRAND_NAME
    },
    category: product.category || 'Functional Nutrition',
    offers: {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'INR',
      price: price.toFixed(2),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: BRAND_LEGAL_NAME
      }
    }
  };

  if (product.gtin) schema.gtin = String(product.gtin).trim();
  if (product.mpn) schema.mpn = String(product.mpn).trim();

  // Only include AggregateRating if actual real review data exists on the product
  const realReviews = Array.isArray(product.reviews) ? product.reviews.filter((r) => r && Number(r.rating) > 0) : [];
  const reviewCount = realReviews.length || Number(product.reviewCount || 0);
  const ratingVal = Number(product.rating || 0);
  if (reviewCount > 0 && ratingVal > 0 && ratingVal <= 5) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(ratingVal.toFixed(1)),
      reviewCount: Math.round(reviewCount),
      bestRating: 5,
      worstRating: 1
    };
  }

  return schema;
}

function buildArticleSchema(blog, canonicalUrl) {
  if (!blog) return null;
  const headline = stripHtmlTags(blog.title || '');
  const description = stripHtmlTags(blog.seoDescription || blog.excerpt || '');
  const imgUrl = toAbsoluteUrl(blog.image || DEFAULT_OG_IMAGE);
  const pubDate = formatIsoDate(blog.date || blog.createdAt);
  const modDate = formatIsoDate(blog.updatedAt || blog.date || blog.createdAt);

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline,
    description,
    image: [imgUrl],
    datePublished: pubDate,
    dateModified: modDate,
    author: {
      '@type': 'Person',
      name: blog.author || 'Nutrolix Research Team'
    },
    publisher: {
      '@type': 'Organization',
      name: BRAND_LEGAL_NAME,
      logo: {
        '@type': 'ImageObject',
        url: BRAND_LOGO_URL
      }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl
    }
  };
}

function buildFaqSchema(faqs = VERIFIED_FAQS) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer
      }
    }))
  };
}

function buildProductSsrNoscript(product, relatedProducts = []) {
  if (!product) return '';
  const name = escapeHtml(product.name || product.title || '');
  const desc = escapeHtml(product.description || product.tagline || '');
  const category = escapeHtml(product.category || 'Functional Nutrition');
  const price = Number(product.price || 0);
  const mrp = Number(product.mrp || 0);
  const ingredients = product.ingredients ? `<p><strong>Ingredients:</strong> ${escapeHtml(product.ingredients)}</p>` : '';
  const usage = product.usageInstructions ? `<p><strong>Usage:</strong> ${escapeHtml(product.usageInstructions)}</p>` : '';
  const nf = product.nutritionFacts && typeof product.nutritionFacts === 'object' ? product.nutritionFacts : null;
  const nutritionHtml = nf
    ? `<p><strong>Nutrition per ${escapeHtml(nf.servingSize || '100g')}:</strong> ${nf.calories ? `Energy ${escapeHtml(nf.calories)} kcal` : ''}${nf.protein ? `, Protein ${escapeHtml(nf.protein)}g` : ''}${nf.carbs ? `, Carbs ${escapeHtml(nf.carbs)}g` : ''}${nf.dietaryFiber ? `, Dietary Fiber ${escapeHtml(nf.dietaryFiber)}g` : ''}</p>`
    : '';

  const relatedHtml = Array.isArray(relatedProducts) && relatedProducts.length
    ? `<nav aria-label="Related Nutrolix Products"><h2>Related Products</h2><ul>${relatedProducts
        .slice(0, 4)
        .map((rp) => `<li><a href="/products/${encodeURIComponent(getProductSlug(rp))}">${escapeHtml(rp.name || rp.title)} — ₹${Number(rp.price || 0)}</a></li>`)
        .join('')}</ul></nav>`
    : '';

  return `<noscript id="nutrolix-seo-noscript"><article><h1>${name}</h1><p>${category} by ${BRAND_NAME}</p><p>Price: ₹${price}${mrp > price ? ` (MRP ₹${mrp})` : ''}</p><p>${desc}</p>${ingredients}${nutritionHtml}${usage}<p><a href="/shop">Browse all Nutrolix Nutrition Products</a></p>${relatedHtml}</article></noscript>`;
}

function buildBlogSsrNoscript(blog, relatedBlogs = []) {
  if (!blog) return '';
  const title = escapeHtml(blog.title || '');
  const excerpt = escapeHtml(blog.excerpt || '');
  const author = escapeHtml(blog.author || 'Nutrolix Research Team');
  const date = escapeHtml(blog.date || '');
  const paragraphs = String(blog.content || '')
    .split(/\n\n+/)
    .filter((p) => p.trim())
    .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
    .join('');

  const relatedHtml = Array.isArray(relatedBlogs) && relatedBlogs.length
    ? `<nav aria-label="Related Nutrition Articles"><h2>More from Nutrolix Blog</h2><ul>${relatedBlogs
        .slice(0, 3)
        .map((rb) => `<li><a href="/blog/${encodeURIComponent(getBlogSlug(rb))}">${escapeHtml(rb.title)}</a></li>`)
        .join('')}</ul></nav>`
    : '';

  return `<noscript id="nutrolix-seo-noscript"><article><h1>${title}</h1><p>By ${author}${date ? ` • ${date}` : ''}</p><p>${excerpt}</p>${paragraphs}<p><a href="/blogs">All Nutrolix Articles</a> | <a href="/shop">Shop Nutrolix Products</a></p>${relatedHtml}</article></noscript>`;
}

function injectSeoIntoHtml(html, {
  title,
  description,
  canonicalUrl,
  robots = 'index, follow, max-image-preview:large',
  ogType = 'website',
  ogImage = DEFAULT_OG_IMAGE,
  seoSettings = DEFAULT_SEO_SETTINGS,
  schemas = [],
  ssrNoscriptHtml = '',
  rewriteNestedPaths = false
} = {}) {
  let out = String(html || '');

  // On nested SSR paths (/products/<slug>, /blog/<slug>), ensure relative asset/page URLs resolve from root
  if (rewriteNestedPaths) {
    out = out
      .replace(/((?:src|href)=["'])assets\//gi, '$1/assets/')
      .replace(/href=["']index\.html(["'#?])/gi, 'href="/$1')
      .replace(/href=["'](shop|food|smart-food-kitchen|blogs|about|contact|faqs|privacy|terms|refund|shipping|cancellation|cart|orders|account)\.html(["'#?])/gi, 'href="/$1$2')
      .replace(/href=["']product\.html\?/gi, 'href="/product?')
      .replace(/href=["']article\.html\?/gi, 'href="/article?');
  }

  // Remove any previously injected SSR SEO block to prevent duplicates
  out = out.replace(/<!-- NUTROLIX_SSR_SEO_START -->[\s\S]*?<!-- NUTROLIX_SSR_SEO_END -->\n?/g, '');

  if (title) {
    const safeTitle = escapeHtml(title);
    if (/<title[^>]*>[\s\S]*?<\/title>/i.test(out)) {
      out = out.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
    } else {
      out = out.replace(/<head([^>]*)>/i, `<head$1>\n  <title>${safeTitle}</title>`);
    }
  }

  // Remove duplicate static meta tags that we are authoritatively supplying in SSR block
  out = out.replace(/\s*<meta\s+[^>]*name=["'](?:description|robots|google-site-verification|nutrolix-ga4-id|nutrolix-gtm-id)["'][^>]*>/gi, '');
  out = out.replace(/\s*<link\s+[^>]*rel=["']canonical["'][^>]*>/gi, '');
  out = out.replace(/\s*<meta\s+[^>]*property=["']og:(?:type|title|description|image|url|site_name|locale)["'][^>]*>/gi, '');
  out = out.replace(/\s*<meta\s+[^>]*name=["']twitter:(?:card|title|description|image)["'][^>]*>/gi, '');

  const safeDesc = escapeHtml(truncateText(description || '', 160));
  const safeCanonical = escapeHtml(canonicalUrl || `${SITE_ORIGIN}/`);
  const safeTitle = escapeHtml(title || `${BRAND_NAME} — ${BRAND_TAGLINE}`);
  const safeOgImage = escapeHtml(toAbsoluteUrl(ogImage || (seoSettings && seoSettings.defaultOgImage) || DEFAULT_OG_IMAGE));
  const safeRobots = escapeHtml(robots);

  const headLines = [
    '<!-- NUTROLIX_SSR_SEO_START -->',
    `  <meta name="description" content="${safeDesc}">`,
    `  <meta name="robots" content="${safeRobots}">`,
    `  <link rel="canonical" href="${safeCanonical}">`,
    `  <meta property="og:site_name" content="${escapeHtml(BRAND_NAME)}">`,
    '  <meta property="og:locale" content="en_IN">',
    `  <meta property="og:type" content="${escapeHtml(ogType)}">`,
    `  <meta property="og:title" content="${safeTitle}">`,
    `  <meta property="og:description" content="${safeDesc}">`,
    `  <meta property="og:url" content="${safeCanonical}">`,
    `  <meta property="og:image" content="${safeOgImage}">`,
    '  <meta name="twitter:card" content="summary_large_image">',
    `  <meta name="twitter:title" content="${safeTitle}">`,
    `  <meta name="twitter:description" content="${safeDesc}">`,
    `  <meta name="twitter:image" content="${safeOgImage}">`
  ];

  // Google Search Console verification tag — ONLY emitted when genuinely configured
  const gscCode = sanitizeVerificationCode((seoSettings && seoSettings.googleSiteVerification) || process.env.GOOGLE_SITE_VERIFICATION || '');
  if (gscCode) {
    headLines.push(`  <meta name="google-site-verification" content="${escapeHtml(gscCode)}">`);
  }

  // GA4 & GTM IDs — ONLY emitted when genuinely configured
  const ga4Id = sanitizeGa4Id((seoSettings && seoSettings.ga4MeasurementId) || process.env.GA4_MEASUREMENT_ID || '');
  const gtmId = sanitizeGtmId((seoSettings && seoSettings.gtmContainerId) || process.env.GTM_CONTAINER_ID || '');
  if (ga4Id) {
    headLines.push(`  <meta name="nutrolix-ga4-id" content="${escapeHtml(ga4Id)}">`);
  }
  if (gtmId) {
    headLines.push(`  <meta name="nutrolix-gtm-id" content="${escapeHtml(gtmId)}">`);
  }

  if (Array.isArray(schemas) && schemas.length > 0) {
    const validSchemas = schemas.filter(Boolean);
    if (validSchemas.length === 1) {
      headLines.push(`  <script type="application/ld+json" id="nutrolix-ssr-schema">${JSON.stringify(validSchemas[0]).replace(/<\/script>/gi, '<\\/script>')}</script>`);
    } else if (validSchemas.length > 1) {
      const graphObj = {
        '@context': 'https://schema.org',
        '@graph': validSchemas.map((s) => {
          const clone = { ...s };
          delete clone['@context'];
          return clone;
        })
      };
      headLines.push(`  <script type="application/ld+json" id="nutrolix-ssr-schema">${JSON.stringify(graphObj).replace(/<\/script>/gi, '<\\/script>')}</script>`);
    }
  }

  // Ensure analytics loader script is present on every public/checkout page
  if (!/nutrolix-analytics\.js/i.test(out)) {
    headLines.push('  <script defer src="/assets/nutrolix-analytics.js"></script>');
  }

  headLines.push('<!-- NUTROLIX_SSR_SEO_END -->');

  const seoBlock = headLines.join('\n') + '\n';
  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, seoBlock + '</head>');
  } else {
    out = seoBlock + out;
  }

  if (ssrNoscriptHtml) {
    out = out.replace(/<noscript id="nutrolix-seo-noscript">[\s\S]*?<\/noscript>/gi, '');
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${ssrNoscriptHtml}\n</body>`);
    } else {
      out += ssrNoscriptHtml;
    }
  }

  return out;
}

function build404Html(reqPath = '') {
  const safePath = escapeHtml(reqPath || '/');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Not Found (404) | Nutrolix — Nutrition That Works</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" href="/assets/nutrolix-logo.png">
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F8FAFC; color: #0F172A; display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 520px; width: 100%; background: #fff; border: 1px solid #E2E8F0; border-radius: 24px; padding: 36px 28px; text-align: center; box-shadow: 0 12px 32px rgba(15, 62, 46, 0.08); }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; background: #ECFDF5; color: #065F46; font-weight: 800; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; }
    h1 { font-size: 28px; margin: 16px 0 8px; color: #0F3E2E; }
    p { font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 22px; }
    code { background: #F1F5F9; padding: 2px 6px; border-radius: 6px; font-size: 12px; }
    .links { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
    .btn { text-decoration: none; padding: 11px 18px; border-radius: 12px; font-weight: 700; font-size: 13px; }
    .btn-primary { background: #0F3E2E; color: #fff; }
    .btn-sec { background: #F1F5F9; color: #0F172A; }
  </style>
</head>
<body>
  <main class="card">
    <span class="badge">404 • Page Not Found</span>
    <h1>We couldn't find that Nutrolix page</h1>
    <p>The page <code>${safePath}</code> may have been moved or removed during our website upgrade. Explore our current store, fresh healthy kitchen, or nutrition blog below.</p>
    <div class="links">
      <a class="btn btn-primary" href="/">Go to Home</a>
      <a class="btn btn-sec" href="/shop">Nutrition Store</a>
      <a class="btn btn-sec" href="/food">Healthy Food Kitchen</a>
      <a class="btn btn-sec" href="/blogs">Blogs</a>
      <a class="btn btn-sec" href="/contact">Contact Us</a>
    </div>
  </main>
</body>
</html>`;
}

module.exports = {
  SITE_ORIGIN,
  BRAND_NAME,
  BRAND_LEGAL_NAME,
  BRAND_TAGLINE,
  DEFAULT_OG_IMAGE,
  BRAND_LOGO_URL,
  OFFICIAL_SOCIAL_LINKS,
  DEFAULT_PAGE_SEO,
  DEFAULT_SEO_SETTINGS,
  PRIVATE_NOINDEX_PATHS,
  PERMANENT_REDIRECT_MAP,
  VERIFIED_FAQS,
  escapeHtml,
  escapeXml,
  stripHtmlTags,
  truncateText,
  slugify,
  toAbsoluteUrl,
  isTestOrPlaceholderProduct,
  getProductSlug,
  getBlogSlug,
  findProductBySlugOrId,
  findBlogBySlugOrId,
  sanitizeVerificationCode,
  sanitizeGa4Id,
  sanitizeGtmId,
  normalizeSeoSettings,
  isPrivateNoindexPath,
  isGone410Path,
  getPermanentRedirectTarget,
  buildRobotsTxt,
  buildSitemapXml,
  buildGoogleMerchantFeedXml,
  buildOrganizationSchema,
  buildWebSiteSchema,
  buildLocalBusinessSchema,
  buildBreadcrumbSchema,
  buildProductSchema,
  buildArticleSchema,
  buildFaqSchema,
  buildProductSsrNoscript,
  buildBlogSsrNoscript,
  injectSeoIntoHtml,
  build404Html
};
