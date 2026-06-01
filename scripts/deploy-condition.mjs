import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

function loadLocalEnv() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    process.env[key] ??= valueParts.join("=").trim();
  }
}

loadLocalEnv();

const rpcUrl = process.env.VITE_STORY_RPC_URL || "https://aeneid.storyrpc.io";
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
  console.error("Missing DEPLOYER_PRIVATE_KEY in .env.");
  console.error("Use a funded burner wallet. Do not paste the private key into chat.");
  process.exit(1);
}

const artifactPath = path.resolve("artifacts", "BlackBoxAccessCondition.json");
if (!fs.existsSync(artifactPath)) {
  console.error("Missing artifact. Run npm.cmd run compile:contracts first.");
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

const storyAeneid = {
  id: 1315,
  name: "Story Aeneid Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "IP",
    symbol: "IP",
  },
  rpcUrls: {
    default: {
      http: [rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "StoryScan",
      url: "https://aeneid.storyscan.io",
    },
  },
  testnet: true,
};

const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({
  chain: storyAeneid,
  transport: http(rpcUrl),
});
const walletClient = createWalletClient({
  account,
  chain: storyAeneid,
  transport: http(rpcUrl),
});

console.log(`Deploying from ${account.address} on Story Aeneid...`);

const hash = await walletClient.deployContract({
  abi: artifact.abi,
  account,
  bytecode: artifact.bytecode,
});

console.log(`Deploy tx: ${hash}`);
console.log("Waiting for receipt...");

const receipt = await publicClient.waitForTransactionReceipt({ hash });

if (!receipt.contractAddress) {
  console.error("Deployment transaction mined, but no contract address was returned.");
  process.exit(1);
}

console.log(`BlackBoxAccessCondition deployed: ${receipt.contractAddress}`);
console.log(`StoryScan: https://aeneid.storyscan.io/tx/${hash}`);
console.log("");
console.log("Add this to .env:");
console.log(`VITE_BLACKBOX_CONDITION_ADDRESS=${receipt.contractAddress}`);
