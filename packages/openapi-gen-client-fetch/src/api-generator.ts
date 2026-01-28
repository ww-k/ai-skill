import { resolve } from "node:path";

import type * as IOpenAPISpec32 from "openapi-schema-type";
import type { OpenapiGenCodeOptions, PathItemRenderer } from "./types";

function isRealPathParam(
    param: IOpenAPISpec32.ParameterObject,
    path: string,
): boolean {
    if (param.in !== "path") return false;

    const pathParamPattern = new RegExp(`{\\s*${param.name}\\s*}`);
    return pathParamPattern.test(path);
}

function mapOpenApiTypeToTypeScript(openApiType: string): string {
    switch (openApiType) {
        case "integer":
        case "number":
            return "number";
        case "string":
            return "string";
        case "boolean":
            return "boolean";
        case "array":
            return "unknown[]";
        case "object":
            return "Record<string, unknown>";
        case "null":
            return "null";
        default:
            return openApiType;
    }
}

function generateParameterType(
    path: string,
    paramTypeName: string,
    parameters: IOpenAPISpec32.ParameterObject[],
): { typeDef: string; warnings: string[] } {
    const warnings: string[] = [];
    const properties: string[] = [];
    const required = new Set<string>();

    parameters.forEach((param) => {
        if (param.in === "path" && !isRealPathParam(param, path)) {
            warnings.push(
                `警告: 参数 '${param.name}' 标记为 path 参数，但路径 '${path}' 中没有对应的占位符。将被视为 query 参数处理。`,
            );
            // @ts-expect-error
            param.in = "query";
        }

        if (param.required) {
            required.add(param.name);
        }

        const isOptional = !param.required ? "?" : "";
        const paramComment = param.description
            ? `    /**\n     * ${param.description}\n${
                  param.example ? `     * @example: ${param.example}\n` : ""
              }     */\n    `
            : "";

        let paramType: string;
        if ("schema" in param) {
            const schema = param.schema;
            if (schema.type === "array") {
                const itemType = schema.items
                    ? (schema.items as IOpenAPISpec32.SchemaObject).type ||
                      "unknown"
                    : "unknown";
                const mappedItemType = mapOpenApiTypeToTypeScript(
                    itemType as string,
                );
                paramType = `${mappedItemType}[]`;
            } else if (Array.isArray(schema.type)) {
                const mappedTypes = schema.type.map(mapOpenApiTypeToTypeScript);
                paramType = mappedTypes.join(" | ");
            } else {
                paramType = mapOpenApiTypeToTypeScript(schema.type || "string");
            }
        } else {
            paramType = "string";
        }

        properties.push(
            `${paramComment}${param.name}${isOptional}: ${paramType};`,
        );
    });

    if (properties.length === 0) {
        return { typeDef: "", warnings };
    }

    const typeDef = `export type ${paramTypeName} = {\n${properties.join(
        "\n",
    )}\n};\n\n`;

    return { typeDef, warnings };
}

function generateRequestBodyType(
    _path: string,
    reqBodyTypeName: string,
    requestBody: IOpenAPISpec32.RequestBodyOrReferenceObject,
    options: OpenapiGenCodeOptions,
    schemas?: Record<string, IOpenAPISpec32.SchemaObject>,
): { typeDef: string; warnings: string[]; dependencies: string[] } {
    const warnings: string[] = [];
    const dependencies: string[] = [];
    let refType: string = "unknown";

    if ("content" in requestBody) {
        for (const contentType of Object.keys(requestBody.content)) {
            const mediaType = requestBody.content[contentType];
            if (mediaType && "schema" in mediaType && mediaType?.schema?.$ref) {
                const schemaName = mediaType.schema.$ref.replace(
                    "#/components/schemas/",
                    "",
                );
                if (schemaName && schemas) {
                    const refTargetSchema = schemas[schemaName];
                    refType = options.toSchemaTypeName(
                        schemaName,
                        refTargetSchema?.title,
                    );
                    dependencies.push(refType);
                } else {
                    warnings.push(
                        `警告: ${mediaType.schema.$ref} 未找到，使用 unknown 类型代替。`,
                    );
                }
                break;
            }
        }
    }

    const description = requestBody.description
        ? `/**\n * ${requestBody.description}\n */\n`
        : "";

    return {
        typeDef: `${description}export type ${reqBodyTypeName} = ${refType};\n\n`,
        warnings,
        dependencies,
    };
}

