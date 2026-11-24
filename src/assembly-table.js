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
        mode: entry.mode,
        opcode: hex(entry.opcode),
        args: hexBytes(entry.args),
        label: entry.label ?? "",
        address: hex(entry.address, 4),
        asm: hexBytes(entry.asm)
    };
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

    instructions
        .filter((entry) => !entry.err)
        .forEach((entry) => {
            const row = toRow(entry);
            const tr = prototype.cloneNode(true);

            tr.removeAttribute("data-row");
            tr.dataset.lineno = entry.lineno;      // para relacionar la fila con
            tr.dataset.address = row.address;      // el código fuente / la ejecución

            for (const cell of tr.querySelectorAll("[data-field]")) {
                // textContent (no innerHTML): el código fuente del usuario no se interpreta como HTML
                cell.textContent = row[cell.dataset.field] ?? "";
            }

            tbody.append(tr);
        });

    return fragment;
}