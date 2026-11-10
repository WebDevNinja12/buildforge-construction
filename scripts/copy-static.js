const fs = require("fs");
const path = require("path");

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function copyIfExists(src, dest) {
  try {
    if (fs.existsSync(src)) {
      ensureDir(path.dirname(dest));
      fs.copyFileSync(src, dest);
      console.log("copied", src, "->", dest);
    }
  } catch (e) {
    console.warn("skip", src, e.message);
  }
}

ensureDir("public");
ensureDir("public/banners");

copyIfExists("logo.png", "public/logo.png");

// Banner images (repo root uploads)
const banners = [
  ["construction (8).png", "public/banners/home.png"],
  ["#civilengineering #civil #engineering.jpeg", "public/banners/about.jpeg"],
  ["🚀 Power Your Business with the Right Workforce.jpeg", "public/banners/services.jpeg"],
];

for (const [src, dest] of banners) {
  copyIfExists(src, dest);
}
