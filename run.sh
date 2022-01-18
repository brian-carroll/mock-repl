#!/bin/bash

app_wasm="dist/app.wasm"
app_include="build/app_bytes.c"
comp_wasm="dist/compiler.wasm"

mkdir -p build dist

zig9 build-lib -target wasm32-freestanding-musl -dynamic src/app.c -O ReleaseSmall -femit-bin=$app_wasm

./print_bytes_as_c_code.js $app_wasm > $app_include

zig9 build-lib -target wasm32-freestanding-musl -dynamic src/compiler.c -O ReleaseSmall -femit-bin=$comp_wasm
