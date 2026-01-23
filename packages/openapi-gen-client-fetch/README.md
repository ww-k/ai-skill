# openapi-gen-client-fetch

这个包是设计为agent skill调用的，目前实现了核心逻辑。
生成类型名，生成函数名的部分是需要agent来生成脚本的，目前的实现是为了测试的，后续会完善。

TODO: 
- 将生成类型名，生成函数名的函数放入测试用例中，将函数传入生成代码的函数中。
- 生成agent skill的描述文件

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
