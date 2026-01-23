import type * as IOpenAPISpec32 from "openapi-schema-type";

/**
 * 将路径转换为驼峰格式
 */
function pathToCamelCase(path: string): string {
    return path
        .split("/")
        .filter(Boolean)
        .map((segment) => {
            // 跳过 api 段
            if (segment === "api") {
                return "";
            }
            // 如果是 URL 参数（以 : 开头或包含 {}），跳过
            if (segment.startsWith(":") || segment.includes("{")) {
                return "";
            }
            return segment.charAt(0).toUpperCase() + segment.slice(1);
        })
        .join("");
}

/**
 * 将 HTTP 方法转换为函数名前缀
 */
function httpMethodToPrefix(method: string): string {
    const methodMap: Record<string, string> = {
        get: "get",
        post: "post",
        put: "put",
        delete: "delete",
        patch: "patch",
        head: "head",
        options: "options",
    };
    return methodMap[method.toLowerCase()] || method;
}

/**
 * 生成参数类型名称
 */
function generateParamTypeName(path: string, method: string): string {
    const pathCamelCase = pathToCamelCase(path);
    const methodPrefix = httpMethodToPrefix(method);
    return `IApiReqParam${methodPrefix.charAt(0).toUpperCase() + methodPrefix.slice(1)}${pathCamelCase}`;
}

/**
 * 生成请求体类型名称
 */
function generateRequestBodyTypeName(path: string, method: string): string {
    const pathCamelCase = pathToCamelCase(path);
    const methodPrefix = httpMethodToPrefix(method);
    return `IApiReqData${methodPrefix.charAt(0).toUpperCase() + methodPrefix.slice(1)}${pathCamelCase}`;
}

/**
 * 检查参数是否为真实的路径参数
 */
function isRealPathParam(
    param: IOpenAPISpec32.ParameterObject,
    path: string,
): boolean {
    if (param.in !== "path") return false;

    // 检查路径中是否包含该参数的占位符
    const pathParamPattern = new RegExp(`{\\s*${param.name}\\s*}`);
    return pathParamPattern.test(path);
}

/**
 * 将 OpenAPI 类型映射到 TypeScript 类型
 */
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
            return openApiType; // 如果不识别的类型，保持原样
    }
}

/**
 * 生成参数类型定义
 */
