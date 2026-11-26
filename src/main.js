// --- Prism Code Editor ---
import { createEditor } from "prism-code-editor";
import "prism-code-editor/layout.css";
import "prism-code-editor/themes/github-dark.css";   // el tema que uses hoy

// Lenguaje: cada uno se importa por separado (tree-shaking)
import "prism-code-editor/prism/languages/asm6502";

// Extensiones que uses hoy, por ejemplo:
// import "prism-code-editor/search.css";
// import { matchBrackets } from "prism-code-editor/match-brackets";

// --- Tu app ---
import { assemble } from "./assembler.js";
import { renderAssemblyTable } from "./assembly-table.js";   // tus módulos reales

import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

const editor = createEditor('#editor', {
  language: 'asm6502',
  theme: 'github-dark',
  class: 'code',
  value: 'LDA #$02 \n\
STA $02 \n\
LDA #$34    ; Valor inmediato  \n\
LDA #$34    ; Valor inmediato  \n\
STA $0190 \n\
LDA #300    ; Valor fuera de rango para el modo INM: 300 \n\
LDA #$B6 \n\
LDA %10100101 ; Probando el binario \n\
LDY #$00 \n\
hola mundo  ; Instrucción inválida: hola mundo \n\
STA ($01),Y \n\
loop:   ; Defino una etiqueta \n\
INY \n\
STA ($01),Y \n\
BBB #$45  ;Instrucción desconocida: BBB \n\
LDA 15 \n\
BCC loop \n\
INY $45 ; Modo ZP no válido para INY',
});

const output = document.getElementById("output");
const errorslist = document.getElementById("errors");

document.getElementById("assemble").addEventListener("click", () => {
  const { result, errors } = assemble(editor.value);

  output.replaceChildren(renderAssemblyTable(result));

  // Las líneas con error no salen en la tabla: se listan aparte
  errorslist.replaceChildren(
    ...errors
      .map(({ lineno, src, err }) => {

        editor.lines[lineno].classList.add('highlighted');

        const li = document.createElement("li");
        li.textContent = `Línea ${lineno}: ${err} (${src})`;
        return li;
      })
  );
});