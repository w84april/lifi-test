import { createConfig } from "@lifi/sdk";
import { type FormEvent, useEffect, useState } from "react";
import "./Forms.css";
import { useAccount } from "wagmi";
import { useLifiQuote } from "../hooks/useLifiQuote";

interface FormData {
	fromChain: string;
	toChain: string;
	fromToken: string;
	toToken: string;
	fromAmount: string;
	stakingContractAddress: string;
	userAddress: string;
	stakingMethodSignature: string;
}

const StakingDepositForm = () => {
	const [quote, setQuote] = useState<any>(null);
	const { address, isConnected } = useAccount();
	const { loading, executing, error, fetchQuote, executeQuote } = useLifiQuote();

	const [formData, setFormData] = useState<FormData>({
		fromChain: "1",
		toChain: "1",
		fromToken: "",
		toToken: "",
		fromAmount: "",
		stakingContractAddress: "",
		userAddress: address || "",
		stakingMethodSignature: "stake(uint256)",
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
				integrator: "staking-lifi-zap",
			});

			// Fetch quote using our hook
			const contractCallsQuote = await fetchQuote({
				fromChain: formData.fromChain,
				toChain: formData.toChain,
				fromToken: formData.fromToken,
				toToken: formData.toToken,
				fromAmount: formData.fromAmount,
				contractAddress: formData.stakingContractAddress,
				stakingMethod: formData.stakingMethodSignature,
				contractCallData: 'placeholder', // Will be properly encoded in the hook
			});

			setQuote(contractCallsQuote);
		} catch (err: any) {
			console.error("Failed to get quote:", err);
		}
	};

	const handleExecute = async () => {
		if (!quote) return;

		try {
			const result = await executeQuote(quote);
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
			<h2>Staking Contract Deposit via LiFi</h2>
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
							placeholder="1"
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
						placeholder="1000000000000000000"
						required
					/>
					<small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
						Enter amount in token's smallest unit
					</small>
				</div>

				<div className="form-group">
					<label htmlFor="stakingContractAddress">
						Staking Contract Address
					</label>
					<input
						type="text"
						id="stakingContractAddress"
						name="stakingContractAddress"
						value={formData.stakingContractAddress}
						onChange={handleInputChange}
						placeholder="0x..."
						required
					/>
				</div>

				<div className="form-group">
					<label htmlFor="stakingMethodSignature">
						Staking Method Signature
					</label>
					<input
						type="text"
						id="stakingMethodSignature"
						name="stakingMethodSignature"
						value={formData.stakingMethodSignature}
						onChange={handleInputChange}
						placeholder="stake(uint256)"
						required
					/>
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
					<button
						type="button"
						className="submit-button execute-button"
						onClick={handleExecute}
						disabled={executing}
					>
						{executing ? "Executing..." : "Sign Tx"}
					</button>
					<pre>{JSON.stringify(quote, null, 2)}</pre>
				</div>
			)}
		</div>
	);
};

export default StakingDepositForm;
