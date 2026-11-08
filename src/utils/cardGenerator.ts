import { Issue } from '../types';
import { buildIssueSlug, buildIssueSharePayload } from './share';

export type CardStyle = 'bold' | 'editorial' | 'neon';
export type CardFormat = 'landscape' | 'square';

export interface CardRenderOptions {
  style?: CardStyle;
  format?: CardFormat;
  colorTone?: 'vibrant' | 'toned';
}

/**
 * Text wrapping helper that measures words precisely within maxWidth
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length === maxLines - 1) {
        const remainingWords = words.slice(i).join(' ');
        let lastLine = remainingWords;
        while (ctx.measureText(`${lastLine}...`).width > maxWidth && lastLine.length > 3) {
          lastLine = lastLine.slice(0, -4).trim();
        }
        lines.push(`${lastLine}...`);
        return lines;
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Fallback-safe rounded rectangle
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Format question so it always ends with a single clean question mark
 */
function formatQuestion(title: string): string {
  let cleaned = title.trim();
  while (cleaned.endsWith('?') || cleaned.endsWith('!')) {
    cleaned = cleaned.slice(0, -1).trim();
  }
  return `${cleaned}?`;
}

/**
 * Computes high-impact, ultra-legible typography based on question length and card aspect ratio
 */
interface DynamicTypography {
  titleFontSize: number;
  titleLineHeight: number;
  titleLines: string[];
  descFontSize: number;
  descLineHeight: number;
  descLines: string[];
  fontFamily: string;
}

function computeDynamicTypography(
  ctx: CanvasRenderingContext2D,
  title: string,
  desc: string | undefined,
  maxWidth: number,
  isSquare: boolean,
  isEditorial = false
): DynamicTypography {
  const len = title.length;
  const hasDesc = !!(desc && desc.trim().length > 0);

  // Commanding question typography: short questions get 76px on Square
  let titleFontSize = isSquare
    ? (len <= 45 ? 76 : len <= 80 ? 64 : 52)
    : (len <= 45 ? 56 : len <= 80 ? 46 : 38);

  let titleLineHeight = Math.round(titleFontSize * 1.22);
  const descFontSize = isSquare ? 32 : 24;
  const descLineHeight = Math.round(descFontSize * 1.45);

  const fontFamily = isEditorial
    ? '"Instrument Serif", Georgia, serif'
    : '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif';

  ctx.font = `${isEditorial ? '800' : '900'} ${titleFontSize}px ${fontFamily}`;
  let titleLines = wrapText(ctx, title, maxWidth, isSquare ? 4 : 3);

  // If title was too long and wrapped into more than max lines, scale down smoothly
  while (titleLines.length > (isSquare ? 4 : 3) && titleFontSize > 36) {
    titleFontSize -= 4;
    titleLineHeight = Math.round(titleFontSize * 1.22);
    ctx.font = `${isEditorial ? '800' : '900'} ${titleFontSize}px ${fontFamily}`;
    titleLines = wrapText(ctx, title, maxWidth, isSquare ? 4 : 3);
  }

  let descLines: string[] = [];
  if (hasDesc && desc) {
    const descFontFam = isEditorial ? 'Georgia, serif' : '"Plus Jakarta Sans", system-ui, sans-serif';
    ctx.font = `${isEditorial ? 'italic 500' : '500'} ${descFontSize}px ${descFontFam}`;
    descLines = wrapText(ctx, desc.trim(), maxWidth - (isEditorial ? 40 : 0), isSquare ? 3 : 2);
  }

  return {
    titleFontSize,
    titleLineHeight,
    titleLines,
    descFontSize,
    descLineHeight,
    descLines,
    fontFamily,
  };
}

/**
 * =========================================================================
 * CONCEPT 1: THE BOLD DUELIST (Viral Social Poll / High Legibility)
 * =========================================================================
 */
