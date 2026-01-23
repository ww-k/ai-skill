import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * 临时目录路径
 */
export const TEMP_DIR = join(process.cwd(), "tmp", "generated");

/**
 * 创建临时输出目录
 */
export async function setupTempDir(): Promise<void> {
    await mkdir(TEMP_DIR, { recursive: true });
}

/**
 * 清理临时目录
 */
export async function cleanupTempDir(): Promise<void> {
    try {
        await rm(TEMP_DIR, { recursive: true, force: true });
    } catch (_error) {
        // 忽略删除错误，可能是目录不存在
    }
}

/**
 * 清理特定文件或目录
 */
export async function cleanupFile(relativePath: string): Promise<void> {
    const fullPath = join(TEMP_DIR, relativePath);
    try {
        await rm(fullPath, { recursive: true, force: true });
    } catch (_error) {
        // 忽略删除错误，可能是文件不存在
    }
}

/**
 * 获取临时目录中的文件路径
 */
export function getTempPath(...segments: string[]): string {
    return join(TEMP_DIR, ...segments);
}
