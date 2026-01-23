import type * as IOpenAPISpec32 from "openapi-schema-type";

/**
 * 将字符串转换为驼峰格式
 */
function toCamelCase(str: string): string {
    return str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toUpperCase() : word.toUpperCase();
        })
        .replace(/\s+/g, "")
        .replace(/-/g, "")
        .replace(/_/g, "");
}

/**
 * 将 OpenAPI 类型映射为 TypeScript 类型
 */
function mapOpenApiTypeToTsType(schema: IOpenAPISpec32.SchemaObject): string {
    // 优先检查 enum，因为它可能同时有 type 和 enum
    if (schema.enum) {
        return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
    }

    if (schema.$ref) {
        // 处理引用，例如 #/components/schemas/Model
        const refPath = schema.$ref.split("/");
        const schemaName = refPath[refPath.length - 1];
        if (schemaName) {
            return `I${toCamelCase(schemaName)}`;
        }
    }

    if (schema.oneOf || schema.anyOf || schema.allOf) {
        const schemas = [
            ...(schema.oneOf || []),
            ...(schema.anyOf || []),
            ...(schema.allOf || []),
        ];
        const types = schemas
            .map((s) =>
                mapOpenApiTypeToTsType(s as IOpenAPISpec32.SchemaObject),
            )
            .join(schema.allOf ? " & " : " | ");
        return `(${types})`;
    }

    if (schema.type) {
        switch (schema.type) {
            case "string":
                return "string";
            case "number":
            case "integer":
                return "number";
            case "boolean":
                return "boolean";
            case "array": {
                const itemType = schema.items
                    ? mapOpenApiTypeToTsType(
                        schema.items as IOpenAPISpec32.SchemaObject,
                    )
                    : "unknown";
                return `${itemType}[]`;
            }
            case "object":
                if (schema.properties) {
                    const properties: string[] = [];
                    const required = new Set(schema.required || []);

                    Object.entries(schema.properties).forEach(
                        ([propName, propSchema]) => {
                            const isRequired = required.has(propName);
                            const propType = mapOpenApiTypeToTsType(
                                propSchema as IOpenAPISpec32.SchemaObject,
                            );
                            const optional = isRequired ? "" : "?";
                            const comment = generatePropertyComment(
                                propSchema as IOpenAPISpec32.SchemaObject,
                            );
                            properties.push(
                                `${comment}    ${propName}${optional}: ${propType};`,
                            );
                        },
                    );

                    return `{\n${properties.join("\n")}\n}`;
                }
                return "Record<string, unknown>";
            default:
                return "unknown";
        }
    }

    return "unknown";
}

/**
 * 生成属性注释
 */
function generatePropertyComment(schema: IOpenAPISpec32.SchemaObject): string {
    const comments: string[] = [];

    if (schema.description) {
        comments.push(`    /**`);
        comments.push(` * ${schema.description}`);
        if ("example" in schema && schema.example !== undefined) {
            comments.push(` * @example: ${schema.example}`);
        }
        comments.push(` */`);
    }

    return comments.length > 0 ? `${comments.join("\n    ")}\n` : "    ";
}

/**
 * 生成 Schema 的 TypeScript 类型定义
 */
export function renderSchema(
    key: string,
    schema: IOpenAPISpec32.SchemaObject,
): { path: string; code: string } {
    const typeName = `I${toCamelCase(key)}`;
    const tsType = mapOpenApiTypeToTsType(schema);

    let code = "";
    if (schema.description) {
        code += `/**\n * ${schema.description}\n */\n`;
    }
    code += `export type ${typeName} = ${tsType};\n`;

    return {
        path: `schemas/${key.toLowerCase()}.ts`,
        code,
    };
}
