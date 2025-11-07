import {
	type ContractCallsQuoteRequest,
	getContractCallsQuote,
	getQuote,
	type QuoteRequest,
} from "@lifi/sdk";
import { sendTransaction, waitForTransactionReceipt } from "@wagmi/core";
import { toBigInt } from "ethers";
import { useState } from "react";
import { type Address, encodeFunctionData } from "viem";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { analyzeLifiTransaction } from "../utils/lifiDiagnostics";
import { config as wagmiConfig } from "../wagmi";
import { useContractCallsDebugger } from "./useContractCallsDebugger";
import { useDecodeTransaction } from "./useDecodeTransaction";
import { useLifiContractCallsAnalyzer } from "./useLifiContractCallsAnalyzer";

interface UseLifiQuoteParams {
	fromChain: string;
	toChain: string;
	fromToken: string;
	toToken: string;
	fromAmount: string;
	contractAddress: string;
	contractCallData?: string;
	stakingMethod?: string; // For custom staking methods
	depositMethod?: "yearnV2" | "yearnV2NoRecipient" | "yearnV3"; // Deposit method type
	stakingAddress?: string; // For staking after vault deposit
	stakingFlow?: boolean; // Flag to enable vault + staking flow
}

export function useLifiQuote() {
	const [loading, setLoading] = useState(false);
	const [executing, setExecuting] = useState(false);
	const [error, setError] = useState<string>("");
	const { address, chainId } = useAccount();
	const { data: walletClient } = useWalletClient();
	const { switchChainAsync } = useSwitchChain();
	const { decodeTransaction } = useDecodeTransaction();
	const { debugContractCalls, validateContractCalls } =
		useContractCallsDebugger();
	const { analyzeQuoteFailure, checkContractCallsSupport, validateAmounts } =
		useLifiContractCallsAnalyzer();
	const executor = "0xd9b2da9c45b118e4e93a004fb1452bcdb6cc0e88";
	const fetchQuote = async (params: UseLifiQuoteParams) => {
		console.log(params);
		if (!address) {
			throw new Error("Wallet not connected");
		}

		setLoading(true);
		setError("");

		try {
			// First get a regular quote to determine the minimum receive amount
			const initialQuote = await getQuote({
				fromAddress: address,
				fromChain: parseInt(params.fromChain),
				toChain: parseInt(params.toChain),
				fromToken: params.fromToken,
				toToken: params.toToken,
				fromAmount: params.fromAmount, // Use raw BigNumber value
			} as QuoteRequest);

			const minReceiveAmount = initialQuote.estimate.toAmountMin;

			// Prepare contract calls
			const contractCalls = [];

			// IMPORTANT: Order matters! Approve must come before deposit
			// Add approve call if not native token
			if (params.toToken !== "0x0000000000000000000000000000000000000000") {
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
					args: [params.contractAddress as Address, BigInt(minReceiveAmount)],
				});

				console.log("Approve call data:", {
					tokenContract: params.toToken,
					spender: params.contractAddress,
					amount: minReceiveAmount,
					data: approveCallData,
				});

				contractCalls.push({
					fromAmount: minReceiveAmount,
					fromTokenAddress: params.toToken, // The token contract where approve will be called
					toContractAddress: params.contractAddress, // The vault address that needs approval to spend tokens
					toContractCallData: approveCallData,
					toContractGasLimit: "150000", // Increased gas limit for approve
				});
			}

			// Add the main contract call (deposit/stake)
			let contractCallData: string;

			if (params.contractCallData) {
				// If custom call data is provided, update it with the correct amount
				if (params.stakingMethod) {
					// For staking methods, encode with just the amount
					const methodName = params.stakingMethod.split("(")[0];
					contractCallData = encodeFunctionData({
						abi: [
							{
								name: methodName,
								type: "function",
								inputs: [{ name: "amount", type: "uint256" }],
								outputs: [],
							},
						],
						functionName: methodName,
						args: [BigInt(minReceiveAmount)],
					});
				} else {
					// Use provided call data as-is
					contractCallData = params.contractCallData;
				}
			} else {
				// Default to deposit method based on type
				switch (params.depositMethod) {
					case "yearnV2NoRecipient":
						// Yearn V2 deposit without recipient: deposit(uint256)
						contractCallData = encodeFunctionData({
							abi: [
								{
									name: "deposit",
									type: "function",
									inputs: [{ name: "_amount", type: "uint256" }],
									outputs: [{ name: "", type: "uint256" }],
								},
							],
							functionName: "deposit",
							args: [BigInt(minReceiveAmount)],
						});
						break;
					case "yearnV3":
						// ERC-4626 compliant deposit: deposit(uint256 assets, address receiver)
						contractCallData = encodeFunctionData({
							abi: [
								{
									name: "deposit",
									type: "function",
									inputs: [
										{ name: "assets", type: "uint256" },
										{ name: "receiver", type: "address" },
									],
									outputs: [{ name: "shares", type: "uint256" }],
								},
							],
							functionName: "deposit",
							args: [BigInt(minReceiveAmount), executor as Address],
						});
						break;
					default:
						// Default to Yearn V2 with recipient: deposit(uint256 _amount, address _recipient)
						contractCallData = encodeFunctionData({
							abi: [
								{
									name: "deposit",
									type: "function",
									inputs: [
										{ name: "_amount", type: "uint256" },
										{ name: "_recipient", type: "address" },
									],
									outputs: [{ name: "", type: "uint256" }],
								},
							],
							functionName: "deposit",
							args: [BigInt(minReceiveAmount), executor as Address],
						});
				}
			}

			console.log("Contract call data:", {
				contractAddress: params.contractAddress,
				amount: minReceiveAmount,
				data: contractCallData,
				method: params.stakingMethod || "deposit",
			});

			contractCalls.push({
				fromAmount: minReceiveAmount,
				fromTokenAddress: params.toToken,
				toContractAddress: params.contractAddress,
				toContractCallData: contractCallData,
				toContractGasLimit: "500000", // Increased gas limit for deposit operations
			});

			// If staking flow is enabled, add approve and stake calls
			if (params.stakingFlow && params.stakingAddress) {
				console.log("Adding staking flow contract calls");

				// Calculate vault tokens using convertToShares
				let vaultTokenAmount: bigint;
				try {
					// Call convertToShares on the vault contract
					const { readContract } = await import("@wagmi/core");
					vaultTokenAmount = await readContract(wagmiConfig, {
						address: params.contractAddress as Address,
						abi: [
							{
								name: "convertToShares",
								type: "function",
								inputs: [{ name: "assets", type: "uint256" }],
								outputs: [{ name: "shares", type: "uint256" }],
							},
						],
						functionName: "convertToShares",
						args: [BigInt(minReceiveAmount)],
						chainId: parseInt(params.toChain) as 1 | 10 | 137 | 42161 | 8453,
					});
					console.log(
						`Converted ${minReceiveAmount} assets to ${vaultTokenAmount} shares`,
					);
				} catch (error) {
					console.warn(
						"Failed to call convertToShares, using 90% of deposit amount as fallback:",
						error,
					);
					// Fallback: assume 90% efficiency for safety
					vaultTokenAmount = (toBigInt(minReceiveAmount) * 9n) / 10n;
				}

				// 3. Approve vault tokens to staking contract
				const approveVaultTokensData = encodeFunctionData({
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
					args: [params.stakingAddress as Address, BigInt(vaultTokenAmount)],
				});

				contractCalls.push({
					fromAmount: vaultTokenAmount.toString(), //test
					fromTokenAddress: params.contractAddress, // Vault contract is the vault token
					toContractAddress: params.stakingAddress, // Approve on vault token contract
					toContractCallData: approveVaultTokensData,
					toContractGasLimit: "150000",
				});

				// 4. Deposit vault tokens into staking contract
				const stakingCallData = encodeFunctionData({
					abi: [
						{
							name: "deposit",
							type: "function",
							inputs: [
								{ name: "amount", type: "uint256" },
								{ name: "receiver", type: "address" },
							],
							outputs: [],
						},
					],
					functionName: "deposit",
					args: [BigInt(vaultTokenAmount), address as Address],
				});

				contractCalls.push({
					fromAmount: vaultTokenAmount.toString(),
					fromTokenAddress: params.contractAddress, // Vault token
					toContractAddress: params.stakingAddress, // Staking contract
					toContractCallData: stakingCallData,
					toContractGasLimit: "500000",
				});
			}

			console.log("Contract calls array:", contractCalls);
			console.log("Quote request params:", {
				fromAddress: address,
				fromChain: parseInt(params.fromChain),
				toChain: parseInt(params.toChain),
				fromToken: params.fromToken,
				toToken: params.toToken,
				toAmount: minReceiveAmount,
				contractCallsCount: contractCalls.length,
			});

			// Validate contract calls before sending
			const validationErrors = validateContractCalls({
				fromAddress: address,
				fromChain: parseInt(params.fromChain),
				toChain: parseInt(params.toChain),
				fromToken: params.fromToken,
				toToken: params.toToken,
				toAmount: minReceiveAmount,
				contractCalls,
			});

			// Get contract calls quote
			const contractCallsQuote = await getContractCallsQuote({
				fromAddress: address,
				fromChain: parseInt(params.fromChain),
				toChain: parseInt(params.toChain),
				fromToken: params.fromToken,
				toToken: params.toToken,
				fromAmount: params.fromAmount,
				// toAmount: minReceiveAmount,
				contractCalls,
			} as ContractCallsQuoteRequest);

			console.log("Contract calls quote response:", contractCallsQuote);
			console.log(
				"Transaction request:",
				contractCallsQuote?.transactionRequest ||
					contractCallsQuote?.estimate?.transactionRequest,
			);

			// Debug the quote structure
			debugContractCalls(contractCallsQuote);
			analyzeLifiTransaction(contractCallsQuote);

			// Analyze why contract calls might be skipped
			analyzeQuoteFailure(contractCallsQuote, params);
			checkContractCallsSupport(params.fromChain, params.toChain);
			validateAmounts(params, contractCallsQuote);

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
			// LiFi quotes have a transactionRequest property
			const txData =
				quote?.transactionRequest || quote?.estimate?.transactionRequest;

			if (!txData) {
				console.error("No transaction data found in quote:", quote);
				throw new Error("Invalid quote: missing transaction data");
			}

			console.log("Transaction data:", txData);
			console.log("Transaction target:", txData.to);
			console.log("Transaction calldata:", txData.data);
			console.log(
				"Original contract address:",
				quote?.contractCalls?.[0]?.toContractAddress ||
					quote?.contractCalls?.[1]?.toContractAddress,
			);

			// Decode the transaction to understand what it's doing
			if (txData.data) {
				decodeTransaction(txData.data as `0x${string}`, txData.to);
			}

			// Switch chain if needed
			const targetChainId = parseInt(
				txData.chainId || quote.fromChainId || quote.estimate?.fromChainId,
			);
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
		fetchQuote,
		executeQuote,
	};
}
