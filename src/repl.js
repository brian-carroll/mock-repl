// wasm_bindgen's JS code expects our imported functions to be global
window.js_create_app = js_create_app;
window.js_run_app = js_run_app;
window.js_get_result_and_memory = js_get_result_and_memory;
import * as mock_repl from "./mock_repl.js";

// ----------------------------------------------------------------------------
// REPL state
// ----------------------------------------------------------------------------

const repl = {
  elemHistory: document.getElementById("history-text"),
  elemSourceInput: document.getElementById("source-input"),

  inputQueue: [],
  inputHistory: [],

  textDecoder: new TextDecoder(),
  textEncoder: new TextEncoder(),

  compiler: null,
  app: null,

  // Temporary storage for values passing back and forth between JS and Wasm
  result: { addr: 0, buffer: new ArrayBuffer() },
};

// Initialise
repl.elemSourceInput.addEventListener("change", onInputChange);
mock_repl.default().then((instance) => {
  repl.compiler = instance;
});

// ----------------------------------------------------------------------------
// Handle inputs
// ----------------------------------------------------------------------------

function onInputChange(event) {
  const inputText = event.target.value;
  event.target.value = "";

  repl.inputQueue.push(inputText);
  if (repl.inputQueue.length === 1) {
    processInputQueue();
  }
}

// Use a queue just in case we somehow get inputs very fast
// This is definitely an edge case, but maybe could happen from copy/paste?
// It allows us to rely on having only one input at a time
async function processInputQueue() {
  while (repl.inputQueue.length) {
    const inputText = repl.inputQueue[0];
    const historyIndex = createHistoryEntry(inputText);

    let outputText;
    let ok = true;
    try {
      outputText = await mock_repl.webrepl_run(inputText);
    } catch (e) {
      outputText = `${e}`;
      ok = false;
    }

    updateHistoryEntry(historyIndex, ok, outputText);
    repl.inputQueue.shift();
  }
}

// ----------------------------------------------------------------------------
// Callbacks to JS from Rust
// ----------------------------------------------------------------------------

// Create an executable Wasm instance from an array of bytes
// (Browser validates the module and does the final compilation to the host's machine code.)
async function js_create_app(wasm_module_bytes) {
  const { instance } = await WebAssembly.instantiate(wasm_module_bytes);
  repl.app = instance;
}

// Call the main function of the app, via the test wrapper
// Cache the result and return the size of the app's memory
function js_run_app() {
  const { run, memory } = repl.app.exports;
  const addr = run();
  const { buffer } = memory;
  repl.result = { addr, buffer };

  // Tell Rust how much space to reserve for its copy of the app's memory buffer.
  // This is not predictable, since the app can resize its own memory via malloc.
  return buffer.byteLength;
}

// After the Rust app has allocated space for the app's memory buffer,
// it calls this function and we copy it, and return the result too
function js_get_result_and_memory(buffer_alloc_addr) {
  const { addr, buffer } = repl.result;
  const appMemory = new Uint8Array(buffer);
  const compilerMemory = new Uint8Array(repl.compiler.memory.buffer);
  compilerMemory.set(appMemory, buffer_alloc_addr);
  return addr;
}

// ----------------------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------------------

function createHistoryEntry(inputText) {
  const historyIndex = repl.inputHistory.length;
  repl.inputHistory.push(inputText);

  const inputElem = document.createElement("div");
  inputElem.textContent = "> " + inputText;
  inputElem.classList.add("input");

  const historyItem = document.createElement("div");
  historyItem.appendChild(inputElem);

  repl.elemHistory.appendChild(historyItem);
  repl.elemHistory.scrollTop = repl.elemHistory.scrollHeight;

  return historyIndex;
}

function updateHistoryEntry(index, ok, outputText) {
  const outputElem = document.createElement("div");
  outputElem.textContent = outputText;
  outputElem.classList.add("output");
  outputElem.classList.add(ok ? "output-ok" : "output-error");

  const historyItem = repl.elemHistory.childNodes[index];
  historyItem.appendChild(outputElem);

  repl.elemHistory.scrollTop = repl.elemHistory.scrollHeight;
}
