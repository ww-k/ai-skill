import { beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { defaultOptions } from "../src";
import { renderPathItem } from "../src/api-generator";
import { ensureWriteFile, fileExists } from "../src/file-utils";
import { openapiGenCode } from "../src/openapi-gen-code";
import { renderSchema } from "../src/schema-generator";
import openapiSpec from "./openapi.json";
import { cleanupTempDir, getTempPath, setupTempDir } from "./test-utils";

import type * as IOpenAPISpec32 from "openapi-schema-type";

type Schemas = Record<string, IOpenAPISpec32.SchemaObject>;

beforeAll(async () => {
    await cleanupTempDir();
    await setupTempDir();
    process.chdir(getTempPath());
});

test("generate schema types", async () => {
    const schemas = openapiSpec.components.schemas as Schemas;
    const apiErrSchema = schemas.ApiErr;
    expect(apiErrSchema).toBeDefined();

    if (apiErrSchema) {
        const { path, code } = renderSchema("ApiErr", schemas, {
            ...defaultOptions,
            outSchemaPath: (_key) => "schemas/apierr.ts",
        });

        expect(code).toContain("export type IApiSchemaApiErr");
        expect(code).toContain("code: number");
        expect(code).toContain("message: string");

        console.log("path", path);
        await ensureWriteFile(path, code);
        const fileExists_result = await fileExists(path);
        expect(fileExists_result).toBe(true);

        const transpiled = await Bun.build({
            entrypoints: [path],
            target: "node",
            format: "esm",
            external: [],
        });

        expect(transpiled.success).toBe(true);
    }
});

test("generate path item with parameters", async () => {
    const sftpCpPath = (openapiSpec as IOpenAPISpec32.OpenAPIDocument).paths?.[
        "/api/sftp/cp"
    ];

    expect(sftpCpPath).toBeDefined();

    if (sftpCpPath) {
        const { path, code } = renderPathItem("/api/sftp/cp", sftpCpPath, {
            ...defaultOptions,
            outApiPath(_path) {
                return "api/sftp_cp.ts";
            },
        });

        expect(code).toContain("export type IApiReqParamPostSftpCp");
        expect(code).toContain("uri: string");
        expect(code).toContain("target_path: string");

        expect(code).toContain("警告:");
        expect(code).toContain("参数 'uri' 标记为 path 参数");

        expect(code).toContain("export async function postSftpCp");
        expect(code).toContain("let url = ");
        expect(code).toContain("fetch(url, config)");

        await ensureWriteFile(path, code);
        const fileExists_result = await fileExists(path);
        expect(fileExists_result).toBe(true);
    }
});

test("generate path item with requestBody", async () => {
    const addTargetPath = (openapiSpec as IOpenAPISpec32.OpenAPIDocument)
        .paths?.["/api/target/add"];

    expect(addTargetPath).toBeDefined();

    if (addTargetPath) {
        const { path, code } = renderPathItem(
            "/api/target/add",
            addTargetPath,
            {
                ...defaultOptions,
                outApiPath(_path) {
                    return "api/target_add.ts";
                },
            },
        );

        await ensureWriteFile(path, code);

        expect(code).toContain("export type IApiReqDataPostTargetAdd");
        expect(code).toContain(
            "警告: #/components/schemas/Model 未找到，使用 unknown 类型代替。",
        );

        expect(code).toContain("export async function postTargetAdd");
        expect(code).toContain("'Content-Type': 'application/json'");
        expect(code).toContain("JSON.stringify(data)");
    }
});

test("full integration test", async () => {
    await openapiGenCode(
        openapiSpec as IOpenAPISpec32.OpenAPIDocument,
        defaultOptions,
    );

    const schemaFile = "api/types.ts";
    const schemaFileExists = await fileExists(schemaFile);
    expect(schemaFileExists).toBe(true);
    const schemaFileContent = readFileSync(schemaFile, "utf-8");
    expect(schemaFileContent.length).toBeGreaterThan(0);
    expect(schemaFileContent).toContain("export type I");

    const apiFile = "api/index.ts";
    const apiFileExists = await fileExists(apiFile);
    expect(apiFileExists).toBe(true);
    const apiFileContent = readFileSync(apiFile, "utf-8");
    expect(apiFileContent.length).toBeGreaterThan(0);
    expect(apiFileContent).toContain("export async function");

    const transpiled = await Bun.build({
        entrypoints: [schemaFile, apiFile],
        target: "node",
        format: "esm",
        external: [],
    });

    expect(transpiled.success).toBe(true);
});

test("handle edge cases", async () => {
    const emptySchema: Schemas = { EmptySchema: {} };
    const { code } = renderSchema("EmptySchema", emptySchema, defaultOptions);

    expect(code).toContain("export type IApiSchemaEmptySchema");

    const enumSchema: Schemas = {
        StatusEnum: {
            type: "string",
            enum: ["pending", "completed", "failed"],
        },
    };

    const { code: enumCode } = renderSchema("StatusEnum", enumSchema, {
        ...defaultOptions,
        outSchemaPath(_key) {
            return "schemas/emptyschema.ts";
        },
    });
    expect(enumCode).toContain('"pending" | "completed" | "failed"');
});

test("warning generation", async () => {
    const pathWithError: IOpenAPISpec32.PathItemObject = {
        post: {
            parameters: [
                {
                    name: "invalid_param",
                    in: "path" as const,
                    required: true,
                    schema: { type: "string" },
                },
            ],
        },
    };

    const { path, code } = renderPathItem("/api/test", pathWithError, {
        ...defaultOptions,
        outApiPath(_key) {
            return "api/test.ts";
        },
    });

    expect(code).toContain("警告:");
    expect(code).toContain("参数 'invalid_param' 标记为 path 参数");

    await ensureWriteFile(path, code);
});

test("path parameter handling", async () => {
    const pathWithCorrectParams: IOpenAPISpec32.PathItemObject = {
        get: {
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "integer", format: "int32" },
                    description: "User ID",
                },
                {
                    name: "action",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                    description: "Action to perform",
                },
            ],
        },
    };

    const { path, code } = renderPathItem(
        "/api/users/{id}/{action}",
        pathWithCorrectParams,
        {
            ...defaultOptions,
            outApiPath(_key) {
                return "api/users1.ts";
            },
        },
    );

    expect(code).toContain("export type IApiReqParamGetUsers");
    expect(code).toContain("id: number");
    expect(code).toContain("action: string");
    expect(code).toContain(
        "url = url.replace(/{\\s*id\\s*}/g, encodeURIComponent(param.id))",
    );
    expect(code).toContain(
        "url = url.replace(/{\\s*action\\s*}/g, encodeURIComponent(param.action))",
    );
    expect(code).not.toContain("queryParams");

    await ensureWriteFile(path, code);
});

