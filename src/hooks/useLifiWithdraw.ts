import {
	type ContractCallsQuoteRequest,
	getContractCallsQuote,
	getQuote,
	type QuoteRequest,
} from "@lifi/sdk";
import { sendTransaction, waitForTransactionReceipt } from "@wagmi/core";
import { useState } from "react";
import { type Address, encodeFunctionData } from "viem";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { analyzeLifiTransaction } from "../utils/lifiDiagnostics";
import { config as wagmiConfig } from "../wagmi";
import { useContractCallsDebugger } from "./useContractCallsDebugger";
import { useDecodeTransaction } from "./useDecodeTransaction";
import { useLifiContractCallsAnalyzer } from "./useLifiContractCallsAnalyzer";

interface UseLifiWithdrawParams {
	fromChain: string;
	toChain: string;
	yearnVaultAddress: string;
	vaultUnderlyingAsset: string;
	toToken: string;
	toTokenAmount: string; // Amount of final token user wants to receive
	withdrawMethod?: "yearnV2" | "yearnV2NoRecipient" | "yearnV3";
}

export function useLifiWithdraw() {
	const [loading, setLoading] = useState(false);
	const [executing, setExecuting] = useState(false);
	const [error, setError] = useState<string>("");
	const { address, chainId } = useAccount();
	const { data: walletClient } = useWalletClient();
	const { switchChainAsync } = useSwitchChain();
	const { decodeTransaction } = useDecodeTransaction();
	const { debugContractCalls } = useContractCallsDebugger();
	const { analyzeQuoteFailure, checkContractCallsSupport } =
		useLifiContractCallsAnalyzer();
	const executor = "0xd9b2da9c45b118e4e93a004fb1452bcdb6cc0e88";

	const fetchWithdrawQuote = async (params: UseLifiWithdrawParams) => {
		console.log("Withdraw params:", params);
		if (!address) {
			throw new Error("Wallet not connected");
		}

		setLoading(true);
		setError("");

		try {
			// Step 1: Get a reverse quote to find how much underlying asset we need
			// to get the desired amount of output token
			const reverseQuote = await getQuote({
				fromAddress: address,
				fromChain: parseInt(params.fromChain),
				toChain: parseInt(params.toChain),
				fromToken: params.vaultUnderlyingAsset,
				toToken: params.toToken,
				fromAmount: "0", // Dummy value, we'll use toAmount
				toAmount: params.toTokenAmount, // Desired output amount
			} as QuoteRequest);

			console.log(
				"Reverse quote to get required underlying amount:",
				reverseQuote,
			);

			// This tells us how much underlying asset we need
			const requiredUnderlyingAmount = reverseQuote.estimate.fromAmount;
			console.log(
				`Need ${requiredUnderlyingAmount} underlying assets to get ${params.toTokenAmount} output tokens`,
			);

			// Prepare contract calls for withdrawal
			const contractCalls = [];

			// Add the withdrawal call
			let withdrawCallData: string;

			switch (params.withdrawMethod) {
				case "yearnV2NoRecipient":
					// Yearn V2 withdraw without recipient: withdraw(uint256 _amount)
					// Takes assets amount, returns shares burned
					withdrawCallData = encodeFunctionData({
						abi: [
							{
								name: "withdraw",
								type: "function",
								inputs: [{ name: "_amount", type: "uint256" }],
								outputs: [{ name: "", type: "uint256" }],
							},
						],
						functionName: "withdraw",
						args: [BigInt(requiredUnderlyingAmount)],
					});
					break;
				case "yearnV3":
					// ERC-4626 compliant withdraw: withdraw(uint256 assets, address receiver, address owner)
					// Takes assets amount, returns shares burned
					withdrawCallData = encodeFunctionData({
						abi: [
							{
								name: "withdraw",
								type: "function",
								inputs: [
									{ name: "assets", type: "uint256" },
									{ name: "receiver", type: "address" },
									{ name: "owner", type: "address" },
								],
								outputs: [{ name: "shares", type: "uint256" }],
							},
						],
						functionName: "withdraw",
						args: [
							BigInt(requiredUnderlyingAmount),
							executor as Address,
							address as Address,
						],
					});
					break;
				default:
					// Default to Yearn V2 with recipient: withdraw(uint256 _amount, address _recipient)
					// Takes assets amount, returns shares burned
					withdrawCallData = encodeFunctionData({
						abi: [
							{
								name: "withdraw",
								type: "function",
								inputs: [
									{ name: "_amount", type: "uint256" },
									{ name: "_recipient", type: "address" },
								],
								outputs: [{ name: "", type: "uint256" }],
							},
						],
						functionName: "withdraw",
						args: [BigInt(requiredUnderlyingAmount), executor as Address],
					});
			}

			contractCalls.push({
				fromAmount: requiredUnderlyingAmount,
				fromTokenAddress: params.yearnVaultAddress, // Vault token (shares)
				toContractAddress: params.yearnVaultAddress, // Call withdraw on the vault
				toContractCallData: withdrawCallData, // Contains requiredUnderlyingAmount
				toContractGasLimit: "500000",
			});

			// After withdrawal, we need to approve the underlying assets for swapping
			// Get the LiFi approval address from the reverse quote
			const approvalAddress = reverseQuote.estimate.approvalAddress;

			if (
				params.vaultUnderlyingAsset !==
					"0x0000000000000000000000000000000000000000" &&
				approvalAddress
			) {
				const approveCallData = encodeFunctionData({
					abi: [
						{
							name: "approve",
							type: "function",
							inputs: [
								{ name: "spender", type: "address" },
								{ name: "amount", type: "uint256" },
							],
							outputs: [{ name: "", type: "bool" }],
						},
					],
					functionName: "approve",
					args: [approvalAddress as Address, BigInt(requiredUnderlyingAmount)],
				});

				console.log("Approve underlying asset for swap:", {
					tokenContract: params.vaultUnderlyingAsset,
					spender: approvalAddress,
					amount: requiredUnderlyingAmount,
				});

				contractCalls.push({
					fromAmount: requiredUnderlyingAmount,
					fromTokenAddress: params.vaultUnderlyingAsset, // The underlying asset contract
					toContractAddress: approvalAddress,
					toContractCallData: approveCallData,
					toContractGasLimit: "150000",
				});
			}

			// The withdrawal will give us underlying assets which will then be swapped by LiFi

			// Get contract calls quote with the desired output amount
			// The contract calls will withdraw shares to get underlying assets
			const contractCallsQuote = await getContractCallsQuote({
				fromAddress: address,
				fromChain: parseInt(params.fromChain),
				toChain: parseInt(params.toChain),
				fromToken: params.vaultUnderlyingAsset, // Start with underlying assets
				toToken: params.toToken, // Final token we want
				toAmount: params.toTokenAmount, // Specify desired output amount
				contractCalls,
			} as ContractCallsQuoteRequest);

			console.log("Contract calls quote response:", contractCallsQuote);
			console.log(
				"Transaction request:",
				contractCallsQuote?.transactionRequest ||
					(contractCallsQuote as any)?.estimate?.transactionRequest,
			);

			// Debug the quote structure
			debugContractCalls(contractCallsQuote);
			analyzeLifiTransaction(contractCallsQuote);

			// Analyze why contract calls might be skipped
			analyzeQuoteFailure(contractCallsQuote, params);
			checkContractCallsSupport(params.fromChain, params.toChain);

			return contractCallsQuote;
		} catch (err: any) {
			console.error("Quote error:", err);
			setError(err.message || "Failed to get quote");
			throw err;
		} finally {
			setLoading(false);
		}
	};

	const executeQuote = async (quote: any) => {
		if (!walletClient || !address || !chainId) {
			throw new Error("Wallet not connected");
		}

		setExecuting(true);
		setError("");

		try {
			// Extract the transaction data from the quote
			const txData = quote?.transactionRequest || (quote as any)?.transactionRequest || (quote as any)?.estimate?.transactionRequest;

			if (!txData) {
				console.error("No transaction data found in quote:", quote);
				throw new Error("Invalid quote: missing transaction data");
			}

			console.log("Transaction data:", txData);
			console.log("Transaction target:", txData.to);
			console.log("Transaction calldata:", txData.data);

			// Decode the transaction to understand what it's doing
			if (txData.data) {
				decodeTransaction(txData.data as `0x${string}`, txData.to);
			}

			// Switch chain if needed
			const targetChainId = parseInt(
				txData.chainId || quote.fromChainId || quote.estimate?.fromChainId,
			) as 1 | 10 | 137 | 42161 | 8453;
			if (chainId !== targetChainId) {
				console.log(`Switching from chain ${chainId} to ${targetChainId}`);
				await switchChainAsync({ chainId: targetChainId });
			}

			// Send the transaction
			const hash = await sendTransaction(wagmiConfig, {
				to: txData.to as Address,
				data: txData.data as `0x${string}`,
				value: txData.value ? BigInt(txData.value) : undefined,
				gas: txData.gasLimit ? BigInt(txData.gasLimit) : undefined,
				gasPrice: txData.gasPrice ? BigInt(txData.gasPrice) : undefined,
				chainId: targetChainId,
			});

			console.log("Transaction sent:", hash);

			// Wait for receipt
			const receipt = await waitForTransactionReceipt(wagmiConfig, {
				hash,
				timeout: 60000 * 15, // 15 minutes
			});

			console.log("Transaction receipt:", receipt);

			if (receipt.status === "success") {
				return { status: "DONE", hash, receipt };
			} else {
				throw new Error("Transaction failed");
			}
		} catch (err: any) {
			console.error("Execute error:", err);
			setError(err.message || "Failed to execute transaction");
			throw err;
		} finally {
			setExecuting(false);
		}
	};

	return {
		loading,
		executing,
		error,
		fetchWithdrawQuote,
		executeQuote,
	};
}
