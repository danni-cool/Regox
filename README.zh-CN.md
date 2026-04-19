# Regox

> **React on Go. No Node in production.**
>
> 用 Go 跑 React,生产环境不需要 Node。

Regox 是一个为 Go 技术栈团队设计的全栈 Web 框架。你用 React 编写前端界面,用 Go 运行后端服务,生产环境只交付一个 Go 二进制——没有 Node.js 运行时。一份 OpenAPI 契约让前端和后端自动保持同步。

[English README](./README.md)

---

## 为什么是 Regox

如果你的团队满足以下条件:

- 在 Go 上有深度积累(基建、监控、部署、性能调优都围绕 Go 构建)
- 前端团队使用 React,不希望切换到 Vue、Svelte 或服务端模板
- 不希望为了 SSR 引入 Node.js 运行时,承担额外的资源占用与运维复杂度

那么现有方案都不够契合:

| 方案 | 问题 |
|---|---|
| Next.js | 运行时需要 Node,和 Go 基建并行维护两套体系 |
| 纯 Go 内嵌 JS 引擎 (goja / wazero) | React 18+ 功能受限,性能比 Node 差一个数量级 |
| Go API + 独立 Next.js 部署 | 两套服务运维,缓存和限流要做两份 |
| 全 Go 模板 (templ) | 放弃 React 生态,前端重写 UI 层 |

Regox 的定位是**在保留 React 开发体验的前提下,让运行时完全留在 Go**。

---

## 核心理念

### 1. 构建时 Node,运行时 Go

Node.js 被降级为仅在 CI/CD 管线中使用的构建工具,跟 Vite、Webpack 定位相同。生产镜像里只有 Go 二进制和静态资源。

```
构建时:
  React 源码 ──[ Node + Vite + Regox 插件 ]──> Go 模板 + Manifest + JS Bundle

运行时:
  HTTP 请求 ──> Go 服务 ──> 模板渲染 ──> 流式 HTML 响应
```

### 2. OpenAPI 作为唯一契约

手写一份 OpenAPI spec 作为唯一权威来源，同时驱动前后端，双方从第一天就可以并行开发：

```
              openapi.yaml  ← 唯一权威来源，手写
                     │
        ┌────────────┴────────────┐
        ↓                         ↓
  oapi-codegen              openapi-typescript
  Go resolver 接口           TS 类型 + 页面数据类型
  + schema struct            + dev mock JSON
        │                         │
        ↓                         ↓
  后端实现接口               前端导入生成的类型
```

改一次 spec，运行 `pnpm codegen`，前后端都会在编译期暴露不同步的地方。

### 3. 四种渲染模式按页面选择

| 模式 | 实现 | 适用场景 | 单机吞吐 |
|---|---|---|---|
| **SSG** | 构建时 Node 渲染出 HTML,Go 托管 | 文档、营销页、博客 | 50k+ QPS |
| **模板化 SSR** | 构建时编译为 Go 模板,运行时填数据 | 商品页、列表、强 SEO 页面 | 20k+ QPS |
| **ISR** | 模板化 SSR + Go 缓存层 + 后台 revalidate | 更新频率中等的内容页 | 接近 SSG |
| **CSR** | Go 吐壳 + API,浏览器渲染 | 后台管理、强交互工具 | 静态文件速度 |

对于极少数"强 SEO + 强动态"的页面,可以选配 Node sidecar 做真正的 React Streaming SSR,但默认情况下用不到。

### 4. 流式优先

Out-of-Order HTML Streaming 默认启用。前端用 `<StreamBoundary>` 标注异步边界,构建时拆分模板,运行时 Go 用 goroutine + channel 并行拉数据、按就绪顺序 flush 片段。

浏览器端产物与 React 18 的 `renderToPipeableStream` 等价,但实现不依赖 Node 运行时。

---

## 架构速览

