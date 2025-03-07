import { describe, expect, test } from 'vitest'
import { compileVineTypeScriptFile } from '../index'
import { sortStyleImport } from '../src/style/order'
import { createMockTransformCtx } from './shared-utils'

describe('Test Vine compiler analyze', () => {
  test('analyze imports', () => {
    const content = `
import { ref, reactive as VueReactive } from 'vue'
import * as Something from 'lib-1'
import type { SomeType } from 'types-2'
`
    const { mockCompilerCtx, mockCompilerHooks } = createMockTransformCtx()
    compileVineTypeScriptFile(content, 'testAnalyzeImports', mockCompilerHooks)
    expect(mockCompilerCtx.vineCompileErrors.length).toBe(0)
    const fileCtx = mockCompilerCtx.fileCtxMap.get('testAnalyzeImports')
    expect(fileCtx?.userImports).toMatchInlineSnapshot(`
      {
        "SomeType": {
          "isType": true,
          "isUsedInTemplate": false,
          "source": "types-2",
        },
        "Something": {
          "isNamespace": true,
          "isType": false,
          "isUsedInTemplate": false,
          "source": "lib-1",
        },
        "VueReactive": {
          "isType": false,
          "isUsedInTemplate": false,
          "source": "vue",
        },
        "ref": {
          "isType": false,
          "isUsedInTemplate": false,
          "source": "vue",
        },
      }
    `)
  })

  test('analyze vine component props by function\'s formal param', () => {
    const content = `
function MyComp(p: {
  name: string;
  data: SomeExternalType;
  bool: boolean;
}) {
  return vine\`<div>Test props by formal param</div>\`
}`
    const { mockCompilerCtx, mockCompilerHooks } = createMockTransformCtx()
    compileVineTypeScriptFile(content, 'testAnalyzeVinePropsByFormalParam', mockCompilerHooks)
    expect(mockCompilerCtx.vineCompileErrors.length).toBe(0)
    expect(mockCompilerCtx.fileCtxMap.size).toBe(1)
    const fileCtx = mockCompilerCtx.fileCtxMap.get('testAnalyzeVinePropsByFormalParam')
    expect(fileCtx?.vineCompFns.length).toBe(1)
    const vineFnComp = fileCtx?.vineCompFns[0]
    expect(vineFnComp?.propsAlias).toBe('p')
    expect(vineFnComp?.props).toMatchInlineSnapshot(`
      {
        "bool": {
          "isBool": true,
          "isFromMacroDefine": false,
          "isRequired": true,
        },
        "data": {
          "isBool": false,
          "isFromMacroDefine": false,
          "isRequired": true,
        },
        "name": {
          "isBool": false,
          "isFromMacroDefine": false,
          "isRequired": true,
        },
      }
    `)
  })

  test('analyze vine component props by macro calls', () => {
    const content = `
const MyComp = () => {
  const name = vineProp<string>()
  const disabled = vineProp.optional<boolean>()
  const title = vineProp.withDefault('# Title', (val: string) => val.startsWith('#'))
  return vine\`<div>Test props by macro calls</div>\`
}`
    const { mockCompilerCtx, mockCompilerHooks } = createMockTransformCtx()
    compileVineTypeScriptFile(content, 'testAnalyzeVinePropsByMacroCalls', mockCompilerHooks)
    expect(mockCompilerCtx.vineCompileErrors.length).toBe(0)
    expect(mockCompilerCtx.fileCtxMap.size).toBe(1)
    const fileCtx = mockCompilerCtx.fileCtxMap.get('testAnalyzeVinePropsByMacroCalls')
    expect(fileCtx?.vineCompFns.length).toBe(1)
    const vineFnComp = fileCtx?.vineCompFns[0]
    expect(vineFnComp?.props).toMatchSnapshot()
  })

  test('analyze vine emits definition', () => {
    const content = `
function MyComp() {
  const myEmits = vineEmits<{
    foo: (a: string) => void;
    bar: (b: number) => void;
  }>()
  return vine\`<div>Test emits</div>\`
}`
    const { mockCompilerCtx, mockCompilerHooks } = createMockTransformCtx()
    compileVineTypeScriptFile(content, 'testAnalyzeVineEmits', mockCompilerHooks)
    expect(mockCompilerCtx.vineCompileErrors.length).toBe(0)
    expect(mockCompilerCtx.fileCtxMap.size).toBe(1)
    const fileCtx = mockCompilerCtx.fileCtxMap.get('testAnalyzeVineEmits')
    expect(fileCtx?.vineCompFns.length).toBe(1)
    const vineFnComp = fileCtx?.vineCompFns[0]
    expect(vineFnComp?.emitsAlias).toBe('myEmits')
    expect(vineFnComp?.emits).toEqual(['foo', 'bar'])
  })

  test('analyze `vineExpose` and `vineOptions` macro calls', () => {
    const content = `
function Comp() {
  const count = ref(1)
  vineExpose({ count })
  vineOptions({
    name: 'MyComp',
    inheritAttrs: false,
  })
  return vine\`<div>Test expose and options</div>\`
}`
    const { mockCompilerCtx, mockCompilerHooks } = createMockTransformCtx()
    compileVineTypeScriptFile(content, 'testAnalyzeVineExposeAndOptions', mockCompilerHooks)
    expect(mockCompilerCtx.vineCompileErrors.length).toBe(0)
    expect(mockCompilerCtx.fileCtxMap.size).toBe(1)
    const fileCtx = mockCompilerCtx.fileCtxMap.get('testAnalyzeVineExposeAndOptions')
    expect(fileCtx?.vineCompFns.length).toBe(1)
    const vineFnComp = fileCtx?.vineCompFns[0]
    expect(vineFnComp?.expose).toMatchSnapshot()
    expect(vineFnComp?.options).toMatchSnapshot()
  })

  test('analyze vine component function\'s Vue bindings type', () => {
    const content = `
import { ref, reactive } from 'vue'

const MyOutsideVar = 1
function MyOutSideFunc() {
  console.log('outside func')
}
class MyOutsideClass {
  constructor() {
    console.log('outside class')
  }
}
enum MyOutsideEnum {
  A = 1,
  B = 2,
}

export function MyComp() {
  const prop1 = vineProp.optional<string>()
  const count = ref(1)
  const state = reactive({
    name: 'vine',
    age: 1,
  })

  return vine\`
    <div>
      Test Vue bindings type
    </div>
  \`
}`
    const { mockCompilerCtx, mockCompilerHooks } = createMockTransformCtx()
    compileVineTypeScriptFile(content, 'testAnalyzeVineVueBindingsType', mockCompilerHooks)
    expect(mockCompilerCtx.vineCompileErrors.length).toBe(0)
    const fileCtx = mockCompilerCtx.fileCtxMap.get('testAnalyzeVineVueBindingsType')
    const vineFnComp = fileCtx?.vineCompFns[0]
    expect(vineFnComp?.bindings).toMatchInlineSnapshot(`
      {
        "MyComp": "setup-const",
        "MyOutSideFunc": "literal-const",
        "MyOutsideClass": "literal-const",
        "MyOutsideVar": "literal-const",
        "count": "setup-ref",
        "prop1": "setup-ref",
        "reactive": "setup-const",
        "ref": "setup-const",
        "state": "setup-reactive-const",
      }
    `)
  })

  test('analyze vine style macro call', () => {
    const content = `
function MyComp() {
  const color = ref('red')
  vineStyle.scoped(scss\`
    .app {
      color: v-bind(color)
    }
  \`)
  return vine\`<div>Test vine style</div>\`
}`
    const { mockCompilerCtx, mockCompilerHooks } = createMockTransformCtx()
    compileVineTypeScriptFile(content, 'testAnalyzeVineStyle', mockCompilerHooks)
    expect(mockCompilerCtx.vineCompileErrors.length).toBe(0)
    const fileCtx = mockCompilerCtx.fileCtxMap.get('testAnalyzeVineStyle')
    const vineFnComp = fileCtx?.vineCompFns[0]
    const scopeId = vineFnComp?.scopeId
    if (!scopeId) {
      throw new Error('scopeId should not be empty')
    }
    expect(scopeId).toBe('77af4072')
    expect(vineFnComp?.cssBindings).toEqual({
      color: '7aa07bf2',
    })
    const styleDefine = fileCtx?.styleDefine[scopeId]
    expect(styleDefine?.lang).toBe('scss')
    expect(styleDefine?.scoped).toBe(true)
  })

  test('analyze vine template', () => {
    const content = `
function MyBox(props: {
  title: string;
}) {
  return vine\`
    <div>
      <h1>{{ title }}</h1>
      <slot />
    </div>
  \`
}
function MyApp() {
  return vine\`
    <MyBox title="Test template">
      <div>Test inner content</div>
    </MyBox>
  \`
}`
    const { mockCompilerCtx, mockCompilerHooks } = createMockTransformCtx()
    compileVineTypeScriptFile(content, 'testAnalyzeVineTemplate', mockCompilerHooks)
    expect(mockCompilerCtx.vineCompileErrors.length).toBe(0)
    const fileCtx = mockCompilerCtx.fileCtxMap.get('testAnalyzeVineTemplate')
    const MyBoxComp = fileCtx?.vineCompFns[0]
    const MyApp = fileCtx?.vineCompFns[1]
    expect(MyBoxComp?.templateAst).toMatchSnapshot()
    expect(MyApp?.templateAst).toMatchSnapshot()
  })

  test('analyze vineProp validator and vineOptions reference locally declared variables', () => {
    const content = `
import { ref } from 'vue'

function MyComp() {
  const prop1 = vineProp<string>(() => {
    return val1.value > 0.5 ? 'A' : 'B'
  })
  vineOptions({
    name: val2.value,
  })

  const val1 = ref(Math.random())
  const val2 = ref('Test')
  return vine\`
    <div>Test reference locally declared variables</div>
  \`
}`
    const { mockCompilerCtx, mockCompilerHooks } = createMockTransformCtx()
    compileVineTypeScriptFile(content, 'testReferenceLocallyDeclaredVariables', mockCompilerHooks)
    expect(mockCompilerCtx.vineCompileErrors.length).toBe(2)
    expect(mockCompilerCtx.vineCompileErrors[0].msg)
      .toMatchInlineSnapshot('"Cannot reference \\"val1\\" locally declared variables because it will be hoisted outside of the setup() function."')
    expect(mockCompilerCtx.vineCompileErrors[1].msg)
      .toMatchInlineSnapshot('"Cannot reference \\"val2\\" locally declared variables because it will be hoisted outside of the setup() function."')
  })
})