function generateFetchFunction(
    path: string,
    method: string,
    functionName: string,
    paramTypeName: string,
    resBodyTypeName: string,
    operation: IOpenAPISpec32.OperationObject,
): string {
    const { parameters } = operation;
    const hasResBody = "requestBody" in operation;
    let hasPathParams = false;
    let hasQueryParams = false;

    if (parameters) {
        hasPathParams = parameters.some(
            (p) => p.in === "path" && isRealPathParam(p, path),
        );
        hasQueryParams = parameters.some((p) => p.in === "query");
    }

    let paramSignature = "";
    if (hasPathParams || hasQueryParams || hasResBody) {
        const params: string[] = [];
        if (hasPathParams || hasQueryParams)
            params.push(`param: ${paramTypeName}`);
        if (hasResBody) params.push(`data: ${resBodyTypeName}`);
        paramSignature = params.join(", ");
    }

    let functionBody = "    ";
    functionBody += "let url = ";
    functionBody += `"${path}";\n    \n`;

    if (hasPathParams) {
        if (parameters) {
            parameters.forEach((param) => {
                if (param.in === "path") {
                    functionBody += `    url = url.replace(/{\\s*${param.name}\\s*}/g, encodeURIComponent(param.${param.name}));\n`;
                }
            });
        }
        functionBody += "\n";
    }

    if (hasQueryParams) {
        functionBody += "    const queryParams = [];\n";

        if (parameters) {
            parameters.forEach((param) => {
                if (param.in === "query") {
                    functionBody += `    if (param.${param.name} !== undefined) queryParams.push(\`${param.name}=\${encodeURIComponent(param.${param.name})}\`);\n`;
                }
            });
        }

        functionBody +=
            "    if (queryParams.length > 0) url += '?' + queryParams.join('&');\n";
    }

    functionBody += "    const config: RequestInit = {\n";
    functionBody += `        method: '${method.toUpperCase()}',\n`;

    if (hasResBody) {
        functionBody += "        headers: {\n";
        functionBody += "            'Content-Type': 'application/json',\n";
        functionBody += "        },\n";
        functionBody += "        body: JSON.stringify(data),\n";
    }

    functionBody += "    };\n    \n";

    functionBody += "    const response = await fetch(url, config);\n";
    functionBody += "    if (!response.ok) {\n";
    functionBody += "        const errorText = await response.text();\n";
    functionBody +=
        // biome-ignore lint/suspicious/noTemplateCurlyInString: ignore
        "        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);\n";
    functionBody += "    }\n";
    functionBody +=
        "    const contentType = response.headers.get('content-type');\n";
    functionBody += "    if (contentType?.includes('application/json')) {\n";
    functionBody += "        return await response.json();\n";
    functionBody += "    } else if (contentType?.includes('text/')) {\n";
    functionBody += "        return await response.text();\n";
    functionBody += "    } else {\n";
    functionBody += "        return await response;\n";
    functionBody += "    }\n";

    return `export async function ${functionName}(${paramSignature}): Promise<unknown> {\n${functionBody}}\n\n`;
}

export const renderPathItem: PathItemRenderer = (
    path: string,
    pathItem: IOpenAPISpec32.PathItemObject,
    options: OpenapiGenCodeOptions,
    schemas?: Record<string, IOpenAPISpec32.SchemaObject>,
) => {
    const warnings: string[] = [];
    const exports: string[] = [];
    const dependencies: string[] = [];

    const httpMethods: Array<
        keyof Pick<
            IOpenAPISpec32.PathItemObject,
            | "get"
            | "put"
            | "post"
            | "delete"
            | "options"
            | "head"
            | "patch"
            | "trace"
        >
    > = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

    httpMethods.forEach((method) => {
        const operation = pathItem[method];
        if (!operation) return;

        const paramTypeName = options.toParamTypeName(path, method);
        const reqBodyTypeName = options.toReqBodyTypeName(path, method);
        const functionName = options.toFunctionName(path, method);

        if (operation.parameters) {
            const { typeDef: paramTypeDef, warnings: paramWarnings } =
                generateParameterType(
                    path,
                    paramTypeName,
                    operation.parameters,
                );
            warnings.push(...paramWarnings);
            exports.push(paramTypeDef);
        }

        if (operation.requestBody) {
            const {
                typeDef: bodyTypeDef,
                warnings: bodyWarnings,
                dependencies: bodyDependencies,
            } = generateRequestBodyType(
                path,
                reqBodyTypeName,
                operation.requestBody,
                options,
                schemas,
            );
            warnings.push(...bodyWarnings);
            dependencies.push(...bodyDependencies);
            exports.push(bodyTypeDef);
        }

        if (operation.summary || operation.description) {
            exports.push("/**");
            if (operation.summary) {
                exports.push(` * ${operation.summary}`);
            }
            if (operation.description) {
                exports.push(` * ${operation.description}`);
            }
            exports.push(" */");
        }

        exports.push(
            generateFetchFunction(
                path,
                method,
                functionName,
                paramTypeName,
                reqBodyTypeName,
                operation,
            ),
        );
    });

    if (warnings.length > 0) {
        exports.unshift(...warnings.map((w) => `// ${w}`));
        exports.unshift("");
    }

    const genApiDir = (path: string) => {
        let apiDir = "";
        if (typeof options.outApiPath === "function") {
            apiDir = options.outApiPath(path);
        } else if (typeof options.outApiPath === "string") {
            apiDir = options.outApiPath as string;
        } else {
            apiDir = "index.ts";
        }
        return resolve(options.outDir, apiDir);
    };

    return {
        path: genApiDir(path),
        code: exports.join("\n"),
        dependencies,
    };
};