function renderBoldDuelist(
  ctx: CanvasRenderingContext2D,
  issue: Issue,
  width: number,
  height: number,
  isSquare: boolean,
  isToned: boolean
) {
  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  if (isToned) {
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e293b');
    bgGrad.addColorStop(1, '#090d16');
  } else {
    bgGrad.addColorStop(0, '#0b0f19');
    bgGrad.addColorStop(0.5, '#111827');
    bgGrad.addColorStop(1, '#030712');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Ambient glows
  const glow1 = ctx.createRadialGradient(width * 0.9, height * 0.1, 10, width * 0.9, height * 0.1, 420);
  glow1.addColorStop(0, isToned ? 'rgba(71, 85, 105, 0.45)' : 'rgba(16, 185, 129, 0.25)');
  glow1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(width * 0.1, height * 0.9, 10, width * 0.1, height * 0.9, 440);
  glow2.addColorStop(0, isToned ? 'rgba(100, 116, 139, 0.40)' : 'rgba(244, 63, 94, 0.22)');
  glow2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // Outer border with sleek rounded corners
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, 36, 36, width - 72, height - 72, 32);
  ctx.stroke();
  ctx.restore();

  const padX = isSquare ? 80 : 88;
  const contentWidth = width - padX * 2;

  // 1. TOP HEADER: Centralized Brand Badge (No Category Pill)
  const headerY = isSquare ? 76 : 56;
  const headerH = isSquare ? 64 : 52;

  ctx.save();
  const brandPillW = isSquare ? 260 : 210;
  const brandX = (width - brandPillW) / 2;

  drawRoundedRect(ctx, brandX, headerY, brandPillW, headerH, isSquare ? 20 : 16);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Brand Icon Box
  const iconBoxSize = isSquare ? 42 : 34;
  const iconBoxOffset = (headerH - iconBoxSize) / 2;
  drawRoundedRect(ctx, brandX + iconBoxOffset, headerY + iconBoxOffset, iconBoxSize, iconBoxSize, 12);
  const iconGrad = ctx.createLinearGradient(brandX, headerY, brandX + iconBoxSize, headerY + iconBoxSize);
  iconGrad.addColorStop(0, '#10b981');
  iconGrad.addColorStop(1, '#6366f1');
  ctx.fillStyle = iconGrad;
  ctx.fill();

  // Checkmark inside icon box
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = isSquare ? 3.5 : 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const icX = brandX + iconBoxOffset;
  const icY = headerY + iconBoxOffset;
  ctx.moveTo(icX + iconBoxSize * 0.26, icY + iconBoxSize * 0.50);
  ctx.lineTo(icX + iconBoxSize * 0.44, icY + iconBoxSize * 0.70);
  ctx.lineTo(icX + iconBoxSize * 0.74, icY + iconBoxSize * 0.32);
  ctx.stroke();

  // Brand Text
  ctx.font = `800 ${isSquare ? '32px' : '26px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('YesOrNo', brandX + iconBoxOffset + iconBoxSize + (isSquare ? 16 : 12), headerY + headerH * 0.68);
  ctx.restore();

  // 2. FOOTER: Centralized Clean Call to Action (No border, no background, no bottom-left text)
  const bottomPad = isSquare ? 76 : 56;
  const footerY = height - bottomPad;

  ctx.save();
  const sharePayload = buildIssueSharePayload(issue);
  const displayHost = sharePayload.url.replace(/^https?:\/\//, '').split('/')[0] || 'yesorno.chillon.top';
  const urlLabel = `Vote at ${displayHost} →`;

  ctx.font = `700 ${isSquare ? '24px' : '18px'} ui-monospace, SFMono-Regular, monospace`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
  ctx.textAlign = 'center';
  ctx.fillText(urlLabel, width / 2, footerY);
  ctx.restore();

  // 3. CENTER QUESTION & DESCRIPTION (Centralized Horizontally & Vertically)
  const headerBottom = headerY + headerH + (isSquare ? 36 : 24);
  const footerTop = footerY - (isSquare ? 36 : 24);
  const availableCenterHeight = footerTop - headerBottom;

  const question = formatQuestion(issue.title);
  const typo = computeDynamicTypography(ctx, question, issue.description, contentWidth, isSquare, false);

  const titleTotalH = typo.titleLines.length * typo.titleLineHeight;
  const descTotalH = typo.descLines.length > 0 ? (typo.descLines.length * typo.descLineHeight + (isSquare ? 36 : 24)) : 0;
  const contentTotalH = titleTotalH + descTotalH;

  const startContentY = headerBottom + Math.max(16, (availableCenterHeight - contentTotalH) / 2);

  // Draw Centralized Question
  ctx.save();
  ctx.font = `900 ${typo.titleFontSize}px ${typo.fontFamily}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';

  let cursorY = startContentY + typo.titleLineHeight * 0.82;
  for (const line of typo.titleLines) {
    ctx.fillText(line, width / 2, cursorY);
    cursorY += typo.titleLineHeight;
  }
  ctx.restore();

  // Draw Centralized Description
  if (typo.descLines.length > 0) {
    cursorY += isSquare ? 20 : 14;
    ctx.save();
    ctx.font = `500 ${typo.descFontSize}px ${typo.fontFamily}`;
    ctx.fillStyle = 'rgba(226, 232, 240, 0.92)';
    ctx.textAlign = 'center';
    for (const line of typo.descLines) {
      ctx.fillText(line, width / 2, cursorY);
      cursorY += typo.descLineHeight;
    }
    ctx.restore();
  }
}

/**
 * =========================================================================
 * CONCEPT 2: EDITORIAL SPOTLIGHT (Clean Magazine / Serif Accent)
 * =========================================================================
 */
