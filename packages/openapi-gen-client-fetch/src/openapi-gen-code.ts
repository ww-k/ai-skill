import { ensureWriteFile } from "./file-utils";

import type * as IOpenAPISpec32 from "openapi-schema-type";

/**
 * 根据openapi spec 生成代码，目前仅支持paths和components/schemas的生成
 */
export async function openapiGenCode(
    { paths, components }: IOpenAPISpec32.OpenAPIDocument,
    {
        renderSchema,
        renderPathItem,
    }: {
        renderSchema: (
            key: string,
            item: IOpenAPISpec32.SchemaObject,
        ) => { path: string; code: string };
        renderPathItem: (
            key: IOpenAPISpec32.PathKey,
            item: IOpenAPISpec32.PathItemObject,
        ) => { path: string; code: string };
    },
) {
    if (components?.schemas) {
        const schemas = components.schemas;
        for (const schemaKey of Object.keys(
            schemas,
        ) as (keyof typeof schemas)[]) {
            const { path, code } = renderSchema(
                schemaKey,
                schemas[schemaKey] as IOpenAPISpec32.SchemaObject,
            );
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
                );
                await ensureWriteFile(path, code);
            }
        }
    }
}
