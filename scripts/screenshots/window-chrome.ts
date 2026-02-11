/**
 * Synthetic macOS window chrome post-processor
 *
 * Adds rounded corners, title bar with traffic lights, and drop shadow
 * to raw screenshots, matching the aesthetic of manually-captured macOS windows.
 *
 * Also provides a lighter "panel frame" variant with just rounded corners
 * and shadow (no title bar) for cropped panel screenshots.
 *
 * Uses sharp for image compositing.
 */

import sharp from 'sharp';

/** Configuration for the window chrome overlay */
interface ChromeConfig {
  /** Corner radius in pixels (at output resolution) */
  cornerRadius: number;
  /** Title bar height in pixels */
  titleBarHeight: number;
  /** Traffic light circle diameter */
  trafficLightSize: number;
  /** Spacing between traffic light circles */
  trafficLightGap: number;
  /** Left margin for traffic lights */
  trafficLightMarginLeft: number;
  /** Drop shadow blur radius */
  shadowBlur: number;
  /** Drop shadow offset Y */
  shadowOffsetY: number;
  /** Padding around the window for the shadow */
  shadowPadding: number;
}

const DEFAULT_CONFIG: ChromeConfig = {
  cornerRadius: 20, // 10px at 1x, doubled for 2x
  titleBarHeight: 44, // 22px at 1x, doubled for 2x
  trafficLightSize: 24, // 12px at 1x
  trafficLightGap: 16, // 8px at 1x
  trafficLightMarginLeft: 40, // 20px at 1x
  shadowBlur: 60,
  shadowOffsetY: 10,
  shadowPadding: 80,
};

/** Traffic light colors */
const TRAFFIC_LIGHTS = {
  close: { fill: '#FF5F57', stroke: '#E0443E' },
  minimize: { fill: '#FEBC2E', stroke: '#DEA123' },
  maximize: { fill: '#28C840', stroke: '#1AAB29' },
};

/**
 * Generate an SVG circle for a traffic light button
 */
function trafficLightCircle(
  cx: number,
  cy: number,
  r: number,
  colors: { fill: string; stroke: string }
): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1"/>`;
}

/**
 * Create the title bar SVG with traffic lights
 */
function createTitleBarSvg(
  width: number,
  height: number,
  config: ChromeConfig,
  isDark: boolean
): string {
  // Title bar colors matched to the screenshot themes (Default Dark Modern / Quiet Light)
  const bgColor = isDark ? '#1f1f1f' : '#F5F5F5';
  const borderColor = isDark ? '#2b2b2b' : '#C9C9C9';
  const r = config.cornerRadius;

  // Traffic light positions (vertically centered in title bar)
  const cy = Math.floor(height / 2);
  const lightRadius = Math.floor(config.trafficLightSize / 2);
  const startX = config.trafficLightMarginLeft + lightRadius;
  const gap = config.trafficLightSize + config.trafficLightGap;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <clipPath id="titleClip">
      <path d="M ${r},0 H ${width - r} Q ${width},0 ${width},${r} V ${height} H 0 V ${r} Q 0,0 ${r},0 Z"/>
    </clipPath>
  </defs>
  <rect width="${width}" height="${height}" fill="${bgColor}" clip-path="url(#titleClip)"/>
  <line x1="0" y1="${height - 0.5}" x2="${width}" y2="${height - 0.5}" stroke="${borderColor}" stroke-width="1"/>
  ${trafficLightCircle(startX, cy, lightRadius, TRAFFIC_LIGHTS.close)}
  ${trafficLightCircle(startX + gap, cy, lightRadius, TRAFFIC_LIGHTS.minimize)}
  ${trafficLightCircle(startX + gap * 2, cy, lightRadius, TRAFFIC_LIGHTS.maximize)}
</svg>`;
}

/**
 * Create a rounded rectangle mask SVG for clipping the window
 */
function createRoundedMask(width: number, height: number, radius: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/>
</svg>`;
}

/**
 * Create a drop shadow SVG
 */
function createShadowSvg(
  totalWidth: number,
  totalHeight: number,
  windowWidth: number,
  windowHeight: number,
  config: ChromeConfig
): string {
  const offsetX = Math.floor((totalWidth - windowWidth) / 2);
  const offsetY = Math.floor((totalHeight - windowHeight) / 2);
  const r = config.cornerRadius;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}">
  <defs>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="${config.shadowOffsetY}" stdDeviation="${config.shadowBlur / 2}" flood-color="rgba(0,0,0,0.35)"/>
    </filter>
  </defs>
  <rect x="${offsetX}" y="${offsetY}" width="${windowWidth}" height="${windowHeight}" rx="${r}" ry="${r}" fill="rgba(0,0,0,0.5)" filter="url(#shadow)"/>