function renderEditorialSpotlight(
  ctx: CanvasRenderingContext2D,
  issue: Issue,
  width: number,
  height: number,
  isSquare: boolean,
  isToned: boolean
) {
  // Deep Rich Editorial Slate Background
  ctx.fillStyle = isToned ? '#090d16' : '#0a0f1d';
  ctx.fillRect(0, 0, width, height);

  // Subtle Dot Grid
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  const dotStep = 32;
  for (let x = 32; x < width; x += dotStep) {
    for (let y = 32; y < height; y += dotStep) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Clean Border
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 36, 36, width - 72, height - 72, 32);
  ctx.stroke();
  ctx.restore();

  const padX = isSquare ? 80 : 88;
  const contentWidth = width - padX * 2;

  // 1. TOP HEADER: Centralized YESORNO / PUBLIC DECISION (No Category Tag)
  const headerY = isSquare ? 76 : 56;
  ctx.save();
  ctx.font = `900 ${isSquare ? '34px' : '26px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  const brandW = ctx.measureText('YESORNO').width;
  ctx.font = `600 ${isSquare ? '20px' : '16px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  const subW = ctx.measureText('  /  PUBLIC DECISION').width;
  const totalHeaderW = brandW + subW;
  const startHeaderX = (width - totalHeaderW) / 2;

  ctx.font = `900 ${isSquare ? '34px' : '26px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('YESORNO', startHeaderX, headerY + (isSquare ? 28 : 22));

  ctx.font = `600 ${isSquare ? '20px' : '16px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('  /  PUBLIC DECISION', startHeaderX + brandW, headerY + (isSquare ? 28 : 22));

  // Horizontal divider
  const sepY = headerY + (isSquare ? 60 : 46);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, sepY);
  ctx.lineTo(width - padX, sepY);
  ctx.stroke();
  ctx.restore();

  // 2. FOOTER: Centralized Clean Call to Action (No border, no background, no bottom-left text)
  const bottomPad = isSquare ? 76 : 56;
  const footerY = height - bottomPad;

  ctx.save();
  const cta = 'Vote at yesorno.chillon.top →';
  ctx.font = `700 ${isSquare ? '24px' : '18px'} ui-monospace, monospace`;
  ctx.fillStyle = '#818cf8';
  ctx.textAlign = 'center';
  ctx.fillText(cta, width / 2, footerY);
  ctx.restore();

  // 3. CENTER QUESTION & DESCRIPTION (Centralized Horizontally & Vertically)
  const headerBottom = sepY + (isSquare ? 36 : 24);
  const footerTop = footerY - (isSquare ? 36 : 24);
  const availableCenterHeight = footerTop - headerBottom;
  const question = formatQuestion(issue.title);
  const typo = computeDynamicTypography(ctx, question, issue.description, contentWidth, isSquare, true);

  const titleTotalH = typo.titleLines.length * typo.titleLineHeight;
  const descTotalH = typo.descLines.length > 0 ? (typo.descLines.length * typo.descLineHeight + (isSquare ? 36 : 24)) : 0;
  const contentTotalH = titleTotalH + descTotalH;

  const startContentY = headerBottom + Math.max(16, (availableCenterHeight - contentTotalH) / 2);

  // Big Centralized Question with Editorial Serif Typography
  ctx.save();
  ctx.font = `800 ${typo.titleFontSize}px ${typo.fontFamily}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';

  let cursorY = startContentY + typo.titleLineHeight * 0.82;
  for (const line of typo.titleLines) {
    ctx.fillText(line, width / 2, cursorY);
    cursorY += typo.titleLineHeight;
  }
  ctx.restore();

  // Centralized Description
  if (typo.descLines.length > 0) {
    cursorY += isSquare ? 22 : 16;
    ctx.save();
    ctx.font = `italic 500 ${typo.descFontSize}px Georgia, serif`;
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'center';
    for (const line of typo.descLines) {
      ctx.fillText(`"${line}"`, width / 2, cursorY);
      cursorY += typo.descLineHeight;
    }
    ctx.restore();
  }
}

/**
 * =========================================================================
 * CONCEPT 3: MIDNIGHT NEON PULSE (Linear / Web3 / Cyber Glow)
 * =========================================================================
 */
function renderMidnightNeon(
  ctx: CanvasRenderingContext2D,
  issue: Issue,
  width: number,
  height: number,
  isSquare: boolean,
  isToned: boolean
) {
  // Midnight Obsidian base
  ctx.fillStyle = '#05070e';
  ctx.fillRect(0, 0, width, height);

  // Radial Neon Glow Orbs
  const glow1 = ctx.createRadialGradient(width * 0.35, height * 0.5, 20, width * 0.35, height * 0.5, 480);
  glow1.addColorStop(0, isToned ? 'rgba(71, 85, 105, 0.45)' : 'rgba(99, 102, 241, 0.32)');
  glow1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(width * 0.85, height * 0.85, 20, width * 0.85, height * 0.85, 420);
  glow2.addColorStop(0, isToned ? 'rgba(100, 116, 139, 0.35)' : 'rgba(16, 185, 129, 0.24)');
  glow2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // Neon glowing outer border
  ctx.save();
  ctx.strokeStyle = isToned ? 'rgba(148, 163, 184, 0.40)' : 'rgba(99, 102, 241, 0.60)';
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, 36, 36, width - 72, height - 72, 32);
  ctx.stroke();
  ctx.restore();

  const padX = isSquare ? 80 : 88;
  const contentWidth = width - padX * 2;

  // 1. TOP HEADER: Centralized Neon Gradient Logo Box + Brand (No Category / Live Pills)
  const headerY = isSquare ? 76 : 56;
  const headerH = isSquare ? 60 : 48;

  ctx.save();
  const logoBoxSize = isSquare ? 50 : 40;
  const logoOffset = (headerH - logoBoxSize) / 2;

  ctx.font = `900 ${isSquare ? '34px' : '26px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  const brandTextW = ctx.measureText('YesOrNo').width;
  const totalTopW = logoBoxSize + (isSquare ? 16 : 12) + brandTextW;
  const topStartX = (width - totalTopW) / 2;

  drawRoundedRect(ctx, topStartX, headerY + logoOffset, logoBoxSize, logoBoxSize, 14);
  const logoGrad = ctx.createLinearGradient(topStartX, headerY, topStartX + logoBoxSize, headerY + logoBoxSize);
  logoGrad.addColorStop(0, '#6366f1');
  logoGrad.addColorStop(0.5, '#a855f7');
  logoGrad.addColorStop(1, '#ec4899');
  ctx.fillStyle = logoGrad;
  ctx.fill();

  ctx.font = `900 ${isSquare ? '18px' : '15px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('Y/N', topStartX + logoBoxSize / 2, headerY + headerH * 0.62);

  ctx.textAlign = 'left';
  ctx.font = `900 ${isSquare ? '34px' : '26px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('YesOrNo', topStartX + logoBoxSize + (isSquare ? 16 : 12), headerY + headerH * 0.68);
  ctx.restore();

  // 2. FOOTER: Centralized Clean Call to Action (No border, no background, no bottom-left text)
  const bottomPad = isSquare ? 76 : 56;
  const footerY = height - bottomPad;

  ctx.save();
  const sharePayload = buildIssueSharePayload(issue);
  const displayHost = sharePayload.url.replace(/^https?:\/\//, '').split('/')[0] || 'yesorno.chillon.top';
  const urlLabel = `Vote at ${displayHost} →`;

  ctx.font = `700 ${isSquare ? '24px' : '18px'} ui-monospace, SFMono-Regular, monospace`;
  ctx.fillStyle = '#818cf8';
  ctx.textAlign = 'center';
  ctx.fillText(urlLabel, width / 2, footerY);
  ctx.restore();

  // 3. CENTER QUESTION & DESCRIPTION (Centralized Horizontally & Vertically)
  const headerBottom = headerY + headerH + (isSquare ? 36 : 24);
  const footerTop = footerY - (isSquare ? 36 : 24);
  const availableCenterHeight = footerTop - headerBottom;

  const question = formatQuestion(issue.title);
  const typo = computeDynamicTypography(ctx, question, issue.description, contentWidth, isSquare, false);

  const titleTotalH = typo.titleLines.length * typo.titleLineHeight;
  const descTotalH = typo.descLines.length > 0 ? (typo.descLines.length * typo.descLineHeight + (isSquare ? 36 : 24)) : 0;
  const contentTotalH = titleTotalH + descTotalH;

  const startContentY = headerBottom + Math.max(16, (availableCenterHeight - contentTotalH) / 2);

  // Big Centralized Neon Question
  ctx.save();
  ctx.font = `900 ${typo.titleFontSize}px ${typo.fontFamily}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';

  let cursorY = startContentY + typo.titleLineHeight * 0.82;
  for (const line of typo.titleLines) {
    ctx.fillText(line, width / 2, cursorY);
    cursorY += typo.titleLineHeight;
  }
  ctx.restore();

  // Centralized Description
  if (typo.descLines.length > 0) {
    cursorY += isSquare ? 20 : 14;
    ctx.save();
    ctx.font = `500 ${typo.descFontSize}px ${typo.fontFamily}`;
    ctx.fillStyle = 'rgba(203, 213, 225, 0.90)';
    ctx.textAlign = 'center';
    for (const line of typo.descLines) {
      ctx.fillText(line, width / 2, cursorY);
      cursorY += typo.descLineHeight;
    }
    ctx.restore();
  }
}

/**
 * Master Render Dispatcher for all 3 concepts
 */
export async function renderIssueCardToCanvas(
  issue: Issue,
  options: CardRenderOptions = {}
): Promise<HTMLCanvasElement> {
  // Wait for Google fonts (Plus Jakarta Sans & Instrument Serif) to be ready
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue if font API fails
    }
  }

  const style = options.style || 'bold';
  const format = options.format || 'square';
  const isSquare = format === 'square';
  const isToned = options.colorTone === 'toned';

  const width = isSquare ? 1080 : 1200;
  const height = isSquare ? 1080 : 675;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  if (style === 'editorial') {
    renderEditorialSpotlight(ctx, issue, width, height, isSquare, isToned);
  } else if (style === 'neon') {
    renderMidnightNeon(ctx, issue, width, height, isSquare, isToned);
  } else {
    renderBoldDuelist(ctx, issue, width, height, isSquare, isToned);
  }

  return canvas;
}

/**
 * Converts the rendered canvas to a PNG Blob
 */
export async function generateIssueCardBlob(
  issue: Issue,
  options: CardRenderOptions = {}
): Promise<Blob> {
  const canvas = await renderIssueCardToCanvas(issue, options);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate PNG blob from canvas'));
    }, 'image/png');
  });
}

/**
 * Converts the rendered canvas to a base64 Data URL for instant in-browser preview
 */
export async function generateIssueCardDataUrl(
  issue: Issue,
  options: CardRenderOptions = {}
): Promise<string> {
  const canvas = await renderIssueCardToCanvas(issue, options);
  return canvas.toDataURL('image/png');
}

/**
 * Triggers a direct browser download of the high-res PNG image card
 */
export async function downloadIssueCard(
  issue: Issue,
  options: CardRenderOptions = {}
): Promise<string> {
  const blob = await generateIssueCardBlob(issue, options);
  const slug = buildIssueSlug(issue);
  const fileName = `${slug}-${options.style || 'card'}-${options.format || 'square'}.png`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return fileName;
}

/**
 * Copies the PNG image directly to clipboard
 */
export async function copyIssueCardToClipboard(
  issue: Issue,
  options: CardRenderOptions = {}
): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard || !window.ClipboardItem) {
    return false;
  }
  try {
    const blob = await generateIssueCardBlob(issue, options);
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    return true;
  } catch (err) {
    console.warn('Failed to copy card to clipboard:', err);
    return false;
  }
}

/**
 * Shares the generated image file using navigator.share with files payload
 */
export async function shareIssueCardFile(
  issue: Issue,
  options: CardRenderOptions = {}
): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  try {
    const blob = await generateIssueCardBlob(issue, options);
    const slug = buildIssueSlug(issue);
    const file = new File([blob], `${slug}-${options.style || 'card'}.png`, { type: 'image/png' });

    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      return false;
    }

    const payload = buildIssueSharePayload(issue);
    await navigator.share({
      title: issue.title,
      text: `${payload.fullText}\n${payload.url}`,
      files: [file],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * =========================================================================
 * COMMENT / PERSPECTIVE CARD GENERATOR
 * =========================================================================
 * Features:
 * - Question / Topic placed prominently at the top
 * - Comment / Reply placed in large prominent text inside a stylish callout bubble
 * - Dynamic typography scaling for punchy readability
 * - Commenter avatar initials, author handle, and YES/NO stance badge
 * - Styles: Bold, Editorial, Neon with Vibrant/Toned support
 */

export interface CommentCardData {
  id: string;
  author: string;
  authorAlias?: string;
  text: string;
  choice?: 'YES' | 'NO';
  createdAt?: string;
}

export interface CommentCardRenderOptions {
  style?: CardStyle;
  format?: CardFormat;
  colorTone?: 'vibrant' | 'toned';
}

/**
 * Draws a speech / quote callout bubble with an upward pointing notch
 */
function drawCalloutBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  notchX: number = 140,
  notchWidth: number = 26,
  notchHeight: number = 14
) {
  ctx.beginPath();
  // Start from right side of notch on top edge
  ctx.moveTo(notchX + notchWidth / 2, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.lineTo(notchX - notchWidth / 2, y);
  // Upward pointing notch towards the question
  ctx.lineTo(notchX, y - notchHeight);
  ctx.lineTo(notchX + notchWidth / 2, y);
  ctx.closePath();
}

/**
 * Common callout inner contents (Large reply text + quote mark + author & stance footer)
 */
function renderCalloutContent(
  ctx: CanvasRenderingContext2D,
  comment: CommentCardData,
  calloutX: number,
  calloutY: number,
  calloutW: number,
  calloutH: number,
  isEditorial: boolean
) {
  const isYes = comment.choice === 'YES';
  const isNo = comment.choice === 'NO';

  // 1. Decorative Quote Mark
  ctx.save();
  ctx.font = `900 68px ${isEditorial ? '"Instrument Serif", Georgia, serif' : '"Plus Jakarta Sans", system-ui, sans-serif'}`;
  ctx.fillStyle = isEditorial 
    ? 'rgba(245, 158, 11, 0.28)' 
    : isYes 
      ? 'rgba(16, 185, 129, 0.25)' 
      : isNo 
        ? 'rgba(244, 63, 94, 0.25)' 
        : 'rgba(255, 255, 255, 0.22)';
  ctx.fillText('“', calloutX + 38, calloutY + 62);
  ctx.restore();

  // 2. Large Comment Reply Text (Dynamic Sizing)
  const textPadX = 42;
  const maxTextW = calloutW - textPadX * 2;
  const replyText = comment.text.trim();
  const len = replyText.length;

  let fontSize = len <= 65 ? 46 : len <= 130 ? 38 : len <= 220 ? 32 : 27;
  let lineHeight = Math.round(fontSize * 1.34);
  const fontFamily = isEditorial
    ? '"Instrument Serif", Georgia, serif'
    : '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif';

  const footerSpace = 96;
  const maxAvailableTextH = calloutH - 120 - footerSpace;

  ctx.font = `${isEditorial ? 'italic 600' : '700'} ${fontSize}px ${fontFamily}`;
  let lines = wrapText(ctx, `"${replyText}"`, maxTextW, 8);

  while (lines.length * lineHeight > maxAvailableTextH && fontSize > 20) {
    fontSize -= 2;
    lineHeight = Math.round(fontSize * 1.34);
    ctx.font = `${isEditorial ? 'italic 600' : '700'} ${fontSize}px ${fontFamily}`;
    lines = wrapText(ctx, `"${replyText}"`, maxTextW, 8);
  }

  // Draw comment lines
  ctx.save();
  ctx.font = `${isEditorial ? 'italic 600' : '700'} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = isEditorial ? '#fffdf7' : '#ffffff';
  let cursorY = calloutY + 86 + lineHeight * 0.75;
  for (const line of lines) {
    ctx.fillText(line, calloutX + textPadX, cursorY);
    cursorY += lineHeight;
  }
  ctx.restore();

  // 3. Callout Divider Line before Author Row
  const footerDividerY = calloutY + calloutH - 84;
  ctx.save();
  ctx.strokeStyle = isEditorial ? 'rgba(245, 158, 11, 0.22)' : 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(calloutX + 32, footerDividerY);
  ctx.lineTo(calloutX + calloutW - 32, footerDividerY);
  ctx.stroke();
  ctx.restore();

  // 4. Author Avatar Initials Circle
  const avatarCenterX = calloutX + 58;
  const avatarCenterY = calloutY + calloutH - 42;
  const avatarRadius = 22;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
  const avatarGrad = ctx.createLinearGradient(
    avatarCenterX - avatarRadius, avatarCenterY - avatarRadius,
    avatarCenterX + avatarRadius, avatarCenterY + avatarRadius
  );
  if (isYes) {
    avatarGrad.addColorStop(0, '#10b981');
    avatarGrad.addColorStop(1, '#059669');
  } else if (isNo) {
    avatarGrad.addColorStop(0, '#f43f5e');
    avatarGrad.addColorStop(1, '#e11d48');
  } else {
    avatarGrad.addColorStop(0, '#6366f1');
    avatarGrad.addColorStop(1, '#8b5cf6');
  }
  ctx.fillStyle = avatarGrad;
  ctx.fill();

  // Initials inside avatar
  const initials = (comment.author || 'Civic Voice')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('') || 'CV';

  ctx.font = '800 15px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, avatarCenterX, avatarCenterY);
  ctx.restore();

  // 5. Author Name and Handle
  ctx.save();
  ctx.font = '800 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(comment.author || 'Civic Participant', calloutX + 90, calloutY + calloutH - 46);

  const handle = comment.authorAlias 
    ? `@${comment.authorAlias.replace(/^@/, '')}` 
    : `@${(comment.author || 'anonymous').toLowerCase().replace(/\s+/g, '')}`;
  ctx.font = '500 13px ui-monospace, SFMono-Regular, monospace';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
  ctx.fillText(handle, calloutX + 90, calloutY + calloutH - 26);
  ctx.restore();

  // 6. Stance Pill (VOTED YES / VOTED NO / PERSPECTIVE)
  ctx.save();
  const badgeW = isYes || isNo ? 154 : 146;
  const badgeH = 38;
  const badgeX = calloutX + calloutW - badgeW - 32;
  const badgeY = calloutY + calloutH - 61;

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 19);
  if (isYes) {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '800 13px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#34d399';
    ctx.textAlign = 'center';
    ctx.fillText('✓  VOTED YES', badgeX + badgeW / 2, badgeY + 24);
  } else if (isNo) {
    ctx.fillStyle = 'rgba(244, 63, 94, 0.22)';
    ctx.fill();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '800 13px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#fb7185';
    ctx.textAlign = 'center';
    ctx.fillText('✕  VOTED NO', badgeX + badgeW / 2, badgeY + 24);
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.26)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 13px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.fillText('💬 PERSPECTIVE', badgeX + badgeW / 2, badgeY + 24);
  }
  ctx.restore();
}

/**
 * Top Question Section common across comment cards
 */
function renderCommentCardTopQuestion(
  ctx: CanvasRenderingContext2D,
  issue: Issue,
  width: number,
  isEditorial: boolean
): number {
  const padX = 72;
  const headerY = 56;
  const headerH = 48;

  // 1. Top Left Brand Pill
  ctx.save();
  const brandPillW = 186;
  drawRoundedRect(ctx, padX, headerY, brandPillW, headerH, 16);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Brand Icon Box
  const iconSize = 30;
  const iconOffset = (headerH - iconSize) / 2;
  drawRoundedRect(ctx, padX + iconOffset, headerY + iconOffset, iconSize, iconSize, 8);
  const iconGrad = ctx.createLinearGradient(padX, headerY, padX + iconSize, headerY + iconSize);
  iconGrad.addColorStop(0, '#10b981');
  iconGrad.addColorStop(1, '#6366f1');
  ctx.fillStyle = iconGrad;
  ctx.fill();

  // Checkmark inside icon
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const icX = padX + iconOffset;
  const icY = headerY + iconOffset;
  ctx.moveTo(icX + iconSize * 0.26, icY + iconSize * 0.50);
  ctx.lineTo(icX + iconSize * 0.44, icY + iconSize * 0.70);
  ctx.lineTo(icX + iconSize * 0.74, icY + iconSize * 0.32);
  ctx.stroke();

  // Brand Text
  ctx.font = '800 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('YesOrNo', padX + iconOffset + iconSize + 12, headerY + headerH * 0.68);
  ctx.restore();

  // 2. Top Right Category Badge
  ctx.save();
  const catText = (issue.category || 'COMMUNITY').toUpperCase();
  ctx.font = '800 13px "Plus Jakarta Sans", system-ui, sans-serif';
  const catTextW = ctx.measureText(catText).width;
  const catPillW = catTextW + 30;
  const catPillX = width - padX - catPillW;

  drawRoundedRect(ctx, catPillX, headerY, catPillW, headerH, 16);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = 'rgba(226, 232, 240, 0.95)';
  ctx.textAlign = 'center';
  ctx.fillText(catText, catPillX + catPillW / 2, headerY + headerH * 0.65);
  ctx.restore();

  // 3. Eyebrow: QUESTION & TOPIC
  const questionStartY = headerY + headerH + 28;
  ctx.save();
  ctx.font = '800 12px ui-monospace, SFMono-Regular, monospace';
  ctx.fillStyle = isEditorial ? 'rgba(245, 158, 11, 0.90)' : 'rgba(148, 163, 184, 0.85)';
  ctx.fillText('QUESTION & TOPIC', padX, questionStartY);
  ctx.restore();

  // 4. The Question (The reply is based on at the top)
  const question = formatQuestion(issue.title);
  const maxQWidth = width - padX * 2;
  const qFontFamily = isEditorial ? '"Instrument Serif", Georgia, serif' : '"Plus Jakarta Sans", system-ui, sans-serif';
  const qFontSize = isEditorial ? 36 : 32;
  const qLineHeight = Math.round(qFontSize * 1.25);

  ctx.save();
  ctx.font = `${isEditorial ? '700' : '800'} ${qFontSize}px ${qFontFamily}`;
  ctx.fillStyle = '#ffffff';
  const qLines = wrapText(ctx, question, maxQWidth, 3);

  let qCursorY = questionStartY + 28;
  for (const line of qLines) {
    ctx.fillText(line, padX, qCursorY);
    qCursorY += qLineHeight;
  }
  ctx.restore();

  return qCursorY;
}

/**
 * Renders Bold Duelist Style Comment Card
 */
function renderBoldCommentCard(
  ctx: CanvasRenderingContext2D,
  issue: Issue,
  comment: CommentCardData,
  width: number,
  height: number,
  isToned: boolean
) {
  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  if (isToned) {
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e293b');
    bgGrad.addColorStop(1, '#090d16');
  } else {
    bgGrad.addColorStop(0, '#0b0f19');
    bgGrad.addColorStop(0.5, '#111827');
    bgGrad.addColorStop(1, '#030712');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Corner ambient glows
  const isYes = comment.choice === 'YES';
  const isNo = comment.choice === 'NO';

  const glow1 = ctx.createRadialGradient(width * 0.85, height * 0.15, 10, width * 0.85, height * 0.15, 380);
  glow1.addColorStop(0, isToned ? 'rgba(71, 85, 105, 0.40)' : 'rgba(99, 102, 241, 0.22)');
  glow1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(width * 0.15, height * 0.85, 10, width * 0.15, height * 0.85, 420);
  glow2.addColorStop(0, isYes ? 'rgba(16, 185, 129, 0.22)' : isNo ? 'rgba(244, 63, 94, 0.22)' : 'rgba(99, 102, 241, 0.18)');
  glow2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // Outer border
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, 36, 36, width - 72, height - 72, 32);
  ctx.stroke();
  ctx.restore();

  // Top Question
  const questionBottomY = renderCommentCardTopQuestion(ctx, issue, width, false);

  // Callout Box Geometry
  const calloutX = 64;
  const calloutW = width - calloutX * 2;
  const footerCardY = height - 56;
  const calloutY = Math.max(questionBottomY + 24, 280);
  const calloutH = footerCardY - calloutY - 24;

  // Draw Callout Box with speech notch
  ctx.save();
  drawCalloutBox(ctx, calloutX, calloutY, calloutW, calloutH, 28, calloutX + 76, 26, 14);
  if (isYes) {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.38)';
  } else if (isNo) {
    ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.38)';
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
  }
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // Callout Inner Content
  renderCalloutContent(ctx, comment, calloutX, calloutY, calloutW, calloutH, false);

  // Card Bottom Footer
  ctx.save();
  ctx.font = '600 15px ui-monospace, SFMono-Regular, monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
  ctx.textAlign = 'center';
  ctx.fillText('Vote & join the conversation at yesorno.chillon.top →', width / 2, footerCardY);
  ctx.restore();
}

