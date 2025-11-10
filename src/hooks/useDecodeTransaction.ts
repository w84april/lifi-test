import { decodeFunctionData, type Hex } from "viem";

// Common LiFi contract ABIs
const LIFI_DIAMOND_ABI = [
  {
    "inputs": [
      {
        "components": [
          { "internalType": "bytes32", "name": "transactionId", "type": "bytes32" },
          { "internalType": "string", "name": "integrator", "type": "string" },
          { "internalType": "address", "name": "referrer", "type": "address" },
          { "internalType": "address", "name": "sendingAssetId", "type": "address" },
          { "internalType": "address", "name": "receiver", "type": "address" },
          { "internalType": "uint256", "name": "minAmount", "type": "uint256" },
          { "internalType": "uint256", "name": "destinationChainId", "type": "uint256" },
          { "internalType": "bool", "name": "hasSourceSwaps", "type": "bool" },
          { "internalType": "bool", "name": "hasDestinationCall", "type": "bool" }
        ],
        "internalType": "struct ILiFi.BridgeData",
        "name": "_bridgeData",
        "type": "tuple"
      },
      {
        "components": [
          { "internalType": "address", "name": "callTo", "type": "address" },
          { "internalType": "address", "name": "approveTo", "type": "address" },
          { "internalType": "address", "name": "sendingAssetId", "type": "address" },
          { "internalType": "address", "name": "receivingAssetId", "type": "address" },
          { "internalType": "uint256", "name": "fromAmount", "type": "uint256" },
          { "internalType": "bytes", "name": "callData", "type": "bytes" },
          { "internalType": "bool", "name": "requiresDeposit", "type": "bool" }
        ],
        "internalType": "struct LibSwap.SwapData[]",
        "name": "_swapData",
        "type": "tuple[]"
      }
    ],
    "name": "swapAndStartBridgeTokensViaBridge",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

export function useDecodeTransaction() {
  const decodeTransaction = (data: Hex, to: string) => {
    console.log("=== Transaction Decoder ===");
    console.log("To address:", to);
    console.log("Data:", data);
    
    try {
      // Try to decode as LiFi Diamond transaction
      const decoded = decodeFunctionData({
        abi: LIFI_DIAMOND_ABI,
        data: data,
      });
      
      console.log("Decoded function:", decoded.functionName);
      console.log("Decoded args:", decoded.args);
      
      if (decoded.args && decoded.args.length >= 2) {
        const bridgeData = decoded.args[0] as any;
        const swapData = decoded.args[1] as any;
        
        console.log("Bridge Data:", {
          transactionId: bridgeData.transactionId,
          integrator: bridgeData.integrator,
          receiver: bridgeData.receiver,
          sendingAssetId: bridgeData.sendingAssetId,
          hasDestinationCall: bridgeData.hasDestinationCall,
        });
        
        if (swapData && swapData.length > 0) {
          console.log("Swap Data:", swapData.map((swap: any) => ({
            callTo: swap.callTo,
            approveTo: swap.approveTo,
            sendingAssetId: swap.sendingAssetId,
            receivingAssetId: swap.receivingAssetId,
            fromAmount: swap.fromAmount,
            callDataLength: swap.callData?.length,
          })));
        }
      }
    } catch (err) {
      console.log("Could not decode as LiFi transaction");
      console.log("First 10 bytes (function selector):", data.slice(0, 10));
    }
    
    console.log("=== End Transaction Decoder ===");
  };
  
  return { decodeTransaction };
}