import type {
  SimulationFixedStepCallback,
  SimulationFixedStepTaskOptions,
} from "@aperture-engine/runtime";
import {
  runDisposersInReverse,
  type AssetRegistry,
  type EcsWorld,
  type MaybePromise,
} from "@aperture-engine/simulation";

export type { MaybePromise };

export interface ApertureFeatureDescriptor {
  readonly id: string;
  /** Hard dependencies: install fails when one is missing, and a `requires` cycle is an error. */
  readonly requires?: readonly string[];
  /**
   * Soft ordering hints: install after these features when they are present.
   * Missing targets are ignored, and hints that would form a cycle are
   * dropped rather than failing resolution.
   */
  readonly optional?: readonly string[];
  /** Features that cannot be configured together with this one. */
  readonly conflictsWith?: readonly string[];
}

export type FeatureDisposer = () => MaybePromise<void>;

export interface FeatureInstallHandle {
  dispose(): MaybePromise<void>;
}

export type FeatureInstallResult =
  | void
  | FeatureDisposer
  | FeatureInstallHandle;

export interface FeatureDiagnostic {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly featureId: string;
  readonly message: string;
  readonly suggestedFix?: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface FeatureDiagnosticsSink {
  report(diagnostic: FeatureDiagnostic): void;
  scoped(featureId: string): ScopedFeatureDiagnosticsSink;
  list(): readonly FeatureDiagnostic[];
}

export interface ScopedFeatureDiagnosticsSink {
  report(
    diagnostic: Omit<FeatureDiagnostic, "featureId"> & {
      readonly featureId?: string;
    },
  ): void;
}

export interface FeatureComponentContext {
  readonly world: EcsWorld;
  readonly diagnostics: FeatureDiagnosticsSink;
}

export interface FeatureAssetContext {
  readonly registry: AssetRegistry;
  readonly diagnostics: FeatureDiagnosticsSink;
}

export interface FeatureRuntimeContext {
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
  readonly registerFixedStepTask: (
    task: SimulationFixedStepCallback,
    options?: SimulationFixedStepTaskOptions,
  ) => () => void;
  readonly diagnostics: FeatureDiagnosticsSink;
}

export interface ExtractionHook {
  readonly id: string;
  readonly packetFamilies: readonly string[];
}

export type RegisterExtractor = (hook: ExtractionHook) => FeatureDisposer;

export interface FeatureExtractionContext {
  readonly registerExtractor: RegisterExtractor;
  readonly diagnostics: FeatureDiagnosticsSink;
}

export interface ApertureWorkerFeature extends ApertureFeatureDescriptor {
  registerComponents?(context: FeatureComponentContext): void;
  registerAssets?(context: FeatureAssetContext): void;
  installRuntime?(
    context: FeatureRuntimeContext,
  ): MaybePromise<FeatureInstallResult>;
  installExtraction?(
    context: FeatureExtractionContext,
  ): MaybePromise<FeatureInstallResult>;
}

export interface InstallApertureWorkerFeaturesOptions {
  readonly features: readonly ApertureWorkerFeature[];
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
  readonly registerFixedStepTask: FeatureRuntimeContext["registerFixedStepTask"];
  readonly registerExtractor?: RegisterExtractor;
  readonly diagnostics?: FeatureDiagnosticsSink;
}

export interface InstalledApertureWorkerFeatures {
  readonly order: readonly string[];
  readonly diagnostics: FeatureDiagnosticsSink;
  dispose(): Promise<void>;
}

interface InstalledFeatureDisposer {
  readonly featureId: string;
  readonly phase: "installRuntime" | "installExtraction";
  dispose(): MaybePromise<void>;
}

export class ApertureFeatureError extends Error {
  readonly code: string;
  readonly suggestedFix: string;
  readonly diagnostics: readonly FeatureDiagnostic[];

