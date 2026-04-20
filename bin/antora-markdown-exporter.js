#!/usr/bin/env node

const version = "0.1.0";
const name = "@wsmy/antora-markdown-exporter";
const argv = process.argv.slice(2);

if (argv.includes("--version") || argv.includes("-v")) {
  console.log(version);
  process.exit(0);
}

if (argv.includes("--help") || argv.length === 0) {
  console.log(`${name} - Antora Markdown exporter CLI`);
  console.log("\nUsage:");
  console.log("  antora-markdown-exporter [--help|--version]");
  process.exit(0);
}

console.error("Unknown command. Run with --help.");
process.exit(1);
