import { Opcodes } from "./opcodes.js";

const MODE_INDEX = {
    INM: 1,
    ZP: 2,
    ZPX: 3,
    ZPY: 4,
    ABS: 5,
    ABSX: 6,
    ABSY: 7,
    IND: 8,
    INDX: 9,
    INDY: 10,
    IMPL: 11,
    REL: 12
};

// Bytes de operando que ocupa cada modo (el tamaño de la instrucción es 1 + esto)
const OPERAND_SIZE = {
    IMPL: 0,
    INM: 1,
    ZP: 1,
    ZPX: 1,
    ZPY: 1,
    ABS: 2,
    ABSX: 2,
    ABSY: 2,
    IND: 2,
    INDX: 1,
    INDY: 1,
    REL: 1
};

// Si una instrucción no tiene variante de página cero (ej. LDA $10,Y),
// se usa la absoluta equivalente.
const ABSOLUTE_FALLBACK = {
    ZP: "ABS",
    ZPX: "ABSX",
    ZPY: "ABSY"
};

const ACCUMULATOR_OPS = ["ASL", "LSR", "ROL", "ROR"];

const DEFAULT_ORIGIN = 0x600;
const MEMORY_SIZE = 0x10000;

const LABEL_NAME = /^[a-z_]\w*$/i;


// --------------------------------------------------
// 1. PREPROCESAMIENTO
// --------------------------------------------------

function preprocess(code) {
    return code
        .split(/\r?\n/)
        .map((source, index) => ({
            lineno: index + 1,
            src: source.split(";")[0].trim()
        }))
        .filter(line => line.src.length > 0);
}


// --------------------------------------------------
// 2. ANÁLISIS (primer pase)
//    Determina el modo y el tamaño de cada instrucción, le asigna
//    su dirección y registra las etiquetas. Los valores que dependen
//    de una etiqueta se resuelven recién en el segundo pase.
// --------------------------------------------------

function analyze(lines, origin) {

    const instructions = [];
    const labels = new Map();
    let address = origin;
    let label = null;

    for (const {lineno, src} of lines) {

        let text = src;

        // Etiqueta al comienzo de la línea:  "loop:"  o  "loop: DEX"
        const labelMatch = text.match(/^([a-z_]\w*):\s*(.*)$/i);

        if (labelMatch) {
            label = labelMatch[1];

            if (labels.has(label)) {
                instructions.push({lineno, src, err: `Etiqueta duplicada: ${label}`});
                continue;
            }

            labels.set(label, address);
            text = labelMatch[2];
            // Línea que contiene solo la etiqueta
            if (!text) continue;
        }

        const instruction = analyzeInstruction(lineno, src, text);

        if (!instruction.err) {
            const size = 1 + OPERAND_SIZE[instruction.mode];

            if (address + size > MEMORY_SIZE) {
                instructions.push({lineno, src, err: "El programa excede la memoria (64K)"});
                continue;
            }

            instruction.address = address;
            
            if (label) instruction.label = label
            label = null

            address += size;
        }

        instructions.push(instruction);
    }

    return {instructions, labels};
}


function analyzeInstruction(lineno, src, text) {

    const match = text.match(/^([a-z]{3})(?:\s+(.+))?$/i);

    if (!match) {
        return {lineno, src, err: `Instrucción inválida: ${text}`};
    }

    const nme = match[1].toUpperCase();
    const row = Opcodes.find(row => row[0] === nme);

    if (!row) {
        return {lineno, src, err: `Instrucción desconocida: ${nme}`};
    }

    const rawargs = match[2]?.trim() ?? "";
    const {mode, operand} = parseOperand(nme, rawargs);

    

    let finalMode = mode;
    let opcode = row[MODE_INDEX[finalMode]];

    if ((opcode === null || opcode === undefined) && ABSOLUTE_FALLBACK[mode]) {
        finalMode = ABSOLUTE_FALLBACK[mode];
        opcode = row[MODE_INDEX[finalMode]];
    }

    if (opcode === null || opcode === undefined) {
        return {lineno, src, err: `Modo ${mode} no válido para ${nme}`};
    }

    return {lineno, src, nme, rawargs, mode: finalMode, opcode, operand};
}


