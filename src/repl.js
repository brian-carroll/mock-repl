const elemSourceInput = document.getElementById("source-input");
const elemHistory = document.getElementById("history-text");
const historyArray = [];
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

const buffers = {
  inputText: new Uint8Array(),
  compilerResult: new Uint8Array(),
  appMemory: new Uint8Array(),
  outputText: new Uint8Array(),
};

let compiler;
loadCompiler("dist/compiler.wasm").then((instance) => {
  compiler = instance;
});

elemSourceInput.addEventListener("change", onPressEnter);

// We need a getter for the compiler memory because whenever it grows,
// the JS ArrayBuffer becomes "detached" and replaced with a new one.
// The ArrayBuffer interface object cannot be resized. I imagine the
// implementation doesn't actually move the bytes unless it has to?
function getCompilerMemory() {
  return new Uint8Array(compiler.exports.memory.buffer);
}

// -----------------------------------------------------------------

async function onPressEnter(event) {
  const { target } = event;
  const inputText = target.value;

  const { ok, app, error } = await compileApp(inputText);
  if (ok) {
    const resultAddr = app.exports.run();
    const outputText = stringifyResult(app, resultAddr);
    historyArray.push({ ok, inputText, outputText });
  } else {
    historyArray.push({ ok, inputText, outputText: error });
  }

  target.value = "";

  renderHistory();
}

// -----------------------------------------------------------------

async function loadCompiler(filename) {
  const wasiLinkObject = {};
  const importObject = createFakeWasiImports(wasiLinkObject);

  importObject.env = {
    main: (i32a, i32b) => 0,
    read_input_text: (dest) => {
      getCompilerMemory().set(buffers.inputText, dest);
    },
    write_compiler_result: (ok, src, size) => {
      // .slice creates a new buffer and copies the bytes
      const bytes = getCompilerMemory().slice(src, src + size);
      buffers.compilerResult = { ok: !!ok, bytes };
    },
    read_app_memory: (dest) => {
      getCompilerMemory().set(buffers.appMemory, dest);
    },
    write_output_text: (src, size) => {
      buffers.outputText = getCompilerMemory().slice(src, size + src);
    },
  };

  const responsePromise = fetch(filename);
  const { instance } = await WebAssembly.instantiateStreaming(
    responsePromise,
    importObject
  );

  wasiLinkObject.exports = instance.exports;

  return instance;
}

// -----------------------------------------------------------------

async function compileApp(inputText) {
  // Convert text to bytes and put it in a buffer for the compiler
  buffers.inputText = textEncoder.encode(inputText);

  // Compiler reads the inputText buffer and writes to the result buffer
  compiler.exports.compile_app(buffers.inputText.length);

  // Handle compiler success or error
  const { ok, bytes } = buffers.compilerResult;
  if (ok) {
    const { instance: app } = await WebAssembly.instantiate(bytes);
    return { ok, app, error: "" };
  } else {
    const error = textDecoder.decode(bytes);
    return { ok, app: null, error };
  }
}

// -----------------------------------------------------------------

function stringifyResult(app, appResultAddr) {
  // Put the app memory in a buffer where the compiler can find it
  buffers.appMemory = new Uint8Array(app.exports.memory.buffer);

  compiler.exports.stringify_app_result(
    buffers.appMemory.length,
    appResultAddr
  );

  // Compiler wrote the output string to another buffer
  return textDecoder.decode(buffers.outputText);
}

// -----------------------------------------------------------------

function renderHistory() {
  elemHistory.innerHTML = "";
  historyArray.forEach(({ ok, inputText, outputText }) => {
    const inputElem = document.createElement("div");
    const outputElem = document.createElement("div");

    inputElem.textContent = "> " + inputText;
    inputElem.classList.add("input");

    outputElem.textContent = outputText;
    outputElem.classList.add("output");
    outputElem.classList.add(ok ? "output-ok" : "output-error");

    elemHistory.appendChild(inputElem);
    elemHistory.appendChild(outputElem);
  });
  elemHistory.scrollTop = elemHistory.scrollHeight;
}
