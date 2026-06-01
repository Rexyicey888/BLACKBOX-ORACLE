import type { Abi } from "viem";
import artifact from "../../artifacts/BlackBoxAccessCondition.json";

export const blackBoxAccessConditionAbi = artifact.abi as Abi;

export function getBlackBoxConditionAddress() {
  const address = import.meta.env.VITE_BLACKBOX_CONDITION_ADDRESS as `0x${string}` | undefined;
  return address && /^0x[a-fA-F0-9]{40}$/.test(address) ? address : undefined;
}
