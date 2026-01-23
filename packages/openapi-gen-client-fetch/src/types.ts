import type * as IOpenAPISpec32 from "openapi-schema-type";

export interface NamingStrategy {
    typePrefix?: string;
    toTypeName: (key: string) => string;
    toFunctionName: (path: string, method: string) => string;
    toParamTypeName: (path: string, method: string) => string;
    toBodyTypeName: (path: string, method: string) => string;
}

export interface RendererOptions {
    namingStrategy: NamingStrategy;
    generateJSDoc?: boolean;
}

export type SchemaRenderer = (
    key: string,
    schema: IOpenAPISpec32.SchemaObject,
    options: RendererOptions,
) => { path: string; code: string };

export type PathItemRenderer = (
    path: string,
    pathItem: IOpenAPISpec32.PathItemObject,
    options: RendererOptions,
) => { path: string; code: string };
