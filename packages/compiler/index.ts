import MagicString from 'magic-string'
import { parse as babelParse } from '@babel/parser'
import type { VineCompilerCtx, VineCompilerHooks, VineCompilerOptions, VineFileCtx } from './src/types'
import { findVineCompFnDecls } from './src/babel-helpers/ast'
import { validateVine } from './src/validate'
import { analyzeVine } from './src/analyze'
import { transformFile } from './src/transform'

export {
  compileVineStyle,
} from './src/style/compile'

export type {
  VineFileCtx,
  VineCompFnCtx as VineFnCompCtx,
  VineCompilerOptions,
  VineProcessorLang,
  VineCompilerHooks,
  VineDiagnostic,
} from './src/types'

export function createCompilerCtx(
  options: VineCompilerOptions,
): VineCompilerCtx {
  return {
    fileCtxMap: new Map(),
    vineCompileErrors: [],
    vineCompileWarnings: [],
    options: {
      inlineTemplate: true, // default inline template
      // Maybe some default options ...
      ...options,
    },
  }
}

export function compileVineTypeScriptFile(
  code: string,
  fileId: string,
  compilerHooks: VineCompilerHooks,
) {
  let compilerOptions: VineCompilerOptions = {}
  compilerHooks.onOptionsResolved((options) => {
    compilerOptions = options
  })
  // Using babel to validate vine declarations
  const root = babelParse(code, {
    sourceType: 'module',
    plugins: [
      'typescript',
    ],
  })
  const vineFileCtx: VineFileCtx = {
    fileId,
    fileSourceCode: new MagicString(code),
    vineCompFns: [],
    userImports: {},
    styleDefine: {},
    vueImportAliases: {},
    root,
  }
  compilerHooks.onBindFileCtx?.(fileId, vineFileCtx)

  const vineCompFnDecls = findVineCompFnDecls(root)

  // 1. Validate all vine restrictions
  const isValidatePass = validateVine(compilerHooks, vineFileCtx, vineCompFnDecls)
  compilerHooks.onValidateEnd?.()

  if (
    !isValidatePass // Vine validation failed
    // || vineCompFnDecls.length === 0 // No vine component function declarations found
  ) {
    return vineFileCtx
  }

  // 2. Analysis
  analyzeVine(compilerHooks, vineFileCtx, vineCompFnDecls)
  compilerHooks.onAnalysisEnd?.()

  // 3. Codegen, or call it "transform"
  transformFile(
    vineFileCtx,
    compilerHooks,
    compilerOptions?.inlineTemplate ?? true,
  )

  return vineFileCtx
}