describe('Test other helpers for compiler', () => {
  test('sort style import', () => {
    const content = `
function MyApp() {
  vineStyle(\`
    .app {
      padding: 10px;
      margin: 8px;
    }
  \`)
  return vine\`
    <div class="app">
      <MyBox />
      <p>Test sort style import</p>
    </div>
  \`
}
function MyBox() {
  vineStyle.scoped(scss\`
    .box {
      color: red;
    }
  \`)
  return vine\`
    <div class="box">
      Test sort style import
    </div>
  \`
}`
    const { mockCompilerCtx, mockCompilerHooks } = createMockTransformCtx()
    compileVineTypeScriptFile(content, 'testSortStyleImport', mockCompilerHooks)
    const fileCtx = mockCompilerCtx.fileCtxMap.get('testSortStyleImport')
    expect(fileCtx).not.toBeUndefined()
    const sorted = sortStyleImport(fileCtx!)
    expect(sorted).toMatchInlineSnapshot(`
      [
        "import 'testSortStyleImport?type=vine-style&scopeId=939fb36a&comp=MyApp&lang=css&virtual.css';",
        "import 'testSortStyleImport?type=vine-style&scopeId=939fac16&comp=MyBox&lang=scss&scoped=true&virtual.scss';",
      ]
    `)
  })
})
