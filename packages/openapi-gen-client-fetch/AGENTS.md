# AGENTS.md - @ai-skill/openapi-gen-client-fetch

你是一个 OpenAPI 到 TypeScript Fetch 客户端代码生成器的专家。这个包提供了从 OpenAPI 3.1 规范生成类型安全的 fetch 客户端代码的能力。

## 包概述

`@ai-skill/openapi-gen-client-fetch` 是一个代码生成工具，它能够：
1. 解析 OpenAPI 3.1 规范文档
2. 为 `components/schemas` 生成 TypeScript 类型定义
3. 为 `paths` 生成对应的 fetch 函数和请求/响应类型
4. 支持路径参数、查询参数、请求体的类型定义
5. 自动生成类型安全的 fetch 客户端代码

## 核心架构

### 主要模块

| 模块 | 文件 | 功能 |
|------|------|------|
| **主入口** | `openapi-gen-code.ts` | 协调 schema 和 API 代码生成的流程 |
| **Schema 生成器** | `schema-generator.ts` | 将 OpenAPI Schema 转换为 TypeScript 类型 |
| **API 生成器** | `api-generator.ts` | 生成 API 路径对应的 fetch 函数和参数类型 |
| **文件工具** | `file-utils.ts` | 提供安全的文件写入和目录创建功能 |

### 核心函数

#### 1. `openapiGenCode()`
主入口函数，遍历 OpenAPI 文档并生成代码。

```typescript
import { openapiGenCode } from "@ai-skill/openapi-gen-client-fetch";
import type * as IOpenAPISpec32 from "openapi-schema-type";

await openapiGenCode(
    openapiSpec as IOpenAPISpec32.OpenAPIDocument,
    {
        renderSchema: (key: string, schema: IOpenAPISpec32.SchemaObject) => {
            // 自定义 schema 渲染逻辑
            return { path: string, code: string };
        },
        renderPathItem: (path: string, pathItem: IOpenAPISpec32.PathItemObject) => {
            // 自定义 API 路径渲染逻辑
            return { path: string, code: string };
        },
    }
);
```

**参数说明**:
- `paths`: OpenAPI paths 对象
- `components`: OpenAPI components 对象
- `renderSchema`: 自定义 schema 渲染函数（可选，默认使用内置 `renderSchema`）
- `renderPathItem`: 自定义路径渲染函数（可选，默认使用内置 `renderPathItem`）

**返回值**: `Promise<void>`

#### 2. `renderSchema()`
将单个 OpenAPI schema 转换为 TypeScript 类型定义。

```typescript
import { renderSchema } from "@ai-skill/openapi-gen-client-fetch";

const { path, code } = renderSchema("User", {
    type: "object",
    properties: {
        id: { type: "integer" },
        name: { type: "string" }
    }
});
// path: "schemas/user.ts"
// code: "export type IUser = {\n    id: number;\n    name: string;\n};\n"
```

#### 3. `renderPathItem()`
将单个 OpenAPI path item 转换为 fetch 函数和类型定义。

```typescript
import { renderPathItem } from "@ai-skill/openapi-gen-client-fetch";

const { path, code } = renderPathItem("/api/users", {
    get: {
        parameters: [
            {
                name: "limit",
                in: "query",
                schema: { type: "integer" }
            }
        ]
    }
});
// path: "api/users.ts"
// code 包含 fetch 函数和参数类型定义
```

#### 4. `ensureWriteFile()`
安全地写入文件，自动创建所需的目录。

```typescript
import { ensureWriteFile } from "@ai-skill/openapi-gen-client-fetch";

await ensureWriteFile("api/users.ts", code);
```

## 代码生成规则

### 类型名称生成

当前实现使用简单的驼峰命名规则：

```typescript
// Schema 名称: "User" -> 类型名: "IUser"
// Schema 名称: "UserProfile" -> 类型名: "IUserProfile"
// Schema 名称: "api_user" -> 类型名: "IApiUser"

toCamelCase("user") // => "User"
toCamelCase("api_user") // => "ApiUser"
```

**TODO**: 这个函数应该由 agent 动态生成，可以根据用户的命名偏好调整。

