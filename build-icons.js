#!/usr/bin/env node

// Build script to generate PNG icons (16, 48, 128 px) from GHOST_SVG on a transparent background.
// Supports `sharp` (if installed) or ImageMagick `magick` / `convert`.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const { GHOST_SVG } = require("./assets.js");

const SIZES = [16, 48, 128];
const ICONS_DIR = path.join(__dirname, "icons");

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Write the SVG file temporarily or as reference
const svgPath = path.join(ICONS_DIR, "ghost.svg");
fs.writeFileSync(svgPath, GHOST_SVG.trim(), "utf8");

async function generateWithSharp(sharp) {
  console.log("Rendering icons with sharp...");
  for (const size of SIZES) {
    const outPath = path.join(ICONS_DIR, `icon-${size}.png`);
    await sharp(Buffer.from(GHOST_SVG))
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(outPath);
    console.log(`✓ Generated ${outPath} (${size}x${size})`);
  }
}

function generateWithImageMagick() {
  const cmd = (() => {
    try {
      execSync("which magick", { stdio: "ignore" });
      return "magick";
    } catch {
      try {
        execSync("which convert", { stdio: "ignore" });
        return "convert";
      } catch {
        return null;
      }
    }
  })();

  if (!cmd) {
    throw new Error(
      "Neither 'sharp' nor ImageMagick ('magick'/'convert') was found. Open export-icons.html in your browser to export icons via HTML5 Canvas."
    );
  }

  console.log(`Rendering icons with ImageMagick (${cmd})...`);
  for (const size of SIZES) {
    const outPath = path.join(ICONS_DIR, `icon-${size}.png`);
    execSync(
      `${cmd} -background none -density 300 "${svgPath}" -resize ${size}x${size} -gravity center -extent ${size}x${size} "${outPath}"`
    );
    console.log(`✓ Generated ${outPath} (${size}x${size})`);
  }
}

async function main() {
  try {
    const sharp = require("sharp");
    await generateWithSharp(sharp);
  } catch (err) {
    generateWithImageMagick();
  }
  console.log("All icons generated successfully!");
}

main().catch((err) => {
  console.error("Icon generation error:", err.message);
  process.exit(1);
});
