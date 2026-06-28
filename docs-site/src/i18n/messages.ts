import { HERO_STORY_MOMENTS } from "../lib/hero-story.js";
import type { Locale } from "./locale.js";

// Shared, non-translated copy (proper nouns, CLI commands) lives here so it is
// declared exactly once and reused across both catalogs.
const CREATE_COMMAND = "npx @aperture-engine/cli create my-app";
const TAGLINE_EN = "3D engine for the agentic age.";

interface HeroMomentCopy {
  readonly label: string;
  readonly title: string;
  readonly body: string;
}

interface FactCopy {
  readonly title: string;
  readonly status: string;
  readonly summary: string;
  readonly points: readonly string[];
}

interface AssumptionCopy {
  readonly title: string;
  readonly statusLabel: string;
  readonly summary: string;
}

interface ShowcaseCopy {
  readonly name: string;
  readonly description: string;
  readonly capabilities: readonly string[];
}

export interface Messages {
  readonly nav: {
    readonly about: string;
    readonly showcases: string;
    readonly examples: string;
    readonly github: string;
    readonly tagline: string;
  };
  readonly language: {
    readonly label: string;
  };
  readonly hero: {
    readonly moments: Record<string, HeroMomentCopy>;
  };
  readonly about: {
    readonly eyebrow: string;
    readonly heading: string;
    readonly intro: string;
    readonly copyCommand: string;
    readonly facts: readonly FactCopy[];
    readonly assumptionsEyebrow: string;
    readonly assumptionsHeading: string;
    readonly assumptionsIntro: string;
    readonly assumptions: readonly AssumptionCopy[];
    readonly searchEyebrow: string;
    readonly searchHeading: string;
    readonly searchIntro: string;
  };
  readonly showcases: {
    readonly sidebarTitle: string;
    readonly open: string;
    readonly source: string;
    readonly status: { readonly active: string; readonly prototype: string };
    readonly items: Record<string, ShowcaseCopy>;
  };
  readonly examples: {
    readonly sidebarTitle: string;
    readonly searchPlaceholder: string;
    readonly searchLabel: string;
    readonly all: string;
    readonly open: string;
    readonly local: string;
    readonly source: string;
    readonly categories: Record<string, string>;
  };
  readonly reference: {
    readonly intro: string;
    readonly chunksSuffix: string;
    readonly placeholder: string;
    readonly searchLabel: string;
    readonly search: string;
    readonly filters: Record<string, string>;
    readonly ready: string;
    readonly loadingCorpus: string;
    readonly loadingModel: string;
    readonly embedding: string;
    readonly ranking: string;
    readonly noResults: string;
    readonly results: (count: number) => string;
    readonly visibleInFilter: (count: number) => string;
  };
}

function heroMomentCopy(
  overrides: Record<string, HeroMomentCopy>,
): Record<string, HeroMomentCopy> {
  const moments: Record<string, HeroMomentCopy> = {};
  for (const moment of HERO_STORY_MOMENTS) {
    moments[moment.id] = overrides[moment.id] ?? {
      label: moment.label,
      title: moment.title,
      body: moment.body,
    };
  }
  return moments;
}