### 函数名称生成

HTTP 方法前缀 + 路径驼峰化：

```typescript
// 路径: "/api/users" + 方法: "get" -> 函数名: "getUsers"
// 路径: "/api/users/:id" + 方法: "get" -> 函数名: "getUsers"
// 路径: "/api/target/add" + 方法: "post" -> 函数名: "postTargetAdd"
```

**TODO**: 这个函数应该由 agent 动态生成，可以根据用户的命名偏好调整。

### 参数类型名称

```typescript
// 路径: "/api/users" + 方法: "get" -> 参数类型: "IApiReqParamGetUsers"
// 路径: "/api/target/add" + 方法: "post" -> 参数类型: "IApiReqParamPostTargetAdd"
```

### 请求体类型名称

```typescript
// 路径: "/api/target/add" + 方法: "post" -> 请求体类型: "IApiReqDataPostTargetAdd"
```

## 支持的 OpenAPI 特性

### Schema 类型映射

| OpenAPI 类型 | TypeScript 类型 |
|--------------|-----------------|
| `string` | `string` |
| `number`, `integer` | `number` |
| `boolean` | `boolean` |
| `array` | `ItemType[]` |
| `object` | `{ properties... }` |
| `enum` | `"value1" \| "value2" \| ...` |
| `$ref` | `IReferencedType` |
| `oneOf`, `anyOf` | `Type1 \| Type2 \| ...` |
| `allOf` | `Type1 & Type2 & ...` |

### 参数处理

- **路径参数**: 替换 URL 中的 `{param}` 占位符
- **查询参数**: 构建查询字符串 `?key1=value1&key2=value2`
- **请求体**: JSON 序列化并通过 `fetch` 发送
- **可选参数**: 根据参数的 `required` 字段决定是否添加 `?`

### 警告机制

当检测到以下问题时会生成警告注释：

1. 参数标记为 `path` 但路径中没有对应的占位符
2. 请求体没有 schema 引用（使用 `any` 类型）

## 使用示例

### 基础用法

```typescript
import { openapiGenCode, renderSchema, renderPathItem } from "@ai-skill/openapi-gen-client-fetch";
import type * as IOpenAPISpec32 from "openapi-schema-type";

const openapiSpec = {
    openapi: "3.1.0",
    paths: {
        "/api/users": {
            get: {
                parameters: [
                    {
                        name: "limit",
                        in: "query",
                        schema: { type: "integer" }
                    }
                ],
                responses: {
                    "200": {
                        description: "Success"
                    }
                }
            }
        }
    },
    components: {
        schemas: {
            User: {
                type: "object",
                properties: {
                    id: { type: "integer" },
                    name: { type: "string" }
                }
            }
        }
    }
};

await openapiGenCode(
    openapiSpec,
    {
        renderSchema,
        renderPathItem
    }
);

// 生成的文件:
// - schemas/user.ts
// - api/users.ts
```

### 自定义渲染逻辑

