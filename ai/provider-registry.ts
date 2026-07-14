import type { AIProvider } from "./provider";

/**
 * AIProviderRegistry maps provider names to AIProvider implementations.
 *
 * This keeps agent classes decoupled from concrete provider imports.
 * Providers are resolved by name at execution time.
 */
export class AIProviderRegistry {
  private readonly providers = new Map<string, AIProvider>();

  /** Register a named provider. Names are case-sensitive. */
  register(name: string, provider: AIProvider): void {
    this.providers.set(name, provider);
  }

  /**
   * Resolve a provider by name.
   * Throws a descriptive error for unknown providers rather than returning undefined.
   */
  resolve(name: string): AIProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      const registered = Array.from(this.providers.keys()).join(", ") || "(none)";
      throw new Error(
        `Unknown AI provider: "${name}". Registered providers: ${registered}`,
      );
    }
    return provider;
  }

  /** Return true if the provider name is registered. */
  isRegistered(name: string): boolean {
    return this.providers.has(name);
  }

  /** Return the names of all registered providers. */
  listNames(): string[] {
    return Array.from(this.providers.keys());
  }
}

/** Global provider registry shared across the application. */
export const globalProviderRegistry = new AIProviderRegistry();
