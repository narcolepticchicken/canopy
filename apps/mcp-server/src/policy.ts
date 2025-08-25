import { readFile } from 'fs/promises';

export type Decision = { outcome: 'allow' | 'deny'; reasons: string[] };

// Lightweight pluggable policy engine. If POLICY_WASM_PATH is provided and
// @open-policy-agent/opa-wasm is installed, it will attempt to evaluate the
// input against the policy and expect a result shape with { result: { allow } }.
// Otherwise, it defaults to allow.
export class PolicyEngine {
  private wasmPath?: string;
  private ready: boolean = false;
  private error?: string;
  private policy: any;

  constructor(wasmPath?: string) {
    this.wasmPath = wasmPath;
  }

  status() {
    if (!this.wasmPath) return { mode: 'allow-all' };
    return { mode: this.ready ? 'opa-wasm' : 'warming', error: this.error };
  }

  async init() {
    if (!this.wasmPath) return;
    try {
      const wasm = await readFile(this.wasmPath);
      // Dynamic import to avoid hard dependency when unused
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = await import('@open-policy-agent/opa-wasm');
      // @ts-ignore
      const policy = await (mod as any).loadPolicy(wasm);
      // Optional: set base data
      policy.setData({});
      this.policy = policy;
      this.ready = true;
    } catch (e: any) {
      this.error = e?.message || String(e);
      this.ready = false;
    }
  }

  async evaluate(input: unknown): Promise<Decision> {
    if (!this.wasmPath || !this.ready || !this.policy) {
      return { outcome: 'allow', reasons: [] };
    }
    try {
      const result = this.policy.evaluate(input);
      // Expecting array with { result: { allow: boolean, reasons?: string[] } }
      const first = Array.isArray(result) ? result[0] : undefined;
      const allow = first?.result?.allow === true;
      const reasons = Array.isArray(first?.result?.reasons) ? first.result.reasons : [];
      return { outcome: allow ? 'allow' : 'deny', reasons };
    } catch (e: any) {
      // Fail open unless explicitly configured otherwise
      return { outcome: 'allow', reasons: [`policy-error: ${e?.message || String(e)}`] };
    }
  }
}

