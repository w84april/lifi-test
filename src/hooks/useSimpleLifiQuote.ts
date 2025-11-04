import { getQuote, type QuoteRequest } from "@lifi/sdk";
import { sendTransaction, waitForTransactionReceipt } from "@wagmi/core";
import { useState } from "react";
import type { Address } from "viem";

import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { config as wagmiConfig } from "../wagmi";

interface UseSimpleLifiQuoteParams {
	fromChain: string;
	toChain: string;
	fromToken: string;
	toToken: string;
	fromAmount: string;
}

export function useSimpleLifiQuote() {
	const [loading, setLoading] = useState(false);
	const [executing, setExecuting] = useState(false);
	const [error, setError] = useState<string>("");
	const { address, chainId } = useAccount();
	const { data: walletClient } = useWalletClient();
	const { switchChainAsync } = useSwitchChain();

	const fetchSimpleQuote = async (params: UseSimpleLifiQuoteParams) => {
		if (!address) {
			throw new Error("Wallet not connected");
		}

		setLoading(true);
		setError("");

		try {
			// Get a simple bridge quote without contract calls
			const quote = await getQuote({
				fromAddress: address,
				fromChain: parseInt(params.fromChain),
				toChain: parseInt(params.toChain),
				fromToken: params.fromToken,
				toToken: params.toToken,
				fromAmount: params.fromAmount, // Use raw BigNumber value
			} as QuoteRequest);

			console.log("Simple quote response:", quote);
			return quote;
		} catch (err: any) {
			console.error("Quote error:", err);
			setError(err.message || "Failed to get quote");
			throw err;
		} finally {
			setLoading(false);
		}
	};

	const executeSimpleQuote = async (quote: any) => {
		if (!walletClient || !address || !chainId) {
			throw new Error("Wallet not connected");
		}

		setExecuting(true);
		setError("");

		try {
			// Extract the transaction data from the quote
			const txData =
				quote?.transactionRequest || quote?.estimate?.transactionRequest;

			if (!txData) {
				console.error("No transaction data found in quote:", quote);
				throw new Error("Invalid quote: missing transaction data");
			}

			console.log("Transaction data:", txData);

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
		fetchSimpleQuote,
		executeSimpleQuote,
	};
}
