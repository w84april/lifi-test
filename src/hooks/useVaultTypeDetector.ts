import { usePublicClient } from "wagmi";
import { type Address, encodeFunctionData } from "viem";
import { useState, useCallback } from "react";

export type VaultType = 'yearnV2' | 'yearnV2NoRecipient' | 'yearnV3' | 'unknown';

// Function selectors for different deposit methods
const DEPOSIT_SELECTORS = {
  // deposit(uint256,address) - 0x6e553f65
  withRecipient: '0x6e553f65',
  // deposit(uint256) - 0xb6b55f25
  noRecipient: '0xb6b55f25',
};

// Minimal ABIs for checking contract methods
const depositWithRecipientABI = [{
  name: "deposit",
  type: "function",
  inputs: [
    { name: "_amount", type: "uint256" },
    { name: "_recipient", type: "address" },
  ],
  outputs: [{ name: "", type: "uint256" }],
}];

const depositNoRecipientABI = [{
  name: "deposit",
  type: "function",
  inputs: [{ name: "_amount", type: "uint256" }],
  outputs: [{ name: "", type: "uint256" }],
}];

const erc4626ABI = [{
  name: "asset",
  type: "function",
  inputs: [],
  outputs: [{ name: "", type: "address" }],
}];

export function useVaultTypeDetector(chainId?: number) {
  const publicClient = usePublicClient({ chainId });
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string>("");

  const detectVaultType = useCallback(async (vaultAddress: string): Promise<VaultType> => {
    if (!publicClient) {
      throw new Error("Public client not available");
    }

    setDetecting(true);
    setError("");

    try {
      const address = vaultAddress as Address;
      
      // Check if it's an ERC-4626 vault (has asset() function)
      try {
        const assetCall = encodeFunctionData({
          abi: erc4626ABI,
          functionName: "asset",
        });
        
        await publicClient.call({
          to: address,
          data: assetCall,
        });
        
        // If asset() exists, it's likely an ERC-4626 vault (Yearn V3)
        return 'yearnV3';
      } catch (e) {
        // Not ERC-4626, continue checking
      }

      // Check for deposit(uint256,address)
      try {
        const testCallWithRecipient = encodeFunctionData({
          abi: depositWithRecipientABI,
          functionName: "deposit",
          args: [BigInt(0), "0x0000000000000000000000000000000000000001" as Address],
        });
        
        await publicClient.call({
          to: address,
          data: testCallWithRecipient,
        });
        
        return 'yearnV2'; // Has deposit with recipient
      } catch (e) {
        // Doesn't have deposit with recipient
      }

      // Check for deposit(uint256)
      try {
        const testCallNoRecipient = encodeFunctionData({
          abi: depositNoRecipientABI,
          functionName: "deposit",
          args: [BigInt(0)],
        });
        
        await publicClient.call({
          to: address,
          data: testCallNoRecipient,
        });
        
        return 'yearnV2NoRecipient'; // Has deposit without recipient
      } catch (e) {
        // Doesn't have deposit without recipient
      }

      return 'unknown';
    } catch (err: any) {
      console.error("Error detecting vault type:", err);
      setError(err.message || "Failed to detect vault type");
      return 'unknown';
    } finally {
      setDetecting(false);
    }
  }, [publicClient]);

  return {
    detecting,
    error,
    detectVaultType,
  };
}