```typescript
import { openapiGenCode } from "@ai-skill/openapi-gen-client-fetch";

await openapiGenCode(
    openapiSpec,
    {
        renderSchema: (key, schema) => {
            // 自定义类型名称生成规则
            const typeName = `${key}Type`; // 不使用 I 前缀
            const tsType = mapOpenApiTypeToTsType(schema);

            return {
                path: `types/${key.toLowerCase()}.ts`,
                code: `export type ${typeName} = ${tsType};\n`
            };
        },
        renderPathItem: (path, pathItem) => {
            // 自定义函数名称生成规则
            const functionName = `${path.replace(/\//g, '_')}_fetch`;
            // ... 自定义渲染逻辑
            return { path, code };
        }
    }
);
```

## Agent 集成指南

### 作为一个 Skill 使用

这个包设计为可以被 agent 作为 skill 调用。Agent 可以：

1. **读取 OpenAPI 规范文件**
   ```bash
   curl https://api.example.com/openapi.json > openapi.json
   ```

2. **调用代码生成器**
   ```typescript
   import { openapiGenCode } from "@ai-skill/openapi-gen-client-fetch";
   import openapiSpec from "./openapi.json";

   await openapiGenCode(openapiSpec, {
       renderSchema: customSchemaRenderer,
       renderPathItem: customApiRenderer
   });
   ```

3. **自定义命名规则**
   Agent 可以根据用户偏好生成不同的类型名和函数名。

4. **处理错误和警告**
   检查生成的代码中的警告注释，向用户报告潜在问题。

### Agent 工作流

```
1. 用户提供 OpenAPI 规范文件（URL 或本地文件）
2. Agent 读取并解析规范
3. Agent 确定用户的命名偏好（如类型前缀、函数命名风格）
4. Agent 生成自定义的 renderSchema 和 renderPathItem 函数
5. Agent 调用 openapiGenCode 生成代码
6. Agent 验证生成的代码（编译检查）
7. Agent 报告生成的文件列表和任何警告
```

## 测试

运行测试：

```bash
bun test
```

运行特定测试：

```bash
bun test packages/openapi-gen-client-fetch/tests/index.test.ts
```

测试覆盖：
- Schema 类型生成（包括 enum、object、array 等）
- API 函数生成（路径参数、查询参数、请求体）
- 混合参数处理
- 警告生成
- 边界情况处理
- 集成测试（完整流程）
- TypeScript 编译验证

## 构建和开发

### 构建

```bash
bun run build
```

### 代码检查

```bash
bun run check
```

### 开发模式

```bash
bun --hot src/index.ts
```

## 技术栈

- **运行时**: Bun
- **语言**: TypeScript (ESNext, Strict Mode)
- **类型定义**: `openapi-schema-type`
- **测试**: `bun:test`
- **代码格式化**: Biome

## 项目结构

```
packages/openapi-gen-client-fetch/
├── src/
│   ├── index.ts              # 包入口（当前为空）
│   ├── openapi-gen-code.ts  # 主入口函数
│   ├── schema-generator.ts   # Schema 类型生成器
│   ├── api-generator.ts      # API 函数生成器
│   └── file-utils.ts         # 文件工具函数
├── tests/
│   ├── index.test.ts         # 主测试文件
│   ├── test-utils.ts         # 测试工具函数
│   └── openapi.json          # 测试用的 OpenAPI 规范
├── package.json
├── tsconfig.json
├── README.md
└── CLAUDE.md
```

## 已知限制

1. **类型/函数名称生成**: 当前使用固定规则，需要支持自定义
2. **响应类型**: 当前返回类型为 `Promise<any>`，可以改进为根据 OpenAPI 的响应 schema 生成具体类型
3. **错误处理**: 简单的错误抛出，可以改进为更结构化的错误类型
4. **OpenAPI 3.1 特性**: 部分高级特性可能未完全支持

## TODO

- [ ] 将类型名和函数名生成函数提取为可配置参数
- [ ] 支持自定义类型前缀（如 `I` 前缀）
- [ ] 支持响应类型生成
- [ ] 改进错误处理，生成类型化的错误类
- [ ] 支持 OpenAPI 3.1 更多特性（如 callbacks、webhooks）
- [ ] 生成完整的 agent skill 描述文件
- [ ] 添加更多边界情况的测试
- [ ] 支持 TypeScript 命名空间或模块导出

## 依赖说明

### 开发依赖

- `@biomejs/biome`: 代码格式化和检查
- `@types/bun`: Bun 类型定义
- `@types/node`: Node.js 类型定义
- `json-schema-meta-type`: JSON Schema 类型定义
- `openapi-schema-type`: OpenAPI 3.1 类型定义

## 贡献指南

1. 遵循项目根目录的 `AGENTS.md` 规范
2. 所有代码必须通过 `bun run check` 检查
3. 添加测试用例覆盖新功能
4. 确保 TypeScript 类型定义完整准确
5. 使用 Bun 原生 API 优于 Node.js polyfills

## 相关资源

- [OpenAPI 3.1 规范](https://spec.openapis.org/oas/v3.1.0)
- [Bun 文档](https://bun.sh/docs)
- [openapi-schema-type](https://www.npmjs.com/package/openapi-schema-type)
