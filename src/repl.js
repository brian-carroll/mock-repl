// REPL state
const repl = {
  elemHistory: document.getElementById("history-text"),
  elemSourceInput: document.getElementById("source-input"),

  inputHistory: [],
  textDecoder: new TextDecoder(),
  textEncoder: new TextEncoder(),

  compiler: null,

  // Temporary storage for values passing back and forth between JS and Wasm
  inputBytes: new Uint8Array(),
  result: { addr: 0, buffer: new ArrayBuffer() },
  outputBytes: new Uint8Array(),
};

// Initialise
repl.elemSourceInput.addEventListener("change", onPressEnter);
initCompiler("dist/compiler.wasm").then((instance) => {
  repl.compiler = instance;
});

// We need a getter for the compiler memory because whenever it grows,
// the JS ArrayBuffer becomes "detached" and replaced with a new one.
// The API seems to be designed to make us do this, as ArrayBuffer is not resizeable.
function getCompilerMemory() {
  return new Uint8Array(repl.compiler.exports.memory.buffer);
}

const compilerCallbacks = {
  webrepl_read_input: (addr) => {
    getCompilerMemory().set(repl.inputBytes, addr);
  },

  webrepl_execute: async (app_bytes_addr, app_bytes_size, app_memory_size_ptr) => {
    const compilerMemory = getCompilerMemory();

    // Use .subarray rather than .slice to avoid a copy, since .instantiate copies anyway.
    const app_bytes = compilerMemory.subarray(
      app_bytes_addr,
      app_bytes_addr + app_bytes_size
    );
    const { instance: app } = await WebAssembly.instantiate(app_bytes);

    const addr = app.exports.run();
    const { buffer } = app.exports.memory;
    repl.result = { addr, buffer };

    // Tell the compiler how large the app's memory is
    // - Remember, the app can grow its heap while running, by an unknowable amount.
    // - It has a completely separate ArrayBuffer
    // - We write the size into the compiler's memory, instead of returning a number,
    //    to avoid the overhead of wasm_bindgen's generic JsValue.
    const compilerMemory32 = new Uint32Array(compilerMemory.buffer);
    compilerMemory32[app_memory_size_ptr >> 2] = buffer.byteLength;
  },

  webrepl_read_result: (buffer_alloc_addr) => {
    const { addr, buffer } = repl.result;
    const appMemory = new Uint8Array(buffer);
    getCompilerMemory().set(appMemory, buffer_alloc_addr);
    return addr;
  },

  webrepl_write_output: (addr, size) => {
    // Make a copy of the output bytes, before the compiler drops all of its heap values
    repl.outputBytes = getCompilerMemory().slice(addr, addr + size);
  },

  // C-style main function. We don't use it, but the compiler Wasm module expects it to exist.
  main: (_argc, _argv) => 0,
};

async function initCompiler(filename) {
  const wasiLinkObject = {};
  const importObject = createFakeWasiImports(wasiLinkObject);
  importObject.env = compilerCallbacks;

  // Streaming API allows browser to start processing Wasm while the file is still loading.
  const responsePromise = fetch(filename);
  const { instance } = await WebAssembly.instantiateStreaming(
    responsePromise,
    importObject
  );

  wasiLinkObject.exports = instance.exports;

  return instance;
}

async function onPressEnter(event) {
  const { target } = event;
  const inputText = target.value;
  const historyIndex = createHistoryEntry(inputText);
  repl.inputBytes = repl.textEncoder.encode(inputText);

  target.value = "";
  target.disabled = true;
  const ok = await repl.compiler.exports.webrepl_run(repl.inputBytes.length);
  target.disabled = false;

  const outputText = repl.textDecoder.decode(repl.outputBytes);

  updateHistoryEntry(historyIndex, ok, outputText);
}

function createHistoryEntry(inputText) {
  const historyIndex = repl.inputHistory.push(inputText);

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
