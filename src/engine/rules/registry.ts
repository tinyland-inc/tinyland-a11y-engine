



import type { CustomRule } from '../../types';

export interface RegistryOptions {
  wcag?: '2.1' | '2.2';
  level?: 'A' | 'AA' | 'AAA';
  customRules?: CustomRule[];
}

export class RuleRegistry {
  private rules: Map<string, CustomRule> = new Map();

  constructor(_options?: RegistryOptions) {}

  register(rule: CustomRule): void {
    this.rules.set(rule.id, rule);
  }

  unregister(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  getRule(ruleId: string): CustomRule | undefined {
    return this.rules.get(ruleId);
  }

  getActiveRules(): CustomRule[] {
    return Array.from(this.rules.values());
  }

  getAllRules(): CustomRule[] {
    return Array.from(this.rules.values());
  }
}
