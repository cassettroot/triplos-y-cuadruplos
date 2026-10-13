function tokenizar(cadena) {
    const tokens = [];
    let i = 0;

    while (i < cadena.length) {
        const char = cadena[i];

        if (/\s/.test(char) || char === ';') {
            i++;
            continue;
        }

        if (/[a-zA-Z_]/.test(char)) {
            const resto = cadena.slice(i);
            const match = resto.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)[0];
            tokens.push({ type: 'ID', value: match });
            i += match.length;
            continue;
        }

        if (/[0-9]/.test(char)) {
            const resto = cadena.slice(i);
            const match = resto.match(/^[0-9]+(\.[0-9]+)?/)[0];
            tokens.push({ type: 'NUM', value: match });
            i += match.length;
            continue;
        }

        if (char === '=') {
            tokens.push({ type: 'ASSIGN', value: '=' });
            i++;
            continue;
        }

        if (char === '(' || char === ')') {
            tokens.push({ type: 'PAREN', value: char });
            i++;
            continue;
        }

        if ('+-*/%^'.includes(char)) {
            if (char === '-') {
                const prev = tokens[tokens.length - 1];
                if (!prev || prev.value === '(' || prev.type === 'OP' || prev.type === 'ASSIGN') {
                    tokens.push({ type: 'UNARY_MINUS', value: 'neg' });
                    i++;
                    continue;
                }
            }
            tokens.push({ type: 'OP', value: char });
            i++;
            continue;
        }

        throw new Error(`Carácter no válido: "${char}"`);
    }

    return tokens;
}

function generarCodigo(tokens) {
    if (!tokens || tokens.length === 0) {
        throw new Error("Ingresa una expresión matemática.");
    }

    let variableDestino = null;
    let tokensExp = tokens;

    if (tokens.length >= 2 && tokens[0].type === 'ID' && tokens[1].type === 'ASSIGN') {
        variableDestino = tokens[0].value;
        tokensExp = tokens.slice(2);
    }

    if (tokensExp.length === 0) {
        throw new Error("Falta la expresión después del signo '='.");
    }

    const precedencia = {
        '+': 1, '-': 1,
        '*': 2, '/': 2, '%': 2,
        '^': 3,
        'neg': 4
    };

    const salida = [];
    const pilaOp = [];

    for (let i = 0; i < tokensExp.length; i++) {
        const token = tokensExp[i];

        if (token.type === 'ID' || token.type === 'NUM') {
            salida.push(token);
        } else if (token.value === '(') {
            pilaOp.push(token);
        } else if (token.value === ')') {
            let apertura = false;
            while (pilaOp.length > 0) {
                const tope = pilaOp.pop();
                if (tope.value === '(') {
                    apertura = true;
                    break;
                }
                salida.push(tope);
            }
            if (!apertura) {
                throw new Error("Paréntesis de cierre ')' sin apertura.");
            }
        } else if (token.type === 'OP' || token.type === 'UNARY_MINUS') {
            const precActual = precedencia[token.value] || 0;
            while (pilaOp.length > 0) {
                const tope = pilaOp[pilaOp.length - 1];
                if (tope.value === '(') break;
                const precTope = precedencia[tope.value] || 0;

                if (precTope >= precActual && token.value !== 'neg' && token.value !== '^') {
                    salida.push(pilaOp.pop());
                } else if (precTope > precActual) {
                    salida.push(pilaOp.pop());
                } else {
                    break;
                }
            }
            pilaOp.push(token);
        }
    }

    while (pilaOp.length > 0) {
        const op = pilaOp.pop();
        if (op.value === '(' || op.value === ')') {
            throw new Error("Paréntesis no balanceados.");
        }
        salida.push(op);
    }

    const cuadruplos = [];
    const triplos = [];
    const pilaOperando = [];
    let contTemp = 1;

    for (const token of salida) {
        if (token.type === 'ID' || token.type === 'NUM') {
            pilaOperando.push({
                nombre: token.value,
                puntero: token.value
            });
        } else if (token.type === 'UNARY_MINUS') {
            if (pilaOperando.length < 1) throw new Error("Operador unario sin operando.");
            const op1 = pilaOperando.pop();
            const temp = `T${contTemp++}`;
            const idx = triplos.length + 1;

            cuadruplos.push({
                op: 'neg',
                arg1: op1.nombre,
                arg2: '-',
                res: temp,
                fn: (vals, tMap) => {
                    const v = resolver(op1.nombre, vals, tMap);
                    return v !== null ? -v : null;
                }
            });

            triplos.push({
                idx: `(${idx})`,
                op: 'neg',
                arg1: op1.puntero,
                arg2: '-',
                fn: (vals, trMap) => {
                    const v = resolverTriplo(op1.puntero, vals, trMap);
                    return v !== null ? -v : null;
                }
            });

            pilaOperando.push({ nombre: temp, puntero: `(${idx})` });
        } else if (token.type === 'OP') {
            if (pilaOperando.length < 2) throw new Error(`Operador "${token.value}" sin operandos.`);
            const b = pilaOperando.pop();
            const a = pilaOperando.pop();
            const temp = `T${contTemp++}`;
            const idx = triplos.length + 1;

            cuadruplos.push({
                op: token.value,
                arg1: a.nombre,
                arg2: b.nombre,
                res: temp,
                fn: (vals, tMap) => {
                    const va = resolver(a.nombre, vals, tMap);
                    const vb = resolver(b.nombre, vals, tMap);
                    return operar(token.value, va, vb);
                }
            });

            triplos.push({
                idx: `(${idx})`,
                op: token.value,
                arg1: a.puntero,
                arg2: b.puntero,
                fn: (vals, trMap) => {
                    const va = resolverTriplo(a.puntero, vals, trMap);
                    const vb = resolverTriplo(b.puntero, vals, trMap);
                    return operar(token.value, va, vb);
                }
            });

            pilaOperando.push({ nombre: temp, puntero: `(${idx})` });
        }
    }

    if (pilaOperando.length !== 1) {
        throw new Error("Expresión inválida.");
    }

    const opFinal = pilaOperando.pop();

    if (variableDestino) {
        const idx = triplos.length + 1;
        cuadruplos.push({
            op: '=',
            arg1: opFinal.nombre,
            arg2: '-',
            res: variableDestino,
            fn: (vals, tMap) => resolver(opFinal.nombre, vals, tMap)
        });

        triplos.push({
            idx: `(${idx})`,
            op: '=',
            arg1: variableDestino,
            arg2: opFinal.puntero,
            fn: (vals, trMap) => resolverTriplo(opFinal.puntero, vals, trMap)
        });
    }

    const varsRequeridas = new Set();
    for (const t of tokensExp) {
        if (t.type === 'ID') varsRequeridas.add(t.value);
    }

    return {
        destino: variableDestino || opFinal.nombre,
        variables: Array.from(varsRequeridas),
        cuadruplos,
        triplos
    };
}