/**
 * Renders Editorial Spotlight Style Comment Card
 */
function renderEditorialCommentCard(
  ctx: CanvasRenderingContext2D,
  issue: Issue,
  comment: CommentCardData,
  width: number,
  height: number,
  isToned: boolean
) {
  // Deep Rich Editorial Slate Background
  ctx.fillStyle = isToned ? '#090d16' : '#0a0f1d';
  ctx.fillRect(0, 0, width, height);

  // Dot Grid Pattern
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  const dotStep = 32;
  for (let x = 32; x < width; x += dotStep) {
    for (let y = 32; y < height; y += dotStep) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Subtle warm amber ambient glow
  const amberGlow = ctx.createRadialGradient(width * 0.5, height * 0.45, 20, width * 0.5, height * 0.45, 500);
  amberGlow.addColorStop(0, 'rgba(245, 158, 11, 0.08)');
  amberGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = amberGlow;
  ctx.fillRect(0, 0, width, height);

  // Outer border with warm tint
  ctx.save();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.22)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 36, 36, width - 72, height - 72, 28);
  ctx.stroke();
  ctx.restore();

  // Top Question
  const questionBottomY = renderCommentCardTopQuestion(ctx, issue, width, true);

  // Callout Box Geometry
  const calloutX = 64;
  const calloutW = width - calloutX * 2;
  const footerCardY = height - 56;
  const calloutY = Math.max(questionBottomY + 24, 280);
  const calloutH = footerCardY - calloutY - 24;

  const isYes = comment.choice === 'YES';
  const isNo = comment.choice === 'NO';

  // Draw Callout Box
  ctx.save();
  drawCalloutBox(ctx, calloutX, calloutY, calloutW, calloutH, 24, calloutX + 76, 26, 14);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fill();
  ctx.strokeStyle = isYes 
    ? 'rgba(16, 185, 129, 0.45)' 
    : isNo 
      ? 'rgba(244, 63, 94, 0.45)' 
      : 'rgba(245, 158, 11, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Callout Inner Content with serif typography
  renderCalloutContent(ctx, comment, calloutX, calloutY, calloutW, calloutH, true);

  // Card Bottom Footer
  ctx.save();
  ctx.font = '600 15px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
  ctx.textAlign = 'center';
  ctx.fillText('YesOrNo Editorial Perspectives  ·  yesorno.chillon.top', width / 2, footerCardY);
  ctx.restore();
}

