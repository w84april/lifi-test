import { createConfig } from "@lifi/sdk";
import { type FormEvent, useEffect, useState } from "react";
import "./Forms.css";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { useLifiWithdraw } from "../hooks/useLifiWithdraw";
import { useTokenApproval } from "../hooks/useTokenApproval";
import {
	useVaultTypeDetector,
	type VaultType,
} from "../hooks/useVaultTypeDetector";
import { parseUnits, TOKEN_DECIMALS } from "../utils/tokenHelpers";

interface FormData {
	fromChain: string;
	toChain: string;
	yearnVaultAddress: string;
	vaultUnderlyingAsset: string;
	toToken: string;
	toTokenAmount: string; // Amount of final token user wants to receive
	userAddress: string;
	withdrawMethod: "yearnV2" | "yearnV2NoRecipient" | "yearnV3";
}

const YearnWithdrawForm = () => {
	const [quote, setQuote] = useState<any>(null);
	const { address, isConnected } = useAccount();
	const { loading, executing, error, fetchWithdrawQuote, executeQuote } =
		useLifiWithdraw();
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
		yearnVaultAddress: "",
		vaultUnderlyingAsset: "",
		toToken: "",
		toTokenAmount: "",
		userAddress: address || "",
		withdrawMethod: "yearnV2",
	});

	const { detecting, detectVaultType } = useVaultTypeDetector(
		parseInt(formData.fromChain),
	);

	useEffect(() => {
		if (address) {
			setFormData((prev) => ({ ...prev, userAddress: address }));
		}
	}, [address]);

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
	) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setQuote(null);

		try {
			// Configure LiFi SDK
			createConfig({
				integrator: "yearn-withdraw-lifi-zap",
			});

			// Fetch withdrawal quote using our hook
			const contractCallsQuote = await fetchWithdrawQuote({
				fromChain: formData.fromChain,
				toChain: formData.toChain,
				yearnVaultAddress: formData.yearnVaultAddress,
				vaultUnderlyingAsset: formData.vaultUnderlyingAsset,
				toToken: formData.toToken,
				toTokenAmount: formData.toTokenAmount,
				withdrawMethod: formData.withdrawMethod,
			});

			// Store LiFi contract address from the quote
			const txData =
				contractCallsQuote?.transactionRequest ||
				(contractCallsQuote?.estimate as any)?.transactionRequest;
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
			<h2>Withdraw from Yearn via LiFi</h2>
			<p style={{ marginBottom: "20px", color: "#666", fontSize: "14px" }}>
				This will: Calculate required vault shares → Withdraw from vault → Swap to get exact output amount
			</p>
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
											withdrawMethod: vaultType as any,
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
					<label htmlFor="vaultUnderlyingAsset">Vault Underlying Asset</label>
					<input
						type="text"
						id="vaultUnderlyingAsset"
						name="vaultUnderlyingAsset"
						value={formData.vaultUnderlyingAsset}
						onChange={handleInputChange}
						placeholder="0x..."
						required
					/>
					<small style={{ color: "#666", display: "block", marginTop: "4px" }}>
						The underlying token that the vault holds (e.g., USDC, DAI, WETH)
					</small>
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
					<small style={{ color: "#666", display: "block", marginTop: "4px" }}>
						Token you want to receive after withdrawal and swap
					</small>
				</div>

				<div className="form-group">
					<label htmlFor="toTokenAmount">
						Final Token Amount to Receive
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
								id="toTokenAmount"
								name="toTokenAmount"
								value={formData.toTokenAmount}
								onChange={handleInputChange}
								placeholder="1000000000000000000"
								required
							/>
							<small
								style={{ color: "#666", display: "block", marginTop: "4px" }}
							>
								Exact amount of {formData.toToken ? 'output token' : 'token'} you want to receive (raw units)
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
										TOKEN_DECIMALS[formData.toToken.toLowerCase()] || 18;
									const rawAmount = parseUnits(e.target.value, decimals);
									setFormData((prev) => ({ ...prev, toTokenAmount: rawAmount }));
								}}
								placeholder="1.0"
								required
							/>
							<small
								style={{ color: "#666", display: "block", marginTop: "4px" }}
							>
								Human-readable amount of final token to receive
								{formData.toTokenAmount && ` = ${formData.toTokenAmount} raw`}
							</small>
						</>
					)}
				</div>

				<div className="form-group">
					<label htmlFor="withdrawMethod">Withdraw Method</label>
					<select
						id="withdrawMethod"
						name="withdrawMethod"
						value={formData.withdrawMethod}
						onChange={handleInputChange}
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
					<div
						style={{
							marginBottom: "15px",
							padding: "10px",
							background: "#f0f0f0",
							borderRadius: "4px",
						}}
					>
						<strong>Contract Calls:</strong>
						<ol style={{ margin: "10px 0", paddingLeft: "20px" }}>
							<li>Withdraw from Yearn vault (receive underlying assets)</li>
							<li>Approve underlying assets for swap</li>
							<li>Swap underlying assets to {formData.toToken || 'desired token'}</li>
						</ol>
					</div>
					{formData.yearnVaultAddress &&
						lifiContractAddress && (
							<button
								type="button"
								className="submit-button"
								onClick={async () => {
									try {
										// For withdrawals, we need to approve vault tokens (shares)
										const sharesToWithdraw = quote?.estimate?.fromAmount || "0";
										const result = await checkAndApproveIfNeeded(
											formData.yearnVaultAddress as Address, // Vault tokens
											address as Address,
											quote.estimate.approvalAddress,
											BigInt(sharesToWithdraw),
											parseInt(formData.fromChain),
										);

										if (!result.needed) {
											alert("Vault tokens already approved!");
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
								{approving ? "Approving..." : "Approve Vault Tokens"}
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

export default YearnWithdrawForm;