#!/bin/bash

set -ex

app_wasm="generated/app.wasm"
app_include="generated/app_bytes.c"
app_rust="src/generated_app_bytes.rs"
comp_wasm="dist/compiler.wasm"

rm -rf generated dist
mkdir -p generated dist

zig9 build-lib -target wasm32-freestanding-musl -dynamic src/app.c -femit-bin=$app_wasm

./print_bytes_as_c_code.js $app_wasm > $app_include
./print_bytes_as_rust_code.js $app_wasm > $app_rust

zig9 build-lib -target wasm32-wasi -dynamic -lc src/compiler.c -O ReleaseSmall -femit-bin=$comp_wasm