// Devuelve el modo de direccionamiento y el operando "limpio"
// (sin '#', sin paréntesis y sin el índice ,X / ,Y).
function parseOperand(nme, text) {

    let match;

    // Sin operando, o acumulador (ASL A). Solo ASL/LSR/ROL/ROR tienen modo
    // acumulador; en el resto "A" puede ser una etiqueta (ej. BCC a).
    if (!text || (ACCUMULATOR_OPS.includes(nme) && /^A$/i.test(text))) {
        return {mode: "IMPL", operand: ""};
    }

    if ((match = text.match(/^#\s*(.+)$/))) {
        return {mode: "INM", operand: match[1].trim()};
    }

    if ((match = text.match(/^\(\s*(.+?)\s*,\s*X\s*\)$/i))) {
        return {mode: "INDX", operand: match[1]};
    }

    if ((match = text.match(/^\(\s*(.+?)\s*\)\s*,\s*Y$/i))) {
        return {mode: "INDY", operand: match[1]};
    }

    if ((match = text.match(/^\(\s*(.+?)\s*\)$/))) {
        return {mode: "IND", operand: match[1]};
    }

    if ((match = text.match(/^(.+?)\s*,\s*X$/i))) {
        return {mode: getAddressMode(match[1], "X"), operand: match[1]};
    }

    if ((match = text.match(/^(.+?)\s*,\s*Y$/i))) {
        return {mode: getAddressMode(match[1], "Y"), operand: match[1]};
    }

    if (isBranch(nme)) {
        return {mode: "REL", operand: text};
    }

    return {mode: getAddressMode(text), operand: text};
}


function isBranch(nme) {
    return [
        "BCC", "BCS", "BEQ", "BMI",
        "BNE", "BPL", "BVC", "BVS"
    ].includes(nme);
}


function getAddressMode(operand, index = "") {

    const number = parseNumber(operand);

    // Una etiqueta (number === null) siempre es una dirección absoluta.
    return (number !== null && number <= 0xFF ? "ZP" : "ABS") + index;
}


// --------------------------------------------------
// 3. CODIFICACIÓN (segundo pase)
//    Ya se conocen todas las etiquetas: se resuelven los operandos.
// --------------------------------------------------

// Devuelve el número, o null si el texto no es un literal numérico.
// Formatos: $FF (hexadecimal), %1010 (binario) y 255 (decimal).
function parseNumber(text) {

    const value = text.trim();

    if (/^\$[0-9a-f]+$/i.test(value)) return Number.parseInt(value.substring(1), 16);
    if (/^%[01]+$/.test(value))       return Number.parseInt(value.substring(1), 2);
    if (/^\d+$/.test(value))          return Number.parseInt(value, 10);

    return null;
}


function encodeOperand({mode, operand, address}, labels) {

    const size = OPERAND_SIZE[mode];

    if (size === 0) return [];

    let value = parseNumber(operand);

    if (value === null) {
        // Es una etiqueta. Solo se admite donde cabe una dirección de 16 bits
        // (o en un salto relativo, donde se convierte en un desplazamiento).
        if (mode !== "REL" && size !== 2) {
            throw new Error(`No se puede usar una etiqueta en modo ${mode}: ${operand}`);
        }

        if (!LABEL_NAME.test(operand)) {
            throw new Error(`Operando inválido: ${operand}`);
        }

        if (!labels.has(operand)) {
            throw new Error(`Etiqueta no definida: ${operand}`);
        }

        value = labels.get(operand);
    }

    if (mode === "REL") {
        // El desplazamiento es relativo a la dirección de la instrucción siguiente.
        const offset = value - (address + 2);

        if (offset < -128 || offset > 127) {
            throw new Error(`Salto fuera de rango (${offset}, el límite es -128 a +127): ${operand}`);
        }

        return [offset & 0xFF];
    }

    const max = size === 1 ? 0xFF : 0xFFFF;

    if (value > max) {
        throw new Error(`Valor fuera de rango para el modo ${mode}: ${operand}`);
    }

    return size === 1
        ? [value]
        : [value & 0xFF, (value >> 8) & 0xFF];
}


function encode(instructions, labels) {

    return instructions.map((instruction) => {

        const {lineno, src, nme, rawargs, mode, opcode, address, label, err} = instruction;

        if (err) return {lineno, src, err};

        try {
            const args = encodeOperand(instruction, labels);

            return {
                lineno, src,
                nme,
                rawargs,
                mode,
                opcode,
                address,
                label,
                args,
                asm: [opcode, ...args]
            };
        }
        catch (error) {
            return {lineno, src, err: error.message};
        }
    });
}


// --------------------------------------------------
// FUNCIÓN PRINCIPAL
// --------------------------------------------------

export function assemble(code, {origin = DEFAULT_ORIGIN} = {}) {
    const lines = preprocess(code);
    const {instructions, labels} = analyze(lines, origin);

    const result = encode(instructions, labels);

    return {
        errors: result.filter((entry) => entry.err),
        result: result.filter((entry) => !entry.err)
    }
}