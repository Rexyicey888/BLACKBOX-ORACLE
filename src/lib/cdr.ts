import { CDRClient, initWasm, uuidToLabel } from "@piplabs/cdr-sdk";
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  encodeAbiParameters,
  http,
  toHex,
  type Address,
  type Hash,
} from "viem";
import { blackBoxAccessConditionAbi, getBlackBoxConditionAddress } from "./blackboxAccess";

const RPC_URL = import.meta.env.VITE_STORY_RPC_URL ?? "https://aeneid.storyrpc.io";
const STORY_API_URL = import.meta.env.VITE_STORY_API_URL ?? "http://172.192.41.96:1317";

export const storyAeneid = defineChain({
  id: 1315,
  name: "Story Aeneid Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "IP",
    symbol: "IP",
  },
  rpcUrls: {
    default: {
      http: [RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "StoryScan",
      url: "https://aeneid.storyscan.io",
    },
  },
  testnet: true,
});

let wasmPromise: Promise<void> | null = null;

export function ensureCdrWasm() {
  wasmPromise ??= initWasm();
  return wasmPromise;
}

export function getPublicClient() {
  return createPublicClient({
    chain: storyAeneid,
    transport: http(RPC_URL),
  });
}

export function getReadOnlyCdrClient() {
  return new CDRClient({
    network: "testnet",
    publicClient: getPublicClient(),
    apiUrl: STORY_API_URL,
  });
}

function getInjectedWallet() {
  const ethereum = window.ethereum;
  if (!ethereum) {
    throw new Error("No browser wallet found. Install MetaMask or another EVM wallet.");
  }

  const providers = ethereum.providers ?? [ethereum];
  const metaMask = providers.find((provider) => provider.isMetaMask);
  const provider = metaMask ?? providers.find((candidate) => typeof candidate.request === "function");

  if (!provider) {
    throw new Error("No EVM wallet provider found. Disable non-EVM wallet extensions, refresh, and try again.");
  }

  return provider;
}

export async function connectWallet() {
  const wallet = getInjectedWallet();

  const accounts = await wallet.request<Address[]>({
    method: "eth_requestAccounts",
  });
  const account = accounts[0];
  if (!account) {
    throw new Error("Wallet did not return an account.");
  }

  await ensureAeneidNetwork(wallet);
  return account;
}

export async function ensureAeneidNetwork(wallet = getInjectedWallet()) {
  try {
    await wallet.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x523" }],
    });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? Number(error.code) : undefined;

    if (code !== 4902) {
      throw error;
    }

    await wallet.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0x523",
          chainName: storyAeneid.name,
          nativeCurrency: storyAeneid.nativeCurrency,
          rpcUrls: [RPC_URL],
          blockExplorerUrls: [storyAeneid.blockExplorers.default.url],
        },
      ],
    });
  }
}

export function getWalletCdrClient(account: Address) {
  const wallet = getInjectedWallet();

  const publicClient = getPublicClient();
  const walletClient = createWalletClient({
    account,
    chain: storyAeneid,
    transport: custom(wallet),
  });

  return new CDRClient({
    network: "testnet",
    publicClient,
    walletClient,
    apiUrl: STORY_API_URL,
  });
}

function getWalletClient(account: Address) {
  return createWalletClient({
    account,
    chain: storyAeneid,
    transport: custom(getInjectedWallet()),
  });
}

function encodeOwnerConditionData(owner: Address) {
  return encodeAbiParameters([{ type: "address" }], [owner]);
}

export async function getCdrFees() {
  const client = getReadOnlyCdrClient();
  const [allocate, write, read] = await Promise.all([
    client.observer.getAllocateFee(),
    client.observer.getWriteFee(),
    client.observer.getReadFee(),
  ]);
  return { allocate, write, read };
}