const en: Messages = {
  nav: {
    about: "About",
    showcases: "Showcases",
    examples: "Examples",
    github: "GitHub",
    tagline: TAGLINE_EN,
  },
  language: {
    label: "Language",
  },
  // English hero copy is the single source of truth in hero-story.ts; reuse it
  // verbatim so the landing page and the day/night system never drift.
  hero: {
    moments: heroMomentCopy({}),
  },
  about: {
    eyebrow: "About",
    heading: "What Aperture is.",
    intro:
      "Aperture is a WebGPU-only, ECS-native 3D runtime built around a simple architecture: ECS is authoritative, rendering is derived from snapshots, simulation can live in a worker, and coding agents are treated as first-class contributors. These are the concrete pieces that matter to the assumptions below.",
    copyCommand: "Copy command",
    facts: [
      {
        title: "ECS is authoritative",
        status: "Implemented",
        summary:
          "Gameplay state lives in ECS. Rendering, input, physics, and tooling read from that data boundary instead of a renderer-owned scene graph.",
        points: [
          "Entities, transforms, hierarchy, resources, and gameplay state are ECS data.",
          "Rendering is derived from extracted snapshots.",
          "The renderer does not own authoritative game objects.",
        ],
      },
      {
        title: "Worker-first runtime",
        status: "Implemented",
        summary:
          "The default browser shape keeps simulation portable to a worker while the main thread owns the canvas, WebGPU, input, and UI.",
        points: [
          "Simulation and extraction can run off the main thread.",
          "Render snapshots are structured data passed across the boundary.",
          "The split makes deterministic stepping and inspection easier.",
        ],
      },
      {
        title: "WebGPU-only renderer",
        status: "Implemented",
        summary:
          "Aperture targets the modern browser GPU stack directly, including materials, shadows, post effects, readback, and diagnostics.",
        points: [
          "No WebGL fallback in the core renderer.",
          "Examples exercise cameras, lighting, materials, physics, particles, and UI.",
          "Showcase apps prove the path beyond small demos.",
        ],
      },
      {
        title: "Agent-readable tooling",
        status: "Active thesis",
        summary:
          "The engine is built around structured diagnostics, generated API references, runtime inspection, and reproducible routes.",
        points: [
          "Errors should explain what failed and what to inspect next.",
          "Examples and showcases double as verification surfaces.",
          "Reference search gives agents and humans the same indexed corpus.",
        ],
      },
    ],
    assumptionsEyebrow: "Assumptions",
    assumptionsHeading: "The bets being tested.",
    assumptionsIntro:
      "Aperture began as research, so these are intentionally short working hypotheses, not launch claims. Some of them may be wrong.",
    assumptions: [
      {
        title: "Building a 3D engine is becoming a one-person job",
        statusLabel: "Validated",
        summary:
          "Agents can carry enough implementation, migration, and verification work that a single developer can own engine-scale scope. The open question is how far that holds under production pressure.",
      },
      {
        title: "Agent-native structure can beat training-data familiarity",
        statusLabel: "Active thesis",
        summary:
          "For hard iterative work, inspectable state, deterministic checks, and machine-readable diagnostics may matter more than ecosystem popularity.",
      },
      {
        title: "Web 3D should be worker-first by default",
        statusLabel: "Active thesis",
        summary:
          "Keeping simulation off the main thread improves responsiveness and gives tools a clean data boundary to step, diff, and replay.",
      },
      {
        title: "Agentic 3D work moves toward headless validation",
        statusLabel: "Active thesis",
        summary:
          "Agents should be able to change ECS systems and validate state before paying the cost of browser and GPU rendering.",
      },
      {
        title: "The ecosystem moat may weaken",
        statusLabel: "Active thesis",
        summary:
          "If agents can study and port ideas quickly, engine architecture may matter more, though mature ecosystems still matter a lot today.",
      },
    ],
    searchEyebrow: "Search",
    searchHeading: "Transformer-powered search.",
    searchIntro:
      "The reference index is part of the experiment: humans and agents can search the same generated docs, public APIs, examples, diagnostics, and curated source chunks.",
  },
  showcases: {
    sidebarTitle: "Showcases",
    open: "Open",
    source: "Source",
    status: { active: "active", prototype: "prototype" },
    items: {
      "city-builder": {
        name: "City Builder",
        description:
          "A tool-like scene for ECS-authored placement, selection, and city-scale composition.",
        capabilities: ["ECS authoring", "layout tools", "3D editing"],
      },
      fps: {
        name: "FPS",
        description:
          "A first-person starter that exercises input, physics, camera control, and WebGPU rendering.",
        capabilities: ["physics", "input", "camera", "game loop"],
      },
      platformer: {
        name: "Platformer",
        description:
          "A compact character/action showcase focused on movement, collision, and readable systems.",
        capabilities: ["character control", "physics", "worker systems"],
      },
      racing: {
        name: "Racing",
        description:
          "A performance-heavy driving scene for render pacing, dynamic meshes, particles, shadows, and audio.",
        capabilities: ["render pacing", "particles", "shadows", "audio"],
      },
    },
  },
  examples: {
    sidebarTitle: "Examples",
    searchPlaceholder: "Search examples",
    searchLabel: "Search examples",
    all: "All",
    open: "Open",
    local: "Local",
    source: "Source",
    categories: {
      "Assets And GLB": "Assets and GLB",
      Basics: "Basics",
      "Cameras And Render Targets": "Cameras and render targets",
      "Diagnostics And Performance": "Diagnostics and performance",
      Interaction: "Interaction",
      "Lighting And Shadows": "Lighting and shadows",
      Materials: "Materials",
      "Particles And UI": "Particles and UI",
      Physics: "Physics",
      "Post Processing": "Post processing",
    },
  },
  reference: {
    intro:
      "Enter a question or capability and rank matches with the pinned local embedding contract.",
    chunksSuffix: "chunks",
    placeholder: "Search systems, diagnostics, examples, materials...",
    searchLabel: "Search Aperture references",
    search: "Search",
    filters: {
      any: "All",
      api: "API",
      docs: "Docs",
      example: "Examples",
      diagnostic: "Diagnostics",
      external: "External",
    },
    ready: "Ready",
    loadingCorpus: "Loading reference corpus",
    loadingModel: "Loading embedding model",
    embedding: "Embedding query",
    ranking: "Ranking results",
    noResults: "No matching references",
    results: (count) => `${count} references`,
    visibleInFilter: (count) => `${count} visible in filter`,
  },
};