</svg>`;
}

/**
 * Add synthetic macOS window chrome to a raw screenshot.
 *
 * @param inputPath - Path to the raw screenshot PNG
 * @param outputPath - Path to write the processed PNG
 * @param theme - 'dark' or 'light' to match title bar colors
 * @param config - Optional override for chrome dimensions
 */
export async function addWindowChrome(
  inputPath: string,
  outputPath: string,
  theme: 'dark' | 'light',
  config: ChromeConfig = DEFAULT_CONFIG
): Promise<void> {
  const isDark = theme === 'dark';

  // Read the raw screenshot
  const rawImage = sharp(inputPath);
  const metadata = await rawImage.metadata();
  const imgWidth = metadata.width!;
  const imgHeight = metadata.height!;

  // Window dimensions (image + title bar)
  const windowWidth = imgWidth;
  const windowHeight = imgHeight + config.titleBarHeight;

  // Total dimensions (window + shadow padding)
  const totalWidth = windowWidth + config.shadowPadding * 2;
  const totalHeight = windowHeight + config.shadowPadding * 2;

  // Background color for the area outside the window
  const bgColor = isDark ? { r: 30, g: 30, b: 30, alpha: 0 } : { r: 240, g: 240, b: 240, alpha: 0 };

  // Step 1: Create the shadow layer
  const shadowSvg = createShadowSvg(totalWidth, totalHeight, windowWidth, windowHeight, config);
  const shadowLayer = await sharp(Buffer.from(shadowSvg)).png().toBuffer();

  // Step 2: Create the title bar
  const titleBarSvg = createTitleBarSvg(windowWidth, config.titleBarHeight, config, isDark);
  const titleBar = await sharp(Buffer.from(titleBarSvg)).png().toBuffer();

  // Step 3: Composite title bar + screenshot into the window
  const rawBuffer = await rawImage.toBuffer();
  const windowImage = await sharp({
    create: {
      width: windowWidth,
      height: windowHeight,
      channels: 4,
      background: bgColor,
    },
  })
    .composite([
      { input: titleBar, top: 0, left: 0 },
      { input: rawBuffer, top: config.titleBarHeight, left: 0 },
    ])
    .png()
    .toBuffer();

  // Step 4: Apply rounded corner mask
  const maskSvg = createRoundedMask(windowWidth, windowHeight, config.cornerRadius);
  const maskedWindow = await sharp(windowImage)
    .composite([
      {
        input: Buffer.from(maskSvg),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();

  // Step 5: Composite everything onto the final canvas
  const offsetX = config.shadowPadding;
  const offsetY = config.shadowPadding;

  await sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: shadowLayer, top: 0, left: 0 },
      { input: maskedWindow, top: offsetY, left: offsetX },
    ])
    .png()
    .toFile(outputPath);
}

/**
 * Add a subtle panel frame to a cropped screenshot.
 *
 * Unlike addWindowChrome, this adds only rounded corners and a drop shadow
 * (no title bar or traffic lights). Used for cropped panel screenshots
 * where the full window chrome would be misleading.
 *
 * @param inputPath - Path to the cropped screenshot PNG
 * @param outputPath - Path to write the processed PNG
 * @param theme - 'dark' or 'light' (affects shadow intensity)
 */
export async function addPanelFrame(
  inputPath: string,
  outputPath: string,
  theme: 'dark' | 'light'
): Promise<void> {
  const cornerRadius = 16; // 8px at 1x, doubled for 2x
  const shadowBlur = 40;
  const shadowOffsetY = 6;
  const shadowPadding = 60;

  const rawImage = sharp(inputPath);
  const metadata = await rawImage.metadata();
  const imgWidth = metadata.width!;
  const imgHeight = metadata.height!;

  const totalWidth = imgWidth + shadowPadding * 2;
  const totalHeight = imgHeight + shadowPadding * 2;

  const shadowOpacity = theme === 'dark' ? 0.4 : 0.25;

  // Step 1: Apply rounded corners to the image
  const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imgWidth}" height="${imgHeight}">
  <rect width="${imgWidth}" height="${imgHeight}" rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
</svg>`;

  const maskedImage = await sharp(await rawImage.toBuffer())
    .composite([{ input: Buffer.from(maskSvg), blend: 'dest-in' as const }])
    .png()
    .toBuffer();

  // Step 2: Create shadow layer
  const shadowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}">
  <defs>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="${shadowOffsetY}" stdDeviation="${shadowBlur / 2}" flood-color="rgba(0,0,0,${shadowOpacity})"/>
    </filter>
  </defs>
  <rect x="${shadowPadding}" y="${shadowPadding}" width="${imgWidth}" height="${imgHeight}" rx="${cornerRadius}" ry="${cornerRadius}" fill="rgba(0,0,0,${shadowOpacity + 0.1})" filter="url(#shadow)"/>
</svg>`;

  const shadowLayer = await sharp(Buffer.from(shadowSvg)).png().toBuffer();

  // Step 3: Composite onto transparent canvas
  await sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: shadowLayer, top: 0, left: 0 },
      { input: maskedImage, top: shadowPadding, left: shadowPadding },
    ])
    .png()
    .toFile(outputPath);
}