```
┌─────────────────────────────────────────────────────────────────┐
│                         开发 / 构建时                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   openapi.yaml ──────────┬──> Go resolver 接口 (oapi-codegen)   │
│   (唯一权威来源)          └──> TS 类型 + mock (openapi-typescript) │
│                                                                    │
│   frontend/pages/*.tsx ──> Vite + Regox Plugin                   │
│                          │                                         │
│                          ├── Island 自动检测 (AST 静态分析)        │
│                          ├──> dist/templates/*.html (Go 模板)     │
│                          ├──> dist/assets/islands/*.js (bundle)   │
│                          └──> dist/manifest.json                   │
│                                                                    │
│   backend/**/*.go ───────> Go Compiler                            │
│                                                                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                           运行时                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                    │
│                    ┌─────────────────────┐                        │
│    HTTP Request ──>│   Go Regox Server   │                        │
│                    │                      │                        │
│                    │  ├─ Router           │                        │
│                    │  ├─ Page Resolvers   │<── DB / Cache / RPC    │
│                    │  ├─ Template Engine  │                        │
│                    │  └─ Stream Writer    │                        │
│                    └──────────┬───────────┘                        │
│                               │                                     │
│                ┌──────────────┴──────────────┐                      │
│                ↓                             ↓                      │
│         Streaming HTML              JSON API Response               │
│                                                                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 快速上手示例(设计草案)

> 以下 API 为设计草案,尚未全部实现,用于展示最终目标的开发体验。实现过程中会迭代。

### 目录结构

```
my-app/
├── openapi.yaml                   # 先写这个，唯一权威来源
├── regox.config.ts                # 构建配置
│
├── frontend/
│   ├── pages/
│   │   └── product/
│   │       └── [id].tsx           # 标准 React 组件，无需任何注解
│   ├── components/
│   │   └── CartButton.tsx         # 编译器自动检测为 Island
│   └── generated/
│       └── types.ts               # openapi-typescript 生成，勿手动修改
│
├── backend/
│   ├── resolvers/
│   │   └── product.go             # 实现 generated 包中的 PageResolvers 接口
│   ├── generated/
│   │   └── resolvers.gen.go       # oapi-codegen 生成，勿手动修改
│   └── main.go
│
└── go.mod
```

### 一个页面的完整生命周期

#### 1. 先写 OpenAPI spec

```yaml
# openapi.yaml
/internal/pages/product/{id}:
  get:
    operationId: GetProductPage
    responses:
      "200":
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ProductPageData"
```

运行 `pnpm codegen`，TS 类型和 Go 接口自动生成。

#### 2. 前端定义页面（React）

```tsx
// frontend/pages/product/[id].tsx
import type { ProductPageData } from '@/generated/types'  // 生成的类型
import { CartButton } from '@/components/CartButton'       // 标准 React 组件
import type { RegoxPageConfig } from 'regox'

export const regox = { mode: 'ssr' } satisfies RegoxPageConfig

export default function ProductPage({ product }: ProductPageData) {
  return (
    <main>
      <h1>{product.title}</h1>
      <p>{product.description}</p>
      {/* CartButton 用了 useState + onClick，编译器自动识别为 Island */}
      <CartButton productId={product.id} price={product.price} />
    </main>
  )
}
```

#### 3. 后端实现 Resolver（Go）

```go
// backend/resolvers/product.go
package resolvers

import (
    "context"
    gen "myapp/backend/generated" // oapi-codegen 生成
)

type Resolvers struct{}

func (r *Resolvers) GetProductPage(ctx context.Context, id string) (*gen.ProductPageData, error) {
    product, err := db.GetProduct(ctx, id)
    if err != nil {
        return nil, err
    }
    return &gen.ProductPageData{Product: product}, nil
}
```

#### 4. 构建后的产物

```
dist/
├── manifest.json
├── templates/
│   └── product-[id]/
│       ├── shell.html         # 带 {{.Product.*}} 占位符
│       └── reviews.html       # 流式片段模板
├── assets/
│   ├── islands/
│   │   └── cart-button.[hash].js
│   └── vendor.[hash].js
```

**4. 运行时行为**

```
GET /product/abc123
  │
  ├─ [2ms]   Go 渲染 shell,flush(浏览器开始下载 JS/CSS)
  ├─ [30ms]  Product 数据就绪,渲染插槽,flush
  ├─ [150ms] Reviews 数据就绪,渲染流式片段 + 移动脚本,flush
  └─ [151ms] 响应结束