const zh: Messages = {
  nav: {
    about: "关于",
    showcases: "案例展示",
    examples: "示例",
    github: "GitHub",
    tagline: "面向智能体时代的 3D 引擎。",
  },
  language: {
    label: "语言",
  },
  hero: {
    moments: heroMomentCopy({
      "ecs-native": {
        label: "ECS",
        title: "原生 ECS，而非场景图",
        body: "你的游戏状态是渲染器读取的纯数据，而不是你手动改动的可变对象树。实体与组件是权威来源，渲染只是派生出的快照。正是这一设计让 Aperture 快速、可并行、对智能体友好，也是场景图引擎事后无法改造的。",
      },
      "agent-first": {
        label: "智能体",
        title: "智能体优先，且人类可读",
        body: "为当下的开发方式而生：向智能体描述意图，而不是逐行手写代码。规整、局部、显式的系统既便于智能体生成，也便于人类信任；配套 1,200+ 条结构化诊断和内置 MCP 检查工具，让智能体的成果可验证，而非凭空猜测。",
      },
      multithreaded: {
        label: "Worker",
        title: "默认多线程",
        body: "在 Web 上你一直都在主线程编码。而在这里，你在 Worker 中编码，主线程交给渲染器。模拟开箱即用，默认运行在主线程之外，快照边界也已为你解决。你的游戏逻辑再也不会拖累帧率。",
      },
      "webgpu-rendering": {
        label: "WebGPU",
        title: "最先进的 WebGPU 渲染",
        body: "所绘制的一切都没有 WebGL 时代的妥协。基于物理的材质、真实面光源、聚簇光照、级联阴影、基于图像的光照，以及一整套现代后处理效果：TAA、泛光、SSAO、SSR，自始至终构建于 WebGPU 之上。",
      },
    }),
  },
  about: {
    eyebrow: "关于",
    heading: "Aperture 是什么。",
    intro:
      "Aperture 是一个纯 WebGPU、以 ECS 为核心的 3D 运行时，围绕一套简单的架构构建：ECS 是权威来源，渲染由快照派生，模拟可运行在 Worker 中，编码智能体被视为一等贡献者。下面这些具体部分正是支撑各项假设的关键。",
    copyCommand: "复制命令",
    facts: [
      {
        title: "ECS 是权威来源",
        status: "已实现",
        summary:
          "游戏玩法状态存放于 ECS。渲染、输入、物理和工具都从这一数据边界读取，而不是从渲染器拥有的场景图读取。",
        points: [
          "实体、变换、层级、资源和玩法状态都是 ECS 数据。",
          "渲染由提取出的快照派生而来。",
          "渲染器不拥有权威的游戏对象。",
        ],
      },
      {
        title: "Worker 优先的运行时",
        status: "已实现",
        summary:
          "默认的浏览器结构让模拟可移植到 Worker，同时主线程负责画布、WebGPU、输入和 UI。",
        points: [
          "模拟与提取可运行在主线程之外。",
          "渲染快照是跨边界传递的结构化数据。",
          "这种拆分让确定性步进和检查更为简单。",
        ],
      },
      {
        title: "纯 WebGPU 渲染器",
        status: "已实现",
        summary:
          "Aperture 直接面向现代浏览器的 GPU 技术栈，涵盖材质、阴影、后处理效果、回读和诊断。",
        points: [
          "核心渲染器没有 WebGL 回退。",
          "示例覆盖相机、光照、材质、物理、粒子和 UI。",
          "案例应用证明这条路径不止于小型演示。",
        ],
      },
      {
        title: "智能体可读的工具链",
        status: "进行中的论点",
        summary:
          "引擎围绕结构化诊断、生成式 API 参考、运行时检查和可复现路由而构建。",
        points: [
          "错误信息应说明失败原因以及接下来该检查什么。",
          "示例和案例既是演示，也是验证场景。",
          "参考检索为智能体与人类提供同一份索引语料。",
        ],
      },
    ],
    assumptionsEyebrow: "假设",
    assumptionsHeading: "正在验证的赌注。",
    assumptionsIntro:
      "Aperture 始于研究，因此这些是有意写得简短的工作假设，而非营销话术。其中有些可能是错的。",
    assumptions: [
      {
        title: "构建 3D 引擎正在变成一个人的工作",
        statusLabel: "已验证",
        summary:
          "智能体可以承担足够多的实现、迁移和验证工作，使单个开发者就能独自掌控引擎规模的工作范围。悬而未决的是，这一点在生产环境的压力下能成立到什么程度。",
      },
      {
        title: "智能体原生的结构可以胜过训练数据的熟悉度",
        statusLabel: "进行中的论点",
        summary:
          "对于困难的迭代工作，可检查的状态、确定性的校验和机器可读的诊断，也许比生态的流行度更重要。",
      },
      {
        title: "Web 3D 默认就应该是 Worker 优先",
        statusLabel: "进行中的论点",
        summary:
          "让模拟远离主线程能提升响应性，并为工具提供一条干净的数据边界来步进、对比和回放。",
      },
      {
        title: "智能体化的 3D 工作正走向无头验证",
        statusLabel: "进行中的论点",
        summary:
          "智能体应当能在付出浏览器和 GPU 渲染的代价之前，修改 ECS 系统并验证状态。",
      },
      {
        title: "生态护城河可能会减弱",
        statusLabel: "进行中的论点",
        summary:
          "如果智能体能快速研究并移植各种思路，引擎架构也许会更重要，尽管成熟的生态在今天仍然非常重要。",
      },
    ],
    searchEyebrow: "检索",
    searchHeading: "由 Transformer 驱动的检索。",
    searchIntro:
      "参考索引也是这场实验的一部分：人类和智能体可以检索同一份生成的文档、公开 API、示例、诊断和精选源码片段。",
  },
  showcases: {
    sidebarTitle: "案例展示",
    open: "打开",
    source: "源码",
    status: { active: "活跃", prototype: "原型" },
    items: {
      "city-builder": {
        name: "城市建造",
        description: "一个类工具的场景，用于 ECS 编排的放置、选择和城市规模的组合。",
        capabilities: ["ECS 编排", "布局工具", "3D 编辑"],
      },
      fps: {
        name: "第一人称射击",
        description: "一个第一人称起步项目，演练输入、物理、相机控制和 WebGPU 渲染。",
        capabilities: ["物理", "输入", "相机", "游戏循环"],
      },
      platformer: {
        name: "平台跳跃",
        description: "一个紧凑的角色/动作案例，聚焦于移动、碰撞和易读的系统。",
        capabilities: ["角色控制", "物理", "Worker 系统"],
      },
      racing: {
        name: "竞速",
        description: "一个对性能要求较高的驾驶场景，用于考验渲染节奏、动态网格、粒子、阴影和音频。",
        capabilities: ["渲染节奏", "粒子", "阴影", "音频"],
      },
    },
  },
  examples: {
    sidebarTitle: "示例",
    searchPlaceholder: "搜索示例",
    searchLabel: "搜索示例",
    all: "全部",
    open: "打开",
    local: "本地",
    source: "源码",
    categories: {
      "Assets And GLB": "资源与 GLB",
      Basics: "基础",
      "Cameras And Render Targets": "相机与渲染目标",
      "Diagnostics And Performance": "诊断与性能",
      Interaction: "交互",
      "Lighting And Shadows": "光照与阴影",
      Materials: "材质",
      "Particles And UI": "粒子与 UI",
      Physics: "物理",
      "Post Processing": "后处理",
    },
  },
  reference: {
    intro: "输入一个问题或能力，使用固定的本地嵌入模型对匹配项排序。",
    chunksSuffix: "个片段",
    placeholder: "搜索系统、诊断、示例、材质……",
    searchLabel: "搜索 Aperture 参考",
    search: "搜索",
    filters: {
      any: "全部",
      api: "API",
      docs: "文档",
      example: "示例",
      diagnostic: "诊断",
      external: "外部",
    },
    ready: "就绪",
    loadingCorpus: "正在加载参考语料",
    loadingModel: "正在加载嵌入模型",
    embedding: "正在嵌入查询",
    ranking: "正在排序结果",
    noResults: "没有匹配的参考",
    results: (count) => `${count} 条参考`,
    visibleInFilter: (count) => `筛选中可见 ${count} 条`,
  },
};

export const messages: Record<Locale, Messages> = { en, zh };

export function getMessages(locale: Locale): Messages {
  return messages[locale] ?? messages.en;
}
