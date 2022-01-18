#!/bin/bash

app_wasm_file="build/app.wasm"
app_bytes_include="build/app_bytes.c"
comp_wasm_file="build/compiler.wasm"

mkdir -p build

zig9 build-lib -target wasm32-freestanding-musl -dynamic src/app.c -O ReleaseSmall -femit-bin=$app_wasm_file

./print_bytes_as_c_code.js $app_wasm_file > $app_bytes_include

zig9 build-lib -target wasm32-freestanding-musl -dynamic src/compiler.c -O ReleaseSmall -femit-bin=$comp_wasm_file
