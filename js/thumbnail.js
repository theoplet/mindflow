/**
 * MindFlow — Google Drive Thumbnail & Indexable Text Generator
 * Handles rendering mindmap previews, scaling under Drive size limits (<= 1.5MB),
 * URL-safe Base64 conversion, indexable text aggregation, and fallback cards.
 */

import { renderMapToCanvas } from './export.js';

/**
 * Strip HTML tags and entity escapes from text
 * @param {string} html 
 * @returns {string} Plain text
 */
function stripHTML(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Gather text + notes of all nodes in mindmap, strip HTML, truncate at 120,000 characters.
 * @param {Object} mindmap 
 * @returns {string} Searchable indexable text
 */
export function buildIndexableText(mindmap) {
  if (!mindmap) return '';
  const nodes = mindmap.getAllNodes ? mindmap.getAllNodes() : (mindmap.root ? [mindmap.root] : []);
  const parts = [];

  for (const n of nodes) {
    if (n.text) {
      const clean = stripHTML(n.text);
      if (clean) parts.push(clean);
    }
    if (n.notes) {
      const cleanNotes = stripHTML(n.notes);
      if (cleanNotes) parts.push(cleanNotes);
    }
  }

  const combined = parts.join(' \n ');
  return combined.slice(0, 120000);
}

/**
 * Convert a Blob into URL-safe Base64 string (+ -> -, / -> _) in 8192 byte chunks to avoid stack overflow.
 * @param {Blob} blob 
 * @returns {Promise<string>} Base64 URL-safe encoded string
 */
export async function blobToBase64Url(blob) {
  if (!blob) return '';
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }

  const base64 = btoa(binary);
  // URL-safe Base64 as per RFC 4648 § 5
  return base64.replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Fit a rendered canvas under 1,500,000 bytes by testing widths [1600, 1000, 700, 440, 220].
 * For each width level, tests PNG then JPEG q=0.85, returning the first blob <= 1,500,000 bytes.
 * All drawImage operations are wrapped in try/catch to safeguard against canvas tainting.
 * @param {HTMLCanvasElement} canvas 
 * @returns {Promise<Blob|null>}
 */
export async function fitUnderLimit(canvas) {
  if (!canvas || !canvas.width || !canvas.height) return null;

  const widths = [1600, 1000, 700, 440, 220];
  let fallbackSmallestBlob = null;

  for (const targetWidth of widths) {
    const w = Math.min(canvas.width, targetWidth);
    const scale = w / canvas.width;
    const h = Math.max(1, Math.round(canvas.height * scale));

    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = w;
    resizedCanvas.height = h;
    const ctx = resizedCanvas.getContext('2d');

    // Fill background to prevent transparent areas turning black on JPEG conversion
    ctx.fillStyle = '#0F0F23';
    ctx.fillRect(0, 0, w, h);

    try {
      ctx.drawImage(canvas, 0, 0, w, h);
    } catch (drawErr) {
      console.warn('drawImage failed during fitUnderLimit (taint safeguard):', drawErr);
    }

    // 1. Try PNG first
    try {
      const pngBlob = await new Promise(res => resizedCanvas.toBlob(res, 'image/png'));
      if (pngBlob) {
        fallbackSmallestBlob = pngBlob;
        if (pngBlob.size <= 1500000) {
          return pngBlob;
        }
      }
    } catch (e) {}

    // 2. Try JPEG q=0.85
    try {
      const jpegBlob = await new Promise(res => resizedCanvas.toBlob(res, 'image/jpeg', 0.85));
      if (jpegBlob) {
        fallbackSmallestBlob = jpegBlob;
        if (jpegBlob.size <= 1500000) {
          return jpegBlob;
        }
      }
    } catch (e) {}
  }

  return fallbackSmallestBlob;
}

/**
 * Render a purple gradient fallback card with brain emoji, map name, and node count.
 * @param {string} [name='MindFlow Map'] 
 * @param {number} [nodeCount=1] 
 * @returns {HTMLCanvasElement}
 */
export function renderFallbackCard(name = 'MindFlow Map', nodeCount = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');

  // Rich purple gradient
  const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, '#3B0764');
  gradient.addColorStop(0.5, '#581C87');
  gradient.addColorStop(1, '#7E22CE');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 630);

  // Decorative border
  ctx.strokeStyle = 'rgba(216, 180, 254, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, 1140, 570);

  // Brain emoji
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '96px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  ctx.fillText('🧠', 600, 220);

  // Map Name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 44px Inter, -apple-system, sans-serif';
  const displayName = String(name || 'MindFlow Map').trim();
  const truncatedName = displayName.length > 40 ? displayName.slice(0, 37) + '...' : displayName;
  ctx.fillText(truncatedName, 600, 350);

  // Node count & branding
  ctx.fillStyle = '#DDD6FE';
  ctx.font = '22px Inter, -apple-system, sans-serif';
  const nodeText = `${nodeCount || 1} ${nodeCount === 1 ? 'node' : 'nodes'} • MindFlow`;
  ctx.fillText(nodeText, 600, 415);

  return canvas;
}

/**
 * Generate map thumbnail Blob for Google Drive upload.
 * Awaits document.fonts.ready, calls renderMapToCanvas with background '#0F0F23' and maxDimension 4096.
 * Wrapped in Promise.race with 8s timeout.
 * Any error returns renderFallbackCard(). NEVER throws.
 * @param {Object} app MindFlow App instance
 * @returns {Promise<Blob>} Thumbnail Blob (image/png or image/jpeg <= 1.5MB)
 */
export async function generateMapThumbnail(app) {
  try {
    const renderPromise = (async () => {
      if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch (e) {}
      }

      const canvasEl = app?.canvas?.transformEl || document.querySelector('#canvas-transform');
      const svgEl = app?.renderer?.svg || document.querySelector('#svg-connectors');
      const bounds = app?.lastBounds || null;

      const canvas = await renderMapToCanvas({
        canvasEl,
        svgEl,
        bounds,
        background: '#0F0F23',
        maxDimension: 4096
      });

      const blob = await fitUnderLimit(canvas);
      if (!blob) throw new Error('Failed to generate thumbnail blob from canvas');
      return blob;
    })();

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Thumbnail generation timed out after 8s')), 8000);
    });

    const blob = await Promise.race([renderPromise, timeoutPromise]);
    return blob;
  } catch (err) {
    console.warn('Thumbnail generation failed or timed out, using fallback card:', err);
    try {
      const name = app?.currentMapName || 'MindFlow Map';
      const nodes = app?.mindmap?.getAllNodes ? app.mindmap.getAllNodes() : [];
      const nodeCount = nodes.length || (app?.mindmap?.root ? 1 : 1);
      const fallbackCanvas = renderFallbackCard(name, nodeCount);
      const fallbackBlob = await fitUnderLimit(fallbackCanvas);
      if (fallbackBlob) return fallbackBlob;
    } catch (fallbackErr) {
      console.error('Fallback card error:', fallbackErr);
    }

    // Never throws: generate minimal 120x60 canvas blob
    try {
      const mini = document.createElement('canvas');
      mini.width = 120;
      mini.height = 60;
      const mctx = mini.getContext('2d');
      mctx.fillStyle = '#4C1D95';
      mctx.fillRect(0, 0, 120, 60);
      return await new Promise(res => mini.toBlob(res, 'image/jpeg', 0.85));
    } catch (finalErr) {
      return new Blob([], { type: 'image/jpeg' });
    }
  }
}
