import { createConfig } from "@lifi/sdk";
import { type FormEvent, useEffect, useState } from "react";
import "./Forms.css";
import { useAccount } from "wagmi";
import { useSimpleLifiQuote } from "../hooks/useSimpleLifiQuote";
import { useTokenApproval } from "../hooks/useTokenApproval";
import { type Address, parseEther } from "viem";

interface FormData {
	fromChain: string;
	toChain: string;
	fromToken: string;
	toToken: string;
	fromAmount: string;
	userAddress: string;
}

const TestBridgeForm = () => {
	const [quote, setQuote] = useState<any>(null);
	const { address, isConnected } = useAccount();
	const { loading, executing, error, fetchSimpleQuote, executeSimpleQuote } = useSimpleLifiQuote();
	const { approving, checkAndApproveIfNeeded } = useTokenApproval();
	const [lifiContractAddress, setLifiContractAddress] = useState<string | null>(null);

	const [formData, setFormData] = useState<FormData>({
		fromChain: "1",
		toChain: "10",
		fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
		toToken: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // USDC on Optimism
		fromAmount: "10000000", // 10 USDC (6 decimals)
		userAddress: address || "",
	});

	useEffect(() => {
		if (address) {
			setFormData((prev) => ({ ...prev, userAddress: address }));
		}
	}, [address]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setQuote(null);

		try {
			// Configure LiFi SDK
			createConfig({
				integrator: "test-bridge-lifi",
			});

			// Fetch simple bridge quote
			const simpleQuote = await fetchSimpleQuote({
				fromChain: formData.fromChain,
				toChain: formData.toChain,
				fromToken: formData.fromToken,
				toToken: formData.toToken,
				fromAmount: formData.fromAmount,
			});

			// Store LiFi contract address from the quote
			const txData = simpleQuote?.transactionRequest || simpleQuote?.estimate?.transactionRequest;
			if (txData?.to) {
				setLifiContractAddress(txData.to);
			}

			setQuote(simpleQuote);
		} catch (err: any) {
			console.error("Failed to get quote:", err);
		}
	};

	const handleExecute = async () => {
		if (!quote) return;

		try {
			const result = await executeSimpleQuote(quote);
			if (result.status === 'DONE') {
				alert(`Transaction successful! Hash: ${result.hash}`);
				setQuote(null); // Clear quote after successful execution
			}
		} catch (err: any) {
			console.error("Failed to execute:", err);
		}
	};

	return (
		<div className="form-container">
			<h2>Test Simple Bridge via LiFi</h2>
			<form onSubmit={handleSubmit}>
				<div className="form-group">
					<label htmlFor="userAddress">User Address</label>
					<input
						type="text"
						id="userAddress"
						name="userAddress"
						value={formData.userAddress}
						onChange={handleInputChange}
						placeholder="0x..."
						required
						disabled={!!address}
					/>
				</div>

				<div className="form-row">
					<div className="form-group">
						<label htmlFor="fromChain">From Chain ID</label>
						<input
							type="text"
							id="fromChain"
							name="fromChain"
							value={formData.fromChain}
							onChange={handleInputChange}
							placeholder="1"
							required
						/>
					</div>
					<div className="form-group">
						<label htmlFor="toChain">To Chain ID</label>
						<input
							type="text"
							id="toChain"
							name="toChain"
							value={formData.toChain}
							onChange={handleInputChange}
							placeholder="10"
							required
						/>
					</div>
				</div>

				<div className="form-row">
					<div className="form-group">
						<label htmlFor="fromToken">From Token Address</label>
						<input
							type="text"
							id="fromToken"
							name="fromToken"
							value={formData.fromToken}
							onChange={handleInputChange}
							placeholder="0x..."
							required
						/>
					</div>
					<div className="form-group">
						<label htmlFor="toToken">To Token Address</label>
						<input
							type="text"
							id="toToken"
							name="toToken"
							value={formData.toToken}
							onChange={handleInputChange}
							placeholder="0x..."
							required
						/>
					</div>
				</div>

				<div className="form-group">
					<label htmlFor="fromAmount">Amount (in smallest unit)</label>
					<input
						type="text"
						id="fromAmount"
						name="fromAmount"
						value={formData.fromAmount}
						onChange={handleInputChange}
						placeholder="10000000"
						required
					/>
					<small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
						USDC has 6 decimals, so 10 USDC = 10000000
					</small>
				</div>

				<button
					type="submit"
					className="submit-button"
					disabled={loading || !isConnected}
				>
					{!isConnected
						? "Connect Wallet"
						: loading
							? "Getting Quote..."
							: "Get Quote"}
				</button>
			</form>

			{error && <div className="error-message">{error}</div>}

			{quote && (
				<div className="quote-result">
					<h3>Quote Result</h3>
					{formData.fromToken && formData.fromToken !== "0x0000000000000000000000000000000000000000" && lifiContractAddress && (
						<button
							type="button"
							className="submit-button"
							onClick={async () => {
								try {
									const amount = BigInt(formData.fromAmount);
									const result = await checkAndApproveIfNeeded(
										formData.fromToken as Address,
										address as Address,
										lifiContractAddress as Address,
										amount,
										parseInt(formData.fromChain)
									);
									
									if (!result.needed) {
										alert("Token already approved!");
									} else {
										alert(`Approval successful! Hash: ${result.hash}`);
									}
								} catch (err: any) {
									console.error("Approval failed:", err);
									alert(`Approval failed: ${err.message}`);
								}
							}}
							disabled={approving || !address}
							style={{ marginRight: '10px' }}
						>
							{approving ? "Approving..." : "Approve Token"}
						</button>
					)}
					<button
						type="button"
						className="submit-button execute-button"
						onClick={handleExecute}
						disabled={executing}
					>
						{executing ? "Executing..." : "Sign Tx"}
					</button>
					<details>
						<summary>Transaction Details</summary>
						<div>
							<h4>Transaction Request:</h4>
							<pre>{JSON.stringify(quote?.transactionRequest || quote?.estimate?.transactionRequest, null, 2)}</pre>
						</div>
					</details>
					<details>
						<summary>Full Quote Data</summary>
						<pre>{JSON.stringify(quote, null, 2)}</pre>
					</details>
				</div>
			)}
		</div>
	);
};

export default TestBridgeForm;