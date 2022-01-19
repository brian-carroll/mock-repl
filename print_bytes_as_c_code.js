#!/usr/bin/env node

const fs = require("fs");

const infile = process.argv[2];
if (!infile) {
  throw new Error("Need an input file argument")
}

const buffer = fs.readFileSync(infile);

console.log(`
ResultByteArray app = {
    .ok = 1,
    .length = ${buffer.length},
    .bytes = {`)
buffer.forEach((byte) => {
  const hex = byte.toString(16).padStart(2, '0');
  console.log(`        0x${hex},`);
});
console.log(`    }
};`)
