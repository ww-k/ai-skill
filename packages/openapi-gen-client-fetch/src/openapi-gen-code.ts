import { dirname, relative } from "node:path";

import { renderPathItem } from "./api-generator";
import { defaultOptions } from "./default";
import { emptyFile, ensureWriteFile } from "./file-utils";
import { renderSchema } from "./schema-generator";

import type * as IOpenAPISpec32 from "openapi-schema-type";
import type { OpenapiGenCodeOptions } from "./types";

function getRelativePath(from: string, to: string) {
    const relativePath = relative(dirname(from), to);

    // 如果路径为空（相同目录），返回 './'
    if (relativePath === "") {
        return "./";
    }

    // 如果已经是 ./ 或 ../ 开头，直接返回
    if (relativePath.startsWith("./") || relativePath.startsWith("../")) {
        return relativePath;
    }

    // 否则添加 ./ 前缀
    return `./${relativePath}`;
}

export async function openapiGenCode(
    { paths, components }: IOpenAPISpec32.OpenAPIDocument,
    options?: OpenapiGenCodeOptions,
) {
    const emptySet = new Set();
    const finalOptions = options || defaultOptions;

    const typesMap = new Map<string, string[]>();
    const schemas = components?.schemas;
    if (schemas) {
        for (const schemaKey of Object.keys(
            schemas,
        ) as (keyof typeof schemas)[]) {
            const { path, typeName, code } = renderSchema(
                schemaKey,
                schemas,
                finalOptions,
            );

            let types = typesMap.get(path);
            if (!types) {
                types = [];
                typesMap.set(path, types);
            }
            types.push(typeName);

            if (!emptySet.has(path)) {
                await emptyFile(path);
                emptySet.add(path);
            }
            await ensureWriteFile(path, code);
        }
    }

    const depsMap = new Map<string, Map<string, string[]>>();
    const apiCodesMap = new Map<string, string[]>();
    if (paths) {
        for (const pathKey of Object.keys(paths)) {
            if (pathKey.startsWith("/")) {
                const { path, code, dependencies } = renderPathItem(
                    pathKey as IOpenAPISpec32.PathKey,
                    paths[
                        pathKey as IOpenAPISpec32.PathKey
                    ] as IOpenAPISpec32.PathItemObject,
                    finalOptions,
                    schemas,
                );

                if (dependencies.length > 0 && typesMap.size > 0) {
                    let depsTypeMap = depsMap.get(path);
                    if (!depsTypeMap) {
                        depsTypeMap = new Map();
                        depsMap.set(path, depsTypeMap);
                    }
                    dependencies.forEach((dep) => {
                        typesMap.forEach((types, typePath) => {
                            if (typePath !== path && types.includes(dep)) {
                                let deps = depsTypeMap.get(typePath);
                                if (!deps) {
                                    deps = [];
                                    depsTypeMap.set(typePath, deps);
                                }
                                deps.push(dep);
                            }
                        });
                    });
                }

                if (!emptySet.has(path)) {
                    await emptyFile(path);
                    emptySet.add(path);
                }

                let codes = apiCodesMap.get(path);
                if (!codes) {
                    codes = [];
                    apiCodesMap.set(path, codes);
                }
                codes.push(code);
            }
        }
    }

    for (const [apiPath, codes] of apiCodesMap) {
        const imports: string[] = [];
        const depsTypeMap = depsMap.get(apiPath);
        if (depsTypeMap) {
            depsTypeMap.forEach((deps, typePath) => {
                const relativePath = getRelativePath(apiPath, typePath);
                imports.push(`// ${apiPath}\n`);
                imports.push(`// ${typePath}\n`);
                imports.push(
                    `import type { ${deps.join(", ")} } from "${relativePath}";\n`,
                );
            });
            imports.push("\n");
        }
        await ensureWriteFile(apiPath, [...imports, ...codes]);
    }
}
