// A dependency-free module used to exercise the headless Vite SSR runtime
// without loading the engine (which would register ECS components a second
// time in a shared vitest worker).
export const plainValue = 42;

export function plainGreeting(name: string): string {
  return `hello ${name}`;
}
