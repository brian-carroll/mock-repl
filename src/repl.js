window.webrepl_execute = webrepl_execute;
window.webrepl_read_result = webrepl_read_result;
import * as mock_repl from "./mock_repl.js";

// REPL state
const repl = {
  elemHistory: document.getElementById("history-text"),
  elemSourceInput: document.getElementById("source-input"),

  inputHistory: [],
  textDecoder: new TextDecoder(),
  textEncoder: new TextEncoder(),

  compiler: null,

  // Temporary storage for values passing back and forth between JS and Wasm
  result: { addr: 0, buffer: new ArrayBuffer() },
};

// Initialise
repl.elemSourceInput.addEventListener("change", onPressEnter);
mock_repl.default().then((instance) => {
  repl.compiler = instance;
});

async function webrepl_execute(app_bytes, app_memory_size_ptr) {
  const { instance: app } = await WebAssembly.instantiate(app_bytes);

  const addr = app.exports.run();
  const { buffer } = app.exports.memory;
  repl.result = { addr, buffer };

  // Tell the compiler how large the app's memory is
  // The app can grow its heap arbitrarily while running
  // Write directly to memory to avoid having to convert from JsValue
  const compilerMemory32 = new Uint32Array(repl.compiler.memory.buffer);
  compilerMemory32[app_memory_size_ptr >> 2] = buffer.byteLength;
}

function webrepl_read_result(buffer_alloc_addr) {
  const { addr, buffer } = repl.result;
  const appMemory = new Uint8Array(buffer);
  const compilerMemory8 = new Uint8Array(repl.compiler.memory.buffer);
  compilerMemory8.set(appMemory, buffer_alloc_addr);
  return addr;
}

let locked = false;
async function onPressEnter(event) {
  if (locked) return;
  locked = true;
  const inputText = event.target.value;
  event.target.value = "";

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
  locked = false;
}

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
