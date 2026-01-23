import { access, constants, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/**
 * 确保目录存在，如果不存在则创建
 */
export async function ensureDir(dirPath: string): Promise<void> {
    try {
        await access(dirPath, constants.F_OK);
    } catch {
        await mkdir(dirPath, { recursive: true });
    }
}

/**
 * 安全写入文件，确保目录存在
 */
export async function ensureWriteFile(
    filePath: string,
    content: string,
): Promise<void> {
    const absolutePath = resolve(filePath);
    await ensureDir(dirname(absolutePath));
    await writeFile(absolutePath, content, "utf-8");
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await access(filePath, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * 规范化文件路径
 */
export function normalizePath(...segments: string[]): string {
    return join(...segments).replace(/\\/g, "/");
}
