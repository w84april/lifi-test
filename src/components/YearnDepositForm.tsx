import { createConfig } from "@lifi/sdk";
import { type FormEvent, useEffect, useState } from "react";
import "./Forms.css";
import { type Address, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useLifiQuote } from "../hooks/useLifiQuote";
import { useTokenApproval } from "../hooks/useTokenApproval";
import {
	useVaultTypeDetector,
	type VaultType,
} from "../hooks/useVaultTypeDetector";
import { formatUnits, parseUnits, TOKEN_DECIMALS } from "../utils/tokenHelpers";

interface FormData {
	fromChain: string;
	toChain: string;
	fromToken: string;
	toToken: string;
	fromAmount: string;
	yearnVaultAddress: string;
	userAddress: string;
	depositMethod: "yearnV2" | "yearnV2NoRecipient" | "yearnV3";
}

const YearnDepositForm = () => {
	const [quote, setQuote] = useState<any>(null);
	const { address, isConnected, chainId } = useAccount();
	const { loading, executing, error, fetchQuote, executeQuote } =
		useLifiQuote();
	const [detectedVaultType, setDetectedVaultType] = useState<VaultType | null>(
		null,
	);
	const { approving, checkAndApproveIfNeeded } = useTokenApproval();
	const [lifiContractAddress, setLifiContractAddress] = useState<string | null>(
		null,
	);
	const [useRawInput, setUseRawInput] = useState(true);
	const [humanAmount, setHumanAmount] = useState("");

	const [formData, setFormData] = useState<FormData>({
		fromChain: "1",
		toChain: "1",
		fromToken: "",
		toToken: "",
		fromAmount: "",
		yearnVaultAddress: "",
		userAddress: address || "",
		depositMethod: "yearnV2",
	});

	const {
		detecting,
		detectVaultType,
		error: detectError,
	} = useVaultTypeDetector(parseInt(formData.toChain));

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
				integrator: "yearn-lifi-zap",
			});

			// Fetch quote using our hook
			const contractCallsQuote = await fetchQuote({
				fromChain: formData.fromChain,
				toChain: formData.toChain,
				fromToken: formData.fromToken,
				toToken: formData.toToken,
				fromAmount: formData.fromAmount,
				contractAddress: formData.yearnVaultAddress,
				depositMethod: formData.depositMethod,
			});

			// Store LiFi contract address from the quote
			const txData =
				contractCallsQuote?.transactionRequest ||
				contractCallsQuote?.estimate?.transactionRequest;
			if (txData?.to) {
				setLifiContractAddress(txData.to);
			}

			setQuote(contractCallsQuote);
		} catch (err: any) {
			console.error("Failed to get quote:", err);
		}
	};

	const handleExecute = async () => {
		if (!quote) return;

		try {
			const result = await executeQuote(quote);
			if (result.status === "DONE") {
				alert(`Transaction successful! Hash: ${result.hash}`);
				setQuote(null); // Clear quote after successful execution
			}
		} catch (err: any) {
			console.error("Failed to execute:", err);
		}
	};

	return (
		<div className="form-container">
			<h2>Yearn Vault Deposit via LiFi</h2>
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
					<label htmlFor="fromAmount">
						Amount
						<button
							type="button"
							onClick={() => setUseRawInput(!useRawInput)}
							style={{
								marginLeft: "10px",
								padding: "2px 8px",
								fontSize: "12px",
								borderRadius: "4px",
								border: "1px solid #ccc",
								background: "#f5f5f5",
								cursor: "pointer",
							}}
						>
							{useRawInput ? "Switch to Human" : "Switch to Raw"}
						</button>
					</label>
					{useRawInput ? (
						<>
							<input
								type="text"
								id="fromAmount"
								name="fromAmount"
								value={formData.fromAmount}
								onChange={handleInputChange}
								placeholder="1000000000000000000"
								required
							/>
							<small
								style={{ color: "#666", display: "block", marginTop: "4px" }}
							>
								Enter amount in token's smallest unit (e.g., 1 ETH =
								1000000000000000000 wei)
							</small>
						</>
					) : (
						<>
							<input
								type="text"
								id="humanAmount"
								name="humanAmount"
								value={humanAmount}
								onChange={(e) => {
									setHumanAmount(e.target.value);
									// Auto-convert to raw amount
									const decimals =
										TOKEN_DECIMALS[formData.fromToken.toLowerCase()] || 18;
									const rawAmount = parseUnits(e.target.value, decimals);
									setFormData((prev) => ({ ...prev, fromAmount: rawAmount }));
								}}
								placeholder="1.0"
								required
							/>
							<small
								style={{ color: "#666", display: "block", marginTop: "4px" }}
							>
								Enter human-readable amount (e.g., 1.5 for 1.5 tokens)
								{formData.fromAmount && ` = ${formData.fromAmount} raw`}
							</small>
						</>
					)}
				</div>

				<div className="form-group">
					<label htmlFor="yearnVaultAddress">Yearn Vault Address</label>
					<div style={{ display: "flex", gap: "10px" }}>
						<input
							type="text"
							id="yearnVaultAddress"
							name="yearnVaultAddress"
							value={formData.yearnVaultAddress}
							onChange={handleInputChange}
							placeholder="0x..."
							required
							style={{ flex: 1 }}
						/>
						<button
							type="button"
							onClick={async () => {
								if (formData.yearnVaultAddress) {
									const vaultType = await detectVaultType(
										formData.yearnVaultAddress,
									);
									setDetectedVaultType(vaultType);
									if (vaultType !== "unknown") {
										setFormData((prev) => ({
											...prev,
											depositMethod: vaultType as any,
										}));
									}
								}
							}}
							disabled={detecting || !formData.yearnVaultAddress}
							style={{ padding: "10px 20px" }}
						>
							{detecting ? "Detecting..." : "Auto-detect"}
						</button>
					</div>
					{detectedVaultType && (
						<small
							style={{
								color: detectedVaultType === "unknown" ? "red" : "green",
							}}
						>
							{detectedVaultType === "unknown"
								? "Could not detect vault type"
								: `Detected: ${detectedVaultType}`}
						</small>
					)}
				</div>

				<div className="form-group">
					<label htmlFor="depositMethod">Deposit Method</label>
					<select
						id="depositMethod"
						name="depositMethod"
						value={formData.depositMethod}
						onChange={handleInputChange as any}
					>
						<option value="yearnV2">Yearn V2 (with recipient)</option>
						<option value="yearnV2NoRecipient">Yearn V2 (no recipient)</option>
						<option value="yearnV3">Yearn V3 (ERC-4626)</option>
					</select>
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
					{formData.fromToken &&
						formData.fromToken !==
							"0x0000000000000000000000000000000000000000" &&
						lifiContractAddress && (
							<button
								type="button"
								className="submit-button"
								onClick={async () => {
									try {
										const amount = BigInt(formData.fromAmount);
										const result = await checkAndApproveIfNeeded(
											formData.fromToken as Address,
											address as Address,
											quote.estimate.approvalAddress,
											amount,
											parseInt(formData.fromChain),
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
								style={{ marginRight: "10px" }}
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
							<pre>
								{JSON.stringify(
									quote?.transactionRequest ||
										quote?.estimate?.transactionRequest,
									null,
									2,
								)}
							</pre>
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

export default YearnDepositForm;
