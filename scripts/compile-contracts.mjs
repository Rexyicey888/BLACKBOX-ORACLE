import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const contractPath = path.resolve("contracts", "BlackBoxAccessCondition.sol");
const source = fs.readFileSync(contractPath, "utf8");

const input = {
  language: "Solidity",
  sources: {
    "BlackBoxAccessCondition.sol": {
      content: source,
    },
  },
  settings: {
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const messages = output.errors ?? [];

for (const message of messages) {
  const prefix = message.severity === "error" ? "ERROR" : "WARN";
  console.log(`${prefix}: ${message.formattedMessage}`);
}

if (messages.some((message) => message.severity === "error")) {
  process.exit(1);
}

const contract = output.contracts?.["BlackBoxAccessCondition.sol"]?.BlackBoxAccessCondition;

if (!contract?.abi || !contract?.evm?.bytecode?.object) {
  console.error("ERROR: BlackBoxAccessCondition artifact was not produced.");
  process.exit(1);
}

const artifactPath = path.resolve("artifacts", "BlackBoxAccessCondition.json");
fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(
  artifactPath,
  `${JSON.stringify(
    {
      contractName: "BlackBoxAccessCondition",
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`,
    },
    null,
    2,
  )}\n`,
);

console.log("BlackBoxAccessCondition compiled successfully.");
console.log(`ABI entries: ${contract.abi.length}`);
console.log(`Bytecode bytes: ${contract.evm.bytecode.object.length / 2}`);
console.log(`Artifact: ${artifactPath}`);
