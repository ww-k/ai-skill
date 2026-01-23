# AGENTS.md

你是在 Bun 管理的 monorepo 中工作的 TypeScript 和现代 JavaScript 开发专家。你的目标是编写高性能、可维护且类型安全的代码，并严格遵守项目标准。

## 项目结构与环境

- **业务代码目标**: Node.js - 库代码以 Node.js 为主要运行时目标
- **包管理器**: Bun Workspaces
- **Monorepo**: 包位于 `packages/` 目录
- **Linter/Formatter**: Biome (`@biomejs/biome`)
- **测试运行器**: Bun Test (`bun:test`)
- **打包构建**: Bun build (`bun:build`)

## 命令

所有命令从项目根目录执行。workspace 配置会自动过滤。

### 安装与初始化
- `bun install`: 为所有包安装依赖

### 开发与构建
- `bun run build`: 构建所有包
- `bun run dev`: 启动开发模式（所有包的监听模式）
- `bun --hot <file>`: 运行特定文件并启用热重载（适合快速原型/服务器）

### 代码质量
- `bun run check`: 运行 Biome linter 和 formatter 检查。**每次提交前必须运行。**

### 测试
- `bun run test`: 运行 monorepo 中所有测试

**运行特定测试：**
- `bun test <filename>`: 运行特定文件的测试
  *示例:* `bun test packages/openapi-gen-client-fetch/tests/index.test.ts`
- `bun test -t "<pattern>"`: 运行匹配名称模式的测试
  *示例:* `bun test -t "generate schema"`

**从根目录运行包内测试：**
- `bun test packages/<pkg-name>/tests/<test-file>.ts`

## 代码风格与标准

### 格式化（由 Biome 强制执行）
- **缩进**: 4 空格
- **引号**: 双引号 (`"`)
- **分号**: 始终使用
- **导入**: 自动组织和分组，按以下顺序：
  1. URL 导入 (http/https)
  2. Node.js/Bun 核心模块 (`node:*`, `bun:*`)
  3. 外部包（非 `src/**/*`）
  4. 包内导入（别名或 `src/**/*`）
  5. CSS/Less 文件
  6. 相对路径导入
  7. 类型导入（仅类型）

*操作*: 运行 `bun run check` 验证格式化。

### TypeScript
- **Strict Mode**: 已启用。无隐式 `any`
- **类型**: 为公共 API 函数显式定义返回类型
- **接口**: 使用 `interface` 定义对象类型，使用 `type` 定义联合类型/基本类型
- **命名约定**:
  - `PascalCase` 用于类、接口、类型和组件
  - `camelCase` 用于变量、函数和方法
  - `UPPER_CASE` 用于全局常量
  - 接口类型前缀 `I`（如 `IApiErr`, `IUser`）

### Bun 专属最佳实践

**文件 I/O**:
```typescript
// 推荐（使用 Bun API）
const content = await Bun.file("path/to/file.txt").text();
await Bun.write("path/to/file.txt", "content");

// 也可以使用（项目中现有代码模式）
import { readFile, writeFile, access, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
```

**Shell 命令**:
```typescript
import { $ } from "bun";
await $`ls -la`;
```

**环境变量**:
- 直接通过 `process.env` 或 `Bun.env` 访问（Bun 自动加载 `.env`）

**构建**:
- 单个包使用 `bun build <entry-file> --target=node --outdir=./dist`

**服务器**:
- 对于开发服务器，优先使用 `Bun.serve()`

## 测试指南

使用内置的 `bun:test` 模块编写测试。

### 结构
测试文件应位于 `tests/` 目录中或与源文件并列的 `*.test.ts` 文件。

### 导入模式
```typescript
import { afterEach, beforeEach, expect, test } from "bun:test";
```

### 示例测试文件
```typescript
import { afterEach, beforeEach, expect, test } from "bun:test";
import { myFeature } from "./index";

beforeEach(async () => {
    // 每个测试前的设置
});

afterEach(async () => {
    // 每个测试后的清理
});

test("should perform expected action", () => {
    const result = myFeature(10);
    expect(result).toBe(20);
});

test("should handle async operations", async () => {
    const data = await myFeature.fetch();
    expect(data).toHaveProperty("id");
});
```

### 验证生成的 TypeScript 代码
```typescript
test("validate generated code compiles", async () => {
    const transpiled = await Bun.build({
        entrypoints: [fullPath],
        target: "node",
        format: "esm",
        external: [],
    });
    expect(transpiled.success).toBe(true);
});
```

### Mocking
使用 `mock` 和 `spyOn` 从 `bun:test`，而不是外部库如 `sinon`。

## Agent 工作流程规则

1. **分析**: 在编写代码之前，探索 `packages/` 中的现有模式以保持一致性
2. **计划**: 如果任务涉及多个步骤，使用注释或 todo list 创建计划
3. **实现**: 使用上述指南编写代码
   - 优先使用 **原生 Bun APIs**（`Bun.file`, `Bun.serve` 等）而非 Node.js polyfills，除非需要兼容性
   - 保持依赖最小化
4. **验证**:
   - **Lint**: `bun run check`（修复任何错误）
   - **Test**: `bun test <modified_file>`
   - **Build**: `bun run build`（如适用）
5. **重构**: 确保代码干净、可读且有文档

## 故障排除

- **"Module not found"**: 检查 `tsconfig.json` 路径和 workspace 配置
- **Linting 错误**: 先运行 `bun run format`。如果问题持续，手动修复
- **类型错误**: 不要使用 `@ts-ignore` 或 `as any` 来静默错误。修复底层类型不匹配

## 文档

- **Bun**: 参考官方文档
- **Biome**: https://biomejs.dev/