export async function sealOwnerOnlySecret(params: {
  account: Address;
  secret: string;
}) {
  await ensureCdrWasm();
  const client = getWalletCdrClient(params.account);
  const globalPubKey = await client.observer.getGlobalPubKey();

  const { uuid, txHash: allocateTx } = await client.uploader.allocate({
    updatable: false,
    writeConditionAddr: params.account,
    readConditionAddr: params.account,
    writeConditionData: "0x",
    readConditionData: "0x",
    skipConditionValidation: true,
  } as unknown as Parameters<typeof client.uploader.allocate>[0]);

  const ciphertext = await client.uploader.encryptDataKey({
    dataKey: new TextEncoder().encode(params.secret),
    globalPubKey,
    label: uuidToLabel(uuid),
  });

  const { txHash: writeTx } = await client.uploader.write({
    uuid,
    accessAuxData: "0x",
    encryptedData: toHex(ciphertext.raw),
  });

  return { uuid, allocateTx, writeTx };
}

export async function sealPaidSecret(params: {
  account: Address;
  secret: string;
  conditionContract?: Address;
}) {
  await ensureCdrWasm();
  const conditionContract = params.conditionContract ?? getBlackBoxConditionAddress();
  if (!conditionContract) {
    throw new Error("Paid access contract address is not configured.");
  }

  const client = getWalletCdrClient(params.account);
  const globalPubKey = await client.observer.getGlobalPubKey();
  const conditionData = encodeOwnerConditionData(params.account);

  const { uuid, txHash: allocateTx } = await client.uploader.allocate({
    updatable: false,
    writeConditionAddr: conditionContract,
    readConditionAddr: conditionContract,
    writeConditionData: conditionData,
    readConditionData: conditionData,
  });

  const ciphertext = await client.uploader.encryptDataKey({
    dataKey: new TextEncoder().encode(params.secret),
    globalPubKey,
    label: uuidToLabel(uuid),
  });

  const { txHash: writeTx } = await client.uploader.write({
    uuid,
    accessAuxData: "0x",
    encryptedData: toHex(ciphertext.raw),
  });

  return { uuid, allocateTx, writeTx, conditionContract };
}

export async function configurePaidListing(params: {
  account: Address;
  uuid: number;
  priceWei: bigint;
  conditionContract?: Address;
}) {
  await ensureAeneidNetwork();
  const conditionContract = params.conditionContract ?? getBlackBoxConditionAddress();
  if (!conditionContract) {
    throw new Error("Paid access contract address is not configured.");
  }

  const walletClient = getWalletClient(params.account);
  const publicClient = getPublicClient();
  const txHash = await walletClient.writeContract({
    address: conditionContract,
    abi: blackBoxAccessConditionAbi,
    functionName: "configureListing",
    args: [params.uuid, params.account, params.priceWei],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return { txHash, conditionContract };
}

export async function buyPaidAccess(params: {
  account: Address;
  uuid: number;
  priceWei: bigint;
  conditionContract?: Address;
}) {
  await ensureAeneidNetwork();
  const conditionContract = params.conditionContract ?? getBlackBoxConditionAddress();
  if (!conditionContract) {
    throw new Error("Paid access contract address is not configured.");
  }

  const walletClient = getWalletClient(params.account);
  const publicClient = getPublicClient();
  const txHash = await walletClient.writeContract({
    address: conditionContract,
    abi: blackBoxAccessConditionAbi,
    functionName: "buyAccess",
    args: [params.uuid],
    value: params.priceWei,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return { txHash };
}

export async function openOwnerOnlySecret(params: {
  account: Address;
  uuid: number;
}) {
  await ensureCdrWasm();
  const client = getWalletCdrClient(params.account);
  const { dataKey, txHash } = await client.consumer.accessCDR({
    uuid: params.uuid,
    accessAuxData: "0x",
    timeoutMs: 120_000,
  });

  return {
    secret: new TextDecoder().decode(dataKey),
    readTx: txHash as Hash,
  };
}

export async function openPaidSecret(params: {
  account: Address;
  uuid: number;
}) {
  return openOwnerOnlySecret(params);
}