/**
 * Renders Midnight Neon Style Comment Card
 */
function renderNeonCommentCard(
  ctx: CanvasRenderingContext2D,
  issue: Issue,
  comment: CommentCardData,
  width: number,
  height: number,
  _isToned?: boolean
) {
  // Midnight Cyberpunk Background
  ctx.fillStyle = '#050814';
  ctx.fillRect(0, 0, width, height);

  // Neon ambient mesh glows
  const isYes = comment.choice === 'YES';
  const isNo = comment.choice === 'NO';

  const glowCyan = ctx.createRadialGradient(width * 0.9, height * 0.1, 10, width * 0.9, height * 0.1, 460);
  glowCyan.addColorStop(0, 'rgba(6, 182, 212, 0.28)');
  glowCyan.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowCyan;
  ctx.fillRect(0, 0, width, height);

  const glowPurple = ctx.createRadialGradient(width * 0.1, height * 0.9, 10, width * 0.1, height * 0.9, 480);
  glowPurple.addColorStop(0, isYes ? 'rgba(16, 185, 129, 0.28)' : isNo ? 'rgba(244, 63, 94, 0.28)' : 'rgba(168, 85, 247, 0.28)');
  glowPurple.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowPurple;
  ctx.fillRect(0, 0, width, height);

  // Radiant outer border with glow
  ctx.save();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, 36, 36, width - 72, height - 72, 32);
  ctx.stroke();
  ctx.restore();

  // Top Question
  const questionBottomY = renderCommentCardTopQuestion(ctx, issue, width, false);

  // Callout Box Geometry
  const calloutX = 64;
  const calloutW = width - calloutX * 2;
  const footerCardY = height - 56;
  const calloutY = Math.max(questionBottomY + 24, 280);
  const calloutH = footerCardY - calloutY - 24;

  // Draw Callout Box with neon glow
  ctx.save();
  drawCalloutBox(ctx, calloutX, calloutY, calloutW, calloutH, 28, calloutX + 76, 26, 14);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fill();

  ctx.shadowColor = isYes ? 'rgba(16, 185, 129, 0.60)' : isNo ? 'rgba(244, 63, 94, 0.60)' : 'rgba(99, 102, 241, 0.55)';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = isYes ? '#10b981' : isNo ? '#f43f5e' : '#6366f1';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // Callout Inner Content
  renderCalloutContent(ctx, comment, calloutX, calloutY, calloutW, calloutH, false);

  // Card Bottom Footer
  ctx.save();
  ctx.font = '700 15px ui-monospace, SFMono-Regular, monospace';
  ctx.fillStyle = '#06b6d4';
  ctx.textAlign = 'center';
  ctx.fillText('LIVE CIVIC PULSE  ·  yesorno.chillon.top', width / 2, footerCardY);
  ctx.restore();
}

