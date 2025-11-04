import { useState, useCallback } from "react";
import { type Address, parseEther, maxUint256 } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { readContract, writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { config as wagmiConfig } from "../wagmi";

const ERC20_ABI = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

export function useTokenApproval() {
  const [checking, setChecking] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string>("");

  const checkAllowance = useCallback(async (
    tokenAddress: Address,
    owner: Address,
    spender: Address,
    chainId?: number
  ): Promise<bigint> => {
    try {
      setChecking(true);
      setError("");

      const allowance = await readContract(wagmiConfig, {
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [owner, spender],
        chainId,
      });

      return allowance as bigint;
    } catch (err: any) {
      console.error("Error checking allowance:", err);
      setError(err.message || "Failed to check allowance");
      return BigInt(0);
    } finally {
      setChecking(false);
    }
  }, []);

  const approveToken = useCallback(async (
    tokenAddress: Address,
    spender: Address,
    amount: bigint,
    chainId?: number
  ): Promise<{ hash: string; success: boolean }> => {
    try {
      setApproving(true);
      setError("");

      console.log("Approving token:", {
        token: tokenAddress,
        spender,
        amount: amount.toString(),
        chainId,
      });

      const hash = await writeContract(wagmiConfig, {
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [spender, amount],
        chainId,
      });

      console.log("Approval transaction hash:", hash);

      // Wait for confirmation
      const receipt = await waitForTransactionReceipt(wagmiConfig, {
        hash,
        chainId,
      });

      console.log("Approval receipt:", receipt);

      return { 
        hash, 
        success: receipt.status === "success" 
      };
    } catch (err: any) {
      console.error("Error approving token:", err);
      setError(err.message || "Failed to approve token");
      throw err;
    } finally {
      setApproving(false);
    }
  }, []);

  const checkAndApproveIfNeeded = useCallback(async (
    tokenAddress: Address,
    owner: Address,
    spender: Address,
    requiredAmount: bigint,
    chainId?: number
  ): Promise<{ needed: boolean; hash?: string }> => {
    // Check current allowance
    const currentAllowance = await checkAllowance(tokenAddress, owner, spender, chainId);
    
    console.log("Current allowance:", currentAllowance.toString());
    console.log("Required amount:", requiredAmount.toString());
    
    // If allowance is sufficient, no approval needed
    if (currentAllowance >= requiredAmount) {
      console.log("Sufficient allowance, no approval needed");
      return { needed: false };
    }
    
    // Approve max uint256 for convenience
    console.log("Insufficient allowance, approving max amount");
    const { hash } = await approveToken(tokenAddress, spender, maxUint256, chainId);
    
    return { needed: true, hash };
  }, [checkAllowance, approveToken]);

  return {
    checking,
    approving,
    error,
    checkAllowance,
    approveToken,
    checkAndApproveIfNeeded,
  };
}