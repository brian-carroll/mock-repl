mod generated_app_bytes;

use bumpalo::Bump;
use generated_app_bytes::APP;
use wasm_bindgen::prelude::wasm_bindgen;

// Seems to be used implicitly by wasm_bindgen macros
#[allow(unused_imports)]
use wasm_bindgen::JsValue;

// Manually update these constants whenever app.c or the C compilation options change!
const COUNTDOWN_START_BYTE_OFFSET: usize = 0x172;
const DEFAULT_START_VALUE: u8 = 22;

// Make sure that heap-allocated compiler data stays alive while the app is executing
struct AppIdentifiers {
    dummy: String,
}
const MOCK_HEAP_DATA: &str = "This is just some dummy string data";

extern "C" {
    pub fn webrepl_read_input(addr: *mut u8);
    pub fn webrepl_read_result(buffer_alloc_addr: *mut u8) -> usize;
    pub fn webrepl_write_output(addr: *const u8, size: usize);
}

// Use wasm_bindgen only where it adds a lot of value (e.g. async).
// It forces all return values from JS to be a generic `JsValue`, which is safe but slow.
#[wasm_bindgen]
extern "C" {
    pub async fn webrepl_execute(
        app_bytes_addr: *const u8,
        app_bytes_size: usize,
        app_memory_size_ptr: *mut usize,
    );
}

#[wasm_bindgen]
pub async fn webrepl_run(input_text_length: usize) -> bool {
    let arena = Bump::new();

    let result = run(&arena, input_text_length).await;
    let ok = result.is_ok();

    let output_text = match result {
        Err(s) => s,
        Ok(s) => s,
    };

    unsafe {
        webrepl_write_output(output_text.as_ptr(), output_text.len());
    }

    ok
}

async fn run(arena: &Bump, input_text_length: usize) -> Result<String, String> {
    // Ask JS to give us a copy of the user's input text
    let input_text: &mut [u8] = arena.alloc_slice_fill_default(input_text_length);
    unsafe {
        webrepl_read_input(input_text.as_mut_ptr());
    }

    // Compile the app
    let (app_bytes, identifiers) = compile(arena, input_text)?;

    // Execute the app (asynchronously in JS)
    let mut app_final_memory_size: usize = 0;
    let size_mut_ptr = (&mut app_final_memory_size) as *mut usize;
    webrepl_execute(app_bytes.as_ptr(), app_bytes.len(), size_mut_ptr).await;

    // Get the root address of the result in the app's memory, and a copy of its memory buffer
    let app_memory_copy: &mut [u8] = arena.alloc_slice_fill_default(app_final_memory_size);
    let app_result_addr = unsafe { webrepl_read_result(app_memory_copy.as_mut_ptr()) };

    // Get a String representation of the result value
    let output_text = stringify(app_memory_copy, app_result_addr, identifiers);

    Ok(output_text)
}

fn compile<'a>(arena: &'a Bump, input_text: &[u8]) -> Result<(&'a [u8], AppIdentifiers), String> {
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

    let fake_type_info = AppIdentifiers {
        dummy: MOCK_HEAP_DATA.to_string(),
    };

    Ok((app_copy, fake_type_info))
}

fn stringify(app_memory_copy: &[u8], app_result_addr: usize, idents: AppIdentifiers) -> String {
    // Get the bytes of the app's result struct (C ByteArray)
    let result = &app_memory_copy[app_result_addr..];

    // Parse the length of the C ByteArray
    let mut length_bytes: [u8; 4] = Default::default();
    length_bytes.copy_from_slice(&result[0..4]);
    let length = u32::from_le_bytes(length_bytes) as usize;

    assert_eq!(idents.dummy, MOCK_HEAP_DATA);

    // Stringify the numbers
    let numbers = &result[4..][0..length];
    format!("{:?}", numbers)
}