/**
 * Master Render Dispatcher for Comment / Perspective Card
 */
export async function renderCommentCardToCanvas(
  issue: Issue,
  comment: CommentCardData,
  options: CommentCardRenderOptions = {}
): Promise<HTMLCanvasElement> {
  // Wait for Google fonts to be ready
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue if font API fails
    }
  }

  const style = options.style || 'bold';
  const width = 1080;
  const height = 1080;
  const isToned = options.colorTone === 'toned';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  if (style === 'editorial') {
    renderEditorialCommentCard(ctx, issue, comment, width, height, isToned);
  } else if (style === 'neon') {
    renderNeonCommentCard(ctx, issue, comment, width, height, isToned);
  } else {
    renderBoldCommentCard(ctx, issue, comment, width, height, isToned);
  }

  return canvas;
}

/**
 * Converts comment card to PNG Blob
 */
export async function generateCommentCardBlob(
  issue: Issue,
  comment: CommentCardData,
  options: CommentCardRenderOptions = {}
): Promise<Blob> {
  const canvas = await renderCommentCardToCanvas(issue, comment, options);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate PNG blob from comment canvas'));
    }, 'image/png');
  });
}

/**
 * Converts comment card to Data URL for instant in-browser preview
 */
export async function generateCommentCardDataUrl(
  issue: Issue,
  comment: CommentCardData,
  options: CommentCardRenderOptions = {}
): Promise<string> {
  const canvas = await renderCommentCardToCanvas(issue, comment, options);
  return canvas.toDataURL('image/png');
}

