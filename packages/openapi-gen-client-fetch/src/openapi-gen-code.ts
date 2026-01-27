import { renderPathItem } from "./api-generator";
import { defaultOptions } from "./default";
import { emptyFile, ensureWriteFile } from "./file-utils";
import { renderSchema } from "./schema-generator";

import type * as IOpenAPISpec32 from "openapi-schema-type";
import type { OpenapiGenCodeOptions } from "./types";

export async function openapiGenCode(
    { paths, components }: IOpenAPISpec32.OpenAPIDocument,
    options?: OpenapiGenCodeOptions,
) {
    const emptySet = new Set();
    const finalOptions = options || defaultOptions;

    const schemas = components?.schemas;
    if (schemas) {
        for (const schemaKey of Object.keys(
            schemas,
        ) as (keyof typeof schemas)[]) {
            const { path, code } = renderSchema(
                schemaKey,
                schemas,
                finalOptions,
            );
            if (!emptySet.has(path)) {
                await emptyFile(path);
                emptySet.add(path);
            }
            await ensureWriteFile(path, code);
        }
    }
    if (paths) {
        for (const pathKey of Object.keys(paths)) {
            if (pathKey.startsWith("/")) {
                const { path, code } = renderPathItem(
                    pathKey as IOpenAPISpec32.PathKey,
                    paths[
                        pathKey as IOpenAPISpec32.PathKey
                    ] as IOpenAPISpec32.PathItemObject,
                    finalOptions,
                    schemas,
                );
                if (!emptySet.has(path)) {
                    await emptyFile(path);
                    emptySet.add(path);
                }
                await ensureWriteFile(path, code);
            }
        }
    }
}
