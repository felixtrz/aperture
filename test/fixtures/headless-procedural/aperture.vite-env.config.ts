// Simulates pointing `aperture headless` at the scaffold's BROWSER config:
// outside a Vite build `import.meta.env` is undefined, so the module-scope
// `import.meta.env.BASE_URL` read throws this exact TypeError before the
// config object (and any mode check) is ever reached (#74). The throw is
// hand-rolled because the test runner itself defines import.meta.env in
// transformed modules, so the real access cannot fail here.
throw new TypeError("Cannot read properties of undefined (reading 'BASE_URL')");