/**
 * Triggers browser download of comment PNG card
 */
export async function downloadCommentCard(
  issue: Issue,
  comment: CommentCardData,
  options: CommentCardRenderOptions = {}
): Promise<string> {
  const blob = await generateCommentCardBlob(issue, comment, options);
  const slug = buildIssueSlug(issue);
  const fileName = `comment-${comment.id}-${slug}-${options.style || 'bold'}.png`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return fileName;
}

/**
 * Copies comment PNG card to clipboard
 */
export async function copyCommentCardToClipboard(
  issue: Issue,
  comment: CommentCardData,
  options: CommentCardRenderOptions = {}
): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard || !window.ClipboardItem) {
    return false;
  }
  try {
    const blob = await generateCommentCardBlob(issue, comment, options);
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    return true;
  } catch (err) {
    console.warn('Failed to copy comment card to clipboard:', err);
    return false;
  }
}

/**
 * Shares comment card image file via native Web Share API
 */
export async function shareCommentCardFile(
  issue: Issue,
  comment: CommentCardData,
  options: CommentCardRenderOptions = {}
): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  try {
    const blob = await generateCommentCardBlob(issue, comment, options);
    const slug = buildIssueSlug(issue);
    const file = new File([blob], `comment-${comment.id}-${slug}.png`, { type: 'image/png' });

    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      return false;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://yesorno.chillon.top';
    const shareUrl = `${origin}/${slug}?c=${comment.id}`;
    const shareText = `"${comment.text}" — ${comment.author} on YesOrNo: ${issue.title}`;

    await navigator.share({
      title: `${comment.author}'s perspective on ${issue.title}`,
      text: `${shareText}\n${shareUrl}`,
      files: [file],
    });
    return true;
  } catch {
    return false;
  }
}
