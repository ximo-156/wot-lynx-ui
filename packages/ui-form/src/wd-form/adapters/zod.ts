/*
 * wd-form/adapters/zod — Zod 校验引擎适配器
 *
 * 与 wot-ui 2.3.2 `wd-form/adapters/zod.ts` 对齐：把 Zod schema 的
 * safeParse 结果归一为 FormSchemaIssue[]（path + message）。
 *
 * Lynx 适配点：
 * - 参考源用 `// #ifndef H5 { jitless: true }` 条件编译（非 H5 平台传
 *   jitless，避免小程序侧动态编译开销）。Lynx 不属于 H5，此处去掉条件
 *   编译后恒传 `{ jitless: true }`；
 * - Zod 由消费方自行安装（peer 依赖），本文件只做结构化类型断言，
 *   不 import zod，避免未安装 zod 时构建失败。
 */
import type { FormSchema, FormSchemaIssue } from '../types'

type ZodLikeIssue = {
  path?: PropertyKey[]
  message?: string
  code?: string
  received?: string
}

type ZodLikeSafeParseResult = {
  success: boolean
  error?: {
    issues?: ZodLikeIssue[]
  }
}

type ZodLikeParseContext = {
  jitless?: boolean
}

type ZodLikeSchema = {
  safeParse: (model: Record<string, any>, context?: ZodLikeParseContext) => ZodLikeSafeParseResult
}

type ZodAdapterOptions = {
  isRequired?: FormSchema['isRequired']
}

function normalizeIssues(result: ZodLikeSafeParseResult): FormSchemaIssue[] {
  if (result.success || !result.error?.issues) return []
  return result.error.issues
    .filter((issue) => Array.isArray(issue.path) && issue.path.length > 0 && issue.message)
    .map((issue) => ({
      path: (issue.path as PropertyKey[]).map((item) => (typeof item === 'number' ? item : String(item))),
      message: issue.message as string
    }))
}

export function zodAdapter(schema: ZodLikeSchema, options: ZodAdapterOptions = {}): FormSchema {
  const formSchema: FormSchema = {
    validate(model) {
      // Lynx 恒传 jitless（参考源 #ifndef H5 分支，见文件头说明）
      return normalizeIssues(schema.safeParse(model, { jitless: true }))
    }
  }
  if (options.isRequired) {
    formSchema.isRequired = options.isRequired
  }
  return formSchema
}
