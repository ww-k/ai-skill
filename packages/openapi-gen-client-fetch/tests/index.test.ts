import { afterEach, beforeEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { renderPathItem } from "../src/api-generator";
import { ensureWriteFile, fileExists } from "../src/file-utils";
import { openapiGenCode } from "../src/openapi-gen-code";
import { renderSchema } from "../src/schema-generator";
import { testNamingStrategy } from "./naming-strategies";
import openapiSpec from "./openapi.json";
import { cleanupTempDir, getTempPath, setupTempDir } from "./test-utils";

import type * as IOpenAPISpec32 from "openapi-schema-type";
import type { RendererOptions } from "../src/types";

const rendererOptions: RendererOptions = {
    namingStrategy: testNamingStrategy,
    generateJSDoc: true,
};

beforeEach(async () => {
    await setupTempDir();
});

afterEach(async () => {
    await cleanupTempDir();
});

test("generate schema types", async () => {
    const apiErrSchema = (openapiSpec as IOpenAPISpec32.OpenAPIDocument)
        .components?.schemas?.ApiErr;
    expect(apiErrSchema).toBeDefined();

    if (apiErrSchema) {
        const { path, code } = renderSchema(
            "ApiErr",
            apiErrSchema,
            rendererOptions,
        );

        expect(path).toBe("schemas/apierr.ts");

        expect(code).toContain("export type IApiErr");
        expect(code).toContain("code: number");
        expect(code).toContain("message: string");

        const fullPath = getTempPath(path);
        await ensureWriteFile(fullPath, code);
        const fileExists_result = await fileExists(fullPath);
        expect(fileExists_result).toBe(true);

        const transpiled = await Bun.build({
            entrypoints: [fullPath],
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
        const { path, code } = renderPathItem(
            "/api/sftp/cp",
            sftpCpPath,
            rendererOptions,
        );

        expect(path).toBe("api/sftpcp.ts");

        expect(code).toContain("export type IApiReqParamPostSftpCp");
        expect(code).toContain("uri: string");
        expect(code).toContain("target_path: string");

        expect(code).toContain("警告:");
        expect(code).toContain("参数 'uri' 标记为 path 参数");

        expect(code).toContain("export async function postSftpCp");
        expect(code).toContain("let url = ");
        expect(code).toContain("fetch(url, config)");

        const fullPath = getTempPath(path);
        await ensureWriteFile(fullPath, code);
        const fileExists_result = await fileExists(fullPath);
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
            rendererOptions,
        );

        expect(path).toBe("api/targetadd.ts");

        expect(code).toContain("export type IApiReqDataPostTargetAdd");
        expect(code).toContain("IModel");

        expect(code).toContain("export async function postTargetAdd");
        expect(code).toContain("'Content-Type': 'application/json'");
        expect(code).toContain("JSON.stringify(data)");

        const fullPath = getTempPath(path);
        await ensureWriteFile(fullPath, code);
        const fileExists_result = await fileExists(fullPath);
        expect(fileExists_result).toBe(true);
    }
});

test("full integration test", async () => {
    const originalCwd = process.cwd();
    process.chdir(getTempPath());

    try {
        await openapiGenCode(
            {
                paths: (openapiSpec as IOpenAPISpec32.OpenAPIDocument).paths,
                components: (openapiSpec as IOpenAPISpec32.OpenAPIDocument)
                    .components,
            } as IOpenAPISpec32.OpenAPIDocument,
            {
                namingStrategy: testNamingStrategy,
                renderSchema,
                renderPathItem,
            },
        );

        const schemaFiles = [
            "schemas/apierr.ts",
            "schemas/connectioninfo.ts",
            "schemas/model.ts",
            "schemas/sftpfile.ts",
        ];

        for (const file of schemaFiles) {
            const fileExists_result = await fileExists(file);
            expect(fileExists_result).toBe(true);

            const content = readFileSync(file, "utf-8");
            expect(content.length).toBeGreaterThan(0);
            expect(content).toContain("export type I");
        }

        const apiFiles = [
            "api/sftpcp.ts",
            "api/sftphome.ts",
            "api/sftpls.ts",
            "api/targetadd.ts",
        ];

        for (const file of apiFiles) {
            const fileExists_result = await fileExists(file);
            expect(fileExists_result).toBe(true);

            const content = readFileSync(file, "utf-8");
            expect(content.length).toBeGreaterThan(0);
            expect(content).toContain("export async function");
        }

        const transpiled = await Bun.build({
            entrypoints: schemaFiles.concat(apiFiles),
            target: "node",
            format: "esm",
            external: [],
        });

        expect(transpiled.success).toBe(true);
    } finally {
        process.chdir(originalCwd);
    }
});

test("handle edge cases", async () => {
    const emptySchema: IOpenAPISpec32.SchemaObject = {};
    const { path, code } = renderSchema(
        "EmptySchema",
        emptySchema,
        rendererOptions,
    );

    expect(path).toBe("schemas/emptyschema.ts");
    expect(code).toContain("export type IEmptySchema");

    const enumSchema: IOpenAPISpec32.SchemaObject = {
        type: "string",
        enum: ["pending", "completed", "failed"],
    };

    const { code: enumCode } = renderSchema(
        "StatusEnum",
        enumSchema,
        rendererOptions,
    );
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

    const { code } = renderPathItem(
        "/api/test",
        pathWithError,
        rendererOptions,
    );

    expect(code).toContain("警告:");
    expect(code).toContain("参数 'invalid_param' 标记为 path 参数");
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

    const { code } = renderPathItem(
        "/api/users/{id}/{action}",
        pathWithCorrectParams,
        rendererOptions,
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

    const { code } = renderPathItem(
        "/api/search",
        pathWithQueryParams,
        rendererOptions,
    );

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

    const { code } = renderPathItem(
        "/api/users/{userId}",
        pathWithMixedParams,
        rendererOptions,
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
});