function generateParameterType(
    path: string,
    method: string,
    parameters?: IOpenAPISpec32.ParameterObject[],
): { typeDef: string; warnings: string[] } {
    const warnings: string[] = [];

    if (!parameters || parameters.length === 0) {
        return { typeDef: "", warnings };
    }

    const properties: string[] = [];
    const required = new Set<string>();

    parameters.forEach((param) => {
        // 检查是否为错误的 path 参数定义
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
                // 将数组项类型映射到 TypeScript 类型
                const mappedItemType = mapOpenApiTypeToTypeScript(
                    itemType as string,
                );
                paramType = `${mappedItemType}[]`;
            } else if (Array.isArray(schema.type)) {
                // 将联合类型中的每种类型都映射到 TypeScript 类型
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

    const typeName = generateParamTypeName(path, method);
    const typeDef = `export type ${typeName} = {\n${properties.join(
        "\n",
    )}\n};\n\n`;

    return { typeDef, warnings };
}

/**
 * 生成请求体类型定义
 */
function generateRequestBodyType(
    path: string,
    method: string,
    requestBody?: IOpenAPISpec32.RequestBodyOrReferenceObject,
): { typeDef: string; warnings: string[] } {
    if (!requestBody) {
        return { typeDef: "", warnings: [] };
    }

    const warnings: string[] = [];
    let refType: string | null = null;

    // 检查是否有 schema 引用
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

    const typeName = generateRequestBodyTypeName(path, method);
    const description = requestBody.description
        ? `/**\n * ${requestBody.description}\n */\n`
        : "";

    if (refType) {
        return {
            typeDef: `${description}export type ${typeName} = ${refType};\n\n`,
            warnings,
        };
    }

    // 如果没有引用，使用 any 类型作为后备
    warnings.push(`警告: ${path} 的请求体没有 schema 引用，使用 any 类型。`);
    return {
        typeDef: `${description}export type ${typeName} = any;\n\n`,
        warnings,
    };
}

/**
 * 生成 fetch 函数
 */
function generateFetchFunction(
    path: string,
    method: string,
    paramTypeName: string,
    bodyTypeName: string,
    hasPathParams: boolean = false,
    hasQueryParams: boolean = false,
    hasBody: boolean = false,
    parameters?: IOpenAPISpec32.ParameterObject[],
): string {
    const functionName = httpMethodToPrefix(method) + pathToCamelCase(path);

    // 构建函数签名
    let paramSignature = "";
    if (hasPathParams || hasQueryParams || hasBody) {
        const params: string[] = [];
        if (hasPathParams || hasQueryParams)
            params.push(`param: ${paramTypeName}`);
        if (hasBody) params.push(`data: ${bodyTypeName}`);
        paramSignature = `(${params.join(", ")})`;
    }

    // 构建函数体
    let functionBody = "    ";

    // 构建URL
    functionBody += "let url = ";

    // 初始化URL
    functionBody += `"${path}";\n    \n`;

    // 如果有路径参数，需要替换路径中的占位符
    if (hasPathParams) {
        // 替换路径参数
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

    // 如果有查询参数，需要构建查询字符串
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

    // 构建请求配置
    functionBody += "    const config: RequestInit = {\n";
    functionBody += `        method: '${method.toUpperCase()}',\n`;

    if (hasBody) {
        functionBody += "        headers: {\n";
        functionBody += "            'Content-Type': 'application/json',\n";
        functionBody += "        },\n";
        functionBody += "        body: JSON.stringify(data),\n";
    }

    functionBody += "    };\n    \n";

    // 错误处理和返回
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

/**
 * 生成 API 路径的代码
 */
export function renderPathItem(
    path: string,
    pathItem: IOpenAPISpec32.PathItemObject,
): { path: string; code: string } {
    const warnings: string[] = [];
    const exports: string[] = [];
    const pathCamelCase = pathToCamelCase(path);

    // 检查每个 HTTP 方法
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

        // 生成参数类型
        const { typeDef: paramTypeDef, warnings: paramWarnings } =
            generateParameterType(path, method, operation.parameters);
        warnings.push(...paramWarnings);

        // 生成请求体类型
        const { typeDef: bodyTypeDef, warnings: bodyWarnings } =
            generateRequestBodyType(path, method, operation.requestBody);
        warnings.push(...bodyWarnings);

        // 确定是否有各种类型的参数
        const _hasParams = paramTypeDef.length > 0;
        const hasBody = bodyTypeDef.length > 0;
        const paramTypeName = generateParamTypeName(path, method);
        const bodyTypeName = generateRequestBodyTypeName(path, method);

        // 添加类型定义
        if (paramTypeDef) exports.push(paramTypeDef);
        if (bodyTypeDef) exports.push(bodyTypeDef);

        // 添加函数注释
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

        // 确定是否有各种类型的参数
        const hasPathParams = operation.parameters
            ? operation.parameters.some(
                  (p) => p.in === "path" && isRealPathParam(p, path),
              )
            : false;
        const hasQueryParams = operation.parameters
            ? operation.parameters.some((p) => p.in === "query")
            : false;

        // 生成函数
        exports.push(
            generateFetchFunction(
                path,
                method,
                paramTypeName,
                bodyTypeName,
                hasPathParams,
                hasQueryParams,
                hasBody,
                operation.parameters,
            ),
        );
    });

    // 添加警告注释
    if (warnings.length > 0) {
        exports.unshift(...warnings.map((w) => `// ${w}`));
        exports.unshift("");
    }

    return {
        path: `api/${pathCamelCase.toLowerCase()}.ts`,
        code: exports.join("\n"),
    };
}