test("query parameter handling", async () => {
    const pathWithQueryParams: IOpenAPISpec32.PathItemObject = {
        get: {
            parameters: [
                {
                    name: "filter",
                    in: "query",
                    required: false,
                    schema: { type: "string" },
                    description: "Filter criteria",
                },
                {
                    name: "limit",
                    in: "query",
                    required: false,
                    schema: { type: "integer", format: "int32" },
                    description: "Result limit",
                },
            ],
        },
    };

    const { path, code } = renderPathItem("/api/search", pathWithQueryParams, {
        ...defaultOptions,
        outApiPath(_key) {
            return "api/search.ts";
        },
    });

    expect(code).toContain("export type IApiReqParamGetSearch");
    expect(code).toContain("filter?: string");
    expect(code).toContain("limit?: number");
    expect(code).toContain("const queryParams = []");
    expect(code).toContain(
        "if (param.filter !== undefined) queryParams.push(`filter=$" +
            "{encodeURIComponent(param.filter)}`)",
    );
    expect(code).toContain(
        "if (param.limit !== undefined) queryParams.push(`limit=$" +
            "{encodeURIComponent(param.limit)}`)",
    );
    expect(code).toContain(
        "if (queryParams.length > 0) url += '?' + queryParams.join('&')",
    );

    await ensureWriteFile(path, code);
});

test("mixed path and query parameters", async () => {
    const pathWithMixedParams: IOpenAPISpec32.PathItemObject = {
        get: {
            parameters: [
                {
                    name: "userId",
                    in: "path",
                    required: true,
                    schema: { type: "integer", format: "int32" },
                    description: "User ID",
                },
                {
                    name: "include",
                    in: "query",
                    required: false,
                    schema: { type: "string" },
                    description: "Additional fields to include",
                },
                {
                    name: "format",
                    in: "query",
                    required: false,
                    schema: { type: "string" },
                    description: "Response format",
                },
            ],
        },
    };

    const { path, code } = renderPathItem(
        "/api/users/{userId}",
        pathWithMixedParams,
        {
            ...defaultOptions,
            outApiPath(_key) {
                return "api/users2.ts";
            },
        },
    );

    expect(code).toContain("export type IApiReqParamGetUsers");
    expect(code).toContain("userId: number");
    expect(code).toContain("include?: string");
    expect(code).toContain("format?: string");

    expect(code).toContain(
        "url = url.replace(/{\\s*userId\\s*}/g, encodeURIComponent(param.userId))",
    );

    expect(code).toContain("const queryParams = []");
    expect(code).toContain(
        "if (param.include !== undefined) queryParams.push(`include=$" +
            "{encodeURIComponent(param.include)}`)",
    );
    expect(code).toContain(
        "if (param.format !== undefined) queryParams.push(`format=$" +
            "{encodeURIComponent(param.format)}`)",
    );
    expect(code).toContain(
        "if (queryParams.length > 0) url += '?' + queryParams.join('&')",
    );

    await ensureWriteFile(path, code);
});
