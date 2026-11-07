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

  // Ultra-legible large scale: short questions get huge 68-74px fonts
  let titleFontSize = isSquare
    ? (len <= 45 ? 68 : len <= 85 ? 56 : 48)
    : (len <= 45 ? 52 : len <= 85 ? 44 : 36);

  let titleLineHeight = Math.round(titleFontSize * 1.24);
  const descFontSize = isSquare ? 26 : 22;
  const descLineHeight = Math.round(descFontSize * 1.45);

  const fontFamily = isEditorial
    ? '"Instrument Serif", Georgia, serif'
    : '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif';

  ctx.font = `${isEditorial ? '800' : '900'} ${titleFontSize}px ${fontFamily}`;
  let titleLines = wrapText(ctx, title, maxWidth, isSquare ? 4 : 3);

  // If title was too long and wrapped into more than max lines or exceeded, drop font size slightly
  if (titleLines.length > (isSquare ? 4 : 3) && titleFontSize > 40) {
    titleFontSize -= 8;
    titleLineHeight = Math.round(titleFontSize * 1.24);
    ctx.font = `${isEditorial ? '800' : '900'} ${titleFontSize}px ${fontFamily}`;
    titleLines = wrapText(ctx, title, maxWidth, isSquare ? 4 : 3);
  }

  let descLines: string[] = [];
  if (desc && desc.trim().length > 0) {
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

  const padX = isSquare ? 72 : 80;
  const contentWidth = width - padX * 2;

  // 1. TOP HEADER: Brand Badge + Category Pill
  const headerY = isSquare ? 72 : 56;
  const headerH = 48;

  ctx.save();
  // Brand Badge
  drawRoundedRect(ctx, padX, headerY, 205, headerH, 16);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Mini Icon Box
  drawRoundedRect(ctx, padX + 8, headerY + 8, 32, 32, 10);
  const iconGrad = ctx.createLinearGradient(padX + 8, headerY + 8, padX + 40, headerY + 40);
  iconGrad.addColorStop(0, '#10b981');
  iconGrad.addColorStop(1, '#6366f1');
  ctx.fillStyle = iconGrad;
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(padX + 17, headerY + 24);
  ctx.lineTo(padX + 22, headerY + 29);
  ctx.lineTo(padX + 31, headerY + 18);
  ctx.stroke();

  ctx.font = '800 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('YesOrNo', padX + 50, headerY + 32);

  // Category Pill (Right)
  const categoryLabel = (issue.category || 'Public Ballot').toUpperCase();
  ctx.font = '700 13px "Plus Jakarta Sans", system-ui, sans-serif';
  const catWidth = ctx.measureText(categoryLabel).width + 38;
  const catX = width - padX - catWidth;

  drawRoundedRect(ctx, catX, headerY + 4, catWidth, 40, 14);
  ctx.fillStyle = isToned ? 'rgba(71, 85, 105, 0.3)' : 'rgba(99, 102, 241, 0.22)';
  ctx.fill();
  ctx.strokeStyle = isToned ? 'rgba(148, 163, 184, 0.35)' : 'rgba(129, 140, 248, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(catX + 16, headerY + 24, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#10b981';
  ctx.fill();

  ctx.fillStyle = isToned ? '#e2e8f0' : '#c7d2fe';
  ctx.fillText(categoryLabel, catX + 28, headerY + 29);
  ctx.restore();

  // 2. BOTTOM DUEL SECTION (Fixed Anchor at bottom)
  const duelCardH = isSquare ? 150 : 105;
  const duelBarH = 12;
  const footerH = 38;
  const bottomPad = isSquare ? 72 : 54;
  const duelY = height - (duelCardH + 16 + duelBarH + 20 + footerH + bottomPad);

  const colGap = 18;
  const colW = (contentWidth - colGap) / 2;

  // 3. CENTER QUESTION & DESCRIPTION (Vertically Centered in Available Space)
  const headerBottom = headerY + headerH + 20;
  const availableCenterHeight = duelY - headerBottom;

  const question = formatQuestion(issue.title);
  const typo = computeDynamicTypography(ctx, question, issue.description, contentWidth, isSquare, false);

  const titleTotalH = typo.titleLines.length * typo.titleLineHeight;
  const descTotalH = typo.descLines.length > 0 ? (typo.descLines.length * typo.descLineHeight + (isSquare ? 28 : 18)) : 0;
  const contentTotalH = titleTotalH + descTotalH;

  // Center vertically in the space between header and duel cards
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
    cursorY += isSquare ? 14 : 10;
    ctx.save();
    ctx.font = `500 ${typo.descFontSize}px ${typo.fontFamily}`;
    ctx.fillStyle = 'rgba(226, 232, 240, 0.92)';
    for (const line of typo.descLines) {
      ctx.fillText(line, padX, cursorY);
      cursorY += typo.descLineHeight;
    }
    ctx.restore();
  }

  // 4. DRAW DUEL ACTION CARDS (NO RESULTS/VOTES SHOWN)
  ctx.save();
  // YES Card
  drawRoundedRect(ctx, padX, duelY, colW, duelCardH, 22);
  const yesBg = ctx.createLinearGradient(padX, duelY, padX + colW, duelY + duelCardH);
  yesBg.addColorStop(0, 'rgba(6, 78, 59, 0.92)');
  yesBg.addColorStop(1, 'rgba(6, 95, 70, 0.72)');
  ctx.fillStyle = yesBg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.85)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.font = `900 ${isSquare ? '34px' : '28px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#34d399';
  ctx.fillText('VOTE YES  👍', padX + 28, duelY + (duelCardH / 2) - (isSquare ? 6 : 4));

  ctx.font = `600 ${isSquare ? '16px' : '13px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillText('Cast your stance in favor', padX + 28, duelY + (duelCardH / 2) + (isSquare ? 26 : 20));

  // NO Card
  const noX = padX + colW + colGap;
  drawRoundedRect(ctx, noX, duelY, colW, duelCardH, 22);
  const noBg = ctx.createLinearGradient(noX, duelY, noX + colW, duelY + duelCardH);
  noBg.addColorStop(0, 'rgba(136, 19, 55, 0.92)');
  noBg.addColorStop(1, 'rgba(159, 18, 57, 0.72)');
  ctx.fillStyle = noBg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.85)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.font = `900 ${isSquare ? '34px' : '28px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#fb7185';
  ctx.fillText('VOTE NO  👎', noX + 28, duelY + (duelCardH / 2) - (isSquare ? 6 : 4));

  ctx.font = `600 ${isSquare ? '16px' : '13px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillText('Cast your stance against', noX + 28, duelY + (duelCardH / 2) + (isSquare ? 26 : 20));

  // Dual Progress Connector Bar (Balanced 50/50 Duel Track)
  const barY = duelY + duelCardH + 16;
  const barW = contentWidth;

  drawRoundedRect(ctx, padX, barY, barW, duelBarH, 6);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();

  // Emerald side
  drawRoundedRect(ctx, padX, barY, barW / 2, duelBarH, 6);
  const barYesGrad = ctx.createLinearGradient(padX, barY, padX + barW / 2, barY);
  barYesGrad.addColorStop(0, '#059669');
  barYesGrad.addColorStop(1, '#10b981');
  ctx.fillStyle = barYesGrad;
  ctx.fill();

  // Rose side
  drawRoundedRect(ctx, padX + barW / 2, barY, barW / 2, duelBarH, 6);
  const barNoGrad = ctx.createLinearGradient(padX + barW / 2, barY, padX + barW, barY);
  barNoGrad.addColorStop(0, '#e11d48');
  barNoGrad.addColorStop(1, '#f43f5e');
  ctx.fillStyle = barNoGrad;
  ctx.fill();
  ctx.restore();

  // Footer: Time-Bound Ballot & URL Badge
  const footerY = height - (isSquare ? 82 : 68);
  ctx.save();
  ctx.font = `700 ${isSquare ? '16px' : '14px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(226, 232, 240, 0.92)';
  ctx.fillText(`⚡ Time-Bound Ballot • ${issue.durationLabel || 'Active for Voting'}`, padX, footerY);

  const sharePayload = buildIssueSharePayload(issue);
  const displayHost = sharePayload.url.replace(/^https?:\/\//, '').split('/')[0] || 'yesorno.chillon.top';
  const urlLabel = `${displayHost}/${buildIssueSlug(issue).slice(0, 22)}... →`;

  ctx.font = '700 13px ui-monospace, SFMono-Regular, monospace';
  const badgeW = ctx.measureText(urlLabel).width + 36;
  const badgeX = width - padX - badgeW;

  drawRoundedRect(ctx, badgeX, footerY - 18, badgeW, 40, 14);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(urlLabel, badgeX + 18, footerY + 7);
  ctx.restore();
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

  const padX = isSquare ? 72 : 80;
  const contentWidth = width - padX * 2;

  // 1. TOP HEADER: YESORNO / PUBLIC BALLOT + Clean Category Tag
  const headerY = isSquare ? 72 : 56;
  ctx.save();
  ctx.font = '900 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('YESORNO', padX, headerY + 22);

  ctx.font = '600 14px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(' /  PUBLIC BALLOT', padX + 118, headerY + 22);

  // Clean category tag without double hyphens
  const rawCat = (issue.category || 'COMMUNITY').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  const catTag = `#${rawCat}`;
  ctx.font = '700 13px ui-monospace, SFMono-Regular, monospace';
  const tagW = ctx.measureText(catTag).width + 26;
  const tagX = width - padX - tagW;

  drawRoundedRect(ctx, tagX, headerY, tagW, 36, 18);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.40)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.fillText(catTag, tagX + 13, headerY + 23);

  // Horizontal divider
  const sepY = headerY + 50;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, sepY);
  ctx.lineTo(width - padX, sepY);
  ctx.stroke();
  ctx.restore();

  // 2. BOTTOM DUEL SECTION
  const duelY = isSquare ? height - 260 : height - 200;

  // 3. CENTER QUESTION & DESCRIPTION (Vertically Centered)
  const availableCenterHeight = duelY - (sepY + 30);
  const question = formatQuestion(issue.title);
  const typo = computeDynamicTypography(ctx, question, issue.description, contentWidth, isSquare, true);

  const eyebrowH = 28;
  const titleTotalH = typo.titleLines.length * typo.titleLineHeight;
  const descTotalH = typo.descLines.length > 0 ? (typo.descLines.length * typo.descLineHeight + (isSquare ? 32 : 20)) : 0;
  const contentTotalH = eyebrowH + titleTotalH + descTotalH;

  const startContentY = sepY + 30 + Math.max(16, (availableCenterHeight - contentTotalH) / 2);

  // Eyebrow label
  ctx.save();
  ctx.font = '800 13px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('QUESTION OF THE TOPIC', padX, startContentY + 14);

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
    cursorY += isSquare ? 18 : 12;
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
      ctx.fillText(`"${line}"`, padX + 22, descY);
      descY += typo.descLineHeight;
    }
    ctx.restore();
  }

  // 4. DRAW DUEL BAR
  ctx.save();
  // Left Label
  ctx.font = `900 ${isSquare ? '28px' : '22px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#10b981';
  ctx.fillText('VOTE IN FAVOR (YES)  👍', padX, duelY);

  // Right Label
  const rightLabel = '👎  VOTE AGAINST (NO)';
  ctx.font = `900 ${isSquare ? '28px' : '22px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#f43f5e';
  const rightW = ctx.measureText(rightLabel).width;
  ctx.fillText(rightLabel, width - padX - rightW, duelY);

  // Flat Dual Duel Bar
  const barY = duelY + 22;
  const barH = 14;
  const barW = contentWidth;

  drawRoundedRect(ctx, padX, barY, barW, barH, 7);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();

  // Emerald half
  drawRoundedRect(ctx, padX, barY, barW / 2, barH, 7);
  ctx.fillStyle = '#10b981';
  ctx.fill();

  // Rose half
  drawRoundedRect(ctx, padX + barW / 2, barY, barW / 2, barH, 7);
  ctx.fillStyle = '#f43f5e';
  ctx.fill();

  // Footer
  const footerY = height - (isSquare ? 80 : 66);
  ctx.font = `600 ${isSquare ? '15px' : '13px'} ui-monospace, monospace`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Open for community deliberation', padX, footerY);

  const cta = 'Cast your stance at yesorno.chillon.top →';
  ctx.font = `700 ${isSquare ? '15px' : '13px'} ui-monospace, monospace`;
  const ctaW = ctx.measureText(cta).width;
  ctx.fillStyle = '#818cf8';
  ctx.fillText(cta, width - padX - ctaW, footerY);
  ctx.restore();
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

  const padX = isSquare ? 72 : 80;
  const contentWidth = width - padX * 2;

  // 1. TOP HEADER: Neon Gradient Logo Box + LIVE BALLOT Pill
  const headerY = isSquare ? 72 : 56;
  const headerH = 44;

  ctx.save();
  // Logo Box
  drawRoundedRect(ctx, padX, headerY, 44, headerH, 14);
  const logoGrad = ctx.createLinearGradient(padX, headerY, padX + 44, headerY + headerH);
  logoGrad.addColorStop(0, '#6366f1');
  logoGrad.addColorStop(0.5, '#a855f7');
  logoGrad.addColorStop(1, '#ec4899');
  ctx.fillStyle = logoGrad;
  ctx.fill();

  ctx.font = '900 16px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Y/N', padX + 8, headerY + 28);

  ctx.font = '900 24px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('YesOrNo', padX + 56, headerY + 31);

  // LIVE BALLOT Pill
  const liveLabel = '● LIVE BALLOT';
  ctx.font = '800 12px "Plus Jakarta Sans", system-ui, sans-serif';
  const liveW = ctx.measureText(liveLabel).width + 30;
  const liveX = width - padX - liveW;

  drawRoundedRect(ctx, liveX, headerY + 4, liveW, 36, 18);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.fillText('●', liveX + 13, headerY + 26);
  ctx.fillStyle = '#f1f5f9';
  ctx.fillText('LIVE BALLOT', liveX + 28, headerY + 26);
  ctx.restore();

  // 2. BOTTOM DUEL SECTION
  const duelCardH = isSquare ? 135 : 95;
  const duelBarH = 12;
  const footerH = 38;
  const bottomPad = isSquare ? 72 : 54;
  const duelY = height - (duelCardH + 16 + duelBarH + 20 + footerH + bottomPad);

  const colGap = 18;
  const colW = (contentWidth - colGap) / 2;

  // 3. CENTER QUESTION & DESCRIPTION (Vertically Centered)
  const headerBottom = headerY + headerH + 20;
  const availableCenterHeight = duelY - headerBottom;

  const question = formatQuestion(issue.title);
  const typo = computeDynamicTypography(ctx, question, issue.description, contentWidth, isSquare, false);

  const eyebrowH = 30;
  const titleTotalH = typo.titleLines.length * typo.titleLineHeight;
  const descTotalH = typo.descLines.length > 0 ? (typo.descLines.length * typo.descLineHeight + (isSquare ? 28 : 18)) : 0;
  const contentTotalH = eyebrowH + titleTotalH + descTotalH;

  const startContentY = headerBottom + Math.max(16, (availableCenterHeight - contentTotalH) / 2);

  // Category Eyebrow in Neon
  ctx.save();
  ctx.font = `800 ${isSquare ? '15px' : '13px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#818cf8';
  ctx.fillText(`⚡ ${(issue.category || 'COMMUNITY').toUpperCase()}`, padX, startContentY + 16);

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
    cursorY += isSquare ? 14 : 10;
    ctx.save();
    ctx.font = `500 ${typo.descFontSize}px ${typo.fontFamily}`;
    ctx.fillStyle = 'rgba(203, 213, 225, 0.90)';
    for (const line of typo.descLines) {
      ctx.fillText(line, padX, cursorY);
      cursorY += typo.descLineHeight;
    }
    ctx.restore();
  }

  // 4. DRAW DUEL NEON ACTION CARDS
  ctx.save();
  // Left Neon YES Card
  drawRoundedRect(ctx, padX, duelY, colW, duelCardH, 20);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.75)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(padX + 28, duelY + (duelCardH / 2) - (isSquare ? 6 : 4), 7, 0, Math.PI * 2);
  ctx.fillStyle = '#34d399';
  ctx.fill();

  ctx.font = `900 ${isSquare ? '30px' : '24px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#34d399';
  ctx.fillText('VOTE YES  👍', padX + 46, duelY + (duelCardH / 2) - (isSquare ? 6 : 4) + 8);

  ctx.font = `600 ${isSquare ? '15px' : '13px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText('Cast your stance in favor', padX + 28, duelY + (duelCardH / 2) + (isSquare ? 24 : 18));

  // Right Neon NO Card
  const noX = padX + colW + colGap;
  drawRoundedRect(ctx, noX, duelY, colW, duelCardH, 20);
  ctx.fillStyle = 'rgba(244, 63, 94, 0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 113, 133, 0.75)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(noX + 28, duelY + (duelCardH / 2) - (isSquare ? 6 : 4), 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fb7185';
  ctx.fill();

  ctx.font = `900 ${isSquare ? '30px' : '24px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#fb7185';
  ctx.fillText('VOTE NO  👎', noX + 46, duelY + (duelCardH / 2) - (isSquare ? 6 : 4) + 8);

  ctx.font = `600 ${isSquare ? '15px' : '13px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText('Cast your stance against', noX + 28, duelY + (duelCardH / 2) + (isSquare ? 24 : 18));

  // Glowing 50/50 Dual Progress Bar
  const barY = duelY + duelCardH + 16;
  const barW = contentWidth;

  drawRoundedRect(ctx, padX, barY, barW, duelBarH, 6);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();

  drawRoundedRect(ctx, padX, barY, barW / 2, duelBarH, 6);
  ctx.fillStyle = '#10b981';
  ctx.fill();

  drawRoundedRect(ctx, padX + barW / 2, barY, barW / 2, duelBarH, 6);
  ctx.fillStyle = '#f43f5e';
  ctx.fill();
  ctx.restore();

  // Footer: Fast 1-Min Voting + URL Badge
  const footerY = height - (isSquare ? 82 : 68);
  ctx.save();
  ctx.font = `700 ${isSquare ? '16px' : '14px'} "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Open Ballot • Fast 1-Min Voting', padX, footerY);

  const sharePayload = buildIssueSharePayload(issue);
  const displayHost = sharePayload.url.replace(/^https?:\/\//, '').split('/')[0] || 'yesorno.chillon.top';
  const urlLabel = `${displayHost}/${buildIssueSlug(issue).slice(0, 22)}... →`;

  ctx.font = '700 13px ui-monospace, SFMono-Regular, monospace';
  const badgeW = ctx.measureText(urlLabel).width + 36;
  const badgeX = width - padX - badgeW;

  drawRoundedRect(ctx, badgeX, footerY - 18, badgeW, 40, 14);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(urlLabel, badgeX + 18, footerY + 7);
  ctx.restore();
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
