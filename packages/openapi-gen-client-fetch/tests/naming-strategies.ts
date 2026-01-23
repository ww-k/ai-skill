import { defaultNamingStrategy } from "../src/naming-strategies";

export function toCamelCase(str: string): string {
    return str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toUpperCase() : word.toUpperCase();
        })
        .replace(/\s+/g, "")
        .replace(/-/g, "")
        .replace(/_/g, "");
}

export function pathToCamelCase(path: string): string {
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

export const testNamingStrategy = {
    typePrefix: defaultNamingStrategy.typePrefix,
    toTypeName: defaultNamingStrategy.toTypeName,
    toFunctionName: defaultNamingStrategy.toFunctionName,
    toParamTypeName: defaultNamingStrategy.toParamTypeName,
    toBodyTypeName: defaultNamingStrategy.toBodyTypeName,
    toCamelCase,
    pathToCamelCase,
};
