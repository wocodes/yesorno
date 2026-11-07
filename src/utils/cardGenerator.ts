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

  // 1. TOP HEADER: Large Brand Badge + Category Pill
  const headerY = isSquare ? 76 : 56;
  const headerH = isSquare ? 64 : 52;

  ctx.save();
  // Brand Badge (Left)
  const brandPillW = isSquare ? 260 : 210;
  drawRoundedRect(ctx, padX, headerY, brandPillW, headerH, isSquare ? 20 : 16);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Brand Icon Box
  const iconBoxSize = isSquare ? 42 : 34;
  const iconBoxOffset = (headerH - iconBoxSize) / 2;
  drawRoundedRect(ctx, padX + iconBoxOffset, headerY + iconBoxOffset, iconBoxSize, iconBoxSize, 12);
  const iconGrad = ctx.createLinearGradient(padX, headerY, padX + iconBoxSize, headerY + iconBoxSize);
  iconGrad.addColorStop(0, '#10b981');
  iconGrad.addColorStop(1, '#6366f1');
  ctx.fillStyle = iconGrad;
  ctx.fill();

  // Checkmark inside icon box
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = isSquare ? 3.5 : 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const icX = padX + iconBoxOffset;
  const icY = headerY + iconBoxOffset;
  ctx.moveTo(icX + iconBoxSize * 0.26, icY + iconBoxSize * 0.50);
  ctx.lineTo(icX + iconBoxSize * 0.44, icY + iconBoxSize * 0.70);
  ctx.lineTo(icX + iconBoxSize * 0.74, icY + iconBoxSize * 0.32);
  ctx.stroke();

  // Brand Text
  ctx.font = `800 ${isSquare ? '32px' : '26px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('YesOrNo', padX + iconBoxOffset + iconBoxSize + (isSquare ? 16 : 12), headerY + headerH * 0.68);

  // Category Pill (Right)
  const categoryLabel = (issue.category || 'Public Ballot').toUpperCase();
  ctx.font = `700 ${isSquare ? '22px' : '17px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  const catTextW = ctx.measureText(categoryLabel).width;
  const catPillW = catTextW + (isSquare ? 64 : 50);
  const catX = width - padX - catPillW;

  drawRoundedRect(ctx, catX, headerY, catPillW, headerH, isSquare ? 20 : 16);
  ctx.fillStyle = isToned ? 'rgba(71, 85, 105, 0.35)' : 'rgba(99, 102, 241, 0.25)';
  ctx.fill();
  ctx.strokeStyle = isToned ? 'rgba(148, 163, 184, 0.45)' : 'rgba(129, 140, 248, 0.50)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Glowing dot
  ctx.beginPath();
  ctx.arc(catX + (isSquare ? 24 : 18), headerY + headerH / 2, isSquare ? 6 : 5, 0, Math.PI * 2);
  ctx.fillStyle = '#10b981';
  ctx.fill();

  ctx.fillStyle = isToned ? '#f1f5f9' : '#e0e7ff';
  ctx.fillText(categoryLabel, catX + (isSquare ? 42 : 32), headerY + headerH * 0.68);
  ctx.restore();

  // 2. FOOTER: Large Status Text & Call to Action Badge
  const bottomPad = isSquare ? 76 : 56;
  const footerH = isSquare ? 60 : 48;
  const footerY = height - bottomPad;

  ctx.save();
  // Status text (Left)
  ctx.font = `700 ${isSquare ? '26px' : '20px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(226, 232, 240, 0.95)';
  ctx.fillText(`⚡ Time-Bound Ballot • ${issue.durationLabel || 'Active for Voting'}`, padX, footerY + footerH * 0.65);

  // URL / CTA Badge (Right)
  const sharePayload = buildIssueSharePayload(issue);
  const displayHost = sharePayload.url.replace(/^https?:\/\//, '').split('/')[0] || 'yesorno.chillon.top';
  const urlLabel = `Vote at ${displayHost} →`;

  ctx.font = `700 ${isSquare ? '22px' : '17px'} ui-monospace, SFMono-Regular, monospace`;
  const badgeW = ctx.measureText(urlLabel).width + (isSquare ? 50 : 38);
  const badgeX = width - padX - badgeW;

  drawRoundedRect(ctx, badgeX, footerY, badgeW, footerH, isSquare ? 18 : 14);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(urlLabel, badgeX + (isSquare ? 25 : 19), footerY + footerH * 0.66);
  ctx.restore();

  // 3. CENTER QUESTION & DESCRIPTION (Vertically Centered in Available Space)
  const headerBottom = headerY + headerH + (isSquare ? 36 : 24);
  const footerTop = footerY - (isSquare ? 36 : 24);
  const availableCenterHeight = footerTop - headerBottom;

  const question = formatQuestion(issue.title);
  const typo = computeDynamicTypography(ctx, question, issue.description, contentWidth, isSquare, false);

  const titleTotalH = typo.titleLines.length * typo.titleLineHeight;
  const descTotalH = typo.descLines.length > 0 ? (typo.descLines.length * typo.descLineHeight + (isSquare ? 36 : 24)) : 0;
  const contentTotalH = titleTotalH + descTotalH;

  const startContentY = headerBottom + Math.max(16, (availableCenterHeight - contentTotalH) / 2);

  // Draw Question
  ctx.save();
  ctx.font = `900 ${typo.titleFontSize}px ${typo.fontFamily}`;
  ctx.fillStyle = '#ffffff';

  let cursorY = startContentY + typo.titleLineHeight * 0.82;
  for (const line of typo.titleLines) {
    ctx.fillText(line, padX, cursorY);
    cursorY += typo.titleLineHeight;
  }
  ctx.restore();

  // Draw Description
  if (typo.descLines.length > 0) {
    cursorY += isSquare ? 20 : 14;
    ctx.save();
    ctx.font = `500 ${typo.descFontSize}px ${typo.fontFamily}`;
    ctx.fillStyle = 'rgba(226, 232, 240, 0.92)';
    for (const line of typo.descLines) {
      ctx.fillText(line, padX, cursorY);
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

  // 1. TOP HEADER: Large YESORNO / PUBLIC BALLOT + Clean Category Tag
  const headerY = isSquare ? 76 : 56;
  ctx.save();
  ctx.font = `900 ${isSquare ? '34px' : '26px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('YESORNO', padX, headerY + (isSquare ? 30 : 24));

  ctx.font = `600 ${isSquare ? '20px' : '16px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(' /  PUBLIC BALLOT', padX + (isSquare ? 180 : 140), headerY + (isSquare ? 30 : 24));

  // Clean category tag without double hyphens
  const rawCat = (issue.category || 'COMMUNITY').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const catTag = `#${rawCat}`;
  ctx.font = `700 ${isSquare ? '20px' : '16px'} ui-monospace, SFMono-Regular, monospace`;
  const tagW = ctx.measureText(catTag).width + (isSquare ? 36 : 28);
  const tagX = width - padX - tagW;
  const tagH = isSquare ? 48 : 38;

  drawRoundedRect(ctx, tagX, headerY - (isSquare ? 4 : 2), tagW, tagH, isSquare ? 20 : 16);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.fillText(catTag, tagX + (isSquare ? 18 : 14), headerY + tagH * 0.62);

  // Horizontal divider
  const sepY = headerY + (isSquare ? 64 : 50);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, sepY);
  ctx.lineTo(width - padX, sepY);
  ctx.stroke();
  ctx.restore();

  // 2. FOOTER: Large Status Text & Clean Call to Action
  const bottomPad = isSquare ? 76 : 56;
  const footerY = height - bottomPad;

  ctx.save();
  ctx.font = `600 ${isSquare ? '22px' : '17px'} ui-monospace, monospace`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Open for community deliberation', padX, footerY);

  const cta = 'Vote at yesorno.chillon.top →';
  ctx.font = `700 ${isSquare ? '22px' : '17px'} ui-monospace, monospace`;
  const ctaW = ctx.measureText(cta).width;
  ctx.fillStyle = '#818cf8';
  ctx.fillText(cta, width - padX - ctaW, footerY);
  ctx.restore();

  // 3. CENTER QUESTION & DESCRIPTION (Vertically Centered in Available Space)
  const headerBottom = sepY + (isSquare ? 36 : 24);
  const footerTop = footerY - (isSquare ? 36 : 24);
  const availableCenterHeight = footerTop - headerBottom;
  const question = formatQuestion(issue.title);
  const typo = computeDynamicTypography(ctx, question, issue.description, contentWidth, isSquare, true);

  const eyebrowH = isSquare ? 34 : 26;
  const titleTotalH = typo.titleLines.length * typo.titleLineHeight;
  const descTotalH = typo.descLines.length > 0 ? (typo.descLines.length * typo.descLineHeight + (isSquare ? 36 : 24)) : 0;
  const contentTotalH = eyebrowH + titleTotalH + descTotalH;

  const startContentY = headerBottom + Math.max(16, (availableCenterHeight - contentTotalH) / 2);

  // Eyebrow label
  ctx.save();
  ctx.font = `800 ${isSquare ? '20px' : '16px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('QUESTION OF THE TOPIC', padX, startContentY + (isSquare ? 20 : 16));

  // Big Question with Editorial Serif Typography
  let cursorY = startContentY + eyebrowH + typo.titleLineHeight * 0.82;
  ctx.font = `800 ${typo.titleFontSize}px ${typo.fontFamily}`;
  ctx.fillStyle = '#ffffff';

  for (const line of typo.titleLines) {
    ctx.fillText(line, padX, cursorY);
    cursorY += typo.titleLineHeight;
  }
  ctx.restore();

  // Excerpt Context Box with Indigo Accent Bar
  if (typo.descLines.length > 0) {
    cursorY += isSquare ? 20 : 14;
    ctx.save();
    // Indigo vertical accent line
    const boxH = typo.descLines.length * typo.descLineHeight + 10;
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(padX + 2, cursorY - 18);
    ctx.lineTo(padX + 2, cursorY - 18 + boxH);
    ctx.stroke();

    ctx.font = `italic 500 ${typo.descFontSize}px Georgia, serif`;
    ctx.fillStyle = '#cbd5e1';
    let descY = cursorY + 6;
    for (const line of typo.descLines) {
      ctx.fillText(`"${line}"`, padX + 26, descY);
      descY += typo.descLineHeight;
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

  // 1. TOP HEADER: Neon Gradient Logo Box + LIVE BALLOT Pill
  const headerY = isSquare ? 76 : 56;
  const headerH = isSquare ? 60 : 48;

  ctx.save();
  // Logo Box
  const logoBoxSize = isSquare ? 50 : 40;
  const logoOffset = (headerH - logoBoxSize) / 2;
  drawRoundedRect(ctx, padX, headerY + logoOffset, logoBoxSize, logoBoxSize, 14);
  const logoGrad = ctx.createLinearGradient(padX, headerY, padX + logoBoxSize, headerY + logoBoxSize);
  logoGrad.addColorStop(0, '#6366f1');
  logoGrad.addColorStop(0.5, '#a855f7');
  logoGrad.addColorStop(1, '#ec4899');
  ctx.fillStyle = logoGrad;
  ctx.fill();

  ctx.font = `900 ${isSquare ? '18px' : '15px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Y/N', padX + (isSquare ? 10 : 8), headerY + headerH * 0.62);

  ctx.font = `900 ${isSquare ? '34px' : '26px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('YesOrNo', padX + logoBoxSize + (isSquare ? 16 : 12), headerY + headerH * 0.68);

  // LIVE BALLOT Pill
  const liveLabel = '● LIVE BALLOT';
  ctx.font = `800 ${isSquare ? '18px' : '15px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  const liveW = ctx.measureText(liveLabel).width + (isSquare ? 44 : 32);
  const liveX = width - padX - liveW;

  drawRoundedRect(ctx, liveX, headerY, liveW, headerH, isSquare ? 20 : 16);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.fillText('●', liveX + (isSquare ? 18 : 14), headerY + headerH * 0.64);
  ctx.fillStyle = '#f1f5f9';
  ctx.fillText('LIVE BALLOT', liveX + (isSquare ? 38 : 30), headerY + headerH * 0.64);
  ctx.restore();

  // 2. FOOTER: Fast 1-Min Voting + URL Badge
  const bottomPad = isSquare ? 76 : 56;
  const footerH = isSquare ? 60 : 48;
  const footerY = height - bottomPad;

  ctx.save();
  ctx.font = `700 ${isSquare ? '24px' : '18px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Open Ballot • Fast 1-Min Voting', padX, footerY + footerH * 0.65);

  const sharePayload = buildIssueSharePayload(issue);
  const displayHost = sharePayload.url.replace(/^https?:\/\//, '').split('/')[0] || 'yesorno.chillon.top';
  const urlLabel = `Vote at ${displayHost} →`;

  ctx.font = `700 ${isSquare ? '22px' : '17px'} ui-monospace, SFMono-Regular, monospace`;
  const badgeW = ctx.measureText(urlLabel).width + (isSquare ? 50 : 38);
  const badgeX = width - padX - badgeW;

  drawRoundedRect(ctx, badgeX, footerY, badgeW, footerH, isSquare ? 18 : 14);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.26)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(urlLabel, badgeX + (isSquare ? 25 : 19), footerY + footerH * 0.66);
  ctx.restore();

  // 3. CENTER QUESTION & DESCRIPTION (Vertically Centered in Available Space)
  const headerBottom = headerY + headerH + (isSquare ? 36 : 24);
  const footerTop = footerY - (isSquare ? 36 : 24);
  const availableCenterHeight = footerTop - headerBottom;

  const question = formatQuestion(issue.title);
  const typo = computeDynamicTypography(ctx, question, issue.description, contentWidth, isSquare, false);

  const eyebrowH = isSquare ? 34 : 26;
  const titleTotalH = typo.titleLines.length * typo.titleLineHeight;
  const descTotalH = typo.descLines.length > 0 ? (typo.descLines.length * typo.descLineHeight + (isSquare ? 36 : 24)) : 0;
  const contentTotalH = eyebrowH + titleTotalH + descTotalH;

  const startContentY = headerBottom + Math.max(16, (availableCenterHeight - contentTotalH) / 2);

  // Category Eyebrow in Neon
  ctx.save();
  ctx.font = `800 ${isSquare ? '22px' : '17px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#818cf8';
  ctx.fillText(`⚡ ${(issue.category || 'COMMUNITY').toUpperCase()}`, padX, startContentY + (isSquare ? 20 : 16));

  // Big Neon Question
  let cursorY = startContentY + eyebrowH + typo.titleLineHeight * 0.82;
  ctx.font = `900 ${typo.titleFontSize}px ${typo.fontFamily}`;
  ctx.fillStyle = '#ffffff';

  for (const line of typo.titleLines) {
    ctx.fillText(line, padX, cursorY);
    cursorY += typo.titleLineHeight;
  }
  ctx.restore();

  // Optional Description
  if (typo.descLines.length > 0) {
    cursorY += isSquare ? 20 : 14;
    ctx.save();
    ctx.font = `500 ${typo.descFontSize}px ${typo.fontFamily}`;
    ctx.fillStyle = 'rgba(203, 213, 225, 0.90)';
    for (const line of typo.descLines) {
      ctx.fillText(line, padX, cursorY);
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
  const format = options.format || 'landscape';
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
  const fileName = `${slug}-${options.style || 'card'}-${options.format || 'landscape'}.png`;

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
