import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrum, base, mainnet, optimism, polygon } from "wagmi/chains";

export const config = getDefaultConfig({
	appName: "LiFi Zap Interface",
	projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID, // Get from https://cloud.walletconnect.com
	chains: [mainnet, polygon, optimism, arbitrum, base],
	ssr: false,
});
