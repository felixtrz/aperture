/** Reads a function signature without splitting nested attributes or types. */
export function findWgslFunctionDeclaration(source, name) {
    const tokens = tokenizeWgsl(source);
    const index = tokens.findIndex((token, index) => token.text === "fn" && tokens[index + 1]?.text === name);
    if (index < 0 || tokens[index + 2]?.text !== "(")
        return null;
    let start = index;
    const attributes = [];
    const attributeSources = [];
    while (start > 0) {
        let previous = start - 1;
        const end = tokens[previous].end;
        if (tokens[previous]?.text === ")") {
            previous = matchingDelimiter(tokens, previous, -1) - 1;
        }
        if (tokens[previous - 1]?.text !== "@")
            break;
        attributes.unshift(tokens[previous].text);
        attributeSources.unshift(source.slice(tokens[previous - 1].start, end));
        start = previous - 1;
    }
    const open = index + 2;
    const close = matchingDelimiter(tokens, open, 1);
    const parameters = splitParameters(tokens.slice(open + 1, close)).map((parameter) => {
        let cursor = skipAttributes(parameter, 0).next;
        const name = parameter[cursor++]?.text;
        if (!name ||
            parameter[cursor++]?.text !== ":" ||
            cursor >= parameter.length) {
            throw new Error("Malformed WGSL function parameter declaration");
        }
        return {
            name,
            type: parameter
                .slice(cursor)
                .map((token) => token.text)
                .join(" "),
        };
    });
    let cursor = close + 1;
    if (tokens[cursor++]?.text !== "->")
        return null;
    const returnAttributes = skipAttributes(tokens, cursor);
    cursor = returnAttributes.next;
    const typeStart = cursor;
    while (cursor < tokens.length && tokens[cursor]?.text !== "{")
        cursor++;
    if (cursor >= tokens.length)
        throw new Error("WGSL function body missing");
    return {
        start: tokens[start].start,
        bodyStart: tokens[cursor].start,
        attributes,
        attributesSource: source
            .slice(tokens[start].start, tokens[index].start)
            .trim(),
        helperAttributesSource: attributeSources
            .filter((_attribute, index) => attributes[index] !== "fragment")
            .join("\n"),
        parametersSource: source.slice(tokens[open].end, tokens[close].start),
        parameters,
        returnType: tokens
            .slice(typeStart, cursor)
            .map((token) => token.text)
            .join(" "),
        returnAttributes: returnAttributes.names,
    };
}
function skipAttributes(tokens, index) {
    const names = [];
    while (tokens[index]?.text === "@") {
        const name = tokens[index + 1]?.text;
        if (!name)
            throw new Error("Malformed WGSL attribute");
        names.push(name);
        index += 2;
        if (tokens[index]?.text === "(")
            index = matchingDelimiter(tokens, index, 1) + 1;
    }
    return { next: index, names };
}
function matchingDelimiter(tokens, start, direction) {
    let depth = 0;
    for (let index = start; index >= 0 && index < tokens.length; index += direction) {
        const text = tokens[index].text;
        if (text === (direction === 1 ? "(" : ")"))
            depth++;
        if (text === (direction === 1 ? ")" : "("))
            depth--;
        if (depth === 0)
            return index;
    }
    throw new Error("Unbalanced WGSL attribute/function parentheses");
}
function splitParameters(tokens) {
    const parameters = [];
    let start = 0, parenDepth = 0, angleDepth = 0;
    for (let index = 0; index < tokens.length; index++) {
        const text = tokens[index].text;
        if (text === "(")
            parenDepth++;
        else if (text === ")")
            parenDepth--;
        else if (text === "<" && parenDepth === 0)
            angleDepth++;
        else if (text === ">" && parenDepth === 0)
            angleDepth--;
        else if (text === "," && parenDepth === 0 && angleDepth === 0) {
            if (index > start)
                parameters.push(tokens.slice(start, index));
            start = index + 1;
        }
    }
    if (start < tokens.length)
        parameters.push(tokens.slice(start));
    return parameters;
}
function tokenizeWgsl(source) {
    const tokens = [];
    for (let index = 0; index < source.length;) {
        if (/\s/u.test(source[index])) {
            index++;
            continue;
        }
        if (source.startsWith("//", index)) {
            const newline = source.indexOf("\n", index + 2);
            index = newline < 0 ? source.length : newline + 1;
            continue;
        }
        if (source.startsWith("/*", index)) {
            let depth = 1;
            index += 2;
            while (index < source.length && depth > 0) {
                if (source.startsWith("/*", index)) {
                    depth++;
                    index += 2;
                }
                else if (source.startsWith("*/", index)) {
                    depth--;
                    index += 2;
                }
                else
                    index++;
            }
            if (depth > 0)
                throw new Error("Unterminated WGSL comment");
            continue;
        }
        const start = index;
        if (/[A-Za-z_0-9]/u.test(source[index]))
            while (index < source.length && /[A-Za-z_0-9]/u.test(source[index]))
                index++;
        else
            index += source.startsWith("->", index) ? 2 : 1;
        tokens.push({ text: source.slice(start, index), start, end: index });
    }
    return tokens;
}
//# sourceMappingURL=wgsl-function-declaration.js.map