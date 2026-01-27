import type * as IOpenAPISpec32 from "openapi-schema-type";

export interface OpenapiGenCodeOptions {
    outDir: string;
    outApiPath: string | ((path: string) => string);
    outSchemaPath: string | ((key: string, title?: string) => string);

    typePrefix: string;
    toSchemaTypeName: (key: string, title?: string) => string;
    toFunctionName: (path: string, method: string) => string;
    toParamTypeName: (path: string, method: string) => string;
    toBodyTypeName: (path: string, method: string) => string;
}

export type SchemaRenderer = (
    key: string,
    schemas: Record<string, IOpenAPISpec32.SchemaObject>,
    options: OpenapiGenCodeOptions,
) => { path: string; code: string };

export type PathItemRenderer = (
    path: string,
    pathItem: IOpenAPISpec32.PathItemObject,
    options: OpenapiGenCodeOptions,
    schemas?: Record<string, IOpenAPISpec32.SchemaObject>,
) => { path: string; code: string };