```

---

## 技术栈

### 运行时

- **[Go 1.22+](https://go.dev/)** — 运行时
- **[Huma](https://huma.rocks/)** — Go HTTP 框架,提供 OpenAPI 自动生成
- **[templ](https://templ.guide/)** — Go 模板引擎(可选,作为 `html/template` 的高性能替代)
- **[Vite](https://vitejs.dev/)** — 前端构建工具
- **[React 18+](https://react.dev/)** — UI 框架

### Codegen 工具链

- **[oapi-codegen](https://github.com/oapi-codegen/oapi-codegen)** — OpenAPI → Go
- **[openapi-typescript](https://github.com/drwpow/openapi-typescript)** — OpenAPI → TS

---

## 路线图

### Phase 0 — 设计与原型验证（当前）

- [x] 架构设计与技术选型
- [x] 核心抽象定义（路由、渲染模式、Island 自动检测、状态管理）
- [x] OpenAPI-first 契约设计与 codegen 流程
- [x] Monorepo 结构（`packages/vite-plugin`、`go/server`、`apps/mvp`）
- [ ] 关键技术点原型验证
  - [ ] JSX → Go 模板编译器（哨兵值 + AST 静态分析）
  - [ ] Go Out-of-Order Streaming 实现
  - [ ] Island 自动检测准确率（传递性依赖分析）

### Phase 1 — MVP（目标：端到端跑通一个完整应用）

- [ ] Vite 插件：SSR/ISR 页面 JSX → Go 模板编译
- [ ] Vite 插件：Island 自动检测（hooks + 事件处理器）+ bundle 提取
- [ ] Vite 插件：manifest.json 生成
- [ ] Go Runtime：manifest 加载、page resolver 注册、模板引擎
- [ ] Island hydration runtime（`regox-runtime.js`，目标 < 1KB）
- [ ] Dev 模式：mock 回退 + Go air 热重载 + WebSocket 状态推送
- [ ] 端到端 Demo：CSR + SSR + ISR 页面，含跨 Island 状态

### Phase 2 — 流式与生产加固

- [ ] `<StreamBoundary>` 组件与编译支持
- [ ] Go 并发流式渲染（goroutine + channel）
- [ ] ISR 缓存状态机：stale-while-revalidate、tag invalidation
- [ ] 资源优化：HTTP/2 Push、103 Early Hints

### Phase 3 — ISR 与生产特性

- [ ] ISR 缓存状态机:stale-while-revalidate、tag invalidation
- [ ] 多实例协调:基于 Redis 的去重 revalidate
- [ ] 可观测性:OpenTelemetry、结构化日志、Prometheus metrics
- [ ] 部署支持:Docker、Kubernetes、单二进制

### Phase 4 — 生态与文档

- [ ] 完整文档站(用 Regox 自己构建)
- [ ] 示例项目:博客、电商、内部仪表盘
- [ ] 迁移指南:从 Next.js / Nuxt / 纯 Go 模板迁移
- [ ] 社区插件系统

### 探索中(尚未决定是否纳入)

- 边缘部署适配(Cloudflare Workers / Fastly 的 Go runtime)
- React Server Components 的有限支持(通过 Node sidecar)
- 可视化编辑器(拖拽布局 → 自动生成组件)

---

## 设计取舍

### 我们选择

- ✅ **运行时简洁优先**:生产只有 Go,运维心智负担最低
- ✅ **约定优于配置**:文件路由、命名约定、自动 codegen
- ✅ **显式优于魔法**:类型契约、流式边界都显式声明
- ✅ **渐进采用**:可以从一个页面开始,不强求全栈重写

### 我们放弃

- ❌ **React 任意运行时能力**:部分 hooks、context、第三方组件在 SSR 编译中受限
- ❌ **React Server Components 原生支持**:RSC 深度依赖 Node,与核心理念冲突
- ❌ **零构建步骤**:必须有构建时 Node,这是换取运行时纯 Go 的必要成本
- ❌ **完全替代 Next.js**:如果团队没有 Go 基建,Next.js 是更合适的选择

---

## 适合 / 不适合

### 适合的团队

- Go 是主要后端语言,团队有 Go 工程化沉淀
- React 是前端标准,希望保留其生态
- 对运行时资源占用敏感(容器内存、冷启动、单二进制部署)
- 规模到了需要自建基建的阶段(几十个页面以上、万级 QPS)

### 不适合的场景

- 团队只有 Node 经验,没有 Go 人员 → Next.js 更合适
- 需要完整的 React Server Components → Next.js 14+
- 应用极度依赖某个特定 React 库的服务端行为(如 Radix Portal 的 SSR)
- 只有几个简单页面,没有长期演进需求 → 用 Vite + Go API 即可

---

## 项目状态

**⚠️ 当前阶段:设计与原型验证(Phase 0)**

Regox 尚未发布可用版本。本 README 描述的是目标架构与设计意图,用于对齐共识、吸引早期贡献者。

欢迎在 Issues 中讨论架构决策、提出反对意见、分享类似场景经验。

---

## FAQ

**Q: 为什么不直接用 Next.js + Go API?**
A: 可以,而且对很多团队来说就是最优解。Regox 适用的场景是:运维两个运行时的成本(重复的可观测性、缓存、限流、部署管线)超过了 Next.js 原生特性的收益。如果你的 Go 基建已经成熟,与其并行维护,不如扩展它。

**Q: 所有 React 组件都能编译成 Go 模板吗?**
A: 不能。编译器支持的是一个"受限 React 子集":纯渲染组件、简单的条件/循环、props 驱动的输出。Hooks、refs、portals、带状态的第三方组件应该放在 Islands 里,由客户端渲染,不参与服务端编译。

**Q: 跟 Astro、Qwik、Marko 比怎么样?**
A: 它们都把运行时放在 Node。Regox 的唯一差异是运行时在 Go,因此继承了 Go 的并发模型、部署方案、可观测性生态。如果你的团队已经在 Node 生态里,Astro / Qwik 是更成熟的选择。

**Q: 为什么选 OpenAPI 而不是 gRPC 或 GraphQL?**
A: OpenAPI 是 REST API + 浏览器客户端场景下最务实的契约格式。Go 生态有成熟工具(Huma、oapi-codegen),TS 生态也有成熟工具(openapi-typescript),而且 spec 本身人类可读,方便 review。gRPC 在浏览器需要 grpc-web 网关;GraphQL 的流式和缓存在 SSR 场景下会变得复杂。

---

## 贡献

Regox 处于最早期设计阶段。现阶段最有价值的贡献方式是在 GitHub Issues 中挑战设计决策。每个 Phase 启动前会发布 RFC,收集反馈后再进入实现。

代码贡献指南将在 Phase 1 启动时发布。

---

## License

TBD(候选:Apache 2.0 / MIT)

---

<p align="center">
  <i>Regox — React on Go. No Node in production.</i>
</p>