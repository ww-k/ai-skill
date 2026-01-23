# OpenAPI 代码生成器 Skill

## 技能描述

这是一个从 OpenAPI 3.1 规范生成类型安全的 TypeScript Fetch 客户端代码的 AI 技能。它可以自动解析 OpenAPI 规范文档，生成完整的类型定义和 fetch 客户端函数。

## 使用场景

- **API 客户端代码生成**: 从 OpenAPI 规范自动生成前端或 Node.js 的 API 客户端代码
- **类型安全**: 生成的代码包含完整的 TypeScript 类型定义
- **自定义命名**: 支持自定义类型和函数命名规则
- **快速集成**: 快速为任何 OpenAPI 规范生成客户端代码

## 核心功能

1. **Schema 类型生成**: 将 `components/schemas` 转换为 TypeScript 类型
2. **API 函数生成**: 为每个路径和 HTTP 方法生成对应的 fetch 函数
3. **参数处理**: 支持路径参数、查询参数、请求体的类型定义
4. **命名策略**: 支持自定义命名规则，包括类型前缀、函数名风格等

## 使用方式

### 基础用法

```typescript
import { openapiGenCode, defaultNamingStrategy, renderSchema, renderPathItem } from "@ai-skill/openapi-gen-client-fetch";
import openapiSpec from "./openapi.json";

await openapiGenCode(openapiSpec, {
    namingStrategy: defaultNamingStrategy,
    renderSchema,
    renderPathItem
});
```

### 自定义命名策略

```typescript
import { openapiGenCode } from "@ai-skill/openapi-gen-client-fetch";

const customNamingStrategy = {
    typePrefix: "",
    toTypeName: (key) => key + "Type",
    toFunctionName: (path, method) => {
        const methodPrefix = method.toLowerCase();
        const pathName = path.replace(/\//g, '_').slice(1);
        return `${methodPrefix}_${pathName}`;
    },
    toParamTypeName: (path, method) => `RequestParam_${method}_${path}`,
    toBodyTypeName: (path, method) => `RequestData_${method}_${path}`,
};

await openapiGenCode(openapiSpec, {
    namingStrategy: customNamingStrategy
});
```

### Agent 工作流程

```
1. 用户提供 OpenAPI 规范文件（URL 或本地路径）
2. 读取并解析 OpenAPI 规范
3. 询问用户的命名偏好（如类型前缀、命名风格）
4. 生成自定义命名策略（如果用户有特殊需求）
5. 调用 openapiGenCode 生成代码
6. 验证生成的代码（运行 bun run check）
7. 报告生成的文件列表和任何警告
```

## 输入参数

### openapiGenCode 函数

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `openapiSpec` | `OpenAPIDocument` | 是 | OpenAPI 3.1 规范对象 |
| `options` | `OpenapiGenCodeOptions` | 否 | 配置选项 |

### OpenapiGenCodeOptions

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `namingStrategy` | `NamingStrategy` | 否 | 命名策略对象，默认使用内置的 defaultNamingStrategy |
| `renderSchema` | `SchemaRenderer` | 否 | 自定义 schema 渲染函数 |
| `renderPathItem` | `PathItemRenderer` | 否 | 自定义路径渲染函数 |

### NamingStrategy

| 方法 | 类型 | 描述 |
|------|------|------|
| `typePrefix` | `string` | 类型前缀，如 "I" 或 "" |
| `toTypeName` | `(key: string) => string` | 将 schema 键名转换为类型名 |
| `toFunctionName` | `(path: string, method: string) => string` | 将路径和方法转换为函数名 |
| `toParamTypeName` | `(path: string, method: string) => string` | 生成参数类型名 |
| `toBodyTypeName` | `(path: string, method: string) => string` | 生成请求体类型名 |

## 输出结果

生成的文件结构：

```
├── schemas/
│   ├── apierr.ts
│   ├── model.ts
│   └── userprofile.ts
└── api/
    ├── users.ts
    ├── targetadd.ts
    └── sftpcp.ts
```

### Schema 文件示例

```typescript
schemas/user.ts:
export type IUser = {
    id: number;
    name: string;
    email: string;
};
```

### API 文件示例

```typescript
api/users.ts:
export type IApiReqParamGetUsers = {
    limit?: number;
    offset?: number;
};

export async function getUsers(param: IApiReqParamGetUsers): Promise<any> {
    let url = "/api/users";

    const queryParams = [];
    if (param.limit !== undefined) queryParams.push(`limit=${encodeURIComponent(param.limit)}`);
    if (param.offset !== undefined) queryParams.push(`offset=${encodeURIComponent(param.offset)}`);
    if (queryParams.length > 0) url += '?' + queryParams.join('&');

    const config: RequestInit = {
        method: 'GET',
    };

    try {
        const response = await fetch(url, config);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        throw error;
    }
}
```

## 常见命名策略示例

### 1. 默认策略

```typescript
{
    typePrefix: "I",
    toTypeName: (key) => "I" + toCamelCase(key),
    toFunctionName: (path, method) => method.toLowerCase() + pathToCamelCase(path),
}
// 结果: IUser, getUsers, IApiReqParamGetUsers
```

### 2. 无前缀策略

```typescript
{
    typePrefix: "",
    toTypeName: (key) => toCamelCase(key),
}
// 结果: User, getUsers, ApiReqParamGetUsers
```

### 3. 下划线策略

```typescript
{
    typePrefix: "",
    toTypeName: (key) => key.toLowerCase(),
    toFunctionName: (path, method) => `${method}_${path.replace(/\//g, '_').slice(1)}`,
}
// 结果: user, get_api_users, request_param_get_api_users
```

## 注意事项

1. **警告信息**: 生成代码时可能会生成警告注释，请检查并告知用户
2. **类型前缀**: 默认使用 "I" 前缀，用户可以自定义
3. **路径参数**: 如果参数标记为 path 但路径中没有占位符，会自动视为 query 参数并生成警告
4. **请求体**: 如果请求体没有 schema 引用，会使用 `any` 类型并生成警告
5. **文件覆盖**: 生成的文件会直接覆盖同名文件，请提醒用户

## 验证和测试

生成代码后，应执行以下验证：

```bash
# 检查代码格式
bun run check

# 编译验证
bun run build

# 运行测试
bun test
```

## 错误处理

- 如果 OpenAPI 规范无效，会抛出解析错误
- 如果生成的代码无法编译，会报告类型错误
- 如果有警告，会在生成的代码中以注释形式呈现

## 依赖项

- `openapi-schema-type`: OpenAPI 3.1 类型定义
- `bun:file`: Bun 文件 API
- `bun:test`: 测试框架

## 相关文档

- [OpenAPI 3.1 规范](https://spec.openapis.org/oas/v3.1.0)
- [包文档](./AGENTS.md)
- [使用示例](./tests/)
