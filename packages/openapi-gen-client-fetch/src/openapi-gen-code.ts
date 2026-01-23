import { ensureWriteFile } from "./file-utils";
import { defaultNamingStrategy } from "./naming-strategies";

import type * as IOpenAPISpec32 from "openapi-schema-type";
import type {
    NamingStrategy,
    PathItemRenderer,
    RendererOptions,
    SchemaRenderer,
} from "./types";

export interface OpenapiGenCodeOptions {
    renderSchema?: SchemaRenderer;
    renderPathItem?: PathItemRenderer;
    namingStrategy?: NamingStrategy;
}

export async function openapiGenCode(
    { paths, components }: IOpenAPISpec32.OpenAPIDocument,
    options?: OpenapiGenCodeOptions,
) {
    const namingStrategy = options?.namingStrategy || defaultNamingStrategy;
    const rendererOptions: RendererOptions = {
        namingStrategy,
        generateJSDoc: true,
    };

    const renderSchemaFn =
        options?.renderSchema ||
        ((key, _schema, _opts) => {
            const typeName = namingStrategy.toTypeName(key);

            return {
                path: `schemas/${key.toLowerCase()}.ts`,
                code: `export type ${typeName} = any;\n`,
            };
        });

    const renderPathItemFn =
        options?.renderPathItem ||
        ((path, _pathItem, _opts) => {
            return {
                path: `api/${path.replace(/\//g, "_").slice(1)}.ts`,
                code: `// Generated for ${path}\n`,
            };
        });

    if (components?.schemas) {
        const schemas = components.schemas;
        for (const schemaKey of Object.keys(
            schemas,
        ) as (keyof typeof schemas)[]) {
            const { path, code } = renderSchemaFn(
                schemaKey,
                schemas[schemaKey] as IOpenAPISpec32.SchemaObject,
                rendererOptions,
            );
            await ensureWriteFile(path, code);
        }
    }
    if (paths) {
        for (const pathKey of Object.keys(paths)) {
            if (pathKey.startsWith("/")) {
                const { path, code } = renderPathItemFn(
                    pathKey as IOpenAPISpec32.PathKey,
                    paths[
                        pathKey as IOpenAPISpec32.PathKey
                    ] as IOpenAPISpec32.PathItemObject,
                    rendererOptions,
                );
                await ensureWriteFile(path, code);
            }
        }
    }
}
