import type { NamingStrategy } from "./types";

function toCamelCase(str: string): string {
    return str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toUpperCase() : word.toUpperCase();
        })
        .replace(/\s+/g, "")
        .replace(/-/g, "")
        .replace(/_/g, "");
}

function pathToCamelCase(path: string): string {
    return path
        .split("/")
        .filter(Boolean)
        .map((segment) => {
            if (segment === "api") {
                return "";
            }
            if (segment.startsWith(":") || segment.includes("{")) {
                return "";
            }
            return segment.charAt(0).toUpperCase() + segment.slice(1);
        })
        .join("");
}

export const defaultNamingStrategy: NamingStrategy = {
    typePrefix: "I",

    toTypeName(key: string): string {
        return `I${toCamelCase(key)}`;
    },

    toFunctionName(path: string, method: string): string {
        const methodPrefix = method.toLowerCase();
        const pathCamelCase = pathToCamelCase(path);
        return `${methodPrefix}${pathCamelCase}`;
    },

    toParamTypeName(path: string, method: string): string {
        const pathCamelCase = pathToCamelCase(path);
        const methodPrefix = method.toLowerCase();
        return `${this.typePrefix}ApiReqParam${methodPrefix.charAt(0).toUpperCase() + methodPrefix.slice(1)}${pathCamelCase}`;
    },

    toBodyTypeName(path: string, method: string): string {
        const pathCamelCase = pathToCamelCase(path);
        const methodPrefix = method.toLowerCase();
        return `${this.typePrefix}ApiReqData${methodPrefix.charAt(0).toUpperCase() + methodPrefix.slice(1)}${pathCamelCase}`;
    },
};
