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

const banners = [
  ["construction (8).png", "public/banners/home.png"],
  ["#civilengineering #civil #engineering.jpeg", "public/banners/about.jpeg"],
  ["🚀 Power Your Business with the Right Workforce.jpeg", "public/banners/services.jpeg"],
  ["307d9897-70e1-4a8a-a927-24d6d45b29ee.jpeg", "public/banners/contact.jpeg"],
  ["93dd6157-027a-4a52-b44e-539145076b46.jpeg", "public/banners/projects.jpeg"],
  ["a385382d-1f06-4cd3-8b72-5a9ad002cac1.jpeg", "public/banners/quote.jpeg"],
  ["b6edc24a-f2ac-4f21-9573-8c976356378b.jpeg", "public/banners/workers.jpeg"],
];

for (const [src, dest] of banners) {
  copyIfExists(src, dest);
}
