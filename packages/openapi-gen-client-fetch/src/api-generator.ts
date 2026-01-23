import type * as IOpenAPISpec32 from "openapi-schema-type";
import type { PathItemRenderer, RendererOptions } from "./types";

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
            return "any[]";
        case "object":
            return "Record<string, any>";
        case "null":
            return "null";
        default:
            return openApiType;
    }
}

function generateParameterType(
    path: string,
    _method: string,
    parameters?: IOpenAPISpec32.ParameterObject[],
): { typeDef: string; warnings: string[] } {
    const warnings: string[] = [];

    if (!parameters || parameters.length === 0) {
        return { typeDef: "", warnings };
    }

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

    const typeDef = `export type IApiReqParam = {\n${properties.join(
        "\n",
    )}\n};\n\n`;

    return { typeDef, warnings };
}

function generateRequestBodyType(
    path: string,
    _method: string,
    requestBody?: IOpenAPISpec32.RequestBodyOrReferenceObject,
): { typeDef: string; warnings: string[] } {
    if (!requestBody) {
        return { typeDef: "", warnings: [] };
    }

    const warnings: string[] = [];
    let refType: string | null = null;

    if ("content" in requestBody) {
        for (const contentType of Object.keys(requestBody.content)) {
            const mediaType = requestBody.content[contentType];
            if (mediaType && "schema" in mediaType && mediaType?.schema?.$ref) {
                const refPath = mediaType.schema.$ref.split("/");
                const schemaName = refPath[refPath.length - 1];
                if (schemaName) {
                    refType = `I${schemaName.charAt(0).toUpperCase() + schemaName.slice(1)}`;
                    break;
                }
            }
        }
    }

    const description = requestBody.description
        ? `/**\n * ${requestBody.description}\n */\n`
        : "";

    if (refType) {
        return {
            typeDef: `${description}export type IApiReqData = ${refType};\n\n`,
            warnings,
        };
    }

    warnings.push(`警告: ${path} 的请求体没有 schema 引用，使用 any 类型。`);
    return {
        typeDef: `${description}export type IApiReqData = any;\n\n`,
        warnings,
    };
}

function generateFetchFunction(
    path: string,
    method: string,
    functionName: string,
    paramTypeName: string,
    bodyTypeName: string,
    hasPathParams: boolean = false,
    hasQueryParams: boolean = false,
    hasBody: boolean = false,
    parameters?: IOpenAPISpec32.ParameterObject[],
): string {
    let paramSignature = "";
    if (hasPathParams || hasQueryParams || hasBody) {
        const params: string[] = [];
        if (hasPathParams || hasQueryParams)
            params.push(`param: ${paramTypeName}`);
        if (hasBody) params.push(`data: ${bodyTypeName}`);
        paramSignature = `(${params.join(", ")})`;
    }

    let functionBody = "    ";
    functionBody += "let url = ";
    functionBody += `"${path}";\n    \n`;

    if (hasPathParams) {
        if (parameters) {
            parameters.forEach((param) => {
                if (param.in === "path") {
                    const _pathParamPattern = new RegExp(
                        `{\\s*${param.name}\\s*}`,
                        "g",
                    );
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

    if (hasBody) {
        functionBody += "        headers: {\n";
        functionBody += "            'Content-Type': 'application/json',\n";
        functionBody += "        },\n";
        functionBody += "        body: JSON.stringify(data),\n";
    }

    functionBody += "    };\n    \n";

    functionBody += "    try {\n";
    functionBody += "        const response = await fetch(url, config);\n";
    functionBody += "        if (!response.ok) {\n";
    functionBody += "            const errorText = await response.text();\n";
    functionBody +=
        // biome-ignore lint/suspicious/noTemplateCurlyInString: ignore
        "            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);\n";
    functionBody += "        }\n";
    functionBody += "        return await response.json();\n";
    functionBody += "    } catch (error) {\n";
    functionBody += "        throw error;\n";
    functionBody += "    }\n";

    return `export async function ${functionName}${paramSignature}: Promise<any> {\n${functionBody}}\n\n`;
}

export const renderPathItem: PathItemRenderer = (
    path: string,
    pathItem: IOpenAPISpec32.PathItemObject,
    options: RendererOptions,
): { path: string; code: string } => {
    const warnings: string[] = [];
    const exports: string[] = [];
    const { namingStrategy } = options;

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

        const { typeDef: paramTypeDef, warnings: paramWarnings } =
            generateParameterType(path, method, operation.parameters);
        warnings.push(...paramWarnings);

        const { typeDef: bodyTypeDef, warnings: bodyWarnings } =
            generateRequestBodyType(path, method, operation.requestBody);
        warnings.push(...bodyWarnings);

        const hasBody = bodyTypeDef.length > 0;
        const paramTypeName = namingStrategy.toParamTypeName(path, method);
        const bodyTypeName = namingStrategy.toBodyTypeName(path, method);
        const functionName = namingStrategy.toFunctionName(path, method);

        const finalParamTypeDef = paramTypeDef.replace(
            "IApiReqParam",
            paramTypeName,
        );
        const finalBodyTypeDef = bodyTypeDef.replace(
            "IApiReqData",
            bodyTypeName,
        );

        if (finalParamTypeDef) exports.push(finalParamTypeDef);
        if (finalBodyTypeDef) exports.push(finalBodyTypeDef);

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

        const hasPathParams = operation.parameters
            ? operation.parameters.some(
                  (p) => p.in === "path" && isRealPathParam(p, path),
              )
            : false;
        const hasQueryParams = operation.parameters
            ? operation.parameters.some((p) => p.in === "query")
            : false;

        exports.push(
            generateFetchFunction(
                path,
                method,
                functionName,
                paramTypeName,
                bodyTypeName,
                hasPathParams,
                hasQueryParams,
                hasBody,
                operation.parameters,
            ),
        );
    });

    if (warnings.length > 0) {
        exports.unshift(...warnings.map((w) => `// ${w}`));
        exports.unshift("");
    }

    const pathCamelCase = path
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

    return {
        path: `api/${pathCamelCase.toLowerCase()}.ts`,
        code: exports.join("\n"),
    };
};
