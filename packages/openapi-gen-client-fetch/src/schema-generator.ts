import type * as IOpenAPISpec32 from "openapi-schema-type";
import type { OpenapiGenCodeOptions, SchemaRenderer } from "./types";

function mapOpenApiTypeToTsType(
    schema: IOpenAPISpec32.SchemaObject,
    schemas: Record<string, IOpenAPISpec32.SchemaObject>,
    options: OpenapiGenCodeOptions,
): string {
    if (schema.enum) {
        return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
    }

    if (schema.$ref) {
        const schemaName = schema.$ref.replace("#/components/schemas/", "");
        const refTargetSchema = schemas[schemaName];
        if (schemaName) {
            return options.toSchemaTypeName(schemaName, refTargetSchema?.title);
        }
    }

    if (schema.oneOf || schema.anyOf || schema.allOf) {
        const unionTypesShemas = [
            ...(schema.oneOf || []),
            ...(schema.anyOf || []),
            ...(schema.allOf || []),
        ];
        const types = unionTypesShemas
            .map((s) =>
                mapOpenApiTypeToTsType(
                    s as IOpenAPISpec32.SchemaObject,
                    schemas,
                    options,
                ),
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
                          schemas,
                          options,
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
                                schemas,
                                options,
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
    schemas: Record<string, IOpenAPISpec32.SchemaObject>,
    options: OpenapiGenCodeOptions,
): { path: string; code: string } => {
    const schema = schemas[key] as IOpenAPISpec32.SchemaObject;
    const name = schema.title || key;
    const typeName = options.toSchemaTypeName(key, schema.title);
    const tsType = mapOpenApiTypeToTsType(schema, schemas, options);

    let code = "";
    if (schema.description) {
        code += `/**\n * ${schema.description}\n */\n`;
    }
    code += `export type ${typeName} = ${tsType};\n`;

    return {
        path: `schemas/${name.toLowerCase()}.ts`,
        code,
    };
};
