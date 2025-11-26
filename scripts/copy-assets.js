#!/usr/bin/env node
/**
 * Copy static assets from frontend/public into frontend-react/public
 * Usage: node scripts/copy-assets.js
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'frontend', 'public');
const dest = path.join(__dirname, '..', 'frontend-react', 'public');

async function copy() {
  try {
    if (!fs.existsSync(src)) {
      console.error('Source folder does not exist:', src);
      process.exit(1);
    }

    // Use fs.cp if available (Node 16.7+), fallback to manual copy
    if (fs.cp) {
      await fs.promises.rm(dest, { recursive: true, force: true });
      await fs.promises.mkdir(dest, { recursive: true });
      await fs.promises.cp(src, dest, { recursive: true });
    } else {
      // simple recursive copy
      const copyRecursive = (s, d) => {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        for (const item of fs.readdirSync(s)) {
          const si = path.join(s, item);
          const di = path.join(d, item);
          const stat = fs.statSync(si);
          if (stat.isDirectory()) copyRecursive(si, di);
          else fs.copyFileSync(si, di);
        }
      };
      if (fs.existsSync(dest)) {
        await fs.promises.rm(dest, { recursive: true, force: true });
      }
      copyRecursive(src, dest);
    }

    console.log('✓ Copied assets from', src, 'to', dest);
  } catch (err) {
    console.error('Copy assets failed:', err);
    process.exit(1);
  }
}

copy();
