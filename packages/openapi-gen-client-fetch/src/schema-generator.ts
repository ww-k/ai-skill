import type * as IOpenAPISpec32 from "openapi-schema-type";
import type { RendererOptions, SchemaRenderer } from "./types";

function mapOpenApiTypeToTsType(schema: IOpenAPISpec32.SchemaObject): string {
    if (schema.enum) {
        return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
    }

    if (schema.$ref) {
        const refPath = schema.$ref.split("/");
        const schemaName = refPath[refPath.length - 1];
        if (schemaName) {
            const typeName =
                schemaName.charAt(0).toUpperCase() + schemaName.slice(1);
            return `I${typeName}`;
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

export const renderSchema: SchemaRenderer = (
    key: string,
    schema: IOpenAPISpec32.SchemaObject,
    options: RendererOptions,
): { path: string; code: string } => {
    const typeName = options.namingStrategy.toTypeName(key);
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
};
