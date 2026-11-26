// Genera una tabla HTML con el resultado de assemble().
//
// El HTML de la tabla vive en un <template> (ver assembly-table.template.html):
//   - el <thead> define las columnas,
//   - la fila <tr data-row> es el prototipo que se repite por cada instrucción,
//   - cada celda indica qué dato muestra con data-field="...".


const hex = (value, digits = 2) =>
    value.toString(16).toUpperCase().padStart(digits, "0");

const hexBytes = (bytes) => bytes.map((byte) => hex(byte)).join(" ");


// Convierte una entrada de assemble() en el texto de cada columna.
export function toRow(entry) {
    return {
        lineno: entry.lineno,
        src: entry.src,
        nme: entry.nme,
        rawargs: entry.rawargs,
        mode: entry.mode,
        opcode: hex(entry.opcode),
        args: hexBytes(entry.args),
        label: entry.label ?? "",
        address: hex(entry.address, 4),
        asm: hexBytes(entry.asm)
    };
}


// clave: [corto, completo, hue del arcoíris (0-360)]
const MODE_INFO = {
    IMPL: ["Impl.", "Implícito", 0],
    INM: ["Inm.", "Inmediato", 40],
    ZP: ["ZP", "Página cero", 60],
    ZPX: ["ZP,X", "Página cero indexado por X", 80],
    ZPY: ["ZP,Y", "Página cero indexado por Y", 100],
    ABS: ["Abs.", "Absoluto", 180],
    ABSX: ["Abs,X", "Absoluto indexado por X", 190],
    ABSY: ["Abs,Y", "Absoluto indexado por Y", 200],
    INDX: ["Ind. X", "Indirecto indexado por X", 260],
    INDY: ["Ind. Y", "Indirecto indexado por Y", 280],
    REL: ["Rel.", "Relativo", 320],
};

function renderModePill(raw) {
    const code = String(raw ?? "").trim();
    if (!code) return null;

    const pill = document.createElement("span");
    pill.className = "mode-pill";

    const info = MODE_INFO[code.toUpperCase()];
    if (!info) {                       // modo desconocido: cápsula neutra
        pill.textContent = code;
        return pill;
    }

    const [short, long, hue] = info;
    pill.style.setProperty("--hue", hue);
    pill.title = long;                 // tooltip con el nombre completo

    for (const [cls, text] of [["m-mid", short], ["m-long", long]]) {
        const span = document.createElement("span");
        span.className = cls;
        span.textContent = text;
        pill.append(span);
    }
    return pill;
}


// Devuelve un DocumentFragment con la tabla. Las líneas con error no se incluyen.
//
//     container.replaceChildren(renderAssemblyTable(assemble(code)));
//
export function renderAssemblyTable(
    instructions,
    template = document.getElementById("assembly-table-template")
) {
    if (!template) {
        throw new Error("No se encontró el <template id=\"assembly-table-template\">");
    }

    const fragment = template.content.cloneNode(true);
    const tbody = fragment.querySelector("tbody");
    const prototype = tbody.querySelector("tr[data-row]");

    if (!prototype) {
        throw new Error("El template no tiene una fila <tr data-row>");
    }

    prototype.remove();


    console.log(instructions);

    instructions
        .filter((entry) => !entry.err)
        .forEach((entry) => {
            const row = toRow(entry);
            const tr = prototype.cloneNode(true);

            tr.removeAttribute("data-row");
            tr.dataset.lineno = entry.lineno;      // para relacionar la fila con
            tr.dataset.address = row.address;      // el código fuente / la ejecución

            for (const cell of tr.querySelectorAll("[data-field]")) {
                if (cell.dataset.field === "mode") {
                    const pill = renderModePill(row.mode);
                    cell.replaceChildren(...(pill ? [pill] : []));
                } else {
                    cell.textContent = row[cell.dataset.field] ?? "";
                }
            }

            tbody.append(tr);
        });

    return fragment;
}