import type { jsPDF } from 'jspdf';

export const CLINIC_LOGO_SVG_STRING = `<svg viewBox="0 0 200 200" width="200" height="200" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <path id="topArc" d="M 28 100 A 72 72 0 0 1 172 100" fill="none" />
    <path id="bottomArc" d="M 172 100 A 72 72 0 0 1 28 100" fill="none" />
  </defs>
  <circle cx="100" cy="100" r="95" fill="none" stroke="#0284c7" stroke-width="8" />
  <circle cx="100" cy="100" r="88" fill="#ffffff" stroke="#0284c7" stroke-width="2.5" />
  <circle cx="100" cy="100" r="66" fill="#f0f9ff" stroke="#bae6fd" stroke-width="1.5" />
  <text fill="#0369a1" font-size="12" font-weight="800" font-family="system-ui, -apple-system, sans-serif" letter-spacing="0.8">
    <textPath href="#topArc" xlink:href="#topArc" startOffset="50%" text-anchor="middle">
      Namana Physiotherapy Clinic
    </textPath>
  </text>
  <text font-size="12.5" font-weight="700" font-family="system-ui, -apple-system, sans-serif" letter-spacing="0.8">
    <textPath href="#bottomArc" xlink:href="#bottomArc" startOffset="50%" text-anchor="middle">
      <tspan fill="#dc2626">Remove pain, </tspan>
      <tspan fill="#16a34a">Move Again</tspan>
    </textPath>
  </text>
  <g stroke-width="2.8" fill="none">
    <path d="M 85 46 L 85 74 L 56 74 L 56 126 L 85 126 L 85 154 L 100 154" stroke="#dc2626" />
    <path d="M 100 46 L 115 46 L 115 74 L 144 74 L 144 126 L 115 126 L 115 154 L 100 154" stroke="#16a34a" />
    <line x1="85" y1="46" x2="100" y2="46" stroke="#dc2626" />
  </g>
  <g fill="#0284c7" stroke="#0284c7">
    <circle cx="110" cy="60" r="7" fill="none" stroke="#0284c7" stroke-width="2.4" />
    <path
      d="M 108 68 C 102 75 97 88 102 102 C 106 114 98 128 85 138 L 74 142 M 102 102 L 120 118 L 132 144"
      fill="none"
      stroke-width="3.2"
      stroke-linecap="round"
    />
    <path d="M 104 80 L 120 78 L 122 88" fill="none" stroke-width="2.5" stroke-linecap="round" />
    <path d="M 102 82 L 86 90 L 88 102" fill="none" stroke-width="2.5" stroke-linecap="round" />
    <circle cx="104" cy="74" r="1.8" fill="#0369a1" />
    <circle cx="101" cy="81" r="1.8" fill="#0369a1" />
    <circle cx="100" cy="88" r="1.8" fill="#0369a1" />
    <circle cx="101" cy="95" r="1.8" fill="#0369a1" />
    <circle cx="103" cy="103" r="1.8" fill="#0369a1" />
  </g>
</svg>`;

let cachedPngDataUrl: string | null = null;
let isInitializing = false;

/**
 * Pre-warms and renders the official uploaded clinic logo into a crisp, high-DPI raster PNG Data URL
 */
export function initLogoCache(): void {
  if (cachedPngDataUrl || isInitializing) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  try {
    isInitializing = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, 400, 400);
          cachedPngDataUrl = canvas.toDataURL('image/png');
        }
      } catch (e) {
        console.warn('Canvas rasterization of uploaded logo failed', e);
      } finally {
        isInitializing = false;
      }
    };

    img.onerror = () => {
      // Fallback to SVG blob
      try {
        const svgBlob = new Blob([CLINIC_LOGO_SVG_STRING], { type: 'image/svg+xml;charset=utf-8' });
        const fallbackUrl = URL.createObjectURL(svgBlob);
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 400;
          canvas.height = 400;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(fallbackImg, 0, 0, 400, 400);
            cachedPngDataUrl = canvas.toDataURL('image/png');
          }
          URL.revokeObjectURL(fallbackUrl);
          isInitializing = false;
        };
        fallbackImg.onerror = () => {
          URL.revokeObjectURL(fallbackUrl);
          isInitializing = false;
        };
        fallbackImg.src = fallbackUrl;
      } catch {
        isInitializing = false;
      }
    };

    img.src = '/clinic_logo.png';
  } catch {
    isInitializing = false;
  }
}

// Automatically initiate on module load
initLogoCache();

/**
 * Renders the official clinic emblem directly onto a jsPDF instance.
 * Uses high-res cached PNG if ready, with pure vector geometry fallback.
 */
export function drawClinicLogoToPdf(doc: jsPDF, x: number, y: number, size: number): void {
  if (cachedPngDataUrl) {
    try {
      doc.addImage(cachedPngDataUrl, 'PNG', x, y, size, size, undefined, 'FAST');
      return;
    } catch {
      // Fallback to vector below
    }
  }

  // Vector fallback for guaranteed rendering in all environments
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;

  // Outer blue ring
  doc.setDrawColor(2, 132, 199); // #0284c7
  doc.setLineWidth(size * 0.04);
  doc.circle(cx, cy, r * 0.95, 'S');

  // Middle white background
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(size * 0.015);
  doc.circle(cx, cy, r * 0.88, 'FD');

  // Inner light blue circle
  doc.setFillColor(240, 249, 255); // #f0f9ff
  doc.setDrawColor(186, 230, 253); // #bae6fd
  doc.circle(cx, cy, r * 0.66, 'FD');

  // Clinical Cross (Red left, Green right)
  const crossW = size * 0.12;
  const crossH = size * 0.45;
  const crossThick = size * 0.12;

  // Red left part of cross
  doc.setFillColor(220, 38, 38);
  doc.rect(cx - crossThick, cy - crossH / 2, crossThick, crossH, 'F');
  doc.rect(cx - crossH / 2, cy - crossThick / 2, crossH / 2, crossThick, 'F');

  // Green right part of cross
  doc.setFillColor(22, 163, 74);
  doc.rect(cx, cy - crossH / 2, crossThick, crossH, 'F');
  doc.rect(cx, cy - crossThick / 2, crossH / 2, crossThick, 'F');

  // Spine & therapy center emblem dots
  doc.setFillColor(3, 105, 161);
  const dotR = size * 0.018;
  doc.circle(cx, cy - size * 0.12, dotR, 'F');
  doc.circle(cx - size * 0.02, cy - size * 0.05, dotR, 'F');
  doc.circle(cx, cy + size * 0.02, dotR, 'F');
  doc.circle(cx + size * 0.02, cy + size * 0.09, dotR, 'F');
  doc.circle(cx, cy + size * 0.16, dotR, 'F');
}