function resolver(nom, vals, temps) {
    if (!isNaN(nom)) return Number(nom);
    if (temps && temps[nom] !== undefined && temps[nom] !== null) return temps[nom];
    if (vals && vals[nom] !== undefined && vals[nom] !== "" && !isNaN(vals[nom])) return Number(vals[nom]);
    return null;
}

function resolverTriplo(ref, vals, trs) {
    if (ref.startsWith('(') && ref.endsWith(')')) {
        const idx = ref.slice(1, -1);
        if (trs && trs[idx] !== undefined && trs[idx] !== null) return trs[idx];
    }
    if (!isNaN(ref)) return Number(ref);
    if (vals && vals[ref] !== undefined && vals[ref] !== "" && !isNaN(vals[ref])) return Number(vals[ref]);
    return null;
}

function operar(op, a, b) {
    if (a === null || b === null) return null;
    a = Number(a);
    b = Number(b);
    switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b !== 0 ? a / b : NaN;
        case '%': return a % b;
        case '^': return Math.pow(a, b);
        default: return null;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const inputExp = document.getElementById("expresion");
    const btnCalc = document.getElementById("btn-calcular");
    const btnLimp = document.getElementById("btn-limpiar");
    const secVars = document.getElementById("seccion-variables");
    const contVars = document.getElementById("contenedor-variables");
    const areaRes = document.getElementById("area-resultados");
    const resFinal = document.getElementById("res-final");
    const msgError = document.getElementById("mensaje-error");
    const tCuad = document.getElementById("tabla-cuadruplos");
    const tTrip = document.getElementById("tabla-triplos");

    let valoresVars = {};

    function error(txt) {
        msgError.textContent = txt;
        msgError.classList.remove("d-none");
        areaRes.classList.add("d-none");
    }

    function limpiarError() {
        msgError.classList.add("d-none");
        msgError.textContent = "";
    }

    function renderizarVariables(listaVars) {
        contVars.innerHTML = "";
        if (listaVars.length === 0) {
            secVars.classList.add("d-none");
            return;
        }

        secVars.classList.remove("d-none");
        listaVars.forEach(v => {
            const val = valoresVars[v] !== undefined ? valoresVars[v] : "";
            valoresVars[v] = val;

            const div = document.createElement("div");
            div.className = "d-flex align-items-center gap-1 bg-white border px-2 py-1 rounded";
            div.innerHTML = `
                <label for="v-${v}" class="fw-bold mb-0">${v} =</label>
                <input type="number" id="v-${v}" data-var="${v}" class="form-control form-control-sm text-center" 
                    value="${val}" placeholder="Valor" style="width: 70px;">
            `;
            contVars.appendChild(div);
        });

        contVars.querySelectorAll("input").forEach(inp => {
            inp.addEventListener("input", (e) => {
                const nom = e.target.getAttribute("data-var");
                const val = e.target.value.trim();
                valoresVars[nom] = val === "" ? null : Number(val);
                calcular();
            });
        });
    }

    function calcular() {
        limpiarError();
        const texto = inputExp.value.trim();

        if (!texto) {
            error("Por favor, ingresa una operación matemática.");
            return;
        }

        try {
            const tokens = tokenizar(texto);
            const res = generarCodigo(tokens);

            if (contVars.children.length !== res.variables.length) {
                renderizarVariables(res.variables);
            }

            contVars.querySelectorAll("input").forEach(inp => {
                const nom = inp.getAttribute("data-var");
                const val = inp.value.trim();
                valoresVars[nom] = val === "" ? null : Number(val);
            });

            const tMap = {};
            tCuad.innerHTML = res.cuadruplos.map((c, i) => {
                const v = c.fn(valoresVars, tMap);
                if (c.res.startsWith('T')) tMap[c.res] = v;
                const vStr = v === null ? '-' : (Number.isInteger(v) ? v : Number(v.toFixed(4)));

                return `
                    <tr>
                        <td class="text-muted">${i + 1}</td>
                        <td class="fw-bold text-primary">${c.op}</td>
                        <td>${c.arg1}</td>
                        <td>${c.arg2}</td>
                        <td class="fw-bold text-success">${c.res}</td>
                        <td class="fw-bold">${vStr}</td>
                    </tr>
                `;
            }).join("");

            const trMap = {};
            tTrip.innerHTML = res.triplos.map((t, i) => {
                const idx = i + 1;
                const v = t.fn(valoresVars, trMap);
                trMap[idx] = v;
                const vStr = v === null ? '-' : (Number.isInteger(v) ? v : Number(v.toFixed(4)));

                return `
                    <tr>
                        <td class="text-secondary fw-bold">(${idx})</td>
                        <td class="fw-bold text-primary">${t.op}</td>
                        <td>${t.arg1}</td>
                        <td>${t.arg2}</td>
                        <td class="fw-bold">${vStr}</td>
                    </tr>
                `;
            }).join("");

            const ultCuad = res.cuadruplos[res.cuadruplos.length - 1];
            const vFin = ultCuad ? ultCuad.fn(valoresVars, tMap) : null;

            if (vFin === null) {
                resFinal.textContent = `Resultado: ${res.destino}`;
            } else {
                const num = Number.isInteger(vFin) ? vFin : Number(vFin.toFixed(4));
                resFinal.textContent = `Resultado: ${res.destino} = ${num}`;
            }

            areaRes.classList.remove("d-none");
        } catch (e) {
            error(e.message);
        }
    }

    btnCalc.addEventListener("click", () => {
        valoresVars = {};
        renderizarVariables([]);
        calcular();
    });

    inputExp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            valoresVars = {};
            renderizarVariables([]);
            calcular();
        }
    });

    btnLimp.addEventListener("click", () => {
        inputExp.value = "";
        valoresVars = {};
        secVars.classList.add("d-none");
        contVars.innerHTML = "";
        areaRes.classList.add("d-none");
        limpiarError();
        inputExp.focus();
    });
});
