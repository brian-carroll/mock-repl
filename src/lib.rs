mod generated_app_bytes;

use bumpalo::Bump;
use core::ffi::c_void;
use generated_app_bytes::APP;

// Manually update these constants whenever app.c or the C compilation options change!
const COUNTDOWN_START_BYTE_OFFSET: usize = 0x172;
const DEFAULT_START_VALUE: u8 = 22;

// Functions imported from JavaScript
extern "C" {
    pub fn repl_read_compiler_input(dest: *mut c_void);
    pub fn repl_write_compiler_output(ok: bool, src: *const c_void, size: usize);
    pub fn repl_read_stringify_input(dest: *mut c_void);
    pub fn repl_write_stringify_output(src: *const c_void, size: usize);
}

#[no_mangle]
pub extern "C" fn repl_compile(input_text_length: usize) {
    let arena = Bump::new();

    // Allocate space for the user's input text (zero-initialised)
    let input_text: &mut [u8] = arena.alloc_slice_fill_default(input_text_length);
    unsafe {
        // Ask JS to fill it with real data
        repl_read_compiler_input(input_text.as_mut_ptr() as *mut c_void);
    }

    let result = repl_compile_help(&arena, input_text);
    if let Err(msg) = result {
        unsafe {
            let msg_ptr = msg.as_ptr() as *const c_void;
            repl_write_compiler_output(false, msg_ptr, msg.len());
        }
    }
}

fn repl_compile_help(arena: &Bump, input_text: &[u8]) -> Result<(), String> {
    if APP[COUNTDOWN_START_BYTE_OFFSET] != DEFAULT_START_VALUE {
        panic!(
            "Template app.wasm changed! Did not find start value {} at offset 0x{:x}\n",
            DEFAULT_START_VALUE, COUNTDOWN_START_BYTE_OFFSET
        );
    }

    let input_str = std::str::from_utf8(input_text).map_err(|e| format!("{:?}", e))?;
    let countdown_start = input_str.parse::<u8>().map_err(|e| format!("{:?}", e))?;

    let app_copy = arena.alloc_slice_copy(APP);
    app_copy[COUNTDOWN_START_BYTE_OFFSET] = countdown_start;

    unsafe {
        let app_ptr = app_copy.as_ptr() as *const c_void;
        repl_write_compiler_output(true, app_ptr, APP.len());
    }

    Ok(())
}

#[no_mangle]
pub extern "C" fn repl_stringify(app_memory_size: usize, app_result_addr: usize) {
    let arena = Bump::new();

    // Allocate space for a copy of the app module's memory buffer (zero-initialised)
    let app_memory_copy: &mut [u8] = arena.alloc_slice_fill_default(app_memory_size);
    unsafe {
        // Ask JS to fill it with real data
        repl_read_stringify_input(app_memory_copy.as_mut_ptr() as *mut c_void);
    }

    // Get the bytes of the app's result struct (C ByteArray)
    let result = &app_memory_copy[app_result_addr..];

    // Parse the length of the C ByteArray
    let mut length_bytes: [u8; 4] = Default::default();
    length_bytes.copy_from_slice(&result[0..4]);
    let length = u32::from_le_bytes(length_bytes) as usize;

    // Stringify the numbers
    let numbers = &result[4..][0..length];
    let output_text = format!("{:?}", numbers);

    unsafe {
        let output_text_ptr = output_text.as_ptr() as *const c_void;
        repl_write_stringify_output(output_text_ptr, output_text.len());
    }
}