  constructor(input: {
    readonly code: string;
    readonly message: string;
    readonly suggestedFix: string;
    readonly diagnostics: readonly FeatureDiagnostic[];
    readonly cause?: unknown;
  }) {
    super(input.message, { cause: input.cause });
    this.name = "ApertureFeatureError";
    this.code = input.code;
    this.suggestedFix = input.suggestedFix;
    this.diagnostics = input.diagnostics;
  }
}

export function createFeatureDiagnosticsSink(
  initial: readonly FeatureDiagnostic[] = [],
): FeatureDiagnosticsSink {
  const diagnostics = [...initial];
  const sink: FeatureDiagnosticsSink = {
    report(diagnostic) {
      diagnostics.push(diagnostic);
    },
    scoped(featureId) {
      return {
        report(diagnostic) {
          sink.report({
            ...diagnostic,
            featureId: diagnostic.featureId ?? featureId,
          });
        },
      };
    },
    list() {
      return diagnostics.slice();
    },
  };

  return sink;
}

export async function installApertureWorkerFeatures(
  options: InstallApertureWorkerFeaturesOptions,
): Promise<InstalledApertureWorkerFeatures> {
  const diagnostics = options.diagnostics ?? createFeatureDiagnosticsSink();
  const orderedFeatures = resolveApertureWorkerFeatureOrder(
    options.features,
    diagnostics,
  );
  const disposers: InstalledFeatureDisposer[] = [];
  const registerExtractor =
    options.registerExtractor ?? createMissingExtractorRegistrar(diagnostics);

  try {
    for (const feature of orderedFeatures) {
      feature.registerComponents?.({
        world: options.world,
        diagnostics,
      });
    }

    for (const feature of orderedFeatures) {
      feature.registerAssets?.({
        registry: options.assets,
        diagnostics,
      });
    }

    for (const feature of orderedFeatures) {
      const result = await feature.installRuntime?.({
        world: options.world,
        assets: options.assets,
        registerFixedStepTask: options.registerFixedStepTask,
        diagnostics,
      });
      pushDisposer(disposers, feature, "installRuntime", result);
    }

    for (const feature of orderedFeatures) {
      const result = await feature.installExtraction?.({
        registerExtractor,
        diagnostics,
      });
      pushDisposer(disposers, feature, "installExtraction", result);
    }
  } catch (error) {
    try {
      await rollbackInstalledFeatures(disposers, diagnostics);
    } catch (rollbackError) {
      throw featureInstallError(
        new AggregateError(
          [error, rollbackError],
          "Aperture feature installation failed and rollback also failed.",
        ),
        diagnostics,
      );
    }
    throw featureInstallError(error, diagnostics);
  }

  return {
    order: orderedFeatures.map((feature) => feature.id),
    diagnostics,
    async dispose() {
      await rollbackInstalledFeatures(disposers, diagnostics);
    },
  };
}

export function resolveApertureWorkerFeatureOrder(
  features: readonly ApertureWorkerFeature[],
  diagnostics: FeatureDiagnosticsSink = createFeatureDiagnosticsSink(),
): readonly ApertureWorkerFeature[] {
  // Resolution must be a pure function of the feature list: only diagnostics
  // added during THIS call may fail it, never entries a caller-supplied or
  // reused sink already carried.
  const preexistingDiagnostics = diagnostics.list().length;
  const byId = new Map<string, ApertureWorkerFeature>();

  for (const feature of features) {
    if (byId.has(feature.id)) {
      diagnostics.report({
        code: "aperture.feature.duplicate",
        severity: "error",
        featureId: feature.id,
        message: `Feature '${feature.id}' was configured more than once.`,
        suggestedFix:
          "Remove the duplicate feature entry or compose it through one preset.",
        data: { featureId: feature.id },
      });
      throw featureResolutionError(diagnostics);
    }

    byId.set(feature.id, feature);
  }

  for (const feature of features) {
    for (const requiredId of feature.requires ?? []) {
      if (!byId.has(requiredId)) {
        diagnostics.report({
          code: "aperture.feature.missingRequired",
          severity: "error",
          featureId: feature.id,
          message: `Feature '${feature.id}' requires missing feature '${requiredId}'.`,
          suggestedFix:
            "Add the required feature or remove the dependent feature from the app configuration.",
          data: { featureId: feature.id, requiredId },
        });
      }
    }

    for (const conflictId of feature.conflictsWith ?? []) {
      if (byId.has(conflictId)) {
        diagnostics.report({
          code: "aperture.feature.conflict",
          severity: "error",
          featureId: feature.id,
          message: `Feature '${feature.id}' conflicts with configured feature '${conflictId}'.`,
          suggestedFix:
            "Remove one of the conflicting features from the app configuration.",
          data: { featureId: feature.id, conflictId },
        });
      }
    }
  }

  if (
    diagnostics
      .list()
      .slice(preexistingDiagnostics)
      .some((diagnostic) => diagnostic.severity === "error")
  ) {
    throw featureResolutionError(diagnostics);
  }

  const ordered: ApertureWorkerFeature[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sccByFeatureId = assignFeatureSccIds(features, byId);

  for (const feature of features) {
    visitFeature(
      feature,
      byId,
      sccByFeatureId,
      visited,
      visiting,
      ordered,
      diagnostics,
    );
  }

  return ordered;
}

function visitFeature(
  feature: ApertureWorkerFeature,
  byId: ReadonlyMap<string, ApertureWorkerFeature>,
  sccByFeatureId: ReadonlyMap<string, number>,
  visited: Set<string>,
  visiting: Set<string>,
  ordered: ApertureWorkerFeature[],
  diagnostics: FeatureDiagnosticsSink,
): void {
  if (visited.has(feature.id)) {
    return;
  }

  if (visiting.has(feature.id)) {
    diagnostics.report({
      code: "aperture.feature.dependencyCycle",
      severity: "error",
      featureId: feature.id,
      message: `Feature dependency cycle includes '${feature.id}'.`,
      suggestedFix:
        "Break the feature dependency cycle by removing or reordering the feature dependency declarations.",
      data: { featureId: feature.id },
    });
    throw featureResolutionError(diagnostics);
  }

  visiting.add(feature.id);

  for (const requiredId of feature.requires ?? []) {
    const requiredFeature = byId.get(requiredId);
    if (requiredFeature !== undefined) {
      visitFeature(
        requiredFeature,
        byId,
        sccByFeatureId,
        visited,
        visiting,
        ordered,
        diagnostics,
      );
    }
  }

  for (const optionalId of feature.optional ?? []) {
    const optionalFeature = byId.get(optionalId);

    // `optional` is a soft ordering hint. Every cycle lives inside one
    // strongly connected component, so an optional edge between two features
    // in the same component is exactly a hint that would create a cycle —
    // drop it and keep resolving. Only `requires` cycles are hard errors.
    if (
      optionalFeature === undefined ||
      sccByFeatureId.get(feature.id) === sccByFeatureId.get(optionalId)
    ) {
      continue;
    }

    visitFeature(
      optionalFeature,
      byId,
      sccByFeatureId,
      visited,
      visiting,
      ordered,
      diagnostics,
    );
  }

  visiting.delete(feature.id);
  visited.add(feature.id);
  ordered.push(feature);
}

function assignFeatureSccIds(
  features: readonly ApertureWorkerFeature[],
  byId: ReadonlyMap<string, ApertureWorkerFeature>,
): Map<string, number> {
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccIds = new Map<string, number>();
  let nextIndex = 0;
  let nextSccId = 0;

  const connect = (feature: ApertureWorkerFeature): void => {
    const index = nextIndex;
    nextIndex += 1;
    indices.set(feature.id, index);
    lowLinks.set(feature.id, index);
    stack.push(feature.id);
    onStack.add(feature.id);

    for (const dependencyId of [
      ...(feature.requires ?? []),
      ...(feature.optional ?? []),
    ]) {
      const dependency = byId.get(dependencyId);

      if (dependency === undefined) {
        continue;
      }

      if (!indices.has(dependencyId)) {
        connect(dependency);
        lowLinks.set(
          feature.id,
          Math.min(
            lowLinks.get(feature.id) ?? index,
            lowLinks.get(dependencyId) ?? index,
          ),
        );
      } else if (onStack.has(dependencyId)) {
        lowLinks.set(
          feature.id,
          Math.min(
            lowLinks.get(feature.id) ?? index,
            indices.get(dependencyId) ?? index,
          ),
        );
      }
    }

    if (lowLinks.get(feature.id) === indices.get(feature.id)) {
      const sccId = nextSccId;
      nextSccId += 1;

      for (;;) {
        const memberId = stack.pop();

        if (memberId === undefined) {
          break;
        }

        onStack.delete(memberId);
        sccIds.set(memberId, sccId);

        if (memberId === feature.id) {
          break;
        }
      }
    }
  };

  for (const feature of features) {
    if (!indices.has(feature.id)) {
      connect(feature);
    }
  }

  return sccIds;
}

function pushDisposer(
  disposers: InstalledFeatureDisposer[],
  feature: ApertureWorkerFeature,
  phase: "installRuntime" | "installExtraction",
  result: FeatureInstallResult | undefined,
): void {
  const disposer = installResultToDisposer(result);

  if (disposer === null) {
    return;
  }

  let disposed = false;
  disposers.push({
    featureId: feature.id,
    phase,
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      return disposer();
    },
  });
}

function installResultToDisposer(
  result: FeatureInstallResult | undefined,
): FeatureDisposer | null {
  if (result === undefined) {
    return null;
  }

  if (typeof result === "function") {
    return result;
  }

  return () => result.dispose();
}

async function rollbackInstalledFeatures(
  disposers: readonly InstalledFeatureDisposer[],
  diagnostics: FeatureDiagnosticsSink,
): Promise<void> {
  await runDisposersInReverse({
    disposers: disposers.map((disposer) => () => disposer.dispose()),
    failureMessage: "One or more feature disposers failed.",
    onError(error, index) {
      const disposer = disposers[index];

      diagnostics.report({
        code: "aperture.feature.disposeFailed",
        severity: "error",
        featureId: disposer?.featureId ?? "feature-resolver",
        message: "Feature disposer failed.",
        suggestedFix:
          "Inspect the feature disposer and ensure teardown can run safely during app shutdown or rollback.",
        data: {
          phase: disposer?.phase,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    },
  });
}

function featureResolutionError(
  diagnostics: FeatureDiagnosticsSink,
): ApertureFeatureError {
  return new ApertureFeatureError({
    code: "aperture.feature.resolutionFailed",
    message: "Aperture feature resolution failed.",
    suggestedFix:
      "Inspect the feature diagnostics and fix duplicate, missing, conflicting, or cyclic feature declarations.",
    diagnostics: diagnostics.list(),
  });
}

function featureInstallError(
  error: unknown,
  diagnostics: FeatureDiagnosticsSink,
): ApertureFeatureError {
  if (error instanceof ApertureFeatureError) {
    return error;
  }

  diagnostics.report({
    code: "aperture.feature.installFailed",
    severity: "error",
    featureId: "feature-resolver",
    message:
      error instanceof Error
        ? error.message
        : "Aperture feature installation failed.",
    suggestedFix:
      "Inspect the feature diagnostics and fix the failing feature install hook.",
  });

  return new ApertureFeatureError({
    code: "aperture.feature.installFailed",
    message: "Aperture feature installation failed.",
    suggestedFix:
      "Inspect the feature diagnostics and fix the failing feature install hook.",
    diagnostics: diagnostics.list(),
    cause: error,
  });
}

function createMissingExtractorRegistrar(
  diagnostics: FeatureDiagnosticsSink,
): RegisterExtractor {
  return (hook) => {
    diagnostics.report({
      code: "aperture.feature.extractorRegistryMissing",
      severity: "error",
      featureId: hook.id,
      message: `Feature '${hook.id}' attempted to register extraction without an extraction registry.`,
      suggestedFix:
        "Install the feature through a resolver that provides an extraction registry, or remove the extraction hook from this phase.",
      data: { packetFamilies: hook.packetFamilies },
    });
    throw featureResolutionError(diagnostics);
  };
}
