/// <reference types="vite/client" />

interface EthereumProvider {
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
  request<T = unknown>(args: { method: string; params?: unknown[] | object }): Promise<T>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

interface Window {
  ethereum?: EthereumProvider;
}
