const fs = require("fs");

const diff = fs.readFileSync("diff.txt", "utf-8");

let review = "## 🤖 Automated Review\n\n";

// Basic checks
if (diff.includes("console.log")) {
  review += "⚠️ Remove console.log statements\n";
}

if (diff.includes("TODO")) {
  review += "⚠️ TODO found — incomplete work\n";
}

if (diff.length > 8000) {
  review += "⚠️ Large PR — consider splitting\n";
}

// File-specific logic
if (diff.includes("auth")) {
  review += "🔐 Auth-related changes — review carefully\n";
}

fs.writeFileSync("review.md", review);
