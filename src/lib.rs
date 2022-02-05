mod generated_app_bytes;

use bumpalo::Bump;
use generated_app_bytes::APP;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;

// Manually update these constants whenever app.c or the C compilation options change!
const COUNTDOWN_START_BYTE_OFFSET: usize = 0x172;
const DEFAULT_START_VALUE: u8 = 22;

// Make sure that heap-allocated compiler data stays alive while the app is executing
struct AppIdentifiers {
    dummy: String,
}
const MOCK_HEAP_DATA: &str = "This is just some dummy string data";

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(catch)]
    pub async fn js_create_app(wasm_module_bytes: &[u8]) -> Result<(), JsValue>;

    #[wasm_bindgen(catch)]
    pub fn js_run_app() -> Result<usize, JsValue>;

    pub fn js_get_result_and_memory(buffer_alloc_addr: *mut u8) -> usize;
}

#[wasm_bindgen]
pub async fn webrepl_run(input_text: String) -> Result<String, String> {
    let arena = &Bump::new();

    let (app_bytes, identifiers) = compile(arena, input_text)?;

    js_create_app(app_bytes)
        .await
        .map_err(|js| format!("{:?}", js))?;

    let app_final_memory_size: usize = js_run_app().map_err(|js| format!("{:?}", js))?;

    // Get the address of the result in the app's memory, and a copy of its memory buffer
    let app_memory_copy: &mut [u8] = arena.alloc_slice_fill_default(app_final_memory_size);
    let app_result_addr = js_get_result_and_memory(app_memory_copy.as_mut_ptr());

    // Create a String representation of the result value
    let output_text = stringify(app_memory_copy, app_result_addr, identifiers);

    Ok(output_text)
}

/// Compile the user's input code to a Wasm binary and some metadata
/// This is fake and will be replaced in the final version
fn compile(arena: &Bump, input_text: String) -> Result<(&[u8], AppIdentifiers), String> {
    if APP[COUNTDOWN_START_BYTE_OFFSET] != DEFAULT_START_VALUE {
        panic!(
            "Template app.wasm changed! Did not find start value {} at offset 0x{:x}\n",
            DEFAULT_START_VALUE, COUNTDOWN_START_BYTE_OFFSET
        );
    }

    let countdown_start = input_text.parse::<u8>().map_err(|e| format!("{:?}", e))?;

    let app_copy = arena.alloc_slice_copy(APP);
    app_copy[COUNTDOWN_START_BYTE_OFFSET] = countdown_start;

    let fake_types_and_names = AppIdentifiers {
        dummy: MOCK_HEAP_DATA.to_string(),
    };

    Ok((app_copy, fake_types_and_names))
}

/// Create a String representation of the result value from the app
/// This is fake and will be replaced in the final version
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
